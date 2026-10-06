import { expect, it } from "vitest";
import { parseReportingFeed, parseWhoOutbreaks } from "./sources";
import { SOURCE_DEFINITIONS } from "./types";
import { advanceJournal, detectFlashpoints } from "./flashpoints";
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

it("carries the publisher lead through ingestion to a health watch on the first poll", async () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  const provider = SOURCE_DEFINITIONS.find(s => s.id === "cbs")!;
  const data = await parseReportingFeed(provider, wrap(
    '<item><title>Officials investigate unexplained death</title><link>https://www.cbsnews.com/news/incident/</link><pubDate>Mon, 05 Oct 2026 11:00:00 GMT</pubDate><description><![CDATA[<p>A worker in <b>Irkutsk</b> died of pneumonia of unknown origin. Contacts are under observation; plague is not confirmed.</p>]]></description></item>',
  ), now);
  expect(data[0].excerpt).toContain("plague is not confirmed");
  expect(data[0].summary).toContain("Publisher excerpt:");
  const results = [{ data, health: { ...provider, state: "healthy" as const, count: data.length,
    checkedAt: new Date(now).toISOString(), fetchedAt: new Date(now).toISOString(),
    nextCheckAt: new Date(now + provider.refreshMs).toISOString(), error: null } }];
  const watches = detectFlashpoints(advanceJournal(undefined, results, now), results, now);
  expect(watches.data).toHaveLength(1);
  expect(watches.data[0]).toMatchObject({ region: "Russia", topic: "Public health", state: "single-source lead", publishers: 1 });
  expect(watches.data[0].reports[0].title).toBe(data[0].title);
  expect(watches.data[0].location?.precision).toBe("country context");
});

it("reads WHO publication dates and assessments without turning a potential event into a confirmed outbreak", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  const item = { Id: "don-1", Title: "Suspected disease - Russia", ItemDefaultUrl: "/2026-DON999",
    PublicationDateAndTime: "2026-10-05T10:00:00Z", Summary: "<p>Diagnosis is under investigation.</p>" };
  const [report] = parseWhoOutbreaks({ value: [item] }, now);
  expect(report).toMatchObject({ sourceId: "who-don", priority: 0, kind: "report",
    occurredAt: "2026-10-05T10:00:00.000Z", excerpt: "Diagnosis is under investigation.",
    url: "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON999" });
  expect(report.summary).toContain("confirmed or potential");
  expect(parseWhoOutbreaks({ value: [
    { ...item, PublicationDateAndTime: "2026-08-01T10:00:00Z" },
    { ...item, PublicationDateAndTime: "2026-10-06T10:00:00Z" },
    { ...item, ItemDefaultUrl: "https://untrusted.example/story" },
    { ...item, PublicationDateAndTime: "invalid" },
  ] }, now)).toEqual([]);
  expect(() => parseWhoOutbreaks({ error: "not available" }, now)).toThrow("Invalid WHO outbreak response");
});
