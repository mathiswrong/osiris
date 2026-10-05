import WebSocket from "ws";
import {
  aircraftContacts,
  vesselContact,
  regionBoxes,
  distanceKm,
  type TrafficContact,
} from "./traffic";
import { providerFetch, resultFor, transition, type Stored } from "./store";
import type { SourceDefinition, SourceResult } from "./types";
// Shared in a Node process, including development module reloads. Respect the provider's 1 req/sec cap.
const state = globalThis as typeof globalThis & {
  ktAircraftQueue?: Promise<unknown>;
  ktAircraftNext?: number;
  ktAircraftQueued?: number;
  ktTrafficCache?: Map<string, Stored<TrafficContact>>;
  ktTrafficPending?: Map<string, Promise<SourceResult<TrafficContact>>>;
};
// Regional traffic is short-lived and never written to disk. Bound arbitrary public query keys.
async function trafficRead(
  def: SourceDefinition,
  loader: () => Promise<TrafficContact[]>,
): Promise<SourceResult<TrafficContact>> {
  const cache = (state.ktTrafficCache ||= new Map());
  const pending = (state.ktTrafficPending ||= new Map());
  const before = cache.get(def.id);
  if (before && Date.now() - Date.parse(before.checkedAt) < def.refreshMs)
    return resultFor(def, before);
  const inFlight = pending.get(def.id);
  if (inFlight) return inFlight;
  if (pending.size >= 16)
    return resultFor(
      def,
      transition(
        before,
        new Error("Regional connector busy; retry next minute"),
        new Date().toISOString(),
      ),
    );
  const task = (async () => {
    let data: TrafficContact[] | Error;
    try {
      data = await loader();
    } catch (e) {
      data = e instanceof Error ? e : new Error("Traffic source unavailable");
    }
    const next = transition(before, data, new Date().toISOString());
    cache.delete(def.id);
    cache.set(def.id, next);
    while (cache.size > 64) cache.delete(cache.keys().next().value!);
    return resultFor(def, next);
  })();
  pending.set(def.id, task);
  try {
    return await task;
  } finally {
    pending.delete(def.id);
  }
}
async function airRequest(url: string) {
  if ((state.ktAircraftQueued || 0) >= 8)
    throw new Error("Aircraft connector busy; retry on the next refresh");
  state.ktAircraftQueued = (state.ktAircraftQueued || 0) + 1;
  const run = (state.ktAircraftQueue || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const wait = Math.max(0, (state.ktAircraftNext || 0) - Date.now());
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      state.ktAircraftNext = Date.now() + 1100;
      return aircraftContacts(
        await (await providerFetch(url)).json(),
        new Date().toISOString(),
      );
    });
  state.ktAircraftQueue = run.catch(() => {});
  try {
    return await run;
  } finally {
    state.ktAircraftQueued!--;
  }
}
export async function regionalTraffic(lat: number, lng: number) {
  const key = `${lat.toFixed(1)}_${lng.toFixed(1)}`;
  const radiusKm = 463; // Provider maximum 250 nautical miles.
  const aircraft = trafficRead(
    {
      id: `adsbfi_${key}`,
      name: "adsb.fi",
      url: `https://opendata.adsb.fi/api/v3/lat/${lat}/lon/${lng}/dist/250`,
      refreshMs: 60_000,
      coverage:
        "250 nautical mile radius · receiver-dependent ADS-B/MLAT coverage · personal, non-commercial use",
    },
    async () =>
      airRequest(
        `https://opendata.adsb.fi/api/v3/lat/${lat}/lon/${lng}/dist/250`,
      ),
  );
  const vessels = trafficRead(
    {
      id: `aisstream_${key}`,
      name: "AIS Stream",
      url: "https://aisstream.io",
      refreshMs: 60_000,
      coverage:
        "Regional AIS messages collected for up to 12 seconds per refresh · incomplete receiver coverage",
    },
    async () => {
      const apiKey = process.env.AISSTREAM_API_KEY || process.env.AIS_API_KEY;
      if (!apiKey)
        throw new Error(
          "AIS Stream is not configured. Set AISSTREAM_API_KEY on the server to enable vessel positions.",
        );
      return new Promise<TrafficContact[]>((resolve, reject) => {
        const contacts = new Map<string, TrafficContact>();
        let confirmed = false,
          done = false;
        const socket = new WebSocket("wss://stream.aisstream.io/v0/stream", {
          handshakeTimeout: 8000,
          maxPayload: 1024 * 1024,
        });
        const finish = (error?: string) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          socket.close();
          if (error) reject(new Error(error));
          else resolve([...contacts.values()]);
        };
        const timer = setTimeout(
          () =>
            finish(
              confirmed
                ? undefined
                : "AIS subscription did not confirm within the collection window",
            ),
          12000,
        );
        socket.on("open", () =>
          socket.send(
            JSON.stringify({
              APIKey: apiKey,
              BoundingBoxes: regionBoxes(lat, lng, radiusKm),
              FilterMessageTypes: [
                "PositionReport",
                "StandardClassBPositionReport",
                "ExtendedClassBPositionReport",
              ],
            }),
          ),
        );
        socket.on("message", (bytes) => {
          try {
            const message = JSON.parse(bytes.toString());
            if (message.MessageType === "SubscriptionConfirmation")
              confirmed = true;
            if (message.error || message.Error) {
              finish(
                "AIS provider rejected the subscription; check server credentials and provider access",
              );
              return;
            }
            const contact = vesselContact(message, new Date().toISOString());
            if (contact) {
              confirmed = true;
              if (
                distanceKm({ lat, lng }, contact) <= radiusKm &&
                contacts.size < 10000
              )
                contacts.set(contact.id, contact);
            }
          } catch {
            /* malformed provider messages are discarded, never executed */
          }
        });
        socket.on("error", () => finish("AIS connection failed"));
        socket.on("close", () => {
          if (!done)
            finish(
              "AIS connection closed before the collection window completed",
            );
        });
      });
    },
  );
  return {
    center: { lat, lng },
    radiusKm,
    results: await Promise.all([aircraft, vessels]),
    generatedAt: new Date().toISOString(),
  };
}
