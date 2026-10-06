"use client";

import type { RegionalHub } from "@/lib/intelligence/regional-hubs";
import type { Development } from "@/lib/intelligence/types";
import { reportGroups } from "@/lib/intelligence/flashpoints";
import { telegramPosts } from "@/lib/intelligence/signal-analysis";
import { useState } from "react";
import { WatchTags } from "./FlashpointMonitor";
import type { SignalFeed } from "@/lib/intelligence/signal-analysis";

type StreamRow = {
  id: string;
  at: string;
  title: string;
  detail: string;
  label: string;
  href: string;
  external: boolean;
  unverified?: boolean;
};

function mentionsRegion(title: string, place: string | null, region: string): boolean {
  const normalized = region.toLocaleLowerCase();
  if (place?.toLocaleLowerCase() === normalized) return true;
  const escaped = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, "iu").test(title);
}

const stamp = (value: string) => new Date(value).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";

export default function RegionalDeskStream({ hub, nearby, feed, feedError, now, query = "", includePublicLeads = true }: { hub: RegionalHub; nearby: Development[]; feed: SignalFeed | null; feedError: string; now: number; query?: string; includePublicLeads?: boolean }) {
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(12);
  const signalWindow = Date.parse(feed?.timestamp || "") - 24 * 3_600_000;
  const represented = new Set(hub.events.flatMap((event) => event.reports.map((report) => report.id)));
  const social: StreamRow[] = (includePublicLeads ? telegramPosts(feed) : [])
    .filter(({ item, carrier }) => !represented.has(`telegram:${item.id}:${carrier.source}`) && Date.parse(carrier.published) >= signalWindow &&
      (mentionsRegion(item.title, item.place?.name || item.coords_anchor, hub.name) ||
        reportGroups({ id: item.id, sourceId: carrier.source, source: carrier.source_name,
          title: item.title, url: carrier.link, occurredAt: carrier.published,
          kind: "report", reason: "", priority: 0, summary: "" }).some((group) => group.region === hub.name)))
    .map(({ item, carrier }) => ({
      id: `${item.id}:${carrier.source}`,
      at: carrier.published,
      title: item.title,
      detail: `${carrier.source_name} · place mention, not a verified location`,
      label: "Telegram preview",
      href: carrier.link,
      external: true,
      unverified: true,
    }));
  const rows: StreamRow[] = [
    ...hub.events.map((event) => ({
      id: `event:${event.id}`,
      at: event.latestAt,
      title: event.title,
      detail: `${event.sourceCount} ${event.sourceCount === 1 ? "publisher" : "publishers"} · ${event.grouping} · region mentioned`,
      label: event.reports.every((report) => report.sourceId.startsWith("t.me/")) ? "Telegram preview" : event.reports.every((report) => report.kind !== "report") ? "Provider observation" : "Publisher reporting",
      href: `#event-${encodeURIComponent(event.id)}`,
      external: false,
      unverified: event.reports.every((report) => report.sourceId.startsWith("t.me/")),
    })),
    ...nearby.map((item) => ({
      id: `observation:${item.id}`,
      at: item.occurredAt,
      title: item.title,
      detail: `${item.source} · ${item.location?.precision || "location unavailable"} · nearby context`,
      label: "Provider observation",
      href: item.url,
      external: true,
    })),
    ...social,
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const visible = rows.filter((row) => (filter === "all" || row.label === filter) && `${row.title} ${row.detail}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <section id="regional-latest" className="regional-stream" aria-label={`${hub.name} latest stream`}>
    <div className="regional-section-head"><h2>Latest from {hub.name}</h2><span>Newest first</span></div>
    <div className="regional-stream-filters" role="group" aria-label="Filter regional stream">{[["all", "All sources"], ["Publisher reporting", "Reporting"], ["Telegram preview", "Telegram"], ["Provider observation", "Observations"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => { setFilter(id); setLimit(12); }}>{label}<span>{rows.filter((row) => id === "all" || row.label === id).length}</span></button>)}</div>
    {visible.slice(0, limit).map((row) => <a className="regional-stream-row" key={row.id} href={row.href} target={row.external ? "_blank" : undefined} rel={row.external ? "noreferrer" : undefined}>
      <time dateTime={row.at}>{stamp(row.at)}</time>
      <span><strong>{row.title}</strong><small><em className={row.unverified ? "is-unverified" : ""}>{row.label}</em>{row.detail}</small>{row.unverified ? <span className="watch-tag" style={{ "--watch-color": "var(--watch-early)" } as React.CSSProperties}>Early reports · unverified</span> : (() => { const watch = hub.watches.find((watch) => watch.reports.some((report) => `event:${report.id}` === row.id)); return watch ? <WatchTags watch={watch} now={now} /> : null; })()}</span>
    </a>)}
    {!visible.length && <div className="regional-stream-empty">{filter === "Telegram preview" && !feed ? "Checking public Telegram previews…" : "No matching records from this source type in the current window."}</div>}
    {visible.length > limit && <button className="regional-stream-more" onClick={() => setLimit(limit + 12)}>Show more records</button>}
    {feedError && <p className="regional-stream-error">Telegram previews unavailable: {feedError}</p>}
    <div className="regional-stream-foot">Telegram previews are unverified leads. WhatsApp is not connected. <a href={`https://x.com/search?q=${encodeURIComponent(hub.name)}&f=live`} target="_blank" rel="noreferrer">Search X for {hub.name} ↗</a></div>
  </section>;
}
