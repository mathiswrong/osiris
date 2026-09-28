import Parser from "rss-parser";
import type { Development, SourceDefinition } from "./types";
import { earthquakes, hazards, iso, webUrl } from "./normalize";
import { providerFetch, sourceRead } from "./store";
export async function readSource(def: SourceDefinition) {
  return sourceRead<Development>(def, async () => {
    const response = await providerFetch(def.url);
    if (def.id === "usgs") return earthquakes(await response.json());
    if (def.id === "eonet") return hazards(await response.json());
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
            : "Attributed publisher report. Publication time is shown; event time and precise location have not been established.",
      },
    ];
  });
}
