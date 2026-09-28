import { NextRequest, NextResponse } from "next/server";
import { regionalTraffic } from "@/lib/intelligence/traffic-sources";
import { validPosition } from "@/lib/intelligence/traffic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams,
    latText = params.get("lat"),
    lngText = params.get("lng");
  const lat = Number(latText),
    lng = Number(lngText);
  if (!latText?.trim() || !lngText?.trim() || !validPosition(lat, lng))
    return NextResponse.json(
      { error: "Valid latitude and longitude required" },
      { status: 400 },
    );
  return NextResponse.json(
    await regionalTraffic(Math.round(lat * 10) / 10, Math.round(lng * 10) / 10),
    { headers: { "Cache-Control": "no-store" } },
  );
}
