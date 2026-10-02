"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { emptyRegionalHub, type RegionalHub } from "@/lib/intelligence/regional-hubs";

type FollowedRegion = { id: string; name: string };
const storageKey = "knuckletat:followed-regions:v1";
const changeEvent = "knuckletat:followed-regions-change";

function readFollowed(): FollowedRegion[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is FollowedRegion =>
          !!item && typeof item.id === "string" && typeof item.name === "string" && /^[a-z0-9-]+$/.test(item.id),
        ).slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

export function useFollowedRegions() {
  const [followed, setFollowed] = useState<FollowedRegion[]>([]);
  useEffect(() => {
    const update = () => setFollowed(readFollowed());
    update();
    window.addEventListener("storage", update);
    window.addEventListener(changeEvent, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(changeEvent, update);
    };
  }, []);
  return followed;
}

export function FollowRegionButton({ region }: { region: FollowedRegion }) {
  const followed = useFollowedRegions();
  const isFollowed = followed.some((item) => item.id === region.id);
  return (
    <button
      type="button"
      className="regional-follow"
      aria-pressed={isFollowed}
      onClick={() => {
        const next = isFollowed
          ? readFollowed().filter((item) => item.id !== region.id)
          : [...readFollowed().filter((item) => item.id !== region.id), region];
        try { localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 24))); } catch {}
        window.dispatchEvent(new Event(changeEvent));
      }}
    >
      {isFollowed ? "Following ✓" : "+ Follow region"}
    </button>
  );
}

export function MyDeskLink({ hubs, active = false }: { hubs: RegionalHub[]; active?: boolean }) {
  const followed = useFollowedRegions();
  const id = followed[0]?.id || hubs[0]?.id;
  return <Link href={id ? `/regions/${id}` : "/regions"} className="desk-main-link" aria-current={active ? "page" : undefined}>My desk</Link>;
}

export default function RegionalHubPills({ hubs, selectedId }: { hubs: RegionalHub[]; selectedId?: string }) {
  const followed = useFollowedRegions();
  const active = new Map(hubs.map((hub) => [hub.id, hub]));
  const ordered = [
    ...followed.map((item) => ({ ...item, count: active.get(item.id)?.events.length || 0, followed: true })),
    ...hubs.filter((hub) => !followed.some((item) => item.id === hub.id))
      .slice(0, 8)
      .map((hub) => ({ id: hub.id, name: hub.name, count: hub.events.length, followed: false })),
  ];
  const pills = selectedId && !ordered.some((hub) => hub.id === selectedId)
    ? [{ id: selectedId, name: active.get(selectedId)?.name || emptyRegionalHub(selectedId)?.name || selectedId.replaceAll("-", " "), count: active.get(selectedId)?.events.length || 0, followed: false }, ...ordered]
    : ordered;
  return (
    <nav className="desk-region-nav" aria-label="Regional hubs">
      <span className="desk-region-label">{followed.length ? "Followed regions" : "Active regions"}</span>
      <div className="desk-region-pills">
        {pills.map((hub) => (
          <Link key={hub.id} href={`/regions/${hub.id}`} className="desk-region-pill" aria-current={selectedId === hub.id ? "page" : undefined} aria-label={`${hub.name}, ${hub.count} headline groups${hub.followed ? ", followed" : ""}`}>
            {hub.followed && <span className="desk-region-pin" aria-hidden="true">●</span>}
            {hub.name}
            <span className="desk-region-count" aria-hidden="true">{hub.count}</span>
          </Link>
        ))}
        {!pills.length && <span className="desk-region-empty">No active regional watches yet</span>}
      </div>
      <Link href="/regions" className="desk-region-all" aria-current={selectedId === "" ? "page" : undefined}>All regions ↗</Link>
    </nav>
  );
}
