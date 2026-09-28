import { NextRequest, NextResponse } from "next/server";
import { SATELLITE_SOURCE } from "@/lib/intelligence/types";
import { providerFetch, sourceRead } from "@/lib/intelligence/store";
import {
  parseElements,
  predict,
  groundTrack,
  orbitalTrack,
} from "@/lib/intelligence/satellites";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (id && !/^[1-9]\d{0,8}$/.test(id))
    return NextResponse.json(
      { error: "Invalid catalogue ID" },
      { status: 400 },
    );
  const stored = await sourceRead(SATELLITE_SOURCE, async () =>
    // The complete OMM catalogue is several megabytes. Aborting its transfer
    // after the normal RSS timeout can consume CelesTrak's two-hour download
    // allowance without leaving a usable snapshot.
    parseElements(await (await providerFetch(SATELLITE_SOURCE.url, 60_000)).json()),
  );
  const now = new Date();
  const data = stored.data.flatMap((e) => {
    const p = predict(e, now);
    const next = p ? predict(e, new Date(now.getTime() + 60_000)) : null;
    return p
      ? [
          {
            ...p,
            next: next
              ? { lat: next.lat, lng: next.lng, altKm: next.altKm }
              : undefined,
          },
        ]
      : [];
  });
  const element = id
    ? stored.data.find((e) => String(e.NORAD_CAT_ID) === id)
    : undefined;
  const contextElements = [
    stored.data.find((e) => String(e.NORAD_CAT_ID) === "25544"),
    stored.data.find((e) => String(e.NORAD_CAT_ID) === "49260"),
    stored.data.find((e) => e.OBJECT_NAME === "SENTINEL-1C"),
    stored.data.find((e) => e.OBJECT_NAME.startsWith("NAVSTAR")),
    stored.data.find((e) => /GALILEO/.test(e.OBJECT_NAME)),
    stored.data.find((e) => e.OBJECT_NAME === "STARLINK-1008"),
  ].filter((e): e is NonNullable<typeof e> => !!e);
  return NextResponse.json(
    {
      contextOrbits: contextElements.map((e) => ({
        id: String(e.NORAD_CAT_ID),
        points: orbitalTrack(e, now),
      })),
      data,
      health: {
        ...stored.health,
        count: data.length,
        state:
          stored.health.state === "healthy" && data.length < stored.data.length
            ? "partial"
            : stored.health.state,
        coverage: `${stored.health.coverage} · ${stored.data.length - data.length} elements could not be propagated`,
      },
      selectedId: element ? id : undefined,
      orbit: element ? orbitalTrack(element, now) : undefined,
      track: element ? groundTrack(element, now) : undefined,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
