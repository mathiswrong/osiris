import {
  json2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
  type OMMJsonObject,
} from "satellite.js";
import type { SatellitePosition } from "./types";
export function parseElements(payload: unknown): OMMJsonObject[] {
  if (!Array.isArray(payload)) throw new Error("Invalid CelesTrak catalogue");
  const keys = [
    "MEAN_MOTION",
    "ECCENTRICITY",
    "INCLINATION",
    "RA_OF_ASC_NODE",
    "ARG_OF_PERICENTER",
    "MEAN_ANOMALY",
    "BSTAR",
    "MEAN_MOTION_DOT",
    "MEAN_MOTION_DDOT",
  ];
  const seen = new Set<string>();
  const rows = payload.filter((v): v is OMMJsonObject => {
    if (
      !v ||
      typeof v !== "object" ||
      typeof v.OBJECT_NAME !== "string" ||
      typeof v.EPOCH !== "string" ||
      !Number.isFinite(Date.parse(v.EPOCH))
    )
      return false;
    const id = String(v.NORAD_CAT_ID);
    if (
      !/^[1-9]\d{0,8}$/.test(id) ||
      seen.has(id) ||
      keys.some(
        (k) => v[k] === null || v[k] === "" || !Number.isFinite(Number(v[k])),
      )
    )
      return false;
    if (
      Number(v.MEAN_MOTION) <= 0 ||
      Number(v.ECCENTRICITY) < 0 ||
      Number(v.ECCENTRICITY) >= 1
    )
      return false;
    seen.add(id);
    return true;
  });
  if (payload.length && !rows.length)
    throw new Error("No valid CelesTrak elements");
  return rows;
}
export function predict(
  element: OMMJsonObject,
  when: Date,
): SatellitePosition | null {
  try {
    const sat = json2satrec(element),
      result = propagate(sat, when);
    if (sat.error || !result?.position) return null;
    const p = eciToGeodetic(result.position, gstime(when));
    const lat = degreesLat(p.latitude),
      lng = degreesLong(p.longitude),
      altKm = p.height;
    if (
      ![lat, lng, altKm].every(Number.isFinite) ||
      altKm < 80 ||
      altKm > 60000
    )
      return null;
    const epoch = new Date(
      /[zZ]|[+-]\d{2}:\d{2}$/.test(element.EPOCH)
        ? element.EPOCH
        : `${element.EPOCH}Z`,
    ).toISOString();
    return {
      inclination: Number(element.INCLINATION),
      eccentricity: Number(element.ECCENTRICITY),
      speedKmS: result.velocity
        ? Math.hypot(result.velocity.x, result.velocity.y, result.velocity.z)
        : undefined,
      id: String(element.NORAD_CAT_ID),
      name: element.OBJECT_NAME,
      epoch,
      lat,
      lng,
      altKm,
      predictedAt: when.toISOString(),
      periodMinutes: 1440 / Number(element.MEAN_MOTION),
      elementAgeHours: (when.getTime() - Date.parse(epoch)) / 3600000,
    };
  } catch {
    return null;
  }
}
export function groundTrack(
  element: OMMJsonObject,
  from: Date,
): [number, number][][] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  const period = 1440 / Number(element.MEAN_MOTION);
  for (let i = 0; i <= 120; i++) {
    const p = predict(
      element,
      new Date(from.getTime() + (period * 60000 * i) / 120),
    );
    if (!p || (run.length && Math.abs(p.lng - run[run.length - 1][0]) > 180)) {
      if (run.length > 1) runs.push(run);
      run = [];
    }
    if (p) run.push([p.lng, p.lat]);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

export function orbitalTrack(element: OMMJsonObject, from: Date) {
  const period = 86400_000 / Number(element.MEAN_MOTION);
  return Array.from({ length: 181 }, (_, i) => {
    const at = new Date(from.getTime() + (period * i) / 180);
    const p = predict(element, at);
    return p
      ? { lat: p.lat, lng: p.lng, altKm: p.altKm, at: at.toISOString() }
      : null;
  }).filter((p): p is NonNullable<typeof p> => p !== null);
}
