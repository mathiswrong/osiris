"use client";
import { useSyncExternalStore } from "react";
import BroadcastPanel from "./BroadcastPanel";
import { BROADCASTS } from "@/lib/intelligence/broadcasts";

function subscribe(callback: () => void) {
  const media = window.matchMedia("(min-width: 701px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export default function BroadcastWall() {
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 701px)").matches, () => false);
  if (!desktop) return null;
  return (
    <section className="desk-broadcast-wall" aria-label="Four live broadcast channels">
      <div className="desk-broadcast-wall-grid">
        {BROADCASTS.map((channel, index) => <BroadcastPanel key={channel.id} fixedChannel={index} />)}
      </div>
    </section>
  );
}
