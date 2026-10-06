"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { buildRegionalHubs, regionCatalog, publicChannelWatches } from "@/lib/intelligence/regional-hubs";
import type { SatelliteResult } from "@/lib/intelligence/types";
import type { ExplorationView } from "@/lib/map-projection";
import type { SignalFeed } from "@/lib/intelligence/signal-analysis";
import { matchesWatchFilter, type FlashpointResult, type WatchFilter } from "@/lib/intelligence/flashpoints";
import { WatchFilters, WatchTags } from "./FlashpointMonitor";
import "./flashpoint-globe.css";

const Map = dynamic(() => import("./SituationMap"), { ssr: false, loading: () => <div className="desk-map-loading">Preparing flashpoint map…</div> });

const SatelliteView = dynamic(() => import("./SatelliteGlobe"), { ssr: false, loading: () => <div className="desk-map-loading">Preparing orbital view…</div> });

export default function FlashpointGlobe({ result, error, theme, feed, satellites, onActivateSatellites, onSelectSatellite }: { result: FlashpointResult | null; error: string; theme: "day" | "night"; feed: SignalFeed | null; satellites: SatelliteResult | null; onActivateSatellites: () => void; onSelectSatellite: (id: string) => void }) {
  const router = useRouter();
  const [filter, setFilter] = useState<WatchFilter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ExplorationView>("map");
  const center = useRef({ lat: 15, lng: 0 });
  const [orbitCenter, setOrbitCenter] = useState({ lat: 15, lng: 0 });
  const [returnCenter, setReturnCenter] = useState<{ lat: number; lng: number }>();
  const changeView = (next: ExplorationView) => {
    if (next === "satellites") setOrbitCenter(center.current);
    setView(next);
    if (next !== "map") onActivateSatellites();
  };
  const now = Date.parse(result?.generatedAt || "");
  const watches = useMemo(() => [...(result?.data || []), ...publicChannelWatches(feed)], [result, feed]);
  const filtered = useMemo(() => watches.filter((watch) => matchesWatchFilter(watch, filter, now) && `${watch.region} ${watch.title} ${watch.topic}`.toLowerCase().includes(query.trim().toLowerCase())), [watches, filter, now, query]);
  const hubs = useMemo(() => result ? buildRegionalHubs({ ...result, data: filtered }).sort((a, b) => Math.min(...a.watches.map((watch) => watches.indexOf(watch))) - Math.min(...b.watches.map((watch) => watches.indexOf(watch)))) : [], [result, filtered, watches]);
  const unlocated = filtered.filter((watch) => !watch.location);
  return <section className="flashpoint-home" aria-label="Flashpoint map">
    <div className="flashpoint-toolbar">
      <div><h1>Flashpoint monitor</h1><p>Start with a place. Follow the story.</p></div>
      <label className="flashpoint-search"><Search size={16} aria-hidden="true" /><input aria-label="Search places and reports" placeholder="Find a place or story…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label="Open a regional desk" value="" onChange={(event) => event.target.value && router.push(`/regions/${event.target.value}`)}>
        <option value="">Open a desk…</option>
        {regionCatalog.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
        {hubs.filter((hub) => !regionCatalog.some((region) => region.id === hub.id)).map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
      </select>
    </div>
    <WatchFilters value={filter} onChange={setFilter} watches={watches} now={now} />
    <div className="flashpoint-map-stage" data-view={view}>
      <div className="flashpoint-geography" aria-hidden={view === "satellites"} inert={view === "satellites"}>
      <Map exploration={view} onExplorationChange={changeView} returnCenter={returnCenter} onViewportChange={(position) => { center.current = position; }} locales={hubs} generatedAt={result?.generatedAt} items={[]} flashpoints={[]} satellites={[]} selected={null} track={[]} space={false} theme={theme} onSelect={(id) => router.push(`/regions/${id}`)} label="Flashpoint map. Zoom out for the globe and satellites, or select a place to open its regional desk." />
      </div>
      <div className="flashpoint-map-guide" role="status" hidden={view === "satellites"}><span><strong>{view === "map" ? "World map" : "Globe"}</strong> · {hubs.length} {hubs.length === 1 ? "locale" : "locales"} · {filtered.length} watches</span><span>Zoom out: map → globe → satellites · Select a place for its desk</span></div>
      {view === "satellites" && <div className="flashpoint-orbits">
        <SatelliteView satellites={satellites?.data || []} selected={null} orbit={[]} contextOrbits={satellites?.contextOrbits || []} onSelect={onSelectSatellite} initialCenter={orbitCenter} onEarth={(position) => { setReturnCenter(position); setView("globe"); }} />
        {(!satellites || satellites.health.error) && <p className="flashpoint-orbit-loading" role="status">{satellites?.health.error ? `Orbital refresh unavailable: ${satellites.health.error}` : "Connecting orbital catalogue…"} <Link href="/?view=space">Open satellite workspace</Link></p>}
      </div>}
      {view !== "satellites" && (!result || !filtered.length || error) && <div className="flashpoint-map-message" role="status">
        <strong>{error ? "Feed refresh unavailable" : !result ? "Connecting live sources" : "No matching watches"}</strong>
        <p>{error || (!result ? "The map is ready. Flashpoints appear as source records arrive." : filter === "emerging" && !result.baselineReady ? "Emerging alerts need 24 continuous hours of baseline collection. Other reporting is available under All watches." : filter === "long-term" ? "Long-term tags appear after a watch has been observed for at least 24 hours." : "Try another status or clear your search.")}</p>
        {result && filter !== "all" && <button onClick={() => setFilter("all")}>Show all watches</button>}
      </div>}
    </div>
    <div className="flashpoint-map-note"><span className="flashpoint-activity-key" aria-label="Marker activity scale"><span>24h reports:</span><span><i className="activity-low" />1–3</span><span><i className="activity-active" />4–9</span><span><i className="activity-high" />10+</span><span>Red also flags measured alerts and reporting surges.</span></span><span>{result?.baselineReady ? "Surge detection active" : `Baseline learning · ${result?.baselineHours.toFixed(1) || "0.0"} / 24h`}</span></div>
    <p className="flashpoint-location-note">Country markers show regional context; verified observations use provider coordinates. Report volume does not establish severity or confirmation.</p>
    <details className="flashpoint-accessible-index"><summary>Browse matching locales <span>{hubs.length}</span></summary><div>{hubs.map((hub) => <Link href={`/regions/${hub.id}`} key={hub.id}><strong>{hub.name}</strong><WatchTags watch={hub.watches[0]} now={now} /><span>{hub.watches[0].title}</span><small>{hub.watches.length} watches · {hub.sources.length} sources</small></Link>)}</div></details>
    {!!unlocated.length && <details className="flashpoint-accessible-index"><summary>Location unresolved <span>{unlocated.length}</span></summary><p>These reports have no established regional location and cannot be placed on the map.</p>{unlocated.map((watch) => <a href={watch.reports[0]?.url} target="_blank" rel="noreferrer" key={watch.id}>{watch.title}<WatchTags watch={watch} now={now} /></a>)}</details>}
  </section>;
}
