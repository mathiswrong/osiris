"use client";

import type { RegionalHub } from "@/lib/intelligence/regional-hubs";
import type { Development } from "@/lib/intelligence/types";
import { reportGroups } from "@/lib/intelligence/flashpoints";
import { telegramPosts } from "@/lib/intelligence/signal-analysis";
import { useSignalsFeed } from "./SignalsWorkspace";

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

export default function RegionalDeskStream({ hub, nearby }: { hub: RegionalHub; nearby: Development[] }) {
  const { feed, feedError } = useSignalsFeed(0);
  const signalWindow = Date.parse(feed?.timestamp || "") - 24 * 3_600_000;
  const social: StreamRow[] = telegramPosts(feed)
    .filter(({ item, carrier }) => Date.parse(carrier.published) >= signalWindow &&
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
      label: "Publisher reporting",
      href: `#event-${encodeURIComponent(event.id)}`,
      external: false,
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
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);

  return <section className="regional-stream" aria-label={`${hub.name} latest stream`}>
    <div className="regional-section-head"><h2>{hub.name} · latest stream</h2><span>NEWEST FIRST</span></div>
    {rows.map((row) => <a className="regional-stream-row" key={row.id} href={row.href} target={row.external ? "_blank" : undefined} rel={row.external ? "noreferrer" : undefined}>
      <time dateTime={row.at}>{stamp(row.at)}</time>
      <span><strong>{row.title}</strong><small><em className={row.unverified ? "is-unverified" : ""}>{row.label}</em>{row.detail}</small></span>
    </a>)}
    {!rows.length && <div className="regional-stream-empty">{feed ? "No matching reports, nearby observations, or sampled Telegram posts in this window." : "Checking regional reporting and public channel previews…"}</div>}
    {feedError && <p className="regional-stream-error">Telegram previews unavailable: {feedError}</p>}
    <div className="regional-stream-foot">Publisher reports mention this region; nearby observations are spatial context. Telegram previews are unverified leads. <a href={`https://x.com/search?q=${encodeURIComponent(hub.name)}&f=live`} target="_blank" rel="noreferrer">Search X for {hub.name} ↗</a></div>
  </section>;
}
