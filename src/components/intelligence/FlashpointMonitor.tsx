"use client";
import { useState } from "react";
import { Flame } from "lucide-react";
import type {
  Flashpoint,
  FlashpointResult,
} from "@/lib/intelligence/flashpoints";
import { HoverPreview } from "./HoverPreview";
export function FlashpointMonitor({
  result,
  selected,
  onSelect,
  error,
}: {
  result: FlashpointResult | null;
  selected: string | null;
  onSelect: (id: string) => void;
  error: string;
}) {
  const [filter, setFilter] = useState("all"),
    [expanded, setExpanded] = useState(false);
  const rows = (result?.data || []).filter(
    (f) => filter === "all" || f.state === filter,
  );
  const seen = new Set<string>();
  const top = rows
    .filter((f) => {
      if (seen.has(f.title)) return false;
      seen.add(f.title);
      return true;
    })
    .slice(0, 10);
  return (
    <section className="desk-panel desk-flashpoints">
      <div className="desk-panel-title">
        <h2>
          <Flame size={17} />
          Flashpoint monitor
        </h2>
        <span>
          {result
            ? `${result.data.length} watches · last 24h`
            : "Connecting feeds"}
        </span>
      </div>
      <div className="desk-flash-toolbar">
        <p>
          Where to look next{" "}
          <span>· Hover for context · Select to investigate across feeds</span>
        </p>
        <div className="desk-flash-filters">
          {[
            ["all", "All watches"],
            ["emerging", "Emerging"],
            ["single-source lead", "Early leads"],
            ["measured alert", "Measured alerts"],
          ].map(([id, name]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className={`desk-flash-grid ${expanded ? "is-expanded" : ""}`}>
        {(expanded ? rows : top).map((f, index) => (
          <HoverPreview
            key={f.id}
            title={`${f.region} · ${f.topic}`}
            lines={[
              f.title,
              `${f.state} · ${f.recentCount} headlines in 6h · ${f.publishers} publishers in 24h`,
              f.reasons[0],
              f.location?.precision === "provider observation"
                ? "Provider supplied location"
                : "Region is context, not a precise incident location",
              `First seen here: ${new Date(f.firstSeen).toUTCString()}`,
            ]}
          >
            <button
              className="desk-flash-card"
              aria-pressed={selected === f.id}
              onClick={() => onSelect(f.id)}
            >
              <span className="desk-flash-rank">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`desk-flash-dot state-${f.state.replaceAll(" ", "-")}`}
              />
              <strong>{f.region}</strong>
              <span className="desk-flash-topic">{f.topic}</span>
              <span className="desk-flash-headline">{f.title}</span>
              <span className="desk-flash-count">
                {f.publishers} {f.publishers === 1 ? "source" : "sources"}{" "}
                <span>↗</span>
              </span>
            </button>
          </HoverPreview>
        ))}
      </div>
      {!rows.length && (
        <p className="desk-flash-empty">
          {error ||
            (!result
              ? "Retrieving public feeds…"
              : filter === "emerging" && !result.baselineReady
                ? "Learning the baseline. Emerging alerts unlock after 24 hours of continuous collection."
                : "No qualifying watches in this view.")}
        </p>
      )}
      <div className="desk-flash-foot">
        <span>
          {error ||
            (result?.baselineReady
              ? "Surge detection active"
              : `Baseline learning · ${result?.baselineHours.toFixed(1) || "0.0"} / 24h`)}
          {result &&
            ` · ${result.healthySources} healthy feeds · ${result.baselineNote}`}
          {result?.excludedSources.length
            ? ` · Excluded: ${result.excludedSources.join(", ")}`
            : ""}
          {result && !result.persistent ? " · History could not be saved" : ""}
        </span>
        {rows.length > 10 && (
          <button onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show top 10" : `Explore all ${rows.length} watches`}
          </button>
        )}
      </div>
    </section>
  );
}
export function FlashpointDetail({
  item,
  onReport,
}: {
  item: Flashpoint;
  onReport: (id: string) => void;
}) {
  return (
    <>
      <span className="desk-flash-state">{item.state}</span>
      <h2>
        {item.region} · {item.topic}
      </h2>
      <h3>Why this needs attention</h3>
      <ul className="desk-evidence-list">
        {item.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <dl>
        <dt>First seen here</dt>
        <dd>{new Date(item.firstSeen).toUTCString()}</dd>
        <dt>Latest publication</dt>
        <dd>{new Date(item.latestAt).toUTCString()}</dd>
        <dt>Map precision</dt>
        <dd>{item.location?.precision || "Unresolved — no map pin"}</dd>
      </dl>
      <h3>Source evidence</h3>
      <p className="desk-muted">
        These are attributed reports, not independently verified findings. Read
        each original before drawing conclusions.
      </p>
      <div className="desk-flash-evidence">
        {item.reports.map((r) => (
          <article key={r.id}>
            <span>
              {r.source} ·{" "}
              {new Date(r.occurredAt).toLocaleString(undefined, {
                timeZone: "UTC",
              })}{" "}
              UTC
            </span>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.title} ↗
            </a>
            <button onClick={() => onReport(r.id)}>Inspect record</button>
          </article>
        ))}
      </div>
    </>
  );
}
