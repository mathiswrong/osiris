"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, LocateFixed, RefreshCw } from "lucide-react";
import type { SourceResult } from "@/lib/intelligence/types";
import { distanceKm, type TrafficContact } from "@/lib/intelligence/traffic";

const Map = dynamic(() => import("./SituationMap"), { ssr: false, loading: () => <div className="desk-map-loading">Preparing traffic map…</div> });
const regions = [
  { name: "English Channel", lat: 51, lng: 2 },
  { name: "Singapore Strait", lat: 1.3, lng: 103.8 },
  { name: "Strait of Hormuz", lat: 26.5, lng: 56.3 },
  { name: "Suez Canal", lat: 30.4, lng: 32.3 },
  { name: "Panama Canal", lat: 9.1, lng: -79.7 },
  { name: "Vancouver / Seattle", lat: 49.1, lng: -123.1 },
  { name: "New York", lat: 40.7, lng: -74 },
];
type Area = { lat: number; lng: number; name: string };
type Snapshot = { results: SourceResult<TrafficContact>[]; generatedAt: string; radiusKm: number };
const utc = (value: string) => new Date(value).toLocaleTimeString(undefined, { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC";

export default function TrafficPanel({ kind, theme, refresh }: { kind: "aircraft" | "vessel"; theme: "day" | "night"; refresh: number }) {
  const marine = kind === "vessel";
  const [area, setArea] = useState<Area>(regions[marine ? 1 : 0]);
  const [viewport, setViewport] = useState({ lat: area.lat, lng: area.lng });
  const [mode, setMode] = useState<"native" | "public">(marine ? "public" : "native");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState("");
  const onViewportChange = useCallback((center: { lat: number; lng: number }) => setViewport(center), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (mode !== "native") return;
    const controller = new AbortController();
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      try {
        const response = await fetch(`/api/intelligence/traffic?kind=${kind}&lat=${area.lat}&lng=${area.lng}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Traffic feed returned HTTP ${response.status}`);
        const data: Snapshot = await response.json();
        if (!controller.signal.aborted) { setSnapshot(data); setError(""); setNow(Date.now()); }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Traffic feed unavailable");
      } finally { inFlight = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    const timer = setInterval(load, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [area, mode, kind, retry, refresh]);
  const result = snapshot?.results[0];
  const contacts = useMemo(() => (result?.data || []).filter((contact) => {
    const age = now - Date.parse(contact.observedAt);
    return contact.kind === kind && age >= -60000 && age < (marine ? 600000 : 300000)
      && distanceKm(area, contact) <= (snapshot?.radiusKm || 463)
      && `${contact.name} ${contact.id} ${contact.registration || ""} ${contact.model || ""}`.toLowerCase().includes(filter.toLowerCase());
  }), [result, now, kind, marine, area, snapshot?.radiusKm, filter]);
  const contact = contacts.find((item) => item.id === selected);
  function changeArea(next: Area) { setArea(next); setViewport(next); setSnapshot(null); setSelected(null); setError(""); }
  const providerUrl = marine
    ? `https://www.myshiptracking.com/?lat=${area.lat}&lng=${area.lng}&zoom=8`
    : `https://globe.adsb.fi/?lat=${area.lat}&lon=${area.lng}&zoom=7`;
  const embedUrl = `https://embed.myshiptracking.com/embed?myst&lat=${area.lat}&lng=${area.lng}&zoom=8&show_menu=0&show_info=1&show_track=1&show_names=0&scroll_wheel=0&map_style=simple`;
  return <section className="desk-panel desk-traffic-panel">
    <div className="desk-traffic-controls">
      <label><span>Area</span><select aria-label={`${marine ? "Maritime" : "Air"} traffic region`} value={area.name} onChange={(event) => { const next = regions.find((region) => region.name === event.target.value); if (next) changeArea(next); }}>
        {!regions.some((region) => region.name === area.name) && <option>{area.name}</option>}
        {regions.map((region) => <option key={region.name}>{region.name}</option>)}
      </select></label>
      {marine && <label><span>Source</span><select aria-label="Maritime map source" value={mode} onChange={(event) => { setMode(event.target.value as "native" | "public"); setSnapshot(null); setSelected(null); setError(""); }}><option value="public">MyShipTracking map</option><option value="native">AIS Stream contacts</option></select></label>}
      {mode === "native" && <div className="desk-traffic-actions"><button onClick={() => changeArea({ lat: Math.round(viewport.lat * 10) / 10, lng: Math.round(viewport.lng * 10) / 10, name: "Custom map area" })}><LocateFixed size={13} /> Search map area</button><button aria-label={`Refresh ${marine ? "maritime" : "air"} traffic`} disabled={loading} onClick={() => setRetry((value) => value + 1)}><RefreshCw size={13} /></button></div>}
    </div>
    {mode === "public" ? <>
      <div className="desk-traffic-embed"><iframe key={`${retry}:${refresh}`} src={embedUrl} title="Live maritime traffic — MyShipTracking" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
      <div className="desk-traffic-foot"><strong>MyShipTracking · public AIS map</strong><span>Pan, zoom and select a vessel. Position times and coverage are supplied by the provider.</span><a href={providerUrl} target="_blank" rel="noreferrer">Open maritime map <ArrowUpRight size={12} /></a>
        <button className="desk-traffic-reload" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={12} /> Reload maritime map</button>
      </div>
    </> : <>
      <div className="desk-traffic-status" role="status"><strong>{loading ? "Updating traffic…" : `${contacts.length.toLocaleString()} ${marine ? "vessels" : "aircraft"} in range`}</strong><span>{result?.health.fetchedAt ? `Snapshot ${utc(result.health.fetchedAt)}` : "Waiting for source"} · 250 nm radius</span></div>
      <Map items={[]} flashpoints={[]} satellites={[]} track={[]} selected={selected} onSelect={setSelected} space={false} theme={theme} contacts={contacts} focus={area} radiusKm={snapshot?.radiusKm || 463} onViewportChange={onViewportChange} label={marine ? "Maritime traffic map" : "Air traffic map"} />
      <div className="desk-traffic-foot">
        {(error || result?.health.error) && <p className="desk-amber">{marine && result?.health.error?.includes("not configured") ? "AIS contacts are unavailable. Select MyShipTracking map above to view public ship traffic." : error || result?.health.error}</p>}
        <input aria-label={`Filter ${marine ? "vessels" : "aircraft"}`} placeholder={marine ? "Filter vessels by name or MMSI…" : "Filter callsign, registration or model…"} value={filter} onChange={(event) => setFilter(event.target.value)} />
        <select aria-label={`Select ${marine ? "vessel" : "aircraft"}`} value={contact?.id || ""} onChange={(event) => setSelected(event.target.value || null)}><option value="">Select a marker or choose a contact ({contacts.length})</option>{contacts.slice(0, 500).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.model || item.id.split(":")[1]}</option>)}{contact && !contacts.slice(0, 500).some((item) => item.id === contact.id) && <option value={contact.id}>{contact.name}</option>}</select>
        {contact && <div className="desk-traffic-contact"><strong>{contact.name}</strong><span>{[contact.model, contact.registration, contact.altitudeFt !== undefined ? `${contact.altitudeFt.toLocaleString()} ft` : "", contact.speedKnots !== undefined ? `${contact.speedKnots.toFixed(0)} kn` : "", contact.heading !== undefined ? `${contact.heading.toFixed(0)}°` : ""].filter(Boolean).join(" · ")}</span><span>Position {utc(contact.observedAt)} · {contact.timestampBasis}</span><a href={contact.sourceUrl} target="_blank" rel="noreferrer">Inspect original contact <ArrowUpRight size={12} /></a></div>}
        <span>{marine ? "AIS Stream · sampled regional positions, up to 10 min old" : "adsb.fi · ADS-B / MLAT positions, up to 5 min old"}. Refreshes each minute; receiver coverage varies.</span>
        <a href={providerUrl} target="_blank" rel="noreferrer">Open {marine ? "maritime" : "air traffic"} provider <ArrowUpRight size={12} /></a>
      </div>
    </>}
  </section>;
}
