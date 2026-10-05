import { describe, expect, it } from "vitest";
import {
  aircraftContacts,
  distanceKm,
  regionBoxes,
  vesselContact,
} from "./traffic";
import { orbitalVector, satelliteCategory } from "./orbital-view";
const time = "2026-09-28T00:00:00Z",
  now = Date.parse(time);
const aircraft = {
  hex: "abcdef",
  flight: "TEST12 ",
  lat: 26.1,
  lon: 56.4,
  seen_pos: 4,
  alt_baro: 32000,
  gs: 410,
  dbFlags: 1,
};
describe("regional traffic evidence", () => {
  it("keeps reported position time, units and provider military flags", () => {
    const [c] = aircraftContacts({ now, ac: [aircraft] }, time);
    expect(c).toMatchObject({
      name: "TEST12",
      observedAt: "2026-09-27T23:59:56.000Z",
      military: true,
      altitudeFt: 32000,
      speedKnots: 410,
    });
    expect(c.classification).toContain("mission unknown");
  });
  it("does not infer military ownership from a callsign or airframe name", () => {
    expect(
      aircraftContacts(
        { now, ac: [{ ...aircraft, dbFlags: 0, flight: "RCH001", t: "C17" }] },
        time,
      )[0].military,
    ).toBe(false);
  });
  it("rejects stale, missing-age and invalid positions but preserves genuine empty responses", () => {
    expect(
      aircraftContacts(
        {
          now,
          ac: [
            { ...aircraft, seen_pos: 301 },
            { ...aircraft, seen_pos: undefined },
            { ...aircraft, lat: 91 },
          ],
        },
        time,
      ),
    ).toEqual([]);
    expect(aircraftContacts({ now, ac: [] }, time)).toEqual([]);
    expect(() => aircraftContacts({ ac: [] }, time)).toThrow();
    expect(() =>
      aircraftContacts({ now: now - 600000, ac: [aircraft] }, time),
    ).toThrow(/out of date/);
  });
  it("splits maritime search boxes at the antimeridian", () => {
    const boxes = regionBoxes(10, 179.8, 463);
    expect(boxes).toHaveLength(2);
    for (const box of boxes)
      for (const [lat, lng] of box) {
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(lng)).toBeLessThanOrEqual(180);
      }
    expect(regionBoxes(90, 0, 463)).toHaveLength(1);
  });
  it("uses geodesic distance across the date line", () => {
    expect(
      distanceKm({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 }),
    ).toBeCloseTo(22.239, 2);
  });
  it("does not treat static AIS metadata as a new position", () => {
    expect(
      vesselContact(
        {
          MessageType: "ShipStaticData",
          MetaData: { MMSI: 123456789, latitude: 0, longitude: 0 },
          Message: { ShipStaticData: {} },
        },
        time,
      ),
    ).toBeNull();
  });
  it("labels receipt-time fallback and handles AIS unavailable heading/speed sentinels", () => {
    const c = vesselContact(
      {
        MessageType: "PositionReport",
        MetaData: { MMSI: 123456789, ShipName: " VESSEL " },
        Message: {
          PositionReport: {
            Latitude: 0,
            Longitude: 0,
            Sog: 102.3,
            TrueHeading: 511,
            Cog: 40,
          },
        },
      },
      time,
    );
    expect(c).toMatchObject({
      name: "VESSEL",
      lat: 0,
      lng: 0,
      timestampBasis: "received by this server",
      military: false,
      heading: 40,
    });
    expect(c?.speedKnots).toBeUndefined();
  });
  it("rejects AIS invalid latitude, invalid decode and old provider position time", () => {
    const base = {
      MessageType: "PositionReport",
      MetaData: { MMSI: 123456789, time_utc: "2026-09-27T22:00:00Z" },
      Message: { PositionReport: { Latitude: 0, Longitude: 0 } },
    };
    expect(vesselContact(base, time)).toBeNull();
    expect(
      vesselContact(
        {
          ...base,
          MetaData: { MMSI: 123456789 },
          Message: { PositionReport: { Latitude: 91, Longitude: 0 } },
        },
        time,
      ),
    ).toBeNull();
  });
});
describe("orbital display truth", () => {
  it("uses a spherical Earth with a true distance option and preserves orientation", () => {
    expect(orbitalVector(0, 0, 0, "true")).toEqual([1, 0, -0]);
    expect(Math.hypot(...orbitalVector(45, 90, 6371, "true"))).toBeCloseTo(2);
    expect(orbitalVector(90, 0, 0)[1]).toBeCloseTo(1);
    expect(orbitalVector(0, 90, 0)[2]).toBeCloseTo(-1);
  });
  it("separates constellation visibility without inventing mission classifications", () => {
    expect(satelliteCategory({ id: "44713", name: "STARLINK-1008" })).toBe(
      "Starlink",
    );
    expect(satelliteCategory({ id: "99999", name: "USA SECRET" })).toBe(
      "Not documented",
    );
  });
});

it("excludes ground equipment from aircraft traffic and rejects future provider clocks", () => {
  expect(
    aircraftContacts(
      {
        now,
        ac: [
          { ...aircraft, t: "TWR" },
          { ...aircraft, t: "GND" },
          { ...aircraft, type: "adsb_icao_nt" },
        ],
      },
      time,
    ),
  ).toEqual([]);
  expect(() =>
    aircraftContacts({ now: now + 120000, ac: [aircraft] }, time),
  ).toThrow();
});
