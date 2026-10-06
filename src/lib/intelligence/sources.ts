import Parser from "rss-parser";
import type { Development, SourceDefinition } from "./types";
import { earthquakes, hazards, iso, webUrl } from "./normalize";
import { providerFetch, sourceRead } from "./store";
import { copernicusActivations, loadHansAlerts, ooniIncidents } from "./special-sources";
import { htmlToText } from "../telegram";
export async function readSource(def: SourceDefinition) {
  return sourceRead<Development>(def, async () => {
    if (def.id === "hans") return loadHansAlerts(def.url);
    const response = await providerFetch(def.url);
    if (def.id === "usgs") return earthquakes(await response.json());
    if (def.id === "eonet") return hazards(await response.json());
    if (def.id === "cems") return copernicusActivations(await response.json());
    if (def.id === "ooni") return ooniIncidents(await response.json());
    if (def.id === "who-don") return parseWhoOutbreaks(await response.json());
    return parseReportingFeed(def, await response.text());
  });
}
export async function parseReportingFeed(
  def: SourceDefinition,
  xml: string,
  now = Date.now(),
): Promise<Development[]> {
  const feed = await new Parser({
    customFields: {
      item: [
        "georss:point",
        "gdacs:alertlevel",
        "gdacs:fromdate",
        "gdacs:todate",
      ],
    },
  }).parseString(xml);
  return feed.items.flatMap((item) => {
    const excerpt = htmlToText(item.content || item.summary || "").slice(0, 800);
    const url = webUrl(item.link),
      occurredAt = iso(item.isoDate || item.pubDate);
    if (
      !url ||
      !occurredAt ||
      !item.title ||
      Date.parse(occurredAt) > now + 300_000 ||
      now - Date.parse(occurredAt) > 7 * 86400_000
    )
      return [];
    const coordinates = String(item["georss:point"] || "")
      .trim()
      .split(/\s+/)
      .map(Number);
    const [lat, lng] = coordinates;
    const located =
      def.id === "gdacs" &&
      coordinates.length === 2 &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180;
    const eventStart = iso(item["gdacs:fromdate"]),
      eventEnd = iso(item["gdacs:todate"]);
    const timing = eventStart
      ? ` Provider event window: ${eventStart.slice(0, 10)}${eventEnd ? ` to ${eventEnd.slice(0, 10)}` : ""}.${Date.parse(eventStart) > now ? " The provider's start date is in the future; onset has not been established." : ""}`
      : " Provider event start not established.";
    return [
      {
        id: `${def.id}:${item.guid || url}`,
        sourceId: def.id,
        source: def.name,
        title: item.title,
        excerpt,
        url,
        occurredAt,
        kind: def.id === "gdacs" ? ("hazard" as const) : ("report" as const),
        ...(located
          ? {
              location: {
                lat,
                lng,
                precision: "provider observation" as const,
              },
            }
          : {}),
        priority: 0,
        reason:
          def.id === "gdacs"
            ? `GDACS ${String(item["gdacs:alertlevel"] || "unclassified")} alert · provider assessment`
            : def.id === "defense"
              ? "Official government statement · not independent confirmation"
              : "Publisher report · ordered by publication time",
        summary:
          def.id === "gdacs"
            ? "GDACS disaster alert. Location and alert level are supplied by the provider; alert publication time is not necessarily event onset." +
              timing
            : `${excerpt ? `Publisher excerpt: ${excerpt}\n\n` : ""}Attributed publisher report. Publication time is shown; event time and precise location have not been established.`,
      },
    ];
  });
}

export function parseWhoOutbreaks(payload: unknown, now = Date.now()): Development[] {
  if (!payload || typeof payload !== "object" || !("value" in payload) || !Array.isArray(payload.value))
    throw new Error("Invalid WHO outbreak response");
  return payload.value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const occurredAt = iso(item.PublicationDateAndTime);
    const url = typeof item.ItemDefaultUrl === "string" && /^\/[\w-]+$/.test(item.ItemDefaultUrl)
      ? `https://www.who.int/emergencies/disease-outbreak-news/item${item.ItemDefaultUrl}` : null;
    if (!url || !occurredAt || typeof item.Id !== "string" || typeof item.Title !== "string" || !item.Title.trim() ||
      Date.parse(occurredAt) > now + 300_000 || now - Date.parse(occurredAt) > 30 * 86400_000) return [];
    const excerpt = htmlToText(typeof item.Summary === "string" ? item.Summary : "").slice(0, 800);
    return [{
      id: `who-don:${item.Id}`, sourceId: "who-don", source: "WHO Disease Outbreak News",
      title: item.Title, url, occurredAt, kind: "report" as const, priority: 0, excerpt,
      reason: "WHO public health assessment · publication time",
      summary: `${excerpt ? `WHO excerpt: ${excerpt}\n\n` : ""}Official report of a confirmed or potential health event. Read the assessment for case status; publication does not establish event onset.`,
    }];
  });
}
