export type TelegramCarrier = { source: string; source_name: string; link: string; published: string };
export type SignalNews = { id: string; title: string; link: string; published: string; source: string; source_name: string; alert_kind: string; place: { name: string } | null; coords_anchor: string | null; also_reported_by: TelegramCarrier[] };
export type SignalFeed = { news: SignalNews[]; sources: { handle: string; name: string; kind: string; count: number; latest: string | null }[]; timestamp: string };
export type TelegramPost = { item: SignalNews; carrier: TelegramCarrier };
export type SignalTrend = {
  name: string;
  posts: TelegramPost[];
  channels: number;
  lastHourChannels: number;
  lastHour: number;
  priorHour: number;
  latest: number;
  state: "rising" | "active" | "recent";
};

const HOUR = 3_600_000;
const isTelegram = (source: string) => source.startsWith("t.me/");
const titleCase = (value: string) => value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
const specificPlaces = ["Gaza", "West Bank", "Strait of Hormuz", "Qeshm Island", "Kyiv"];
function mentionedPlace(post: TelegramPost) {
  return specificPlaces.find((place) => new RegExp(`\\b${place}\\b`, "i").test(post.item.title))
    || post.item.place?.name || post.item.coords_anchor;
}

export function telegramPosts(feed: SignalFeed | null): TelegramPost[] {
  if (!feed) return [];
  const seen = new Set<string>();
  return feed.news.flatMap((item) => {
    const carriers = [
      ...(isTelegram(item.source) ? [{ source: item.source, source_name: item.source_name, link: item.link, published: item.published }] : []),
      ...item.also_reported_by.filter((carrier) => isTelegram(carrier.source)),
    ];
    return carriers.flatMap((carrier) => {
      const key = `${item.id}:${carrier.source}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ item, carrier }];
    });
  }).filter(({ carrier }) => Number.isFinite(Date.parse(carrier.published)));
}

export function analyzeTelegram(feed: SignalFeed | null): { posts: TelegramPost[]; trends: SignalTrend[]; fresh: TelegramPost[] } {
  const posts = telegramPosts(feed);
  const now = Date.parse(feed?.timestamp || "");
  if (!Number.isFinite(now)) return { posts, trends: [], fresh: [] };
  const groups = new Map<string, { name: string; posts: TelegramPost[]; channels: Set<string>; lastHourChannels: Set<string>; lastHour: number; priorHour: number; latest: number }>();
  for (const post of posts) {
    const rawPlace = mentionedPlace(post);
    if (!rawPlace) continue; // Posts without a named place stay in the live feed.
    const key = rawPlace.trim().toLocaleLowerCase();
    const group = groups.get(key) || { name: titleCase(rawPlace.trim()), posts: [], channels: new Set<string>(), lastHourChannels: new Set<string>(), lastHour: 0, priorHour: 0, latest: 0 };
    const published = Date.parse(post.carrier.published);
    const elapsed = now - published;
    group.posts.push(post);
    group.channels.add(post.carrier.source);
    if (elapsed >= 0 && elapsed <= HOUR) { group.lastHour++; group.lastHourChannels.add(post.carrier.source); }
    else if (elapsed > HOUR && elapsed <= 2 * HOUR) group.priorHour++;
    group.latest = Math.max(group.latest, published);
    groups.set(key, group);
  }
  const trends: SignalTrend[] = [...groups.values()].map((group): SignalTrend => ({
    name: group.name,
    posts: group.posts.sort((a, b) => Date.parse(b.carrier.published) - Date.parse(a.carrier.published)),
    channels: group.channels.size,
    lastHourChannels: group.lastHourChannels.size,
    lastHour: group.lastHour,
    priorHour: group.priorHour,
    latest: group.latest,
    state: group.lastHour >= 2 && group.lastHour >= group.priorHour + 2 && group.lastHourChannels.size >= 2
      ? "rising" : group.latest <= now && group.latest >= now - 15 * 60_000 ? "active" : "recent",
  })).sort((a, b) => {
    const rank = { rising: 2, active: 1, recent: 0 };
    return rank[b.state] - rank[a.state] || b.lastHour - a.lastHour || b.latest - a.latest;
  }).slice(0, 9);
  const fresh = [...posts].filter(({ carrier }) => {
    const elapsed = now - Date.parse(carrier.published);
    return elapsed >= 0 && elapsed <= HOUR;
  }).sort((a, b) => Date.parse(b.carrier.published) - Date.parse(a.carrier.published));
  return { posts, trends, fresh };
}
