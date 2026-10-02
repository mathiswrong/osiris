import { describe, expect, it } from "vitest";
import { buildRegionalHubs, emptyRegionalHub, regionId, regionalBrief } from "./regional-hubs";
import type { Flashpoint, FlashpointResult } from "./flashpoints";
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
});
