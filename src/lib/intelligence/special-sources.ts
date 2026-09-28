import type { Development } from "./types";
import { iso, webUrl } from "./normalize";
import { providerFetch } from "./store";

type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" ? value as Row : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const utc = (value: unknown) => {
  const raw = text(value);
  return iso(raw && !/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? `${raw.replace(" ", "T")}Z` : raw);
};
const recent = (value: string, days: number, now: number) =>
  Date.parse(value) <= now + 300_000 && now - Date.parse(value) <= days * 86400_000;

export function copernicusActivations(payload: unknown, now = Date.now()): Development[] {
  const entries = row(payload).results;
  if (!Array.isArray(entries)) throw new Error("Invalid Copernicus activation response");
  return entries.flatMap((value) => {
    const item = row(value);
    const code = text(item.code), title = text(item.name);
    const occurredAt = utc(item.activationTime);
    if (!/^EMSR\d+$/.test(code) || !title || !occurredAt || !recent(occurredAt, 60, now)) return [];
    const match = /^POINT \((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(text(item.centroid));
    const lng = match ? Number(match[1]) : NaN, lat = match ? Number(match[2]) : NaN;
    const location = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng, precision: "activation centroid" as const } : undefined;
    const countries = Array.isArray(item.countries) ? item.countries.filter((x): x is string => typeof x === "string").join(", ") : "";
    return [{
      id: `cems:${code}`, sourceId: "cems", source: "Copernicus Rapid Mapping",
      title, url: `https://mapping.emergency.copernicus.eu/activations/${code}/`,
      occurredAt, timeLabel: "Mapping activated", updatedAt: utc(item.lastUpdate) || undefined,
      kind: "hazard" as const, location, priority: 0,
      reason: `Mapping activated · ${text(item.category) || "emergency"}`,
      summary: `Rapid Mapping activation${countries ? ` in ${countries}` : ""}. ${typeof item.n_products === "number" ? `${item.n_products} products listed. ` : ""}The map point is the activation-area centroid, not the incident location. Activation time does not establish event onset.`,
    }];
  });
}

export function ooniIncidents(payload: unknown, now = Date.now()): Development[] {
  const entries = row(payload).incidents;
  if (!Array.isArray(entries)) throw new Error("Invalid OONI incident response");
  return entries.flatMap((value) => {
    const item = row(value);
    const slug = text(item.slug), title = text(item.title);
    const occurredAt = utc(item.create_time);
    if (!/^[a-z0-9-]+$/.test(slug) || !title || !occurredAt || item.published !== true || !recent(occurredAt, 365, now)) return [];
    const countries = Array.isArray(item.CCs) ? item.CCs.filter((x): x is string => typeof x === "string").join(", ") : "";
    return [{
      id: `ooni:${slug}`, sourceId: "ooni", source: "OONI Explorer", title,
      url: `https://explorer.ooni.org/findings/${slug}`,
      occurredAt, timeLabel: "Finding record created", updatedAt: utc(item.update_time) || undefined,
      kind: "report" as const, priority: 0,
      reason: "Published OONI finding · curated investigation",
      summary: `${text(item.short_description) || "OONI internet interference finding."}${countries ? ` Countries: ${countries}.` : ""} Record creation time is shown; measurement coverage varies by network and place.`,
    }];
  });
}

export function hansAlerts(payload: unknown, details: Map<string, unknown>): Development[] {
  if (!Array.isArray(payload)) throw new Error("Invalid HANS elevated volcano response");
  return payload.flatMap((value) => {
    const item = row(value), id = text(item.vnum), name = text(item.volcano_name);
    const occurredAt = typeof item.sent_unixtime === "number" ? iso(item.sent_unixtime * 1000) : utc(item.sent_utc);
    const url = webUrl(item.notice_url);
    if (!/^\d+$/.test(id) || !name || !occurredAt || !url) return [];
    const detail = row(details.get(id));
    const lat = detail.latitude, lng = detail.longitude;
    const location = typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng, precision: "volcano location" as const } : undefined;
    const level = text(item.alert_level) || "unclassified";
    const color = text(item.color_code) || "unclassified";
    return [{
      id: `hans:${id}`, sourceId: "hans", source: "USGS HANS",
      title: `${name} · ${level} / ${color}`, url, occurredAt, timeLabel: "Notice issued",
      kind: "hazard" as const, location, priority: 0,
      reason: `Volcano alert ${level} · aviation color ${color}`,
      summary: `Latest HANS notice for a volcano at an elevated alert level. The map point marks the volcano, not an eruption or ash plume. Open the original notice for the observatory assessment.`,
    }];
  });
}

export async function loadHansAlerts(url: string): Promise<Development[]> {
  const payload: unknown = await (await providerFetch(url)).json();
  if (!Array.isArray(payload)) throw new Error("Invalid HANS elevated volcano response");
  const ids = payload.map((item) => text(row(item).vnum)).filter((id) => /^\d+$/.test(id)).slice(0, 25);
  const details = new Map<string, unknown>();
  await Promise.all(ids.map(async (id) => {
    try {
      details.set(id, await (await providerFetch(`https://volcanoes.usgs.gov/hans-public/api/volcano/getVolcano/${id}`)).json());
    } catch { /* Alert remains available without coordinates. */ }
  }));
  return hansAlerts(payload, details);
}
