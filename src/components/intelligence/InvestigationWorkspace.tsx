"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, Layers, X } from "lucide-react";
import type { Flashpoint } from "@/lib/intelligence/flashpoints";
import type { SatelliteResult, SourceResult } from "@/lib/intelligence/types";
import { distanceKm, type TrafficContact } from "@/lib/intelligence/traffic";
import { missionFor } from "@/lib/intelligence/profiles";
import { HoverPreview } from "./HoverPreview";
const Map = dynamic(() => import("./SituationMap"), { ssr: false });
export default function InvestigationWorkspace(props: {
  flashpoint: Flashpoint;
  related: Flashpoint[];
  onWatch: (id: string) => void;
  satellites: SatelliteResult | null;
  theme: "day" | "night";
  onClose: () => void;
  onSatellite: (id: string) => void;
}) {
  // Key the session to a watch so contacts from another region cannot flash in while loading.
  return <InvestigationSession key={props.flashpoint.id} {...props} />;
}
function InvestigationSession({
  flashpoint,
  related,
  onWatch,
  satellites,
  theme,
  onClose,
  onSatellite,
}: {
  flashpoint: Flashpoint;
  related: Flashpoint[];
  onWatch: (id: string) => void;
  satellites: SatelliteResult | null;
  theme: "day" | "night";
  onClose: () => void;
  onSatellite: (id: string) => void;
}) {
  const [center, setCenter] = useState(
    flashpoint.location
      ? { lat: flashpoint.location.lat, lng: flashpoint.location.lng }
      : null,
  );
  const [manual, setManual] = useState(false),
    [latInput, setLatInput] = useState(String(center?.lat ?? "")),
    [lngInput, setLngInput] = useState(String(center?.lng ?? ""));
  const [radius, setRadius] = useState(463),
    [results, setResults] = useState<SourceResult<TrafficContact>[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null),
    [layers, setLayers] = useState({
      aircraft: true,
      vessel: true,
      military: true,
      satellite: true,
      observations: true,
    });
  const [now, setNow] = useState(() => Date.now()),
    [limit, setLimit] = useState(35);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!center) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/intelligence/traffic?lat=${center!.lat}&lng=${center!.lng}`,
          { signal: controller.signal },
        );
        if (!r.ok) throw new Error(`Traffic request HTTP ${r.status}`);
        const data = await r.json();
        if (active) {
          setResults(data.results);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Traffic request failed");
      }
      if (active) setLoading(false);
    }
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(t);
    };
  }, [center]);
  const contacts = useMemo(
    () =>
      results
        .flatMap((r) => r.data)
        .filter(
          (c) =>
            center &&
            distanceKm(center, c) <= radius &&
            now - Date.parse(c.observedAt) <
              (c.kind === "aircraft" ? 300_000 : 600_000),
        )
        .sort((a, b) => distanceKm(center!, a) - distanceKm(center!, b)),
    [results, center, radius, now],
  );
  const nearbySatellites = useMemo(
    () =>
      (satellites?.data || [])
        .filter(
          (s) =>
            center &&
            distanceKm(center, s) <= radius &&
            now - Date.parse(s.predictedAt) < 180_000,
        )
        .sort((a, b) => distanceKm(center!, a) - distanceKm(center!, b)),
    [satellites, center, radius, now],
  );
  const visibleContacts = contacts.filter((c) =>
    c.military ? layers.military : layers[c.kind],
  );
  const contact = contacts.find((c) => c.id === selected),
    sat = nearbySatellites.find((s) => s.id === selected);
  const counts: Record<keyof typeof layers, number> = {
    aircraft: contacts.filter((c) => c.kind === "aircraft" && !c.military)
      .length,
    vessel: contacts.filter((c) => c.kind === "vessel" && !c.military).length,
    military: contacts.filter((c) => c.military).length,
    satellite: nearbySatellites.length,
    observations: flashpoint.reports.filter((r) => r.location).length,
  };
  return (
    <section className="desk-panel investigation" id="investigation">
      <div className="investigation-header">
        <div>
          <span className="investigation-eyebrow">
            <Layers size={14} /> CONNECTED INVESTIGATION
          </span>
          <h2>
            {flashpoint.region} <span>/ {flashpoint.topic}</span>
          </h2>
          <p>{flashpoint.title}</p>
        </div>
        <button onClick={onClose} aria-label="Close investigation">
          <X size={18} />
        </button>
      </div>
      <div className="investigation-flow">
        <span>
          {flashpoint.publishers}{" "}
          {flashpoint.publishers === 1 ? "publisher" : "publishers"}
        </span>
        <b>→</b>
        <span>{flashpoint.region}</span>
        <b>→</b>
        <span>Air · Sea · Space · Military flags</span>
        <small>Spatial context; no causal relationship established</small>
      </div>
      {related.length > 0 && (
        <div className="investigation-related">
          <span>Regions in shared reporting</span>
          {related.slice(0, 8).map((f) => (
            <button key={f.id} onClick={() => onWatch(f.id)}>
              {f.region} ↗
            </button>
          ))}
        </div>
      )}
      <div className="investigation-layers">
        {(Object.keys(layers) as (keyof typeof layers)[]).map((key) => (
          <button
            key={key}
            className={`layer-${key}`}
            aria-pressed={layers[key]}
            onClick={() => {
              setLayers((old) => ({ ...old, [key]: !old[key] }));
              setLimit(35);
            }}
          >
            <i />
            {
              {
                aircraft: "Aircraft",
                vessel: "Vessels",
                military: "Military flagged",
                satellite: "Satellite subpoints",
                observations: "Observations",
              }[key]
            }{" "}
            <b>{counts[key]}</b>
          </button>
        ))}
        <select
          aria-label="Investigation radius"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        >
          <option value={100}>100 km radius</option>
          <option value={250}>250 km radius</option>
          <option value={463}>463 km / 250 NM</option>
        </select>
      </div>
      <div className="investigation-grid">
        <div>
          {center ? (
            <Map
              items={layers.observations ? flashpoint.reports : []}
              flashpoints={manual ? [] : [flashpoint]}
              satellites={[]}
              selected={selected}
              track={[]}
              onSelect={setSelected}
              space={false}
              theme={theme}
              contacts={visibleContacts}
              contextSatellites={layers.satellite ? nearbySatellites : []}
              focus={center}
              radiusKm={radius}
            />
          ) : (
            <div className="desk-empty">
              <h3>Location unresolved</h3>
              <p>
                Set a search center to compare nearby public traffic. Reporting
                remains available.
              </p>
            </div>
          )}
          <form
            className="investigation-center"
            onSubmit={(e) => {
              e.preventDefault();
              const lat = Number(latInput),
                lng = Number(lngInput);
              if (
                latInput.trim() &&
                lngInput.trim() &&
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                Math.abs(lat) <= 90 &&
                Math.abs(lng) <= 180
              ) {
                setResults([]);
                setSelected(null);
                setCenter({ lat, lng });
                setManual(true);
              }
            }}
          >
            <span>
              {manual
                ? "User-selected search center"
                : flashpoint.location?.precision || "No inferred location"}
            </span>
            <label>
              Lat{" "}
              <input
                aria-label="Search center latitude"
                type="number"
                min="-90"
                max="90"
                step="any"
                required
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
              />
            </label>
            <label>
              Lng{" "}
              <input
                aria-label="Search center longitude"
                type="number"
                min="-180"
                max="180"
                step="any"
                required
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
              />
            </label>
            <button type="submit">Recenter</button>
          </form>
          <div className="investigation-sources">
            {!results.length && (
              <p>
                {center
                  ? loading
                    ? "Requesting regional feeds…"
                    : "Traffic not yet retrieved"
                  : "Set a center to request traffic"}
              </p>
            )}
            {results.map((r) => (
              <div key={r.health.id}>
                <a
                  href={
                    r.health.name === "adsb.fi"
                      ? "https://adsb.fi"
                      : r.health.url
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.health.name} ↗
                </a>
                <strong
                  className={
                    r.health.state === "healthy" ? "desk-green" : "desk-amber"
                  }
                >
                  {r.health.state}
                </strong>
                <span>
                  {r.health.error ||
                    `${r.data.length} positions in the provider response · ${r.health.fetchedAt ? new Date(r.health.fetchedAt).toLocaleTimeString([], { timeZone: "UTC" }) + " UTC" : "never retrieved"}`}
                </span>
                <small>{r.health.coverage}</small>
              </div>
            ))}
            {error && (
              <p role="status" className="desk-amber">
                {error} · any retained positions keep their original timestamps.
              </p>
            )}
            {satellites && (
              <small>
                CelesTrak: {satellites.health.state} · satellite subpoints show
                predicted positions projected onto Earth, not sensor coverage or
                tasking.
              </small>
            )}
          </div>
        </div>
        <aside className="investigation-assets">
          <div className="desk-panel-title">
            <h3>Nearby contacts</h3>
            <span>{loading ? "Refreshing…" : "CURRENT SNAPSHOTS"}</span>
          </div>
          {(contact || sat) && (
            <div className="contact-detail">
              <strong>{contact?.name || sat?.name}</strong>
              {contact ? (
                <>
                  <p>{contact.model || contact.classification}</p>
                  <dl>
                    <dt>Identity</dt>
                    <dd>{contact.registration || contact.id}</dd>
                    <dt>Speed / altitude</dt>
                    <dd>
                      {contact.speedKnots?.toFixed(0) ?? "—"} kt /{" "}
                      {contact.altitudeFt?.toLocaleString() ?? "—"} ft
                    </dd>
                    <dt>Position time</dt>
                    <dd>{new Date(contact.observedAt).toUTCString()}</dd>
                    <dt>Time basis</dt>
                    <dd>{contact.timestampBasis}</dd>
                  </dl>
                  <p>{contact.classification}</p>
                  <a href={contact.sourceUrl} target="_blank" rel="noreferrer">
                    Inspect at {contact.source} <ArrowUpRight size={12} />
                  </a>
                </>
              ) : (
                sat && (
                  <>
                    <p>
                      {missionFor(sat)?.summary || "Mission not documented"}
                    </p>
                    <p>
                      {sat.altKm.toFixed(0)} km altitude · elements{" "}
                      {sat.elementAgeHours.toFixed(1)}h old
                    </p>
                    <button onClick={() => onSatellite(sat.id)}>
                      Open orbit, mission & clients →
                    </button>
                  </>
                )
              )}
            </div>
          )}
          <div className="contact-list">
            {visibleContacts.slice(0, limit).map((c) => (
              <HoverPreview
                key={c.id}
                title={c.name}
                lines={[
                  c.model || c.kind,
                  c.classification,
                  `${new Date(c.observedAt).toUTCString()} · ${c.source}`,
                  "Nearby position only; no link to this event established",
                ]}
              >
                <button
                  aria-pressed={selected === c.id}
                  className={`contact-row layer-${c.military ? "military" : c.kind}`}
                  onClick={() => setSelected(c.id)}
                >
                  <i />
                  <strong>{c.name}</strong>
                  <span>{c.model?.split(" ")[0] || c.kind}</span>
                  <small>{distanceKm(center!, c).toFixed(0)} km</small>
                </button>
              </HoverPreview>
            ))}
            {visibleContacts.length > limit && (
              <button onClick={() => setLimit((n) => n + 35)}>
                Show next contacts ({visibleContacts.length - limit})
              </button>
            )}
            {layers.satellite &&
              nearbySatellites.slice(0, limit).map((s) => (
                <HoverPreview
                  key={s.id}
                  title={s.name}
                  lines={[
                    missionFor(s)?.summary || "Mission not documented",
                    `${s.altKm.toFixed(0)} km altitude · predicted subpoint`,
                    "Proximity does not establish imaging coverage or a relationship to this incident",
                  ]}
                >
                  <button
                    className="contact-row layer-satellite"
                    aria-pressed={selected === s.id}
                    onClick={() => setSelected(s.id)}
                  >
                    <i />
                    <strong>{s.name}</strong>
                    <span>{missionFor(s)?.purpose || "Unknown"}</span>
                    <small>{distanceKm(center!, s).toFixed(0)} km</small>
                  </button>
                </HoverPreview>
              ))}
            {layers.satellite && nearbySatellites.length > limit && (
              <button onClick={() => setLimit((n) => n + 35)}>
                Show more satellites ({nearbySatellites.length - limit})
              </button>
            )}
            {!visibleContacts.length &&
              (!layers.satellite || !nearbySatellites.length) && (
                <p className="desk-empty">
                  No recent positions in the enabled layers. Check coverage
                  below the map; this does not mean the area is inactive.
                </p>
              )}
          </div>
        </aside>
      </div>
      <div className="investigation-reports">
        <h3>
          Reporting attached to this watch{" "}
          <small>
            Last 24 hours · current traffic snapshots above may describe a
            different time
          </small>
        </h3>
        {flashpoint.reports.slice(0, 8).map((r) => (
          <a key={r.id} href={r.url} target="_blank" rel="noreferrer">
            <span>{r.source}</span>
            <strong>{r.title}</strong>
            <small>
              {new Date(r.occurredAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              UTC ↗
            </small>
          </a>
        ))}
      </div>
    </section>
  );
}
