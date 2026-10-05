import { expect, it } from "vitest";
import { parseReportingFeed } from "./sources";
import { SOURCE_DEFINITIONS } from "./types";
const def = SOURCE_DEFINITIONS.find((s) => s.id === "gdacs")!;
const wrap = (content: string) =>
  `<rss version="2.0" xmlns:georss="http://www.georss.org/georss" xmlns:gdacs="http://www.gdacs.org"><channel><title>GDACS</title>${content}</channel></rss>`;
it("reads GDACS GeoRSS coordinates, alert level and provider event window separately from publication time", async () => {
  const rows = await parseReportingFeed(
    def,
    wrap(
      "<item><title>Green flood alert</title><link>https://www.gdacs.org/report.aspx?eventid=1</link><guid>1</guid><pubDate>Mon, 28 Sep 2026 05:00:00 GMT</pubDate><georss:point>0 0</georss:point><gdacs:alertlevel>Green</gdacs:alertlevel><gdacs:fromdate>Mon, 05 Oct 2026 01:00:00 GMT</gdacs:fromdate></item>",
    ),
    Date.parse("2026-09-28T06:00:00Z"),
  );
  expect(rows[0].location).toEqual({
    lat: 0,
    lng: 0,
    precision: "provider observation",
  });
  expect(rows[0].occurredAt).toBe("2026-09-28T05:00:00.000Z");
  expect(rows[0].reason).toContain("Green");
  expect(rows[0].summary).toContain("start date is in the future");
  expect(rows[0].priority).toBe(0);
});
it("does not invent a point for malformed GeoRSS coordinates", async () => {
  const rows = await parseReportingFeed(
    def,
    wrap(
      "<item><title>Flood alert</title><link>https://www.gdacs.org/report.aspx?eventid=2</link><pubDate>Mon, 28 Sep 2026 05:00:00 GMT</pubDate><georss:point>91 181</georss:point></item>",
    ),
    Date.parse("2026-09-28T06:00:00Z"),
  );
  expect(rows[0].location).toBeUndefined();
});
