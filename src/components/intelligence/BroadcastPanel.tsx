"use client";
import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import {
  BROADCASTS,
  type BroadcastStream,
} from "@/lib/intelligence/broadcasts";
import type { SourceResult } from "@/lib/intelligence/types";
type YTPlayer = { destroy(): void; mute(): void; playVideo(): void };
type YTApi = {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => YTPlayer;
};
let sdk: Promise<YTApi> | undefined;
function youtubeSdk() {
  if (!sdk)
    sdk = new Promise<YTApi>((resolve, reject) => {
      const w = window as typeof window & {
        YT?: YTApi;
        onYouTubeIframeAPIReady?: () => void;
      };
      if (w.YT?.Player) {
        resolve(w.YT);
        return;
      }
      const previous = w.onYouTubeIframeAPIReady;
      const timeout = setTimeout(
        () => reject(new Error("YouTube player API did not load")),
        15_000,
      );
      w.onYouTubeIframeAPIReady = () => {
        clearTimeout(timeout);
        previous?.();
        if (w.YT) resolve(w.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("YouTube player API blocked"));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      sdk = undefined;
      throw error;
    });
  return sdk;
}
function Player({
  stream,
  onStatus,
}: {
  stream: BroadcastStream;
  onStatus: (status: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true,
      dispose = () => {};
    const status = (s: string) => {
      if (active) onStatus(s);
    };
    const timeout = setTimeout(
      () =>
        status(
          "Playback is taking longer than expected. Retry or open the broadcaster.",
        ),
      25_000,
    );
    const playing = () => {
      clearTimeout(timeout);
      status("Playing · live broadcast");
    };
    if (stream.kind === "youtube") {
      void youtubeSdk()
        .then((api) => {
          if (!active || !host.current) return;
          const element = document.createElement("div");
          host.current.appendChild(element);
          const p = new api.Player(element, {
            videoId: stream.url,
            host: "https://www.youtube.com",
            width: "100%",
            height: "100%",
            playerVars: {
              autoplay: 1,
              mute: 1,
              playsinline: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                if (!active) return;
                clearTimeout(timeout);
                p.mute();
                p.playVideo();
                status("Player ready · press play if playback is blocked");
              },
              onStateChange: (e: { data: number }) => {
                if (e.data === 1) playing();
                else if (e.data === 2) status("Paused");
                else if (e.data === 3) status("Buffering…");
                else if (e.data === 0)
                  status(
                    "Broadcast ended · retry to discover the current live feed",
                  );
              },
              onError: (e: { data: number }) => {
                clearTimeout(timeout);
                status(
                  `Playback unavailable (YouTube ${e.data}). Try another channel or open the broadcaster.`,
                );
              },
              onAutoplayBlocked: () =>
                status("Ready · press play in the player"),
            },
          });
          dispose = () => p.destroy();
        })
        .catch((e) => status(e.message));
    } else if (video.current) {
      const v = video.current;
      v.addEventListener("playing", playing);
      const waiting = () => status("Buffering…");
      const pause = () => status("Paused");
      const ended = () => status("Broadcast ended");
      const error = () => {
        clearTimeout(timeout);
        status("Video playback failed. Retry or open the broadcaster.");
      };
      v.addEventListener("waiting", waiting);
      v.addEventListener("pause", pause);
      v.addEventListener("ended", ended);
      v.addEventListener("error", error);
      const play = () =>
        void v.play().catch(() => {
          clearTimeout(timeout);
          status("Ready · press play in the player");
        });
      if (v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = stream.url;
        play();
      } else
        void import("hls.js")
          .then(({ default: Hls }) => {
            if (!active) return;
            if (!Hls.isSupported()) {
              status("This browser cannot play HLS. Open the broadcaster.");
              return;
            }
            const hls = new Hls({ maxBufferLength: 20 });
            hls.loadSource(stream.url);
            hls.attachMedia(v);
            hls.on(Hls.Events.MANIFEST_PARSED, play);
            hls.on(Hls.Events.ERROR, (_, data) => {
              if (data.fatal) {
                clearTimeout(timeout);
                status(
                  `Stream unavailable (${data.details}). Retry or open the broadcaster.`,
                );
                hls.destroy();
              }
            });
            dispose = () => hls.destroy();
          })
          .catch(() => status("Video library failed to load. Retry."));
      const cleanup = () => {
        v.removeEventListener("playing", playing);
        v.removeEventListener("waiting", waiting);
        v.removeEventListener("pause", pause);
        v.removeEventListener("ended", ended);
        v.removeEventListener("error", error);
        v.pause();
        v.removeAttribute("src");
        v.load();
      };
      return () => {
        active = false;
        clearTimeout(timeout);
        dispose();
        cleanup();
      };
    }
    return () => {
      active = false;
      clearTimeout(timeout);
      dispose();
    };
  }, [stream, onStatus]);
  return stream.kind === "hls" ? (
    <video
      ref={video}
      controls
      muted
      playsInline
      aria-label="Official live broadcast"
    />
  ) : (
    <div ref={host} className="desk-youtube" />
  );
}
export default function BroadcastPanel({ fixedChannel }: { fixedChannel?: number } = {}) {
  const [channel, setChannel] = useState(0),
    [attempt, setAttempt] = useState(0),
    [enabled, setEnabled] = useState(fixedChannel !== undefined),
    [stream, setStream] = useState<BroadcastStream | null>(null),
    [status, setStatus] = useState(
      fixedChannel === undefined
        ? "Choose a channel, then load its live player."
        : "Finding the current live stream…",
    );
  const selected = BROADCASTS[fixedChannel ?? channel];
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    void fetch(`/api/intelligence/broadcast?id=${selected.id}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Player discovery HTTP ${response.status}`);
        const result: SourceResult<BroadcastStream> = await response.json();
        if (!active) return;
        if (result.health.state !== "healthy" || !result.data[0])
          throw new Error(result.health.error || "No live broadcast found");
        setStream(result.data[0]);
        setStatus("Connecting to official stream…");
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [selected.id, attempt, enabled]);
  const load = () => {
    setStream(null);
    setStatus("Finding the current live stream…");
    setEnabled(true);
    setAttempt((x) => x + 1);
  };
  return (
    <section className={`desk-panel desk-broadcast${fixedChannel === undefined ? "" : " desk-broadcast-fixed"}`}>
      <div className="desk-panel-title">
        <h2>
          <Radio size={15} />
          {fixedChannel === undefined ? "Live broadcasts" : selected.name}
        </h2>
        <span>Official sources</span>
      </div>
      {fixedChannel === undefined && <div className="desk-channels">
        {BROADCASTS.map((c, i) => (
          <button
            key={c.id}
            aria-pressed={i === channel}
            onClick={() => {
              setChannel(i);
              setStream(null);
              setEnabled(false);
              setStatus("Ready to load the official player.");
            }}
          >
            {c.name}
          </button>
        ))}
      </div>}
      <div className="desk-video">
        {stream ? (
          <Player
            key={`${selected.id}-${attempt}`}
            stream={stream}
            onStatus={setStatus}
          />
        ) : (
          <div>
            <Radio size={24} />
            <strong>{selected.name}</strong>
            <button onClick={load}>
              {enabled ? "Retry player" : "Load live broadcast"}
            </button>
          </div>
        )}
        {stream &&
          /unavailable|failed|taking longer|did not load|cannot play/i.test(
            status,
          ) && (
            <div className="desk-player-fallback">
              <strong>Playback not available here</strong>
              <span>
                The player has not confirmed playback. Use the broadcaster or
                try another channel.
              </span>
              <a href={selected.url} target="_blank" rel="noreferrer">
                Watch {selected.name} ↗
              </a>
            </div>
          )}
      </div>
      <div className="desk-media-note">
        <p
          role="status"
          className={status.startsWith("Playing") ? "desk-green" : ""}
        >
          {status}
        </p>
        <div className="desk-media-actions">
          {stream && <button onClick={load}>Reconnect</button>}
          <a href={selected.url} target="_blank" rel="noreferrer">
            Open broadcaster ↗
          </a>
        </div>
        <small>
          Starts muted. Broadcasts are not evidence of the selected incident.
        </small>
      </div>
    </section>
  );
}
