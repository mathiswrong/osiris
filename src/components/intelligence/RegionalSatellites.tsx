"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SourceHealth } from "@/lib/intelligence/types";

type SatelliteSummary = {
  id: string;
  name: string;
  altKm: number;
  distanceKm: number;
  purpose: string;
  predictedAt: string;
  elementAgeHours: number;
};
type Snapshot = {
  data: SatelliteSummary[];
  total: number;
  earthObservationCount: number;
  radiusKm: number;
  predictedAt: string;
  health: SourceHealth;
};

export default function RegionalSatellites({ name, center }: { name: string; center?: { lat: number; lng: number } }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const lat = center?.lat, lng = center?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const controller = new AbortController();
    const load = () => void fetch(`/api/intelligence/regional-satellites?lat=${lat}&lng=${lng}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`Satellite HTTP ${response.status}`); return response.json() as Promise<Snapshot>; })
      .then((data) => { setSnapshot(data); setError(""); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Satellite context unavailable"); });
    load();
    const timer = setInterval(load, 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [lat, lng]);
  return <section className="regional-satellite-panel" aria-label={`Satellites near ${name}`}>
    <div className="regional-section-head"><h2>Satellites near {name}</h2><Link href="/?view=space">Full orbital view ↗</Link></div>
    <p>Predicted ground subpoints within 900 km of the regional context center. A pass does not establish sensor coverage or available imagery.</p>
    {snapshot ? <>
      <div className="regional-satellite-summary"><strong>{snapshot.total}</strong><span>nearby subpoints</span><strong>{snapshot.earthObservationCount}</strong><span>documented Earth observation</span></div>
      <div className="regional-satellite-list">{snapshot.data.slice(0, 4).map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.purpose} · {item.distanceKm} km from center · {Math.round(item.altKm)} km altitude</span></div>)}{!snapshot.total && <span>No catalogue subpoints are nearby at this prediction time.</span>}</div>
      <small>Predicted {new Date(snapshot.predictedAt).toLocaleTimeString("en", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })} UTC · CelesTrak {snapshot.health.state}{snapshot.health.fetchedAt ? ` · elements retrieved ${new Date(snapshot.health.fetchedAt).toLocaleDateString("en", { timeZone: "UTC" })}` : ""}</small>
    </> : <p>{center ? "Loading current catalogue positions…" : "Regional center unavailable."}</p>}
    {error && <p className="regional-error">Satellite context: {error}. {snapshot ? "Showing the last prediction." : ""}</p>}
  </section>;
}
