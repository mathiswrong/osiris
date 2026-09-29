"use client";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Satellite, Search } from "lucide-react";
import { missionFor } from "@/lib/intelligence/profiles";
import type { SatelliteResult } from "@/lib/intelligence/types";
import { DashboardTile } from "./DashboardGrid";
import SatelliteDossier from "./SatelliteDossier";
import { HoverPreview } from "./HoverPreview";

const SatelliteGlobe = dynamic(() => import("./SatelliteGlobe"), {
  ssr: false,
  loading: () => <div className="desk-map-loading">Preparing orbital view…</div>,
});
const date = (value: string) => new Date(value).toLocaleString(undefined, {
  timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
}) + " UTC";
const purposes = ["all", "Communications", "Earth observation", "Navigation", "Research", "Not documented"];

export function useSatelliteTiles({ satellites, selectedId, onSelect, active, onActivate }: {
  satellites: SatelliteResult | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  active: boolean;
  onActivate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState("all");
  const [limit, setLimit] = useState(100);
  const sectionRef = useCallback((node: HTMLElement | null) => {
    if (active || !node) return;
    if (!window.IntersectionObserver) { onActivate(); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { onActivate(); observer.disconnect(); }
    }, { rootMargin: "600px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, onActivate]);
  const matches = useMemo(() => (satellites?.data || []).filter((satellite) => {
    const profile = missionFor(satellite);
    return (purpose === "all" || (profile?.purpose || "Not documented") === purpose)
      && `${satellite.name} ${satellite.id} ${profile?.operator || ""} ${profile?.purpose || ""}`.toLowerCase().includes(query.toLowerCase());
  }), [satellites, purpose, query]);
  const selected = satellites?.data.find((satellite) => satellite.id === selectedId);
  const reviewedCount = useMemo(() => (satellites?.data || []).filter((satellite) => missionFor(satellite)).length, [satellites]);
  const select = (id: string | null) => { onSelect(id); setLimit(100); };
  return [<DashboardTile key="satellites" id="satellites" title="Orbital traffic" w={3} h={22} kind="map">
    <section ref={sectionRef} className="desk-panel desk-orbital-panel">
        <div className="desk-panel-title"><h2>Orbital traffic</h2><span>PREDICTED POSITIONS</span></div>
        <div className="desk-map-caption">{satellites ? `${satellites.data.length.toLocaleString()} active objects · ${reviewedCount.toLocaleString()} with mission context · select an object to inspect` : "Loading public orbital elements…"}</div>
        <div className="desk-space-controls">
          <div className="desk-filters">
            <label className="desk-search"><Search size={15} /><input aria-label="Search satellites" placeholder="Name, operator, purpose or ID…" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(100); }} /></label>
            <select aria-label="Satellite purpose" value={purpose} onChange={(event) => { setPurpose(event.target.value); setLimit(100); }}>
              {purposes.map((option) => <option key={option} value={option}>{option === "all" ? "All purposes" : option}</option>)}
            </select>
          </div>
          <div className="desk-space-shortcuts">
            <span>Start with a known mission</span>
            {[{ id: "25544", name: "ISS" }, { id: "49332", name: "SES-17" }, { id: "49260", name: "Landsat 9" }].map((satellite) => <button key={satellite.id} onClick={() => { setQuery(""); setPurpose("all"); select(satellite.id); }}>{satellite.name}</button>)}
            {selectedId && <button onClick={() => select(null)}>Clear selection</button>}
            <span>{matches.length.toLocaleString()} matches</span>
          </div>
        </div>
        {active ? <SatelliteGlobe contextOrbits={satellites?.contextOrbits || []} satellites={matches} selected={selected || null} orbit={satellites?.selectedId === selectedId ? satellites.orbit || [] : []} onSelect={(id) => select(id)} /> : <div className="desk-map-loading">Orbital view loads when you reach this section…</div>}
        <div className="desk-map-caption desk-map-bottom"><span>SGP4 orbital predictions · CelesTrak GP/OMM</span><span>{satellites?.health.state || "Connecting CelesTrak"}</span></div>
      </section>
    </DashboardTile>, <DashboardTile key="mission" id="mission" title="Mission inspector" w={3} h={21}>
      <aside className="desk-panel desk-context">
        <div className="desk-panel-title"><h2>Mission inspector</h2><span>ORBITAL ELEMENTS</span></div>
        <strong>{selected?.name || "Select a satellite to investigate"}</strong>
        <p>{selected ? missionFor(selected)?.summary || "Mission details have not been established for this catalogue object." : "Search above or select an object on the globe to inspect its orbit and mission."}</p>
        <span className="desk-muted">{selected ? `${missionFor(selected)?.scope || "Orbit only"} · ${selected.altKm.toFixed(0)} km altitude` : "Profiles link to original operators and space agencies."}</span>
        {selected && <>
          <div className="desk-orbit-metrics">
            <span><b>{selected.altKm.toFixed(0)}</b> km altitude</span>
            <span><b>{selected.speedKmS?.toFixed(2) || "—"}</b> km/s</span>
            <span><b>{selected.inclination?.toFixed(1) || "—"}°</b> inclination</span>
            <span><b>{selected.periodMinutes.toFixed(1)}</b> min orbit</span>
          </div>
          <div className="desk-inspector-section"><h3>Operator</h3><p>{missionFor(selected)?.operator || "Not established"}</p></div>
          <div className="desk-inspector-section"><h3>Capabilities</h3><ul>{(missionFor(selected)?.capabilities || ["Payload and capabilities have not been established."]).slice(0, 3).map((capability) => <li key={capability}>{capability}</li>)}</ul></div>
          <div className="desk-inspector-section"><h3>Publicly documented users & clients</h3><p>{missionFor(selected)?.customers.map((customer) => customer.name).join(" · ") || missionFor(selected)?.users || "Not established"}</p><small>{missionFor(selected)?.scope || "Catalogue"} context · see each disclosure’s scope and date.</small></div>
          <a href="#satellite-dossier">Full dossier, disclosures & sources ↓</a>
        </>}
      </aside>
    </DashboardTile>, <DashboardTile key="catalogue" id="catalogue" title="Satellite catalogue" w={3} h={21}>
      <section className="desk-panel">
        <div className="desk-panel-title"><h2>Find a satellite</h2><span>{matches.length} MATCHES</span></div>
        <div className="desk-records">
          {matches.slice(0, limit).map((satellite) => <HoverPreview key={satellite.id} title={satellite.name} lines={[missionFor(satellite)?.summary || "Mission not yet documented", missionFor(satellite)?.operator || "Operator not established", `${satellite.altKm.toFixed(0)} km · elements ${satellite.elementAgeHours.toFixed(1)}h old`]}>
            <button className="desk-record" aria-pressed={selectedId === satellite.id} onClick={() => select(satellite.id)}>
              <span className="desk-record-top"><span>CelesTrak · {satellite.id}</span><span>{satellite.altKm.toFixed(0)} km</span></span>
              <strong>{satellite.name} <span className="desk-purpose-tag">{missionFor(satellite)?.purpose || "Not documented"}</span></strong>
              <small>Elements {satellite.elementAgeHours.toFixed(1)}h old · predicted {date(satellite.predictedAt)}</small>
            </button>
          </HoverPreview>)}
          {!matches.length && <div className="desk-empty">{satellites?.health.error || (satellites ? "No matching satellites. Try another search or purpose." : "Retrieving satellite catalogue…")}</div>}
          {matches.length > limit && <div className="desk-empty">Showing {limit} of {matches.length} records. <button onClick={() => setLimit((value) => value + 100)}>Show next 100</button></div>}
        </div>
      </section>
    </DashboardTile>, <DashboardTile key="satellite-dossier" id="satellite-dossier" title="Satellite dossier" w={6} h={17}>
      <section className="desk-panel">
        <div className="desk-panel-title"><h2>Satellite dossier</h2><span>PROVENANCE</span></div>
        <div className="desk-detail" aria-live="polite">
          {selected ? <><h2>{selected.name}</h2><SatelliteDossier satellite={selected} /><h3>Orbit & predicted position</h3>
            <dl><dt>Catalogue ID</dt><dd>{selected.id}</dd><dt>Altitude</dt><dd>{selected.altKm.toFixed(1)} km above WGS84</dd><dt>Element epoch</dt><dd>{date(selected.epoch)}</dd><dt>Element age</dt><dd className={selected.elementAgeHours > 72 ? "desk-amber" : ""}>{selected.elementAgeHours.toFixed(1)} hours{selected.elementAgeHours > 72 ? " · old elements; prediction uncertainty increases" : ""}</dd><dt>Predicted at</dt><dd>{date(selected.predictedAt)}</dd><dt>Period</dt><dd>{selected.periodMinutes.toFixed(1)} minutes</dd><dt>Orbital path</dt><dd>One predicted revolution in an Earth-fixed frame.</dd></dl>
            <a href={`https://celestrak.org/NORAD/elements/gp.php?CATNR=${selected.id}&FORMAT=JSON`} target="_blank" rel="noreferrer">Original CelesTrak elements ↗</a>
          </> : <div className="desk-empty"><Satellite size={28} /><h2>Search, select, follow</h2><p>Search a spacecraft by name or catalogue ID. Select it to view its position, predicted orbital path and the age of its source elements.</p></div>}
        </div>
      </section>
    </DashboardTile>];
}
