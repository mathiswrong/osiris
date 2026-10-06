import { describe, expect, it, vi } from "vitest";
import { countryName } from "../countryCentroids";
import { buildRegionalHubs, countryCatalog, emptyRegionalHub, regionId, regionalBrief, publicChannelWatches } from "./regional-hubs";
import type { Flashpoint, FlashpointResult } from "./flashpoints";
import { matchesWatchFilter, watchTags, watchAttention } from "./flashpoints";
import type { Development } from "./types";

const at = "2026-09-29T12:00:00.000Z";
function report(id: string, title: string, source = "A"): Development {
  return { id, sourceId: source, source, title, url: `https://example.org/${id}`, occurredAt: at,
    kind: "report", reason: "Publisher report", priority: 0, summary: "Attributed reporting" };
}
function result(rows: Development[]): FlashpointResult {
  const watch: Flashpoint = { id: "flash:UA:Conflict", title: rows[0].title, region: "Ukraine",
    topic: "Conflict & security", state: "multi-source watch", reasons: [], reports: rows,
    count: rows.length, publishers: 2, firstSeen: at, latestAt: at, recentCount: rows.length, baselineCount: 0 };
  return { data: [watch], generatedAt: at, baselineReady: false, baselineHours: 0,
    baselineNote: "", comparableSources: 0, healthySources: 2, excludedSources: [], persistent: true, unlocatedReports: 0 };
}

describe("regional event candidates", () => {
  it("keeps public regional URLs stable when browser country names differ", () => {
    const browserNames = vi.spyOn(Intl.DisplayNames.prototype, "of").mockReturnValue("Browser country name");
    try {
      expect(["PS", "HK", "MO"].map((code) => regionId(countryName(code)))).toEqual([
        "palestinian-territories", "hong-kong-sar-china", "macao-sar-china",
      ]);
    } finally { browserNames.mockRestore(); }
  });
  it("maps report volume to an attention scale without inventing severity or verification", () => {
    const watch = result([report("a", "Reporting from Ukraine")]).data[0];
    expect([1, 3, 4, 9, 10, 100].map((count) => watchAttention({ ...watch, count }).level)).toEqual(["low", "low", "active", "active", "high", "high"]);
    expect(watchAttention({ ...watch, count: 1, state: "emerging" }).label).toBe("Reporting surge");
    expect(watchAttention({ ...watch, count: 1, state: "measured alert" }).label).toBe("Measured alert");
    const high = { ...watch, count: 100, state: "single-source lead" as const };
    expect(watchTags(high, Date.parse(at))).toEqual(["early"]);
    expect(watchAttention(high).color).not.toBe(watchAttention(high, "night").color);
  });
  it("frames large countries across the antimeridian without expanding to the whole world", () => {
    const bounds = countryCatalog.find((country) => country.code === "RU")!.bounds!;
    expect(bounds[0]).toBeLessThan(30);
    expect(bounds[2]).toBeGreaterThan(180);
    expect(bounds[2] - bounds[0]).toBeLessThan(180);
    expect(bounds[3] - bounds[1]).toBeGreaterThan(35);
  });
  it("groups closely matching headlines but keeps different incidents separate", () => {
    const hubs = buildRegionalHubs(result([
      report("a", "Drone attack damages power station near Kyiv", "A"),
      report("b", "Drone attack damages power station near Kyiv overnight", "B"),
      report("c", "Drone attack damages railway bridge near Odesa", "C"),
    ]));
    expect(hubs).toHaveLength(1);
    expect(hubs[0].events).toHaveLength(2);
    expect(hubs[0].events[0].reports.map((row) => row.id)).toEqual(["a", "b"]);
    expect(hubs[0].events[0].grouping).toBe("matching headlines");
    expect(hubs[0].events[1].reports.map((row) => row.id)).toEqual(["c"]);
  });

  it("honors a manual separation and keeps the brief tied to evidence", () => {
    const hub = buildRegionalHubs(result([
      report("a", "Drone attack damages power station near Kyiv", "A"),
      report("b", "Drone attack damages power station near Kyiv overnight", "B"),
    ]), new Set(["b"]))[0];
    expect(hub.events).toHaveLength(2);
    expect(regionalBrief(hub, Date.parse(at))[0]).toContain("2 headline groups mentioning Ukraine");
    expect(regionId("Strait of Hormuz")).toBe("strait-of-hormuz");
    expect(emptyRegionalHub("canada")?.center).toBeDefined();
    expect(emptyRegionalHub("strait-of-hormuz")?.center).toEqual({ lat: 26.6, lng: 56.5 });
  });

  it("filters actual watch states without treating publisher agreement as verification", () => {
    const watch = result([report("a", "Reporting from Ukraine")]).data[0];
    const now = Date.parse(at);
    expect(matchesWatchFilter(watch, "multiple", now)).toBe(true);
    expect(matchesWatchFilter(watch, "verified", now)).toBe(false);
    expect(watchTags({ ...watch, state: "single-source lead" }, now)).toEqual(["early"]);
    expect(watchTags({ ...watch, state: "emerging" }, now)).toEqual(["emerging"]);
    const ongoing = { ...watch, firstSeen: new Date(now - 24 * 3_600_000).toISOString() };
    expect(matchesWatchFilter(ongoing, "long-term", now)).toBe(true);
    expect(matchesWatchFilter(ongoing, "long-term", now - 1)).toBe(false);
    const measured = { ...watch, id: "flash:usgs:quake", region: "Measured earthquake", state: "measured alert" as const, location: { lat: 12, lng: 34, precision: "provider observation" as const } };
    expect(matchesWatchFilter(measured, "verified", now)).toBe(true);
    const hub = buildRegionalHubs({ ...result(watch.reports), data: [measured] })[0];
    expect(hub.id).toBe("observed-flash-usgs-quake");
    expect(hub.center).toEqual(measured.location);
    expect(buildRegionalHubs({ ...result(watch.reports), data: [{ ...watch, region: "Location unresolved" }] })).toEqual([]);
  });
  it("places recent public Telegram leads in their named region and keeps them unverified", () => {
    const rows = publicChannelWatches({ timestamp: at, sources: [], news: [{ id: "post", title: "Ukraine ceasefire negotiations continue", source: "t.me/channel-a", source_name: "Channel A", link: "https://t.me/channel-a/1", published: at, alert_kind: "report", place: null, coords_anchor: null, also_reported_by: [
      { source: "t.me/channel-b", source_name: "Channel B", link: "https://t.me/channel-b/2", published: at },
    ] }] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ region: "Ukraine", publishers: 2, count: 2, state: "single-source lead", location: { precision: "country context" } });
    expect(matchesWatchFilter(rows[0], "verified", Date.parse(at))).toBe(false);
    expect(publicChannelWatches(null)).toEqual([]);
  });
});
