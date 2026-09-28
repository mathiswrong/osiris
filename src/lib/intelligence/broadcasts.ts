export const BROADCASTS = [
  {
    id: "dw",
    name: "DW News",
    url: "https://www.dw.com/en/live-tv/channel-english",
    channel: "UCknLrEdhRCp1aegoMqRaCZg",
  },
  {
    id: "france24",
    name: "France 24",
    url: "https://www.france24.com/en/live",
    channel: "UCQfwfsi5VrQ8yKZ-UWmAEFg",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/video/live",
    channel: "UCNye-wNBqNL5ZzHSJj3l8Bg",
  },
  {
    id: "sky",
    name: "Sky News",
    url: "https://news.sky.com/watch-live",
    channel: "UCoMdktPbSTixAyNGwb-UYkQ",
  },
] as const;
export interface BroadcastStream {
  kind: "hls" | "youtube";
  url: string;
  title: string;
  resolvedAt: string;
}
/** Extract only the public player response, never execute publisher scripts. */
export function youtubeLive(html: string, channel: string): BroadcastStream {
  const marker = html.match(/(?:var\s+)?ytInitialPlayerResponse\s*=\s*/);
  if (!marker || marker.index === undefined)
    throw new Error("Broadcaster live player could not be resolved");
  const start = marker.index + marker[0].length;
  let depth = 0,
    quoted = false,
    escape = false,
    end = start;
  for (; end < html.length; end++) {
    const c = html[end];
    if (quoted) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      end++;
      break;
    }
  }
  const p = JSON.parse(html.slice(start, end));
  if (p.videoDetails?.channelId !== channel)
    throw new Error("Live video does not belong to the expected broadcaster");
  if (
    p.playabilityStatus?.status !== "OK" ||
    p.playabilityStatus?.playableInEmbed !== true
  )
    throw new Error(
      "Broadcaster does not permit embedded playback for this stream",
    );
  if (
    (p.microformat?.playerMicroformatRenderer?.liveBroadcastDetails
      ?.isLiveNow ?? p.videoDetails?.isLive) !== true ||
    p.videoDetails?.isUpcoming === true
  )
    throw new Error("No active live broadcast found on the official channel");
  const id = p.videoDetails?.videoId;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id))
    throw new Error("Invalid live video identifier");
  return {
    kind: "youtube",
    url: id,
    title: String(p.videoDetails.title || "Live broadcast"),
    resolvedAt: new Date().toISOString(),
  };
}
