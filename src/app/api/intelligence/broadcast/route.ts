import { NextRequest, NextResponse } from "next/server";
import {
  BROADCASTS,
  youtubeLive,
  type BroadcastStream,
} from "@/lib/intelligence/broadcasts";
import { providerFetch, sourceRead } from "@/lib/intelligence/store";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const channel = BROADCASTS.find(
    (c) => c.id === request.nextUrl.searchParams.get("id"),
  );
  if (!channel)
    return NextResponse.json({ error: "Unknown broadcaster" }, { status: 400 });
  const def = {
    id: `broadcast-v3-${channel.id}`,
    name: channel.name,
    url: channel.url,
    refreshMs: 300_000,
    coverage:
      "Official live player discovery; playback verified separately in your browser",
  };
  const result = await sourceRead<BroadcastStream>(def, async () => {
    if (channel.id === "dw") {
      const html = await (await providerFetch(channel.url)).text();
      const src = html.match(/"hlsVideoSrc":"([^"]+)"/)?.[1];
      if (!src) throw new Error("DW did not publish a live HLS stream");
      const url = new URL(src);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "dwamdstream102.akamaized.net"
      )
        throw new Error("DW stream host changed; adapter needs review");
      const manifest = await (await providerFetch(url.href)).text();
      if (!manifest.startsWith("#EXTM3U"))
        throw new Error("Invalid DW stream manifest");
      return [
        {
          kind: "hls",
          url: url.href,
          title: "DW English · official live television",
          resolvedAt: new Date().toISOString(),
        },
      ];
    }
    if (channel.id === "aljazeera") {
      const page = await (await providerFetch(channel.url)).text();
      const embed = page.match(
        /"embedUrl":"(https:\/\/players\.brightcove\.net\/665003303001\/[^" ]+)"/,
      )?.[1];
      if (!embed)
        throw new Error("Al Jazeera did not publish its official player");
      const playerUrl = new URL(embed),
        videoId = playerUrl.searchParams.get("videoId");
      if (
        playerUrl.hostname !== "players.brightcove.net" ||
        !/^\/665003303001\/[a-zA-Z0-9_]+\/index\.html$/.test(
          playerUrl.pathname,
        ) ||
        !/^\d+$/.test(videoId || "")
      )
        throw new Error("Al Jazeera player changed; adapter needs review");
      const html = await (await providerFetch(playerUrl.href)).text();
      // Public browser playback policy published inside the broadcaster's own player.
      const policy = html.match(/videoCloud:\{policyKey:"([^"]+)"/)?.[1];
      if (!policy)
        throw new Error("Official player playback policy unavailable");
      const response = await fetch(
        `https://edge.api.brightcove.com/playback/v1/accounts/665003303001/videos/${videoId}`,
        {
          headers: { Accept: `application/json;pk=${policy}` },
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        },
      );
      if (!response.ok)
        throw new Error(`Official player API HTTP ${response.status}`);
      const data = await response.json();
      const source = data.sources?.find(
        (s: { src?: string; type?: string; key_systems?: unknown }) =>
          s.type === "application/vnd.apple.mpegurl" && s.src && !s.key_systems,
      );
      if (!source)
        throw new Error(
          "No public HLS stream published by the official player",
        );
      const stream = new URL(source.src);
      if (
        stream.protocol !== "https:" ||
        stream.hostname !== "live-hls-web-aje-gcp.thehlive.com"
      )
        throw new Error("Al Jazeera stream host changed; adapter needs review");
      const manifest = await (await providerFetch(stream.href)).text();
      if (!manifest.startsWith("#EXTM3U"))
        throw new Error("Invalid broadcaster stream manifest");
      return [
        {
          kind: "hls",
          url: stream.href,
          title: String(data.name || channel.name),
          resolvedAt: new Date().toISOString(),
        },
      ];
    }
    const html = await (
      await providerFetch(
        `https://www.youtube.com/channel/${channel.channel}/live`,
      )
    ).text();
    return [youtubeLive(html, channel.channel)];
  });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
