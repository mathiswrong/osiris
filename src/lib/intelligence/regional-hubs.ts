import type { Flashpoint, FlashpointResult } from "./flashpoints";
import type { Development } from "./types";
import { COUNTRY_CENTROIDS, COUNTRY_BOUNDS, countryName } from "../countryCentroids";
import { reportGroups } from "./flashpoints";
import { telegramPosts, type SignalFeed } from "./signal-analysis";

export type RegionalEvent = {
  id: string;
  title: string;
  topic: string;
  reports: Development[];
  latestAt: string;
  sourceCount: number;
  grouping: "matching headlines" | "single record";
};

export type RegionalHub = {
  id: string;
  name: string;
  watches: Flashpoint[];
  events: RegionalEvent[];
  latestAt: string;
  sources: string[];
  center?: { lat: number; lng: number };
};

export function regionId(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export const countryCatalog = Object.entries(COUNTRY_CENTROIDS)
  .filter(([code]) => code.length === 2)
  .map(([code, [lng, lat]]) => ({ code, id: regionId(countryName(code)), name: countryName(code), center: { lat, lng }, bounds: COUNTRY_BOUNDS[code] }));
export const regionCatalog = [
  ...countryCatalog,
  { id: "strait-of-hormuz", name: "Strait of Hormuz", center: { lat: 26.6, lng: 56.5 } },
  { id: "suez-canal", name: "Suez Canal", center: { lat: 30.5, lng: 32.4 } },
  { id: "red-sea", name: "Red Sea", center: { lat: 20, lng: 38 } },
];
export function emptyRegionalHub(id: string): RegionalHub | undefined {
  const region = regionCatalog.find((item) => item.id === id);
  return region && { ...region, watches: [], events: [], latestAt: "", sources: [] };
}

/** Public-channel posts stay early leads, even when several channels repeat a claim. */
export function publicChannelWatches(feed: SignalFeed | null): Flashpoint[] {
  const now = Date.parse(feed?.timestamp || "");
  const groups = new Map<string, Flashpoint>();
  for (const { item, carrier } of telegramPosts(feed)) {
    const at = Date.parse(carrier.published);
    if (at > now || at <= now - 24 * 3_600_000) continue;
    const report: Development = { id: `telegram:${item.id}:${carrier.source}`, title: item.title,
      sourceId: carrier.source, source: carrier.source_name, url: carrier.link, occurredAt: carrier.published,
      kind: "report", priority: 0, reason: "Unverified public Telegram preview", summary: "A public-channel lead, not independent confirmation." };
    for (const group of reportGroups(report)) {
      const existing = groups.get(group.key);
      if (existing) {
        existing.reports.push(report);
        existing.count++;
        existing.recentCount += at > now - 6 * 3_600_000 ? 1 : 0;
        existing.publishers = new Set(existing.reports.map((row) => row.sourceId)).size;
        if (at < Date.parse(existing.firstSeen)) existing.firstSeen = carrier.published;
        if (at > Date.parse(existing.latestAt)) { existing.latestAt = carrier.published; existing.title = item.title; }
      } else groups.set(group.key, { id: `telegram-watch:${group.key}`, title: item.title, region: group.region,
        topic: group.topic, location: group.location, state: "single-source lead", reports: [report],
        count: 1, publishers: 1, firstSeen: carrier.published, latestAt: carrier.published,
        recentCount: at > now - 6 * 3_600_000 ? 1 : 0, baselineCount: 0, reasons: ["Sampled public Telegram posts. Claims and incident locations have not been verified."] });
    }
  }
  return [...groups.values()];
}

const ignored = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "is", "of", "on", "the", "to", "with", "after", "over", "says", "said"]);
function words(title: string): Set<string> {
  return new Set(title.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 2 && !ignored.has(word)) || []);
}
function matchingHeadline(a: Development, b: Development): boolean {
  if (Math.abs(Date.parse(a.occurredAt) - Date.parse(b.occurredAt)) > 36 * 3_600_000) return false;
  const left = words(a.title), right = words(b.title);
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared >= 4 && shared / (left.size + right.size - shared) >= 0.7;
}

/** Conservative candidates. Region/topic watches themselves are not event identities. */
export function buildRegionalHubs(result: FlashpointResult, separated = new Set<string>()): RegionalHub[] {
  const regions = new Map<string, Flashpoint[]>();
  for (const watch of result.data) {
    if (watch.region === "Location unresolved") continue;
    const name = watch.region === "Measured earthquake" ? watch.title : watch.region;
    regions.set(name, [...(regions.get(name) || []), watch]);
  }
  return [...regions].map(([name, watches]) => {
    const records = new Map<string, { report: Development; topic: string }>();
    for (const watch of watches) for (const report of watch.reports)
      if (!records.has(report.id)) records.set(report.id, { report, topic: watch.topic });
    const ordered = [...records.values()].sort((a, b) => Date.parse(b.report.occurredAt) - Date.parse(a.report.occurredAt));
    const events: RegionalEvent[] = [];
    for (const { report, topic } of ordered) {
      const match = !separated.has(report.id) && events.find((event) =>
        event.topic === topic && event.reports.every((member) => !separated.has(member.id)) && matchingHeadline(report, event.reports[0]),
      );
      if (match) {
        match.reports.push(report);
        match.sourceCount = new Set(match.reports.map((row) => row.sourceId)).size;
        match.grouping = "matching headlines";
      } else {
        events.push({ id: report.id, title: report.title, topic, reports: [report],
          latestAt: report.occurredAt, sourceCount: 1, grouping: "single record" });
      }
    }
    // Use the oldest member as the event key so later matching reports do not
    // discard this browser's saved review of the existing candidate.
    for (const event of events) event.id = event.reports.reduce((oldest, row) =>
      Date.parse(row.occurredAt) < Date.parse(oldest.occurredAt) ? row : oldest,
    event.reports[0]).id;
    return { id: watches[0].region === "Measured earthquake" ? `observed-${regionId(watches[0].id)}` : regionId(name), name, watches, events,
      latestAt: watches.reduce((latest, watch) => watch.latestAt > latest ? watch.latestAt : latest, ""),
      sources: [...new Set(ordered.map(({ report }) => report.source))].sort(),
      center: watches.find((watch) => watch.location)?.location || countryCatalog.find((country) => country.id === regionId(name))?.center };
  }).sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));
}

export function regionalBrief(hub: RegionalHub, now: number): string[] {
  if (!hub.events.length) return [
    `No qualifying headlines mentioning ${hub.name} entered the current 24 hour watch window.`,
    "The map and nearby observations use a regional context center; proximity alone does not connect an observation to an event.",
    "Monitored sources have limited coverage. An empty watch is not evidence that nothing happened.",
  ];
  const recent = hub.events.filter((event) => now - Date.parse(event.latestAt) <= 6 * 3_600_000);
  return [
    `${hub.events.length} headline ${hub.events.length === 1 ? "group" : "groups"} mentioning ${hub.name} across ${hub.watches.length} topic ${hub.watches.length === 1 ? "watch" : "watches"} in the last 24 hours. ${recent.length} ${recent.length === 1 ? "has" : "have"} new reporting in the last 6 hours.`,
    `${hub.sources.length} sources appear in this region's current evidence. A headline may mention a region without locating its event there; source count is not independent confirmation.`,
    recent.length ? `Latest matching headline: ${recent[0].title}` : "No new matching reporting in the last 6 hours from the monitored feeds.",
  ];
}
