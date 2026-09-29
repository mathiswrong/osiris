import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { regionalTraffic } from "./traffic-sources";
import { providerFetch } from "./store";
vi.mock("./store", async (original) => ({ ...await original<typeof import("./store")>(), providerFetch: vi.fn() }));
const globals = globalThis as typeof globalThis & { ktTrafficCache?: Map<string, unknown>; ktTrafficPending?: Map<string, unknown>; ktAircraftNext?: number; ktAircraftQueued?: number; ktAircraftQueue?: Promise<unknown> };
beforeEach(() => {
  globals.ktTrafficCache?.clear(); globals.ktTrafficPending?.clear(); globals.ktAircraftNext = 0; globals.ktAircraftQueued = 0; globals.ktAircraftQueue = undefined;
  vi.stubEnv("AISSTREAM_API_KEY", ""); vi.stubEnv("AIS_API_KEY", "");
  vi.mocked(providerFetch).mockReset().mockResolvedValue(new Response(JSON.stringify({ now: Date.now(), ac: [] })));
});
afterEach(() => vi.unstubAllEnvs());
describe("independent homepage traffic feeds", () => {
  it("loads aircraft without opening or reporting an unrelated AIS source", async () => {
    const data = await regionalTraffic(51, 2, "aircraft");
    expect(data.results).toHaveLength(1);
    expect(data.results[0].health).toMatchObject({ name: "adsb.fi", state: "healthy" });
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });
  it("keeps vessel failures explicit and does not call the aircraft service", async () => {
    const data = await regionalTraffic(1.3, 103.8, "vessel");
    expect(data.results).toHaveLength(1);
    expect(data.results[0].health).toMatchObject({ name: "AIS Stream", state: "unavailable" });
    expect(data.results[0].health.error).toContain("not configured");
    expect(providerFetch).not.toHaveBeenCalled();
  });
  it("preserves the combined investigation response by default", async () => {
    const data = await regionalTraffic(26.5, 56.3);
    expect(data.results.map((result) => result.health.name)).toEqual(["adsb.fi", "AIS Stream"]);
  });
});
