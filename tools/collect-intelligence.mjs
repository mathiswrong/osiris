// Run against a single web replica; mount INTELLIGENCE_DATA_DIR on durable storage.
import { setTimeout } from "node:timers/promises";

const origin = process.env.INTELLIGENCE_URL || "http://localhost:3217";
const once = process.argv.includes("--once");
const stop = new AbortController();
let collected = false;
process.on("SIGTERM", () => stop.abort());
process.on("SIGINT", () => stop.abort());
do {
  try {
    const response = await fetch(new URL("/api/intelligence/monitor", origin), {
      signal: AbortSignal.any([AbortSignal.timeout(55_000), stop.signal]),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { flashpoints: f } = await response.json();
    collected = true;
    console.log(
      JSON.stringify({
        at: f.generatedAt,
        flashpoints: f.data.length,
        healthySources: f.healthySources,
        baselineReady: f.baselineReady,
        persistent: f.persistent,
      }),
    );
  } catch (error) {
    if (stop.signal.aborted) break;
    console.error(error.message);
    if (once) process.exitCode = 1;
  }
  if (!once && !stop.signal.aborted) {
    // A new container may start the collector just before Next begins listening.
    try {
      await setTimeout(collected ? 60_000 : 5_000, undefined, { signal: stop.signal });
    } catch (error) {
      if (!stop.signal.aborted) throw error;
    }
  }
} while (!once && !stop.signal.aborted);
