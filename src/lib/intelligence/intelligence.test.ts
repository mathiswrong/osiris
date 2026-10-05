import { describe, it, expect } from "vitest";
import {
  earthquakes,
  hazards,
  point,
  rankDevelopments,
  webUrl,
} from "./normalize";
import { resultFor, transition } from "./store";
import { parseElements, predict, groundTrack } from "./satellites";
import { SOURCE_DEFINITIONS } from "./types";
const epoch = "2026-09-28T00:00:00.000000";
const omm = {
  OBJECT_NAME: "TEST OBJECT",
  OBJECT_ID: "2026-001A",
  NORAD_CAT_ID: 100001,
  EPOCH: epoch,
  MEAN_MOTION: 15.49,
  ECCENTRICITY: 0.0004,
  INCLINATION: 51.64,
  RA_OF_ASC_NODE: 100,
  ARG_OF_PERICENTER: 30,
  MEAN_ANOMALY: 50,
  EPHEMERIS_TYPE: 0 as const,
  ELEMENT_SET_NO: 999,
  BSTAR: 0.00002,
  MEAN_MOTION_DOT: 0.0001,
  MEAN_MOTION_DDOT: 0,
};
describe("provider truth contracts", () => {
  it("clears last-good rows after a successful empty response", () => {
    const before = transition(undefined, [{ id: 1 }], "2026-09-28T00:00:00Z");
    const after = transition(before, [], "2026-09-28T00:01:00Z");
    expect(after.current?.data).toEqual([]);
    expect(after.previous?.data).toEqual([{ id: 1 }]);
    expect(resultFor(SOURCE_DEFINITIONS[0], after).health.state).toBe(
      "healthy",
    );
  });
  it("preserves the original retrieval timestamp on failure", () => {
    const before = transition(undefined, [{ id: 1 }], "2026-09-28T00:00:00Z");
    const after = transition(
      before,
      new Error("Provider HTTP 503"),
      "2026-09-28T00:01:00Z",
    );
    expect(resultFor(SOURCE_DEFINITIONS[0], after)).toMatchObject({
      data: [{ id: 1 }],
      health: {
        state: "stale",
        fetchedAt: "2026-09-28T00:00:00Z",
        checkedAt: "2026-09-28T00:01:00Z",
      },
    });
    expect(
      resultFor(
        SOURCE_DEFINITIONS[0],
        transition(undefined, new Error("offline"), "2026-09-28T00:00:00Z"),
      ).health.state,
    ).toBe("unavailable");
  });
  it("accepts zero coordinates and rejects missing or nonfinite coordinates", () => {
    expect(point([0, 0])).toMatchObject({ lat: 0, lng: 0 });
    expect(point([Infinity, 4])).toBeUndefined();
    expect(point([null, 4])).toBeUndefined();
    expect(point([180, 91])).toBeUndefined();
  });
  it("does not manufacture dates or geometry for malformed earthquake records", () => {
    const good = {
      id: "abc",
      properties: {
        mag: 6,
        place: "Test",
        time: 1790553600000,
        updated: 1790553610000,
        sig: 700,
        url: "https://earthquake.usgs.gov/earthquakes/eventpage/abc",
      },
      geometry: { coordinates: [0, 0, 10] },
    };
    const normalized = earthquakes({
      features: [
        good,
        { ...good, id: "bad", geometry: { coordinates: [null, 1] } },
      ],
    });
    expect(normalized).toHaveLength(1);
    expect(normalized[0].occurredAt).toBe(
      new Date(1790553600000).toISOString(),
    );
    expect(normalized[0].priority).toBe(2);
    expect(() => earthquakes({ error: "rate limited" })).toThrow();
  });
  it("uses the latest valid EONET point, without invented severity", () => {
    const rows = hazards({
      events: [
        {
          id: "x",
          title: "Event",
          link: "https://eonet.gsfc.nasa.gov/api/v3/events/x",
          geometry: [
            { type: "Point", date: "2026-09-26", coordinates: [1, 2] },
            { type: "Point", date: "2026-09-27", coordinates: [3, 4] },
          ],
        },
      ],
    });
    expect(rows[0].location).toMatchObject({ lat: 4, lng: 3 });
    expect(rows[0].priority).toBe(0);
  });
  it("rejects active-content links", () => {
    expect(webUrl("javascript:alert(1)")).toBeNull();
    expect(webUrl("https://example.com/report")).toBe(
      "https://example.com/report",
    );
  });
  it("sorts measured significance before ordinary reports", () => {
    const base = {
      id: "x",
      sourceId: "x",
      source: "x",
      title: "x",
      url: "https://example.com",
      occurredAt: "2026-09-28",
      kind: "report" as const,
      reason: "",
      summary: "",
    };
    expect(
      rankDevelopments([
        { ...base, id: "report", priority: 0 },
        { ...base, id: "alert", occurredAt: "2026-09-27", priority: 2 },
      ])[0].id,
    ).toBe("alert");
  });
});
describe("modern orbital catalogue", () => {
  it("retains six-digit catalogue IDs and deduplicates by full ID", () => {
    expect(
      parseElements([omm, { ...omm }, { ...omm, NORAD_CAT_ID: 100002 }]).map(
        (x) => x.NORAD_CAT_ID,
      ),
    ).toEqual([100001, 100002]);
  });
  it("rejects malformed elements rather than supplying fallback coordinates", () => {
    expect(() => parseElements([{ ...omm, ECCENTRICITY: 2 }])).toThrow();
    expect(
      predict({ ...omm, MEAN_MOTION: 0 }, new Date("2026-09-28T00:00:00Z")),
    ).toBeNull();
  });
  it("exposes the epoch and predicts finite orbital positions without dateline stripes", () => {
    const when = new Date("2026-09-28T01:00:00Z");
    const p = predict(omm, when)!;
    expect(p.id).toBe("100001");
    expect(p.elementAgeHours).toBe(1);
    expect(p.altKm).toBeGreaterThan(80);
    const track = groundTrack(omm, when);
    expect(track.length).toBeGreaterThan(0);
    for (const run of track)
      for (let i = 1; i < run.length; i++)
        expect(Math.abs(run[i][0] - run[i - 1][0])).toBeLessThanOrEqual(180);
  });
});
