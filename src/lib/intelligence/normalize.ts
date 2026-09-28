import type { Development } from "./types";
export function webUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function point(
  value: unknown,
): { lat: number; lng: number; precision: "provider observation" } | undefined {
  if (!Array.isArray(value) || value.length < 2) return;
  const [lng, lat] = value;
  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    Math.abs(lng) > 180 ||
    Math.abs(lat) > 90
  )
    return;
  return { lat, lng, precision: "provider observation" };
}
export function iso(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
type Row = Record<string, unknown>;
function row(x: unknown): Row {
  return x && typeof x === "object" ? (x as Row) : {};
}
export function earthquakes(payload: unknown): Development[] {
  const features = row(payload).features;
  if (!Array.isArray(features))
    throw new Error("Invalid USGS feature collection");
  return features.flatMap((item) => {
    const f = row(item),
      p = row(f.properties),
      location = point(row(f.geometry).coordinates);
    const occurredAt = iso(p.time),
      url = webUrl(p.url);
    if (
      !location ||
      !occurredAt ||
      !url ||
      typeof f.id !== "string" ||
      typeof p.mag !== "number" ||
      !Number.isFinite(p.mag)
    )
      return [];
    const significant = typeof p.sig === "number" && p.sig >= 600;
    return [
      {
        id: `usgs:${f.id}`,
        sourceId: "usgs",
        source: "USGS",
        title: `M${p.mag.toFixed(1)} · ${String(p.place || "Earthquake")}`,
        url,
        occurredAt,
        updatedAt: iso(p.updated) || undefined,
        kind: "earthquake" as const,
        location,
        priority: significant ? 2 : 0,
        reason: significant
          ? "USGS significance ≥600"
          : "Measured earthquake · M2.5+ feed",
        summary: `Magnitude ${p.mag}. ${typeof p.alert === "string" ? `USGS PAGER alert: ${p.alert}.` : "No PAGER alert supplied."} Magnitude alone does not establish human impact.`,
      },
    ];
  });
}
export function hazards(payload: unknown): Development[] {
  const events = row(payload).events;
  if (!Array.isArray(events)) throw new Error("Invalid EONET event collection");
  return events.flatMap((item) => {
    const e = row(item),
      geometries = Array.isArray(e.geometry)
        ? e.geometry
            .map(row)
            .filter((g) => g.type === "Point" && iso(g.date))
            .sort(
              (a, b) => Date.parse(String(b.date)) - Date.parse(String(a.date)),
            )
        : [];
    const g = geometries[0],
      location = point(g?.coordinates),
      occurredAt = iso(g?.date),
      url = webUrl(e.link);
    if (
      !location ||
      !occurredAt ||
      !url ||
      typeof e.id !== "string" ||
      typeof e.title !== "string"
    )
      return [];
    return [
      {
        id: `eonet:${e.id}`,
        sourceId: "eonet",
        source: "NASA EONET",
        title: e.title,
        url,
        occurredAt,
        kind: "hazard" as const,
        location,
        priority: 0,
        reason: "NASA open-event catalogue",
        summary:
          "Latest reported event point. An open catalogue entry is not a new alert or a measured severity score.",
      },
    ];
  });
}
export function rankDevelopments(items: Development[]): Development[] {
  return [...items].sort(
    (a, b) =>
      Number(b.priority === 2) - Number(a.priority === 2) ||
      Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
      a.id.localeCompare(b.id),
  );
}
