import { describe, expect, it } from "vitest";
import { copernicusActivations, hansAlerts, ooniIncidents } from "./special-sources";

const now = Date.parse("2026-09-28T22:00:00Z");
describe("specialist source normalization", () => {
  it("labels a Copernicus point as an activation centroid and uses activation time", () => {
    const [item] = copernicusActivations({ results: [{ code: "EMSR932", name: "Wildfire in Spain", activationTime: "2026-09-15T16:58:00", eventTime: "2026-09-15T13:00:00", centroid: "POINT (-7.213497 37.789542)", countries: ["Spain"], category: "Wildfire", n_products: 1 }] }, now);
    expect(item.occurredAt).toBe("2026-09-15T16:58:00.000Z");
    expect(item.location?.precision).toBe("activation centroid");
    expect(item.url).toBe("https://mapping.emergency.copernicus.eu/activations/EMSR932/");
    expect(item.summary).toContain("not the incident location");
  });
  it("keeps published OONI findings unlocated and excludes unpublished incidents", () => {
    const result = ooniIncidents({ incidents: [
      { slug: "2026-gabon-blocked-social-media", title: "Gabon blocked social media", create_time: "2026-02-19T16:13:42Z", published: true, CCs: ["GA"] },
      { slug: "draft", title: "Draft", create_time: "2026-09-01T00:00:00Z", published: false },
    ] }, now);
    expect(result).toHaveLength(1);
    expect(result[0].location).toBeUndefined();
    expect(result[0].kind).toBe("report");
  });
  it("uses HANS notice time and volcano coordinates without claiming an eruption", () => {
    const [item] = hansAlerts([{ vnum: "311120", volcano_name: "Great Sitkin", sent_unixtime: 1790628087, alert_level: "WATCH", color_code: "ORANGE", notice_url: "https://volcanoes.usgs.gov/hans-public/notice/example" }], new Map([["311120", { latitude: 52.0765, longitude: -176.1109 }]]));
    expect(item.location).toEqual({ lat: 52.0765, lng: -176.1109, precision: "volcano location" });
    expect(item.reason).toContain("WATCH");
    expect(item.summary).toContain("not an eruption");
  });
});
