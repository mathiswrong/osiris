import { NextRequest, NextResponse } from "next/server";
import { SOURCE_DEFINITIONS } from "@/lib/intelligence/types";
import { readSource } from "@/lib/intelligence/sources";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const def = SOURCE_DEFINITIONS.find(
    (s) => s.id === request.nextUrl.searchParams.get("id"),
  );
  if (!def)
    return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  return NextResponse.json(await readSource(def), {
    headers: { "Cache-Control": "no-store" },
  });
}
