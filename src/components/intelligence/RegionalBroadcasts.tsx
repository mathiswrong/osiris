"use client";

import { useCallback, useEffect, useState } from "react";
import { Tv } from "lucide-react";
import { countryCatalog } from "@/lib/intelligence/regional-hubs";
import { embedUrl } from "@/components/LiveNewsPreviews";
import BroadcastPanel from "./BroadcastPanel";

type Feed = { id: string; name: string; country: string; city: string; url: string; embed_allowed: boolean; category: string };

export default function RegionalBroadcasts({ regionId, name }: { regionId: string; name: string }) {
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [selected, setSelected] = useState("");
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const country = countryCatalog.find((candidate) => candidate.id === regionId)?.code;
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/live-news", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Channel catalog unavailable");
      const data: { feeds: Feed[] } = await response.json();
      setFeeds(data.feeds.filter((feed) => feed.country === country));
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Channel catalog unavailable"); });
    return () => controller.abort();
  }, [country]);
  const feed = feeds?.find((candidate) => candidate.id === selected) || feeds?.[0];
  const embed = feed && embedUrl(feed.url, feed.embed_allowed);
  const playbackFailed = useCallback(() => setPlaying(false), []);
  return <section className="regional-broadcasts" aria-label={`${name} broadcast context`}>
    <div className="regional-section-head"><h2><Tv size={16} aria-hidden="true" /> Television</h2><span>{feeds?.length ? `${name} · ${feeds.length} channels` : "International context"}</span></div>
    {!!feeds?.length && <>
      <label className="regional-channel-select">Regional channel<select value={feed?.id || ""} onChange={(event) => { setSelected(event.target.value); setPlaying(false); }}>{feeds.map((channel) => <option value={channel.id} key={channel.id}>{channel.name} · {channel.city}</option>)}</select></label>
      {playing && embed ? <iframe src={embed} title={`${feed.name} live broadcast`} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" onError={playbackFailed} /> : <div className="regional-tv-preview"><Tv size={28} aria-hidden="true" /><strong>{feed?.name}</strong><span>{feed?.city} · {feed?.category === "state" ? "State media" : "Regional broadcaster"}</span>{embed && <button onClick={() => setPlaying(true)}>Load live broadcast</button>}</div>}
      <a className="regional-broadcaster-link" href={feed?.url} target="_blank" rel="noreferrer">Open {feed?.name} at the broadcaster ↗</a>
      <p className="regional-tv-note">{embed ? "Playback depends on the broadcaster’s availability. " : "This broadcaster requires viewing on its own site. "}A broadcast is context, not evidence of a reported event.</p>
    </>}
    {feeds?.length === 0 && <p className="regional-tv-note">No local channel is connected for {name}. Explore the international broadcasts below.</p>}
    {error && <p className="regional-tv-note" role="status">{error}. International broadcasts remain available below.</p>}
    {(!feeds?.length || playing === false) && <details className="regional-international-tv" open={feeds?.length === 0}><summary>International broadcasts</summary><BroadcastPanel /></details>}
  </section>;
}
