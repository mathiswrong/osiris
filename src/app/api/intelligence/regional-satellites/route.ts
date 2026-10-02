import { NextRequest, NextResponse } from "next/server";
import { SATELLITE_SOURCE } from "@/lib/intelligence/types";
import { providerFetch, sourceRead } from "@/lib/intelligence/store";
import { parseElements, predict } from "@/lib/intelligence/satellites";
import { distanceKm, validPosition } from "@/lib/intelligence/traffic";
import { missionFor } from "@/lib/intelligence/profiles";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rawLat = request.nextUrl.searchParams.get("lat");
  const rawLng = request.nextUrl.searchParams.get("lng");
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const radiusKm = 900;
  if (!rawLat?.trim() || !rawLng?.trim() || !validPosition(lat, lng))
    return NextResponse.json({ error: "Invalid regional center" }, { status: 400 });

  const stored = await sourceRead(SATELLITE_SOURCE, async () =>
    parseElements(await (await providerFetch(SATELLITE_SOURCE.url, 60_000)).json()),
  );
  const now = new Date();
  const nearby = stored.data.flatMap((element) => {
    const position = predict(element, now);
    if (!position) return [];
    const distance = distanceKm({ lat, lng }, position);
    if (distance > radiusKm) return [];
    const profile = missionFor(position);
    return [{
      id: position.id,
      name: position.name,
      altKm: position.altKm,
      distanceKm: Math.round(distance),
      purpose: profile?.purpose || "Not documented",
      predictedAt: position.predictedAt,
      elementAgeHours: position.elementAgeHours,
    }];
  });
  nearby.sort((a, b) =>
    Number(b.purpose === "Earth observation") - Number(a.purpose === "Earth observation") ||
    a.distanceKm - b.distanceKm,
  );
  return NextResponse.json({
    data: nearby.slice(0, 8),
    total: nearby.length,
    earthObservationCount: nearby.filter((item) => item.purpose === "Earth observation").length,
    center: { lat, lng },
    radiusKm,
    predictedAt: now.toISOString(),
    health: stored.health,
  }, { headers: { "Cache-Control": "no-store" } });
}
