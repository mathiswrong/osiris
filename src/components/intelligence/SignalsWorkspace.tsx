"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUpRight, Radio, Search } from "lucide-react";
import { analyzeTelegram, type SignalFeed, type SignalTrend } from "@/lib/intelligence/signal-analysis";

type Connector = "hapi" | "reliefweb" | "gfw";
type Lookup = { rows: { title: string; detail: string; url: string }[]; retrievedAt: string };
const connectorInfo: { id: Connector; name: string; purpose: string; url: string; placeholder: string }[] = [
  { id: "hapi", name: "HDX HAPI", purpose: "Annual intersectoral people-in-need estimates. Do not sum rows across years or categories.", url: "https://hdx-hapi.readthedocs.io/en/latest/getting-started/", placeholder: "ISO3 country code, e.g. UKR" },
  { id: "reliefweb", name: "ReliefWeb", purpose: "Recent disaster records by country. Requires an approved API app name.", url: "https://apidoc.reliefweb.int/", placeholder: "ISO3 country code, e.g. UKR" },
  { id: "gfw", name: "Global Fishing Watch", purpose: "Vessel identity lookup by name, IMO or MMSI. Coverage and API use depend on provider terms.", url: "https://api-doc.globalfishingwatch.org/our-apis/documentation/", placeholder: "Vessel name, IMO or MMSI" },
];
const watchQueries = [
  { name: "Official emergency agencies", query: '"emergency" OR "evacuation" filter:links' },
  { name: "First-person footage", query: '"explosion" OR "flood" OR "wildfire" filter:videos' },
  { name: "Aviation and maritime watchers", query: '"ADS-B" OR "AIS" OR "NOTAM"' },
  { name: "Verification and corrections", query: '"geolocated" OR "correction" OR "community notes"' },
];
const xSearch = (query: string) => `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;
const blueskySearch = (query: string) => `https://bsky.app/search?q=${encodeURIComponent(query)}`;
const time = (value: string) => new Date(value).toLocaleString(undefined, { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " UTC";
const ago = (value: number, now: number) => {
  const minutes = Math.max(0, Math.floor((now - value) / 60_000));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
};

export function useSignalsFeed(refresh: number) {
  const [feed, setFeed] = useState<SignalFeed | null>(null);
  const [feedError, setFeedError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const load = () => void fetch("/api/news", { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`Telegram feed HTTP ${response.status}`); return response.json() as Promise<SignalFeed>; })
      .then((data) => { setFeed(data); setFeedError(""); })
      .catch((error) => { if (!controller.signal.aborted) setFeedError(error instanceof Error ? error.message : "Telegram feed unavailable"); });
    load();
    const timer = setInterval(load, 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);
  return { feed, feedError };
}

function explanation(trend: SignalTrend) {
  if (trend.state === "rising") return `${trend.lastHour} posts in the last hour versus ${trend.priorHour} in the hour before, across ${trend.lastHourChannels} channels this hour.`;
  if (trend.state === "active") return `${trend.lastHour} ${trend.lastHour === 1 ? "post" : "posts"} in the last hour. The newest arrived within 15 minutes.`;
  return `${trend.lastHour} ${trend.lastHour === 1 ? "post" : "posts"} this hour versus ${trend.priorHour} in the previous hour; ${trend.channels} ${trend.channels === 1 ? "channel" : "channels"} in the sample.`;
}

export function SignalPulse({ feed, feedError }: { feed: SignalFeed | null; feedError: string }) {
  const { fresh, trends } = useMemo(() => analyzeTelegram(feed), [feed]);
  const now = Date.parse(feed?.timestamp || "");
  const latest = fresh[0];
  const active = latest && now - Date.parse(latest.carrier.published) <= 15 * 60_000;
  const channels = new Set(fresh.map((post) => post.carrier.source)).size;
  return <section className={`desk-signal-pulse ${active ? "is-live" : ""}`} aria-label="Telegram signal pulse">
    <div className="desk-panel-title desk-signal-watch-heading">
      <h2><Radio size={16} /> Signal watch</h2>
      <span className={active ? "desk-live-marker" : ""}>{!feed ? "CONNECTING" : active ? "NEW POST" : fresh.length ? "PAST HOUR" : "QUIET SAMPLE"}</span>
    </div>
    <div className="desk-signal-watch-lead">
      <span>LATEST PUBLIC TELEGRAM POST</span>
      {latest ? <a href={latest.carrier.link} target="_blank" rel="noreferrer">{latest.item.title} <ArrowUpRight size={13} /></a> : <strong>{feedError ? "Telegram previews unavailable" : feed ? "No new posts in the past hour" : "Checking public channels…"}</strong>}
      <small>{latest ? `${latest.carrier.source_name} · ${ago(Date.parse(latest.carrier.published), now)}` : "Posting activity is not event verification."}</small>
    </div>
    <div className="desk-signal-watch-metrics">
      <div><strong>{fresh.length}</strong><span>POSTS / 1H</span></div>
      <div><strong>{channels}</strong><span>CHANNELS / 1H</span></div>
      <div><strong>{trends.filter((trend) => trend.state === "rising").length}</strong><span>RISING TOPICS</span></div>
    </div>
    <div className="desk-signal-watch-topics">
      <h3>Activity to check</h3>
      {trends.slice(0, 3).map((trend) => <div key={trend.name}><span className={`desk-signal-topic-dot state-${trend.state}`} /><strong>{trend.name}</strong><small>{trend.lastHour} this hour / {trend.priorHour} before</small></div>)}
      {feed && !trends.length && <p>No located topics in this sample.</p>}
    </div>
    <a className="desk-signal-watch-link" href="#signals">Open signal analysis <ArrowDown size={14} /></a>
    <p className="desk-signal-watch-note">Sampled channel activity. Red marks a fresh post or rising volume, not a verified incident.</p>
  </section>;
}

export default function SignalsWorkspace({ feed, feedError }: { feed: SignalFeed | null; feedError: string }) {
  const [status, setStatus] = useState<Record<Connector, boolean> | null>(null);
  const [connector, setConnector] = useState<Connector>("hapi");
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [looking, setLooking] = useState(false);
  const { trends, fresh } = useMemo(() => analyzeTelegram(feed), [feed]);
  const now = Date.parse(feed?.timestamp || "");
  const active = connectorInfo.find((item) => item.id === connector)!;
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/intelligence/lookup", { signal: controller.signal }).then((response) => response.json()).then((data) => setStatus(data.status)).catch(() => {});
    return () => controller.abort();
  }, []);
  async function runLookup(event: React.FormEvent) {
    event.preventDefault();
    setLooking(true); setLookup(null); setLookupError("");
    try {
      const q = connector === "gfw" ? query.trim() : query.trim().toUpperCase();
      const response = await fetch(`/api/intelligence/lookup?provider=${connector}&q=${encodeURIComponent(q)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Lookup HTTP ${response.status}`);
      setLookup(body);
    } catch (error) { setLookupError(error instanceof Error ? error.message : "Lookup failed"); }
    finally { setLooking(false); }
  }
  const covered = feed?.sources.filter((source) => source.kind === "telegram") || [];
  return <section className="desk-signals" id="signals">
    <div className="desk-panel desk-signals-intro">
      <div className="desk-panel-title"><h2>Signals worth checking</h2><span>{feed ? `SAMPLED ${time(feed.timestamp)}` : "CONNECTING"}</span></div>
      <p><strong>{fresh.length} posts in the last hour</strong> across {new Set(fresh.map((post) => post.carrier.source)).size} public Telegram channels. A red indicator means a fresh post or a rise in posting volume. It does not mean the claim is true or the event is severe.</p>
      {feedError && <p className="desk-amber">{feedError} · showing the last retrieved sample</p>}
    </div>
    <div className="desk-signal-priority">
      {!feed && <div className="desk-panel desk-empty">Retrieving Telegram previews…</div>}
      {feed && !trends.length && <div className="desk-panel desk-empty">No located topics in the current sample. Recent unlocated posts appear below.</div>}
      {trends.slice(0, 3).map((trend) => <article key={trend.name} className={`desk-signal-card state-${trend.state}`}>
        <div className="desk-signal-card-top"><span className="desk-signal-card-status"><i />{trend.state === "rising" ? "RISING ACTIVITY" : trend.state === "active" ? "NEW POST" : "RECENT COVERAGE"}</span><small>{ago(trend.latest, now)}</small></div>
        <h3>{trend.name}</h3>
        <p>{explanation(trend)}</p>
        <a href={trend.posts[0].carrier.link} target="_blank" rel="noreferrer"><strong>{trend.posts[0].item.title}</strong><span>{trend.posts[0].carrier.source_name} · open original <ArrowUpRight size={13} /></span></a>
      </article>)}
    </div>
    <div className="desk-signals-grid">
      <section className="desk-panel">
        <div className="desk-panel-title"><h2>Activity by place</h2><span>{trends.length} TOPICS</span></div>
        <p>Places are mentioned in post titles or supplied as broad source anchors; they are not exact incident locations. Each row compares this hour with the previous hour in the sampled channel previews.</p>
        <div className="desk-signal-list">{trends.map((trend) => <details key={trend.name} className="desk-signal-topic">
          <summary><span className={`desk-signal-topic-dot state-${trend.state}`} /><strong>{trend.name}</strong><span className="desk-signal-topic-analysis">{trend.lastHour} this hour · {trend.priorHour} before · {trend.channels} channels</span></summary>
          <div className="desk-signal-posts"><p>{explanation(trend)} Reposts indicate circulation, not independent confirmation.</p>{trend.posts.slice(0, 5).map((post) => <a key={`${post.item.id}:${post.carrier.source}`} href={post.carrier.link} target="_blank" rel="noreferrer"><strong>{post.item.title}</strong><small>{post.carrier.source_name} · {time(post.carrier.published)} ↗</small></a>)}</div>
        </details>)}</div>
        <p className="desk-muted">{covered.filter((source) => source.count > 0).length} of {covered.length} channel previews returned posts in the 72-hour feed window. Counts are capped per channel, so they indicate activity in this sample rather than a complete trend history.</p>
      </section>
      <section className="desk-panel">
        <div className="desk-panel-title"><h2>Latest Telegram posts</h2><span>PAST HOUR</span></div>
        <p>Read the original post and its timestamp before treating a report as evidence.</p>
        <div className="desk-signal-latest">{fresh.slice(0, 6).map((post) => <a key={`${post.item.id}:${post.carrier.source}`} href={post.carrier.link} target="_blank" rel="noreferrer"><span className="desk-signal-latest-time">{ago(Date.parse(post.carrier.published), now)}</span><strong>{post.item.title}</strong><small>{post.carrier.source_name} ↗</small></a>)}{feed && !fresh.length && <div className="desk-empty">No posts in the past hour from the sampled channels.</div>}</div>
      </section>
    </div>
    <details className="desk-panel desk-signals-extras">
      <summary>Channel coverage, X / Bluesky searches & specialist datasets <span>OPEN TO INVESTIGATE</span></summary>
      <div className="desk-signals-extras-grid">
        <div>
          <h3>Telegram channel coverage</h3>
          <p>Preview counts show how many posts from each channel entered the 72-hour sample.</p>
          <div className="desk-channel-list">{covered.map((source) => <a key={source.handle} href={`https://t.me/s/${source.handle}`} target="_blank" rel="noreferrer"><strong>{source.name}</strong><span>{source.count} in sample · {source.latest ? `latest ${time(source.latest)}` : "no preview"}</span><ArrowUpRight size={15} /></a>)}{!feed && <div className="desk-empty">Checking channel previews…</div>}</div>
        </div>
        <div>
          <h3>Social verification watchlist</h3>
          <p>X and Bluesky links open live platform searches. Search results are leads, not dashboard-verified evidence.</p>
          <div className="desk-social-list">{watchQueries.map((item) => <div key={item.name}><strong>{item.name}</strong><span><a href={xSearch(item.query)} target="_blank" rel="noreferrer">Search X <ArrowUpRight size={13} /></a><a href={blueskySearch(item.query)} target="_blank" rel="noreferrer">Search Bluesky <ArrowUpRight size={13} /></a></span></div>)}</div>
        </div>
      </div>
      <div className="desk-connector-panel">
        <h3>Specialist dataset lookup</h3>
        <div className="desk-connector-tabs">{connectorInfo.map((item) => <button key={item.id} aria-pressed={connector === item.id} onClick={() => { setConnector(item.id); setQuery(""); setLookup(null); setLookupError(""); }}>{item.name} <small>{status?.[item.id] ? "Ready" : "Needs setup"}</small></button>)}</div>
        <p>{active.purpose} <a href={active.url} target="_blank" rel="noreferrer">Provider docs ↗</a></p>
        {status?.[connector] ? <form className="desk-lookup-form" onSubmit={runLookup}><label className="desk-search"><Search size={14} /><input aria-label={`${active.name} search`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={active.placeholder} /></label><button disabled={looking || !query.trim()}>{looking ? "Searching…" : "Search source"}</button></form> : <p className="desk-amber">{status ? `Set ${connector === "hapi" ? "HAPI_APP_IDENTIFIER" : connector === "gfw" ? "GFW_API_ACCESS_TOKEN" : "RELIEFWEB_APPNAME"} on the server to enable this lookup.` : "Checking connector configuration…"}</p>}
        {lookupError && <p className="desk-amber">{lookupError}</p>}
        {lookup && <div className="desk-lookup-results"><small>{lookup.rows.length} results · retrieved {time(lookup.retrievedAt)}</small>{lookup.rows.length ? lookup.rows.map((item, index) => <a key={`${item.title}:${index}`} href={item.url} target="_blank" rel="noreferrer"><strong>{item.title}</strong><span>{item.detail}</span><ArrowUpRight size={13} /></a>) : <div className="desk-empty">No matching records in this provider dataset.</div>}</div>}
      </div>
    </details>
  </section>;
}
