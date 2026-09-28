import { describe, it, expect } from "vitest";
import { missionFor } from "./profiles";
import { youtubeLive } from "./broadcasts";
import {
  advanceJournal,
  detectFlashpoints,
  reportGroups,
  uniqueReports,
  type Journal,
} from "./flashpoints";
import type { Development, SourceResult } from "./types";
const now = Date.parse("2026-09-28T12:00:00Z"),
  hour = 3_600_000;
function report(
  id: string,
  title: string,
  sourceId = "a",
  hours = 1,
): Development {
  return {
    id,
    sourceId,
    source: sourceId,
    title,
    url: `https://${sourceId}.example/${id}`,
    occurredAt: new Date(now - hours * hour).toISOString(),
    kind: "report",
    priority: 0,
    reason: "Publisher report",
    summary: "Attributed report",
  };
}
function result(
  id: string,
  data: Development[] = [],
  state: "healthy" | "stale" = "healthy",
): SourceResult {
  return {
    data,
    health: {
      id,
      name: id,
      url: `https://${id}.example/`,
      state,
      fetchedAt: new Date(now).toISOString(),
      checkedAt: new Date(now).toISOString(),
      nextCheckAt: new Date(now + 300000).toISOString(),
      count: data.length,
      error: state === "stale" ? "offline" : null,
      coverage: "test",
      refreshMs: 300000,
    },
  };
}
const rows = [
  report("1", "Iran missile attack damages coastal port", "a"),
  report("2", "Iran troops move towards border amid ceasefire dispute", "b"),
  report("3", "Iran airstrikes prompt emergency diplomacy in capital", "c"),
  report("4", "Iran rebels abandon talks after hostage negotiations fail", "a"),
];
const results = ["a", "b", "c"].map((id) =>
  result(
    id,
    rows.filter((r) => r.sourceId === id),
  ),
);
function mature(): Journal {
  return {
    version: 1,
    records: rows.map((r) => ({
      ...r,
      firstSeen: new Date(now - hour).toISOString(),
    })),
    samples: Array.from({ length: 145 }, (_, i) => ({
      at: now - 24 * hour + i * 10 * 60_000,
      healthy: ["a", "b", "c"],
    })),
  };
}
describe("mission evidence scope", () => {
  it("does not turn a constellation customer into an individual satellite contract", () => {
    const p = missionFor({ id: "100001", name: "STARLINK-90001" })!;
    expect(p.scope).toBe("Constellation");
    expect(p.customers[0].scope).toContain("not this individual");
    expect(p.customers[0].source.url).toContain("united.mediaroom.com");
  });
  it("matches individually documented spacecraft by stable catalogue ID", () => {
    expect(missionFor({ id: "49332", name: "renamed" })?.name).toBe("SES-17");
    expect(missionFor({ id: "49260", name: "LANDSAT 9" })?.scope).toBe(
      "Spacecraft",
    );
  });
  it("distinguishes real catalogue families and similarly named spacecraft", () => {
    expect(missionFor({ id: "49292", name: "ONEWEB-0366" })?.key).toBe(
      "oneweb",
    );
    expect(missionFor({ id: "49292", name: "ONEWEB-0366" })?.scope).toBe(
      "Constellation",
    );
    expect(
      missionFor({ id: "24876", name: "NAVSTAR 43 (USA 132)" })?.purpose,
    ).toBe("Navigation");
    expect(
      missionFor({ id: "40128", name: "GSAT0201 (GALILEO 5)" })?.name,
    ).toBe("Galileo");
    expect(missionFor({ id: "37605", name: "GSAT-8" })).toBeNull();
  });
  it("leaves unknowns unknown and rejects misleading family substrings", () => {
    for (const name of [
      "USA 999",
      "COSMOS 123",
      "STARLINK-123 DEB",
      "NOT STARLINK-123",
    ])
      expect(missionFor({ id: "999999", name })).toBeNull();
  });
});
describe("flashpoint evidence controls", () => {
  it("keeps unrelated unlocated reports separate instead of manufacturing a multi-source event", () => {
    const rs = [
      result("a", [report("x", "Rebels threaten peace negotiations", "a")]),
      result("b", [report("y", "Armed clashes close border crossing", "b")]),
    ];
    const f = detectFlashpoints(advanceJournal(undefined, rs, now), rs, now);
    expect(f.data).toHaveLength(2);
    expect(
      f.data.every((x) => x.state === "single-source lead" && !x.location),
    ).toBe(true);
  });
  it("does not promote sports reporting into a conflict incident", () => {
    expect(
      reportGroups(
        report("a", "Gaza football players hope for World Cup after war"),
      ),
    ).toEqual([]);
  });
  it("does not classify flood deaths as conflict", () => {
    expect(
      reportGroups(report("a", "14 killed as Nepal is hit by floods"))[0].topic,
    ).toBe("Disaster & health");
  });
  it("recognizes global regions without manufacturing a precise incident point", () => {
    const groups = reportGroups(
      report("a", "UK protesters demand ceasefire in Sudan"),
    );
    expect(groups.map((x) => x.region)).toContain("United Kingdom");
    expect(groups.map((x) => x.region)).toContain("Sudan");
    expect(
      groups.every((x) => x.location?.precision === "country context"),
    ).toBe(true);
  });
  it("distinguishes the pronoun us from the country abbreviation US", () => {
    expect(
      reportGroups(report("a", "Iran warns us about war")).some(
        (g) => g.region === "United States",
      ),
    ).toBe(false);
    expect(
      reportGroups(report("a", "US troops prepare for deployment")).some(
        (g) => g.region === "United States",
      ),
    ).toBe(true);
  });
  it("keeps South Sudan distinct from Sudan and preserves unresolved reports", () => {
    expect(
      reportGroups(report("a", "South Sudan ceasefire talks")),
    ).toHaveLength(1);
    expect(
      reportGroups(report("a", "Rebels announce ceasefire"))[0].location,
    ).toBeUndefined();
  });
  it("counts syndicated or repeated headlines once", () => {
    const r = report("a", "Iran missile attack damages coastal port");
    expect(
      uniqueReports([
        r,
        {
          ...r,
          id: "b",
          sourceId: "b",
          url: "https://b.example/x",
          title: "Iran missile attack damages coastal port!",
        },
      ]),
    ).toHaveLength(1);
  });
  it("preserves first-seen time and does not double-count repeated polls", () => {
    const first = advanceJournal(undefined, results, now);
    const second = advanceJournal(first, results, now + 60000);
    expect(second.records).toHaveLength(rows.length);
    expect(second.records[0].firstSeen).toBe(first.records[0].firstSeen);
  });
  it("never labels a cold start emerging", () => {
    const f = detectFlashpoints(
      advanceJournal(undefined, results, now),
      results,
      now,
    );
    expect(f.baselineReady).toBe(false);
    expect(f.data.every((r) => r.state !== "emerging")).toBe(true);
  });
  it("detects a qualifying burst after continuous baseline collection", () => {
    const f = detectFlashpoints(mature(), results, now);
    expect(f.baselineReady).toBe(true);
    expect(f.data.find((f) => f.region === "Iran")?.state).toBe("emerging");
  });
  it("suppresses surge detection across collection gaps or provider coverage changes", () => {
    const j = mature();
    j.samples = j.samples.filter(
      (s) => s.at < now - 10 * hour || s.at > now - 8 * hour,
    );
    expect(detectFlashpoints(j, results, now).baselineReady).toBe(false);
    const changed = mature();
    changed.samples[40].healthy = ["a"];
    expect(detectFlashpoints(changed, results, now).baselineReady).toBe(false);
  });
  it("excludes stale sources and future reports from alerts", () => {
    const j = mature();
    j.records.push({
      ...report("future", "Iran nuclear weapons launched", "a", -1),
      firstSeen: new Date(now).toISOString(),
    });
    const f = detectFlashpoints(
      j,
      [results[0], result("b", [], "stale"), results[2]],
      now,
    );
    expect(f.excludedSources).toContain("b");
    expect(
      f.data
        .flatMap((f) => f.reports)
        .some((r) => r.sourceId === "b" || r.id === "future"),
    ).toBe(false);
  });
  it("retains ongoing watches with evidence older than six hours", () => {
    const r = report("old", "Ukraine ceasefire talks continue", "a", 8);
    const rs = [result("a", [r])];
    const f = detectFlashpoints(advanceJournal(undefined, rs, now), rs, now);
    expect(f.data[0].region).toBe("Ukraine");
    expect(f.data[0].recentCount).toBe(0);
  });
});
describe("official live broadcast resolution", () => {
  const payload = {
    videoDetails: {
      videoId: "Abcdef123_-",
      channelId: "official",
      isLive: true,
      title: "Live",
    },
    playabilityStatus: { status: "OK", playableInEmbed: true },
    microformat: { microformatDataRenderer: {} },
  };
  const html = (p: unknown) =>
    `<script>var ytInitialPlayerResponse = ${JSON.stringify(p)};</script>`;
  it("uses a current video ID from the expected channel, including channel-page metadata", () => {
    expect(youtubeLive(html(payload), "official").url).toBe("Abcdef123_-");
  });
  it("rejects wrong channels, archived live streams and blocked embeds", () => {
    expect(() => youtubeLive(html(payload), "someone-else")).toThrow();
    expect(() =>
      youtubeLive(
        html({
          ...payload,
          videoDetails: {
            ...payload.videoDetails,
            isLive: false,
            isLiveContent: true,
          },
        }),
        "official",
      ),
    ).toThrow();
    expect(() =>
      youtubeLive(
        html({
          ...payload,
          playabilityStatus: { status: "OK", playableInEmbed: false },
        }),
        "official",
      ),
    ).toThrow();
  });
  it("honors explicit offline and upcoming signals", () => {
    expect(() =>
      youtubeLive(
        html({
          ...payload,
          microformat: {
            playerMicroformatRenderer: {
              liveBroadcastDetails: { isLiveNow: false },
            },
          },
        }),
        "official",
      ),
    ).toThrow();
    expect(() =>
      youtubeLive(
        html({
          ...payload,
          videoDetails: { ...payload.videoDetails, isUpcoming: true },
        }),
        "official",
      ),
    ).toThrow();
  });
});

describe("headline noise exclusions", () => {
  it("does not turn trade negotiations or an individual criminal case into a conflict watch", () => {
    expect(
      reportGroups(
        report(
          "crime",
          "Canberra man accused of attack on young boys given strict bail",
        ),
      ),
    ).toEqual([]);
    expect(
      reportGroups(
        report(
          "trade",
          "China says US trade truce extension creates space to advance talks",
        ),
      ),
    ).toEqual([]);
    expect(
      reportGroups(report("war", "Iran missile attack damages coastal port")),
    ).not.toEqual([]);
  });
});
