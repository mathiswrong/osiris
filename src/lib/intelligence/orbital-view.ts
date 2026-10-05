import type { SatellitePosition } from "./types";
import { missionFor } from "./profiles";
export const SATELLITE_COLORS: Record<string, string> = {
  "Earth observation": "#5bbcff",
  Navigation: "#ffc660",
  Research: "#55e1c4",
  Communications: "#c2a0ff",
  Starlink: "#537fa0",
  "Not documented": "#b7c5d4",
};
export function satelliteCategory(s: Pick<SatellitePosition, "id" | "name">) {
  return /^STARLINK-\d+(?: \[DTC\])?$/.test(s.name)
    ? "Starlink"
    : missionFor(s)?.purpose || "Not documented";
}
/** North is +Y, longitude zero is +X. Display scale never changes reported altitude. */
export function orbitalVector(
  lat: number,
  lng: number,
  altKm = 0,
  scale: "spread" | "true" = "spread",
): [number, number, number] {
  const radius =
    1 +
    (scale === "true"
      ? altKm / 6371
      : altKm > 0
        ? 0.12 + 1.25 * Math.sqrt(altKm / 36000)
        : 0);
  const p = (lat * Math.PI) / 180,
    l = (lng * Math.PI) / 180;
  return [
    radius * Math.cos(p) * Math.cos(l),
    radius * Math.sin(p),
    -radius * Math.cos(p) * Math.sin(l),
  ];
}
