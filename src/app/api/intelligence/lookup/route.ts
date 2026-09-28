import { NextRequest, NextResponse } from "next/server";
import { webUrl } from "@/lib/intelligence/normalize";
import { getClientIp, isRateLimited } from "@/lib/ssrf-guard";

type Connector = "hapi" | "reliefweb" | "gfw";
type ResultRow = { title: string; detail: string; url: string };
const configured = () => ({
  hapi: Boolean(process.env.HAPI_APP_IDENTIFIER),
  reliefweb: Boolean(process.env.RELIEFWEB_APPNAME),
  gfw: Boolean(process.env.GFW_API_ACCESS_TOKEN),
});
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};
const str = (value: unknown) => typeof value === "string" ? value : "";
const rows = (value: unknown) => Array.isArray(value) ? value : [];

export async function GET(request: NextRequest) {
  const status = configured();
  const provider = request.nextUrl.searchParams.get("provider") as Connector | null;
  if (!provider) return NextResponse.json({ status });
  if (!(provider in status)) return NextResponse.json({ error: "Unknown connector" }, { status: 400 });
  if (!status[provider]) return NextResponse.json({ error: `${provider.toUpperCase()} connector is not configured`, status }, { status: 503 });
  const query = (request.nextUrl.searchParams.get("q") || "").trim();
  if (query.length > 80 || (provider === "gfw" ? query.length < 2 : !/^[A-Z]{3}$/.test(query)))
    return NextResponse.json({ error: provider === "gfw" ? "Enter a vessel name, IMO or MMSI" : "Enter a three-letter ISO country code" }, { status: 400 });
  if (isRateLimited(`intelligence-lookup:${getClientIp(request)}`, 10, 60_000))
    return NextResponse.json({ error: "Too many lookups. Try again in a minute." }, { status: 429 });
  let endpoint = "", headers: HeadersInit = { Accept: "application/json" };
  if (provider === "hapi") {
    const url = new URL("https://hapi.humdata.org/api/v2/affected-people/humanitarian-needs");
    url.searchParams.set("app_identifier", process.env.HAPI_APP_IDENTIFIER!);
    url.searchParams.set("location_code", query);
    url.searchParams.set("population_status", "INN");
    url.searchParams.set("sector_code", "intersectoral");
    url.searchParams.set("admin_level", "0");
    url.searchParams.set("limit", "30");
    endpoint = url.toString();
  } else if (provider === "reliefweb") {
    const url = new URL("https://api.reliefweb.int/v2/disasters");
    url.searchParams.set("appname", process.env.RELIEFWEB_APPNAME!);
    url.searchParams.set("limit", "20");
    url.searchParams.set("preset", "latest");
    url.searchParams.set("filter[field]", "country.iso3");
    url.searchParams.set("filter[value]", query);
    endpoint = url.toString();
  } else {
    const url = new URL("https://gateway.api.globalfishingwatch.org/v3/vessels/search");
    url.searchParams.set("query", query);
    url.searchParams.set("datasets[0]", "public-global-vessel-identity:latest");
    endpoint = url.toString();
    headers = { ...headers, Authorization: `Bearer ${process.env.GFW_API_ACCESS_TOKEN}` };
  }
  try {
    const response = await fetch(endpoint, { headers, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
    const payload: unknown = await response.json();
    let data: ResultRow[] = [];
    if (provider === "hapi") {
      const list = rows(obj(payload).data || obj(payload).results || payload);
      data = list.map((raw) => {
        const item = obj(raw);
        const period = str(item.reference_period_start).slice(0, 4);
        const value = typeof item.population === "number" ? new Intl.NumberFormat("en").format(item.population) : "—";
        return { title: `${str(item.location_name) || query} · ${period || "period unknown"}`, detail: `${value} people in need · intersectoral · annual estimate`, url: "https://data.humdata.org/" };
      });
    } else if (provider === "reliefweb") {
      data = rows(obj(payload).data).map((raw) => {
        const item = obj(raw), fields = obj(item.fields);
        const date = str(obj(fields.date).created).slice(0, 10);
        return { title: str(fields.name) || "ReliefWeb disaster", detail: `ReliefWeb disaster record${date ? ` · ${date}` : ""}`, url: webUrl(fields.url) || `https://reliefweb.int/taxonomy/term/${encodeURIComponent(str(item.id))}` };
      });
    } else {
      data = rows(obj(payload).entries).map((raw) => {
        const item = obj(raw), identity = obj(item.selfReportedInfo);
        return { title: str(identity.shipname) || str(identity.nShipname) || "Vessel", detail: [str(identity.flag), str(identity.ssvid) && `MMSI ${identity.ssvid}`, str(identity.imo) && `IMO ${identity.imo}`].filter(Boolean).join(" · ") || "Identity match", url: "https://globalfishingwatch.org/map/" };
      });
    }
    return NextResponse.json({ provider, query, rows: data, retrievedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provider request failed" }, { status: 502 });
  }
}
