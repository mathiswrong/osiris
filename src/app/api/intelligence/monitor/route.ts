import { NextResponse } from "next/server";
import { monitorSnapshot } from "@/lib/intelligence/monitor";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json(await monitorSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
