"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Globe2,
  Satellite,
  Search,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import {
  SOURCE_DEFINITIONS,
  SATELLITE_SOURCE,
  type SourceResult,
  type SatelliteResult,
  type SourceHealth,
} from "@/lib/intelligence/types";
import { rankDevelopments } from "@/lib/intelligence/normalize";
import { missionFor } from "@/lib/intelligence/profiles";
import type { FlashpointResult } from "@/lib/intelligence/flashpoints";
import BroadcastPanel from "./BroadcastPanel";
import SatelliteDossier from "./SatelliteDossier";
import { FlashpointMonitor, FlashpointDetail } from "./FlashpointMonitor";
import { HoverPreview } from "./HoverPreview";
import InvestigationWorkspace from "./InvestigationWorkspace";
import "./desk.css";
const SatelliteGlobe = dynamic(() => import("./SatelliteGlobe"), {
  ssr: false,
  loading: () => (
    <div className="desk-map-loading">Preparing orbital view…</div>
  ),
});
const SituationMap = dynamic(() => import("./SituationMap"), {
  ssr: false,
  loading: () => (
    <div className="desk-map-loading">Loading geographic workspace…</div>
  ),
});
type Mode = "global" | "space" | "sources";
function age(value: string | null, now: number) {
  if (!value) return "Never retrieved";
  const elapsed = Math.max(0, now - Date.parse(value));
  if (elapsed < 60000) return "<1m ago";
  if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m ago`;
  if (elapsed < 86400000) return `${Math.floor(elapsed / 3600000)}h ago`;
  return `${Math.floor(elapsed / 86400000)}d ago`;
}
function date(value: string) {
  return (
    new Date(value).toLocaleString(undefined, {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " UTC"
  );
}
function failure(id: string, message: string): SourceHealth {
  const def =
    id === SATELLITE_SOURCE.id
      ? SATELLITE_SOURCE
      : SOURCE_DEFINITIONS.find((d) => d.id === id)!;
  return {
    ...def,
    state: "unavailable",
    count: 0,
    fetchedAt: null,
    checkedAt: new Date().toISOString(),
    nextCheckAt: new Date(Date.now() + def.refreshMs).toISOString(),
    error: message,
  };
}
export default function IntelligenceDesk() {
  const [mode, setMode] = useState<Mode>("global"),
    [results, setResults] = useState<Record<string, SourceResult>>({}),
    [satellites, setSatellites] = useState<SatelliteResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [satelliteId, setSatelliteId] = useState<string | null>("25544"),
    [satelliteLookup, setSatelliteLookup] = useState(""),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [recordLimit, setRecordLimit] = useState(100),
    [tab, setTab] = useState<"brief" | "evidence">("brief");
  const [now, setNow] = useState(0),
    [lastVisit, setLastVisit] = useState<number | null>(null),
    [onlyNew, setOnlyNew] = useState(false),
    [purpose, setPurpose] = useState("all"),
    [flashpoints, setFlashpoints] = useState<FlashpointResult | null>(null),
    [monitorError, setMonitorError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"day" | "night">("day");
  const [imageryEnabled, setImageryEnabled] = useState(false),
    [imageryDate, setImageryDate] = useState("");
  const [investigation, setInvestigation] = useState<string | null>(null);
  useEffect(() => {
    setImageryDate(new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10));
  }, []);
  useEffect(() => {
    try {
      if (localStorage.getItem("knuckletat:theme") === "night")
        setTheme("night");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.dataset.deskTheme = theme;
    try {
      localStorage.setItem("knuckletat:theme", theme);
    } catch {}
    return () => {
      delete document.documentElement.dataset.deskTheme;
    };
  }, [theme]);
  const satelliteRef = useRef<string | null>(null);
  useEffect(() => {
    satelliteRef.current = satelliteId;
  }, [satelliteId]);
  useEffect(() => {
    setNow(Date.now());
    try {
      const previous = Number(localStorage.getItem("intelligence:lastVisit"));
      if (previous > 0) setLastVisit(previous);
      localStorage.setItem("intelligence:lastVisit", String(Date.now()));
    } catch {}
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setBusy(true);
      try {
        const response = await fetch("/api/intelligence/monitor", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Monitor HTTP ${response.status}`);
        const data: { results: SourceResult[]; flashpoints: FlashpointResult } =
          await response.json();
        if (active) {
          setResults(
            Object.fromEntries(data.results.map((r) => [r.health.id, r])),
          );
          setFlashpoints(data.flashpoints);
          setMonitorError("");
        }
      } catch (e) {
        if (active) {
          const message =
            e instanceof Error ? e.message : "Monitor unavailable";
          setMonitorError(
            `Monitor offline · ${message} · showing last retrieved watches`,
          );
          setResults((old) =>
            Object.fromEntries(
              SOURCE_DEFINITIONS.map((def) => {
                const previous = old[def.id];
                return [
                  def.id,
                  {
                    data: previous?.data || [],
                    health: {
                      ...(previous?.health || failure(def.id, message)),
                      state: previous?.health.fetchedAt
                        ? "stale"
                        : "unavailable",
                      error: message,
                    },
                  },
                ];
              }),
            ),
          );
        }
      }
      if (active) setBusy(false);
    }
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (mode === "sources") return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const id = satelliteRef.current;
        const response = await fetch(
          `/api/intelligence/satellites${id ? `?id=${id}` : ""}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Dashboard HTTP ${response.status}`);
        const data: SatelliteResult = await response.json();
        if (active) setSatellites(data);
      } catch (e) {
        if (active)
          setSatellites((old) => ({
            data: old?.data || [],
            health: {
              ...(old?.health ||
                failure(SATELLITE_SOURCE.id, "Request failed")),
              state: old?.health.fetchedAt ? "stale" : "unavailable",
              error: e instanceof Error ? e.message : "Request failed",
            },
          }));
      }
    }
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [mode, investigation, satelliteId, refresh]);
  const items = useMemo(
    () => rankDevelopments(Object.values(results).flatMap((r) => r.data)),
    [results],
  );
  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (filter === "all" || i.kind === filter) &&
          (!onlyNew || !lastVisit || Date.parse(i.occurredAt) > lastVisit) &&
          (!query ||
            `${i.title} ${i.source}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [items, filter, onlyNew, lastVisit, query],
  );
  const selectedFlashpoint = flashpoints?.data.find((f) => f.id === selected);
  const selectedItem =
      items.find((i) => i.id === selected) ||
      flashpoints?.data
        .flatMap((f) => f.reports)
        .find((i) => i.id === selected) ||
      null,
    selectedSat = satellites?.data.find((s) => s.id === satelliteId);
  const space = mode === "space";
  const satMatches = useMemo(
    () =>
      (satellites?.data || []).filter((s) => {
        const profile = missionFor(s);
        return (
          (mode !== "space" || purpose === "all" ||
            (profile?.purpose || "Not documented") === purpose) &&
          (mode !== "space" ||
            `${s.name} ${s.id} ${profile?.operator || ""} ${profile?.purpose || ""}`
              .toLowerCase()
              .includes(query.toLowerCase()))
        );
      }),
    [satellites, query, purpose, mode],
  );
  const satelliteSuggestions = useMemo(
    () => satelliteLookup.trim()
      ? (satellites?.data || []).filter((s) =>
          `${s.name} ${s.id}`.toLowerCase().includes(satelliteLookup.toLowerCase()),
        ).slice(0, 6)
      : [],
    [satellites, satelliteLookup],
  );
  const reviewedCount = useMemo(
    () => (satellites?.data || []).filter((s) => missionFor(s)).length,
    [satellites],
  );
  const health = Object.values(results).map((r) => r.health);
  if (satellites) health.push(satellites.health);
  const issues = health.filter((h) => h.state !== "healthy");
  const handleSelect = useCallback(
    (id: string) => {
      if (space) setSatelliteId(id);
      else setSelected(id);
    },
    [space],
  );
  const activeInvestigation = flashpoints?.data.find(
    (f) => f.id === investigation,
  );
  useEffect(() => {
    if (mode === "global" && activeInvestigation)
      document
        .getElementById("investigation")
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    // Only an explicit watch/mode change should move the reading position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInvestigation?.id, mode]);
  const investigate = (id: string) => {
    setSelected(id);
    setInvestigation(id);
    setMode("global");
  };
  const switchMode = (next: Mode) => {
    setMode(next);
    setRecordLimit(100);
    setQuery("");
  };
  const selectedHealth = selectedItem
    ? results[selectedItem.sourceId]?.health
    : null;
  return (
    <main className="intelligence-desk" data-theme={theme}>
      <header className="desk-header">
        <div className="desk-brand">
          <Image
            className="desk-brand-logo"
            src="/knuckle-tat-logo-single-line.png"
            alt="KNUCKLETAT"
            width={2073}
            height={759}
            priority
          />
          <small>aggregated open source intel.</small>
        </div>
        <div className="desk-clock">
          {now ? new Date(now).toISOString().slice(11, 16) : "--:--"} UTC
        </div>
        <button
          className="desk-theme-switch"
          onClick={() => setTheme(theme === "day" ? "night" : "day")}
          aria-label={`Switch to ${theme === "day" ? "night" : "day"} theme`}
        >
          {theme === "day" ? <Moon size={15} /> : <Sun size={15} />}
          <span>{theme === "day" ? "Night" : "Day"}</span>
        </button>
        <Link href="/explore">
          Legacy explorer <ArrowUpRight size={13} />
        </Link>
      </header>
      <nav className="desk-navigation" aria-label="Workspace">
        <button
          aria-pressed={mode === "global"}
          onClick={() => switchMode("global")}
        >
          <Globe2 size={14} />
          Global
        </button>
        <button aria-pressed={space} onClick={() => switchMode("space")}>
          <Satellite size={14} />
          Satellites
        </button>
        <button
          aria-pressed={mode === "sources"}
          onClick={() => switchMode("sources")}
        >
          <Activity size={14} />
          Source health{" "}
          {issues.length > 0 && (
            <span className="desk-count">{issues.length}</span>
          )}
        </button>
        <span className="desk-nav-note">
          DIRECT PROVIDERS · ATTRIBUTED RECORDS
        </span>
        <button
          aria-label="Refresh dashboard"
          disabled={busy}
          onClick={() => setRefresh((v) => v + 1)}
        >
          <RefreshCw size={13} />
          {busy ? "Updating" : "Refresh"}
        </button>
      </nav>
      {mode === "global" && (
        <nav className="desk-section-links" aria-label="Overview sections">
          <a href="#watches">Watches & broadcasts</a>
          <a href="#global-map">Global map</a>
          <a href="#satellite-overview">Satellites</a>
          <a href="#developments">Developments</a>
          <a href="#source-summary">Sources</a>
        </nav>
      )}
      <div className="desk-healthstrip">
        <span className="desk-green">
          {health.filter((h) => h.state === "healthy").length} sources
          responding
        </span>
        <span>
          {health.length < SOURCE_DEFINITIONS.length
            ? "Connecting sources…"
            : `${items.length} records · ${items.filter((i) => i.location).length} located observations`}
        </span>
        <span className={issues.length ? "desk-amber" : ""}>
          {issues.length
            ? `${issues.length} source ${issues.length === 1 ? "issue" : "issues"} — inspect Source health`
            : "Availability does not verify claims"}
        </span>
      </div>
      {mode === "sources" ? (
        <section className="desk-panel desk-source-page">
          <div className="desk-panel-title">
            <h1>Source health & coverage</h1>
            <span>ORIGINAL PROVIDERS</span>
          </div>
          <p>
            Each connector records its own retrieval time. Failed refreshes
            retain dated data. News coverage is limited to the publishers listed
            here.
          </p>
          <div className="desk-source-table">
            <table>
              <thead>
                <tr>
                  <th>Provider / coverage</th>
                  <th>State</th>
                  <th>Records</th>
                  <th>Last success</th>
                  <th>Refresh</th>
                </tr>
              </thead>
              <tbody>
                {[...SOURCE_DEFINITIONS, SATELLITE_SOURCE].map((def) => {
                  const h = health.find((h) => h.id === def.id);
                  return (
                    <tr key={def.id}>
                      <td>
                        <a href={def.url} target="_blank" rel="noreferrer">
                          {def.name} ↗
                        </a>
                        <small>{def.coverage}</small>
                        {h?.error && (
                          <small className="desk-amber">{h.error}</small>
                        )}
                      </td>
                      <td
                        className={
                          h?.state === "healthy" ? "desk-green" : "desk-amber"
                        }
                      >
                        {h?.state ||
                          (def.id === SATELLITE_SOURCE.id
                            ? "Loads in Satellites"
                            : "Connecting")}
                      </td>
                      <td>{h?.count ?? "—"}</td>
                      <td>{h?.fetchedAt ? date(h.fetchedAt) : "—"}</td>
                      <td>{def.refreshMs / 60000} min</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="desk-coverage-notes">
            <h2>Coverage still to connect</h2>
            <p>
              Regional ADS-B aviation and AIS Stream maritime adapters are
              available inside investigations. AIS requires a server-side API
              key; absent coverage is shown explicitly. UN News supplies
              institutional reporting, not a complete humanitarian incident
              dataset. NASA GIBS daily imagery is available on the overview map;
              camera integration is not enabled in this workspace yet.
            </p>
            <h2>How records are ordered</h2>
            <p>
              USGS significance ≥600 first; all remaining observations and
              publisher reports ordered by time. This is a transparent starting
              rule, not a global threat score. Repetition across publishers is
              not treated as independent confirmation. Flashpoints group
              headline topics and named regions; a continuous 24-hour baseline
              is required for surge detection. Collection runs while this
              dashboard is open or the collector process is running.
            </p>
          </div>
        </section>
      ) : (
        <>
          {!space && (
            <div className="desk-overview-lead" id="watches">
              <FlashpointMonitor
                result={flashpoints}
                selected={selected}
                onSelect={investigate}
                error={monitorError}
                compact
              />
              <BroadcastPanel />
            </div>
          )}
          {!space && activeInvestigation && (
            <InvestigationWorkspace
              flashpoint={activeInvestigation}
              related={(flashpoints?.data || []).filter(
                (f) =>
                  f.id !== activeInvestigation.id &&
                  f.reports.some((r) =>
                    activeInvestigation.reports.some((a) => a.id === r.id),
                  ),
              )}
              onWatch={investigate}
              satellites={satellites}
              theme={theme}
              onClose={() => setInvestigation(null)}
              onSatellite={(id) => {
                setSatelliteId(id);
                switchMode("space");
              }}
            />
          )}
          <div className="desk-main-grid">
            <section className="desk-panel" id={!space ? "global-map" : undefined}>
              <div className="desk-panel-title">
                <h1>{space ? "Orbital traffic" : "Global situation"}</h1>
                <span>
                  {space ? "PREDICTED POSITIONS" : "PROVIDER OBSERVATIONS"}
                </span>
              </div>
              <div className="desk-map-caption">
                {space
                  ? `${satellites?.data.length.toLocaleString() || "—"} active objects · ${reviewedCount.toLocaleString()} with mission context · hover to preview, click to inspect`
                  : "Filled dots: provider locations · rings: regional watches, not precise incident locations · hover to preview"}
                {space && satelliteId && (
                  <button
                    onClick={() => {
                      setSatelliteId(null);
                      setQuery("");
                      setPurpose("all");
                    }}
                  >
                    Clear selection & search
                  </button>
                )}
              </div>
              {!space && (
                <div className="desk-imagery-controls">
                  <button aria-pressed={imageryEnabled} disabled={!imageryDate} onClick={() => setImageryEnabled((enabled) => !enabled)}>
                    {imageryEnabled ? "Hide imagery" : "Show NASA imagery"}
                  </button>
                  <label>
                    Product date (UTC)
                    <input
                      type="date"
                      aria-label="NASA imagery product date"
                      value={imageryDate}
                      max={now ? new Date(now - 86_400_000).toISOString().slice(0, 10) : undefined}
                      onChange={(event) => setImageryDate(event.target.value)}
                    />
                  </label>
                  <span>MODIS Terra daily mosaic · exact acquisition time varies by location · dark gaps mean no imagery · <a href="https://worldview.earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Worldview ↗</a></span>
                </div>
              )}
              {space && (
                <div className="desk-space-controls">
                  <div className="desk-filters">
                    <label className="desk-search">
                      <Search size={15} />
                      <input
                        aria-label="Search satellites"
                        placeholder="Search name, operator, purpose or ID…"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setSatelliteId(null);
                          setRecordLimit(100);
                        }}
                      />
                    </label>
                    <select
                      aria-label="Satellite purpose"
                      value={purpose}
                      onChange={(e) => {
                        setPurpose(e.target.value);
                        setSatelliteId(null);
                        setRecordLimit(100);
                      }}
                    >
                      {[
                        "all",
                        "Communications",
                        "Earth observation",
                        "Navigation",
                        "Research",
                        "Not documented",
                      ].map((p) => (
                        <option key={p} value={p}>
                          {p === "all" ? "All purposes" : p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="desk-space-shortcuts">
                    <span>Start with a known mission</span>
                    {[
                      { id: "25544", name: "ISS" },
                      { id: "49332", name: "SES-17" },
                      { id: "49260", name: "Landsat 9" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setQuery("");
                          setPurpose("all");
                          setSatelliteId(s.id);
                          setRecordLimit(100);
                        }}
                      >
                        {s.name}
                      </button>
                    ))}
                    <span>{satMatches.length.toLocaleString()} matches</span>
                  </div>
                </div>
              )}
              {space ? (
                <SatelliteGlobe
                  contextOrbits={satellites?.contextOrbits || []}
                  satellites={satMatches}
                  selected={selectedSat || null}
                  orbit={
                    satellites?.selectedId === satelliteId
                      ? satellites.orbit || []
                      : []
                  }
                  onSelect={handleSelect}
                />
              ) : (
                <SituationMap
                  items={visible}
                  flashpoints={flashpoints?.data || []}
                  satellites={[]}
                  selected={selected}
                  track={[]}
                  onSelect={handleSelect}
                  space={false}
                  theme={theme}
                  imageryEnabled={imageryEnabled}
                  imageryDate={imageryDate}
                />
              )}
              <div className="desk-map-caption desk-map-bottom">
                <span>
                  {space ? (
                    "SGP4 orbital predictions · CelesTrak GP/OMM"
                  ) : (
                    <span className="desk-legend">
                      <span>
                        <i className="quake" />
                        Earthquakes
                      </span>
                      <span>
                        <i className="hazard" />
                        Natural events
                      </span>
                      <span>
                        <i className="watch" />
                        Regional watches
                      </span>
                    </span>
                  )}
                </span>
                <span>
                  {space
                    ? satellites?.health.state || "Connecting CelesTrak"
                    : "Select a marker or a record"}
                </span>
              </div>
            </section>
            <aside className="desk-side">
              <section className="desk-panel desk-context">
                <div className="desk-panel-title">
                  <h2>{space ? "Mission inspector" : "Evidence context"}</h2>
                  <span>
                    {space ? "ORBITAL ELEMENTS" : "CURRENT SELECTION"}
                  </span>
                </div>
                {space ? (
                  <>
                    <strong>
                      {selectedSat?.name || "Select a satellite to investigate"}
                    </strong>
                    <p>
                      {selectedSat
                        ? missionFor(selectedSat)?.summary ||
                          "Mission details have not been established for this catalogue object."
                        : "Search above or select an object on the globe. Hover for orbital details, then click to inspect its mission."}
                    </p>
                    <span className="desk-muted">
                      {selectedSat
                        ? `${missionFor(selectedSat)?.scope || "Orbit only"} · ${selectedSat.altKm.toFixed(0)} km altitude`
                        : "Profiles link to original operators and space agencies."}
                    </span>
                    {selectedSat && (
                      <>
                        <div className="desk-orbit-metrics">
                          <span>
                            <b>{selectedSat.altKm.toFixed(0)}</b> km altitude
                          </span>
                          <span>
                            <b>{selectedSat.speedKmS?.toFixed(2) || "—"}</b>{" "}
                            km/s
                          </span>
                          <span>
                            <b>{selectedSat.inclination?.toFixed(1) || "—"}°</b>{" "}
                            inclination
                          </span>
                          <span>
                            <b>{selectedSat.periodMinutes.toFixed(1)}</b> min
                            orbit
                          </span>
                        </div>
                        <div className="desk-inspector-section">
                          <h3>Operator</h3>
                          <p>
                            {missionFor(selectedSat)?.operator ||
                              "Not established"}
                          </p>
                        </div>
                        <div className="desk-inspector-section">
                          <h3>Capabilities</h3>
                          <ul>
                            {(
                              missionFor(selectedSat)?.capabilities || [
                                "Payload and capabilities have not been established.",
                              ]
                            )
                              .slice(0, 3)
                              .map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                          </ul>
                        </div>
                        <div className="desk-inspector-section">
                          <h3>Publicly documented users & clients</h3>
                          <p>
                            {missionFor(selectedSat)
                              ?.customers.map((c) => c.name)
                              .join(" · ") ||
                              missionFor(selectedSat)?.users ||
                              "Not established"}
                          </p>
                          <small>
                            {missionFor(selectedSat)?.scope || "Catalogue"}{" "}
                            context · see each disclosure’s scope and date.
                          </small>
                        </div>
                        <a href="#desk-details">
                          Full dossier, disclosures & sources ↓
                        </a>
                      </>
                    )}
                  </>
                ) : selectedFlashpoint ? (
                  <>
                    <strong>
                      {selectedFlashpoint.region} · {selectedFlashpoint.topic}
                    </strong>
                    <p>{selectedFlashpoint.reasons[0]}</p>
                    <span className="desk-muted">
                      {selectedFlashpoint.location?.precision ||
                        "Location unresolved"}{" "}
                      · reports are not independently verified.
                    </span>
                    <button onClick={() => investigate(selectedFlashpoint.id)}>
                      Open combined investigation →
                    </button>
                    <a href="#desk-details">Inspect supporting evidence ↓</a>
                  </>
                ) : selectedItem ? (
                  <>
                    <strong>{selectedItem.title}</strong>
                    <p>
                      {selectedItem.location
                        ? "Provider-supplied geographic observation."
                        : "No precise event location established. The map remains in its current view."}
                    </p>
                    <a href={selectedItem.url} target="_blank" rel="noreferrer">
                      Read original evidence ↗
                    </a>
                    <p className="desk-muted">
                      Broadcast channels are independent of the selected record.
                    </p>
                  </>
                ) : (
                  <p>
                    Select a development to inspect its source, time and
                    location precision.
                  </p>
                )}
              </section>
            </aside>
          </div>
          {!space && (
            <div className="desk-satellite-overview" id="satellite-overview">
              <section className="desk-panel desk-satellite-stage">
                <div className="desk-panel-title">
                  <h2><Satellite size={15} /> Satellite globe</h2>
                  <span>PREDICTED POSITIONS · CELESTRAK</span>
                </div>
                <div className="desk-map-caption">
                  {satellites
                    ? `${satellites.data.length.toLocaleString()} propagated objects · elements last retrieved ${age(satellites.health.fetchedAt, now)}`
                    : "Retrieving the active orbital catalogue…"}
                  {satellites?.health.error && <span className="desk-amber"> · {satellites.health.error}</span>}
                </div>
                <SatelliteGlobe
                  contextOrbits={satellites?.contextOrbits || []}
                  satellites={satellites?.data || []}
                  selected={selectedSat || null}
                  orbit={satellites?.selectedId === satelliteId ? satellites.orbit || [] : []}
                  onSelect={setSatelliteId}
                />
                <div className="desk-map-caption desk-map-bottom">
                  <span>SGP4 predictions at the displayed time. Points are not imagery or live spacecraft telemetry.</span>
                  <button onClick={() => switchMode("space")}>Open full satellite workspace →</button>
                </div>
              </section>
              <aside className="desk-panel desk-satellite-brief">
                <div className="desk-panel-title">
                  <h2>Mission dossier</h2>
                  <span>SELECT AN OBJECT</span>
                </div>
                <label className="desk-search desk-satellite-search">
                  <Search size={14} />
                  <input
                    aria-label="Find a satellite on the overview"
                    placeholder="Search name or catalogue ID…"
                    value={satelliteLookup}
                    onChange={(event) => setSatelliteLookup(event.target.value)}
                  />
                </label>
                {satelliteLookup && (
                  <div className="desk-satellite-suggestions">
                    {satelliteSuggestions.length
                      ? satelliteSuggestions.map((s) => (
                          <button key={s.id} onClick={() => { setSatelliteId(s.id); setSatelliteLookup(""); }}>
                            {s.name} <small>#{s.id}</small>
                          </button>
                        ))
                      : <p>{satellites ? "No matching catalogue objects." : "Catalogue loading…"}</p>}
                  </div>
                )}
                <div className="desk-satellite-shortcuts">
                  {[{ id: "25544", name: "ISS" }, { id: "49260", name: "Landsat 9" }, { id: "49332", name: "SES-17" }].map((s) => (
                    <button key={s.id} aria-pressed={satelliteId === s.id} onClick={() => setSatelliteId(s.id)}>{s.name}</button>
                  ))}
                </div>
                <div className="desk-satellite-dossier">
                  {selectedSat ? (
                    <>
                      <h3>{selectedSat.name}</h3>
                      <p className="desk-muted">
                        {selectedSat.altKm.toFixed(0)} km altitude · predicted {date(selectedSat.predictedAt)} · elements {selectedSat.elementAgeHours.toFixed(1)}h old
                      </p>
                      <SatelliteDossier satellite={selectedSat} />
                    </>
                  ) : (
                    <p className="desk-muted">
                      {satellites?.health.error || "Loading the selected mission. Choose a globe point or search the catalogue."}
                    </p>
                  )}
                </div>
              </aside>
            </div>
          )}
          <div className="desk-bottom-grid">
            <section className="desk-panel" id={!space ? "developments" : undefined}>
              <div className="desk-panel-title">
                <h2>{space ? "Find a satellite" : "Developments"}</h2>
                <span>
                  {space
                    ? `${satMatches.length} MATCHES`
                    : `${visible.length} RECORDS`}
                </span>
              </div>
              {!space && (
                <div className="desk-filters">
                  <label className="desk-search">
                    <Search size={14} />
                    <input
                      aria-label={
                        space ? "Search satellites" : "Search developments"
                      }
                      placeholder={
                        space
                          ? "Name, operator, purpose or ID…"
                          : "Search reporting and observations…"
                      }
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setRecordLimit(100);
                      }}
                    />
                  </label>
                  {space && (
                    <select
                      aria-label="Satellite purpose"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                    >
                      {[
                        "all",
                        "Communications",
                        "Earth observation",
                        "Navigation",
                        "Research",
                        "Not documented",
                      ].map((p) => (
                        <option key={p} value={p}>
                          {p === "all" ? "All purposes" : p}
                        </option>
                      ))}
                    </select>
                  )}
                  {!space && (
                    <>
                      <select
                        aria-label="Record type"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All records</option>
                        <option value="report">Reporting</option>
                        <option value="earthquake">Earthquakes</option>
                        <option value="hazard">Natural events</option>
                      </select>
                      <label className="desk-new">
                        <input
                          type="checkbox"
                          checked={onlyNew}
                          onChange={(e) => setOnlyNew(e.target.checked)}
                        />
                        Since last visit
                      </label>
                    </>
                  )}
                </div>
              )}
              <div className="desk-records">
                {space
                  ? satMatches.slice(0, recordLimit).map((s) => (
                      <HoverPreview
                        key={s.id}
                        title={s.name}
                        lines={[
                          missionFor(s)?.summary ||
                            "Mission not yet documented",
                          missionFor(s)?.operator || "Operator not established",
                          `${s.altKm.toFixed(0)} km · elements ${s.elementAgeHours.toFixed(1)}h old`,
                        ]}
                      >
                        <button
                          className="desk-record"
                          key={s.id}
                          aria-pressed={satelliteId === s.id}
                          onClick={() => setSatelliteId(s.id)}
                        >
                          <span className="desk-record-top">
                            <span>CelesTrak · {s.id}</span>
                            <span>{s.altKm.toFixed(0)} km</span>
                          </span>
                          <strong>
                            {s.name}{" "}
                            <span className="desk-purpose-tag">
                              {missionFor(s)?.purpose || "Not documented"}
                            </span>
                          </strong>
                          <small>
                            Elements {s.elementAgeHours.toFixed(1)}h old ·
                            predicted {date(s.predictedAt)}
                          </small>
                        </button>
                      </HoverPreview>
                    ))
                  : visible.slice(0, recordLimit).map((i) => (
                      <HoverPreview
                        key={i.id}
                        title={i.title}
                        lines={[
                          `${i.source} · ${date(i.occurredAt)}`,
                          i.summary,
                          i.location
                            ? "Provider observation"
                            : "Precise location not established",
                        ]}
                      >
                        <button
                          className="desk-record"
                          key={i.id}
                          aria-pressed={selected === i.id}
                          onClick={() => setSelected(i.id)}
                        >
                          <span className="desk-record-top">
                            <span>
                              {i.source} /{" "}
                              {i.kind === "report"
                                ? "REPORT"
                                : i.kind.toUpperCase()}
                            </span>
                            <span>{age(i.occurredAt, now)}</span>
                          </span>
                          <strong>{i.title}</strong>
                          <small>
                            {i.reason}
                            {results[i.sourceId]?.health.state === "stale"
                              ? " · STALE SOURCE"
                              : ""}
                          </small>
                        </button>
                      </HoverPreview>
                    ))}
                {(space ? !satMatches.length : !visible.length) && (
                  <div className="desk-empty">
                    {space
                      ? satellites?.health.error ||
                        "No satellite records yet. Check source health for availability."
                      : busy
                        ? "Retrieving original provider records…"
                        : "No matching records. Check filters and source health."}
                  </div>
                )}
                {(space ? satMatches.length : visible.length) > recordLimit && (
                  <div className="desk-empty">
                    Showing {recordLimit} of{" "}
                    {space ? satMatches.length : visible.length} records.{" "}
                    <button onClick={() => setRecordLimit((n) => n + 100)}>
                      Show next 100
                    </button>
                  </div>
                )}
              </div>
            </section>
            <section className="desk-panel" id="desk-details">
              <div className="desk-panel-title">
                <h2>
                  {space
                    ? "Satellite dossier"
                    : selectedFlashpoint
                      ? "Flashpoint evidence"
                      : "Selected development"}
                </h2>
                <span>PROVENANCE</span>
              </div>
              {!space && !selectedFlashpoint && (
                <div className="desk-detail-tabs">
                  <button
                    aria-pressed={tab === "brief"}
                    onClick={() => setTab("brief")}
                  >
                    Brief
                  </button>
                  <button
                    aria-pressed={tab === "evidence"}
                    onClick={() => setTab("evidence")}
                  >
                    Evidence
                  </button>
                </div>
              )}
              <div className="desk-detail" aria-live="polite">
                {space ? (
                  selectedSat ? (
                    <>
                      <h2>{selectedSat.name}</h2>
                      <SatelliteDossier satellite={selectedSat} />
                      <h3>Orbit & predicted position</h3>
                      <dl>
                        <dt>Catalogue ID</dt>
                        <dd>{selectedSat.id}</dd>
                        <dt>Altitude</dt>
                        <dd>{selectedSat.altKm.toFixed(1)} km above WGS84</dd>
                        <dt>Element epoch</dt>
                        <dd>{date(selectedSat.epoch)}</dd>
                        <dt>Element age</dt>
                        <dd
                          className={
                            selectedSat.elementAgeHours > 72 ? "desk-amber" : ""
                          }
                        >
                          {selectedSat.elementAgeHours.toFixed(1)} hours
                          {selectedSat.elementAgeHours > 72
                            ? " · old elements; prediction uncertainty increases"
                            : ""}
                        </dd>
                        <dt>Predicted at</dt>
                        <dd>{date(selectedSat.predictedAt)}</dd>
                        <dt>Period</dt>
                        <dd>{selectedSat.periodMinutes.toFixed(1)} minutes</dd>
                        <dt>Orbital path</dt>
                        <dd>
                          One predicted revolution in an Earth-fixed frame.
                        </dd>
                      </dl>
                      <a
                        href={`https://celestrak.org/NORAD/elements/gp.php?CATNR=${selectedSat.id}&FORMAT=JSON`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Original CelesTrak elements ↗
                      </a>
                    </>
                  ) : (
                    <div className="desk-empty">
                      <Satellite size={28} />
                      <h2>Search, select, follow</h2>
                      <p>
                        Search a spacecraft by name or catalogue ID. Select it
                        to view its position, predicted orbital path and the age
                        of its source elements.
                      </p>
                    </div>
                  )
                ) : selectedFlashpoint ? (
                  <FlashpointDetail
                    item={selectedFlashpoint}
                    onReport={setSelected}
                  />
                ) : selectedItem ? (
                  <>
                    <h2>{selectedItem.title}</h2>
                    {tab === "brief" ? (
                      <>
                        <p>{selectedItem.summary}</p>
                        <dl>
                          <dt>Why surfaced</dt>
                          <dd>{selectedItem.reason}</dd>
                          <dt>
                            {selectedItem.sourceId === "gdacs"
                              ? "Alert published"
                              : selectedItem.kind === "report"
                                ? "Published"
                                : "Observed"}
                          </dt>
                          <dd>{date(selectedItem.occurredAt)}</dd>
                          <dt>Location</dt>
                          <dd>
                            {selectedItem.location
                              ? `${selectedItem.location.lat.toFixed(3)}, ${selectedItem.location.lng.toFixed(3)} · provider observation`
                              : "Not established; no map pin inferred"}
                          </dd>
                        </dl>
                      </>
                    ) : (
                      <dl>
                        <dt>Provider</dt>
                        <dd>{selectedItem.source}</dd>
                        <dt>Record ID</dt>
                        <dd className="desk-wrap">{selectedItem.id}</dd>
                        <dt>Last retrieval</dt>
                        <dd>
                          {selectedHealth?.fetchedAt
                            ? date(selectedHealth.fetchedAt)
                            : "Unknown"}
                        </dd>
                        <dt>Source state</dt>
                        <dd>{selectedHealth?.state}</dd>
                        <dt>Source update</dt>
                        <dd>
                          {selectedItem.updatedAt
                            ? date(selectedItem.updatedAt)
                            : "Not supplied"}
                        </dd>
                        <dt>Verification</dt>
                        <dd>
                          {selectedItem.sourceId === "gdacs"
                            ? "Provider disaster alert; publication time does not establish event onset"
                            : selectedItem.kind === "report"
                              ? "Attributed report; not independently verified here"
                              : "Provider observation; human impact not inferred"}
                        </dd>
                      </dl>
                    )}
                    <a href={selectedItem.url} target="_blank" rel="noreferrer">
                      Open original source <ArrowUpRight size={13} />
                    </a>
                  </>
                ) : (
                  <div className="desk-empty">
                    <Globe2 size={28} />
                    <h2>Follow what matters</h2>
                    <p>
                      Start with a flashpoint above to inspect the evidence, or
                      browse individual reports. Hover cards explain each object
                      before you select it.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
          {!space && (
            <section className="desk-panel desk-source-summary" id="source-summary">
              <div className="desk-panel-title">
                <h2><Activity size={15} /> Source health</h2>
                <button onClick={() => switchMode("sources")}>Full source table →</button>
              </div>
              <p>Availability describes retrieval, not the accuracy of a report. Failed refreshes retain the original successful retrieval time.</p>
              <div className="desk-source-chips">
                {[...health].sort((a, b) => Number(a.state === "healthy") - Number(b.state === "healthy"))
                  .map((source) => (
                    <div key={source.id} className="desk-source-chip">
                      <strong>{source.name}</strong>
                      <span className={source.state === "healthy" ? "desk-green" : "desk-amber"}>{source.state}</span>
                      <small>{age(source.fetchedAt, now)}</small>
                    </div>
                  ))}
                {!health.length && <p className="desk-muted">Connecting to original providers…</p>}
              </div>
              <p className="desk-coverage-next">
                Additional coverage: regional aircraft is available in investigations. Live AIS vessels need a server API key; <a href="https://firms.modaps.eosdis.nasa.gov/api/" target="_blank" rel="noreferrer">NASA FIRMS</a> needs a MAP_KEY; <a href="https://apidoc.reliefweb.int/parameters" target="_blank" rel="noreferrer">ReliefWeb</a> requires an approved appname. These feeds are not counted as connected here.
              </p>
            </section>
          )}
        </>
      )}
      <footer className="desk-footer">
        <span>KNUCKLETAT · OSIRIS FORK</span>
        <span>
          Source status describes retrieval, not truth · UTC timestamps
        </span>
        <a
          href="https://github.com/mathiswrong/osiris"
          target="_blank"
          rel="noreferrer"
        >
          Source code ↗
        </a>
      </footer>
    </main>
  );
}
