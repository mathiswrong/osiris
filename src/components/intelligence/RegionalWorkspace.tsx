"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { FlashpointResult } from "@/lib/intelligence/flashpoints";
import type { SourceResult } from "@/lib/intelligence/types";
import { buildRegionalHubs, regionCatalog, emptyRegionalHub, regionId, regionalBrief, type RegionalEvent } from "@/lib/intelligence/regional-hubs";
import { distanceKm } from "@/lib/intelligence/traffic";
import RegionalHubPills, { FollowRegionButton } from "./RegionalHubPills";
import RegionalDeskStream from "./RegionalDeskStream";
import RegionalSatellites from "./RegionalSatellites";
import "./desk.css";
import "./regional.css";
const RegionalMap = dynamic(() => import("./SituationMap"), { ssr: false, loading: () => <div className="desk-map-loading">Preparing regional map…</div> });

type Snapshot = { results: SourceResult[]; flashpoints: FlashpointResult };
type Review = { status: "unreviewed" | "reviewed" | "needs checking"; note: string; saved: boolean };
const reviewKey = "knuckletat:regional-reviews:v1";
const splitKey = "knuckletat:regional-splits:v1";
const readTheme = (): "day" | "night" => {
  try { return localStorage.getItem("knuckletat:theme") === "night" ? "night" : "day"; }
  catch { return "day"; }
};
const subscribeTheme = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const serverTheme = (): "day" | "night" => "day";
const stamp = (value: string) => new Date(value).toLocaleString("en", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
function storedReviews(): Record<string, Review> {
  try { const value = JSON.parse(localStorage.getItem(reviewKey) || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
function storedSplits(): string[] {
  try { const value = JSON.parse(localStorage.getItem(splitKey) || "[]"); return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []; }
  catch { return []; }
}

export default function RegionalWorkspace({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mapScope, setMapScope] = useState<"global" | "region">("global");
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  const [reviews, setReviews] = useState<Record<string, Review>>(storedReviews);
  const [separated, setSeparated] = useState<string[]>(storedSplits);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/intelligence/monitor", { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: Snapshot = await response.json();
        if (active) { setSnapshot(data); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Monitor unavailable");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, []);
  const hubs = useMemo(() => snapshot ? buildRegionalHubs(snapshot.flashpoints, new Set(separated)) : [], [snapshot, separated]);
  const selected = selectedId ? hubs.find((hub) => hub.id === selectedId) || emptyRegionalHub(selectedId) : null;
  const nearby = useMemo(() => {
    const center = selected?.center;
    if (!center || !snapshot) return [];
    return snapshot.results.flatMap((result) => result.data)
      .filter((record) => record.kind !== "report" && record.location && distanceKm(center, record.location) <= 900)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 25);
  }, [selected, snapshot]);
  const related = useMemo(() => {
    if (!selected) return [];
    const ids = new Set(selected.events.flatMap((event) => event.reports.map((report) => report.id)));
    return hubs.filter((hub) => hub.id !== selected.id && hub.events.some((event) => event.reports.some((report) => ids.has(report.id))));
  }, [hubs, selected]);
  const list = query.trim() ? [
    ...hubs.filter((hub) => hub.name.toLowerCase().includes(query.toLowerCase())),
    ...regionCatalog.filter((region) => region.name.toLowerCase().includes(query.toLowerCase()) && !hubs.some((hub) => hub.id === region.id)).map((region) => emptyRegionalHub(region.id)!),
  ] : hubs;
  function updateReview(id: string, patch: Partial<Review>) {
    setReviews((old) => {
      const previous: Review = old[id] || { status: "unreviewed", note: "", saved: false };
      const next = { ...old, [id]: { ...previous, ...patch } };
      try { localStorage.setItem(reviewKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function separate(id: string) {
    setSeparated((old) => {
      const next = old.includes(id) ? old : [...old, id];
      try { localStorage.setItem(splitKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const issues = snapshot?.results.filter((result) => result.health.state !== "healthy") || [];
  return <main className="intelligence-desk regional-page" data-theme={theme}>
    <header className="regional-header">
      <Link className="regional-brand" href="/">KNUCKLETAT<small>aggregated open source intel</small></Link>
      <span>LIVE MONITOR · 60s refresh{snapshot ? ` · ${new Date(snapshot.flashpoints.generatedAt).toLocaleTimeString("en", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })} UTC` : ""}</span>
    </header>
    <nav className="desk-navigation regional-main-navigation" aria-label="Workspace">
      <Link href="/" className="desk-main-link">Global</Link>
      <Link href={selectedId ? `/regions/${selectedId}` : "/regions"} className="desk-main-link" aria-current="page">My desk</Link>
      <Link href="/?view=space" className="desk-main-link">Satellites</Link>
      <Link href="/?view=sources" className="desk-main-link">Sources</Link>
    </nav>
    <RegionalHubPills hubs={hubs} selectedId={selectedId || ""} />
    {selectedId ? selected && snapshot ? <>
      <div className="regional-hero">
        <div><small>REGIONAL DESK / {selected.name.toUpperCase()}</small><h1>{selected.name} watch</h1><p>Reporting, provider observations, public channel previews, and orbital context in one regional view.</p><FollowRegionButton region={{ id: selected.id, name: selected.name }} /></div>
        <div className="regional-metrics"><strong>{selected.events.length}<small>headline groups</small></strong><strong>{selected.watches.length}<small>topic watches</small></strong><strong>{selected.sources.length}<small>publishers</small></strong></div>
      </div>
      <div className="regional-desk-grid">
      <section className="regional-map-section" aria-label="Situation map">
        <div className="regional-section-head"><h2>{mapScope === "global" ? "Global situation" : "Regional context"}</h2><div className="regional-map-switch"><button aria-pressed={mapScope === "global"} onClick={() => setMapScope("global")}>Global</button><button aria-pressed={mapScope === "region"} onClick={() => setMapScope("region")}>Region</button></div></div>
        <RegionalMap key={mapScope} items={mapScope === "global" ? snapshot.results.flatMap((result) => result.data) : [...selected.events.flatMap((event) => event.reports).filter((report) => !!report.location), ...nearby]} flashpoints={mapScope === "global" ? snapshot.flashpoints.data : selected.watches} satellites={[]} track={[]} selected={null} highlighted={selected.watches.map((watch) => watch.id)} theme={theme} onSelect={(id) => {
          const event = selected.events.find((candidate) => candidate.id === id || candidate.reports.some((report) => report.id === id));
          if (event) document.getElementById(`event-${encodeURIComponent(event.id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          else if (nearby.some((item) => item.id === id)) document.getElementById(`observation-${encodeURIComponent(id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          else {
            const watch = snapshot.flashpoints.data.find((item) => item.id === id);
            if (watch && watch.region !== "Location unresolved") router.push(`/regions/${regionId(watch.region)}`);
          }
        }} space={false} focus={mapScope === "region" ? selected.center : undefined} radiusKm={900} label={`${mapScope === "global" ? "Global situation" : selected.name + " context"} map`} />
        <p className="regional-map-explainer">Filled points are provider locations; rings are country or waterway context, not precise incident sites.</p>
      </section>
      <RegionalDeskStream key={selected.id} hub={selected} nearby={nearby} />
      </div>
      <div className="regional-support-grid">
        <RegionalSatellites key={selected.id} name={selected.name} center={selected.center} />
        <section className="regional-coverage-panel"><div className="regional-section-head"><h2>Source coverage</h2><Link href="/?view=sources">Inspect sources ↗</Link></div><p>{selected.sources.length ? selected.sources.join(" · ") : "No qualifying publisher reports in the current window."}</p><p>{issues.length ? `${issues.length} feed ${issues.length === 1 ? "has" : "have"} retrieval issues. A quiet watch needs a coverage check.` : "Responding feeds do not verify the claims they carry."}</p></section>
      </div>
      <section className="regional-brief" aria-label="Regional brief">
        <h2>Reporting brief</h2>
        {regionalBrief(selected, Date.parse(snapshot.flashpoints.generatedAt)).map((line) => <p key={line}>{line}</p>)}
        <small>Current 24 hour evidence window · refreshed every minute · no claim of independent verification</small>
      </section>
      <div className="regional-columns">
        <section>
          <h2>Headline groups <span>{selected.events.length}</span></h2>
          <p className="regional-explainer">These reports mention {selected.name}; the event may be elsewhere. Headlines are grouped only when wording and publication times closely match. Each card keeps its original evidence. You can separate a report if the suggested grouping is wrong.</p>
          <div className="regional-events">{selected.events.map((event) => <EventCard key={event.id} event={event} review={reviews[event.id]} onReview={(patch) => updateReview(event.id, patch)} onSeparate={separate} />)}</div>
          <section className="regional-observations"><h2>Nearby provider observations <span>{nearby.length}</span></h2><p>Within 900 km of the regional context center. These observations are spatial context and are not attributed to the reports above.</p>{nearby.map((record) => <a id={`observation-${encodeURIComponent(record.id)}`} key={record.id} href={record.url} target="_blank" rel="noreferrer"><strong>{record.title} ↗</strong><small>{record.source} · {stamp(record.occurredAt)} · {record.location?.precision}</small></a>)}{!nearby.length && <p>No nearby located observations in the current feed window.</p>}</section>
        </section>
        <aside>
          <section className="regional-side"><h2>Topic watches</h2>{selected.watches.map((watch) => <div key={watch.id}><strong>{watch.topic}</strong><span>{watch.state} · {watch.count} reports</span><small>{watch.reasons[0]}</small></div>)}<p>Watches combine reports by named region and topic. They can contain separate events.</p></section>
          {!!related.length && <section className="regional-side"><h2>Also mentioned</h2><p>These regions appear in at least one of the same source records.</p>{related.map((hub) => <Link key={hub.id} href={`/regions/${hub.id}`}>{hub.name} ↗</Link>)}</section>}
          <section className="regional-side"><h2>Saved investigations</h2>{selected.events.filter((event) => reviews[event.id]?.saved).map((event) => <a href={`#event-${encodeURIComponent(event.id)}`} key={event.id}>{event.title}</a>)}{!selected.events.some((event) => reviews[event.id]?.saved) && <p>Save event cards to keep them here on this device.</p>}</section>
        </aside>
      </div>
    </> : <section className="regional-empty"><h1>{snapshot ? "Region unavailable" : "Loading region…"}</h1><p>{error || "This region may have no qualifying reports in the current 24 hour window."}</p><Link href="/regions">Browse active regions</Link></section> : <>
      <div className="regional-hero"><div><small>LIVE REGIONAL INDEX</small><h1>Regions</h1><p>Start with a place, then read matching reporting, observations, and source coverage together.</p></div><div className="regional-metrics"><strong>{hubs.length}<small>active regions</small></strong><strong>{hubs.reduce((n, hub) => n + hub.events.length, 0)}<small>headline groups</small></strong></div></div>
      <label className="regional-search">Find a region<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search active regions or any country…" /></label>
      {error && <p className="regional-error">Monitor refresh failed: {error}. Showing the last retrieved snapshot.</p>}
      <div className="regional-index">{list.map((hub) => <Link key={hub.id} href={`/regions/${hub.id}`}><strong>{hub.name}</strong><span>{hub.events.length} headline {hub.events.length === 1 ? "group" : "groups"} · {hub.watches.length} topic {hub.watches.length === 1 ? "watch" : "watches"}</span><small>{hub.latestAt ? `Latest report ${stamp(hub.latestAt)}` : "No qualifying headlines in the current window"}</small></Link>)}</div>
      {!snapshot && !error && <p>Loading current source records…</p>}
      {snapshot && !list.length && <p>No active regions match this search. Regions appear when qualifying reports enter the current window.</p>}
    </>}
  </main>;
}

function EventCard({ event, review, onReview, onSeparate }: { event: RegionalEvent; review?: Review; onReview: (patch: Partial<Review>) => void; onSeparate: (id: string) => void }) {
  return <article className="regional-event" id={`event-${encodeURIComponent(event.id)}`}>
    <div className="regional-event-top"><span>{event.topic} · {event.grouping}</span><time dateTime={event.latestAt}>{stamp(event.latestAt)}</time></div>
    <h3>{event.title}</h3>
    <p>{event.reports.length} attributed {event.reports.length === 1 ? "record" : "records"} · {event.sourceCount} {event.sourceCount === 1 ? "publisher" : "publishers"}. Similar reporting does not establish independent confirmation.</p>
    <div className="regional-evidence">{event.reports.map((report) => <div key={report.id}><a href={report.url} target="_blank" rel="noreferrer">{report.source}: {report.title} ↗</a><small>Published {stamp(report.occurredAt)} · {report.location ? `${report.location.precision} (${report.location.lat.toFixed(2)}, ${report.location.lng.toFixed(2)})` : "precise location not established"}</small>{event.reports.length > 1 && <button onClick={() => onSeparate(report.id)}>Separate this report</button>}</div>)}</div>
    <div className="regional-review"><label>Review status<select value={review?.status || "unreviewed"} onChange={(change) => onReview({ status: change.target.value as Review["status"] })}><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option><option value="needs checking">Needs checking</option></select></label><button aria-pressed={review?.saved || false} onClick={() => onReview({ saved: !review?.saved })}>{review?.saved ? "Saved" : "Save investigation"}</button></div>
    <label className="regional-note">Analyst note<textarea value={review?.note || ""} onChange={(change) => onReview({ note: change.target.value })} placeholder="Record a correction or follow-up…" /></label>
    <small className="regional-local-note">Review decisions and notes are stored in this browser.</small>
  </article>;
}
