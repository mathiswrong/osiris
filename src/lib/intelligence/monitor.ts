import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { SOURCE_DEFINITIONS } from "./types";
import { readSource } from "./sources";
import {
  advanceJournal,
  detectFlashpoints,
  type Journal,
  type FlashpointResult,
} from "./flashpoints";
const directory =
  process.env.INTELLIGENCE_DATA_DIR ||
  path.join(process.cwd(), ".cache", "intelligence");
let journal: Journal | undefined;
let pending: Promise<Awaited<ReturnType<typeof collect>>> | undefined;
let cached:
  | {
      at: number;
      payload: {
        results: Awaited<ReturnType<typeof readSource>>[];
        flashpoints: FlashpointResult;
      };
    }
  | undefined;
async function collect() {
  const results = await Promise.all(SOURCE_DEFINITIONS.map(readSource));
  if (!journal) {
    try {
      const disk = JSON.parse(
        await readFile(path.join(directory, "flashpoint-history.json"), "utf8"),
      );
      if (
        disk.version === 1 &&
        Array.isArray(disk.records) &&
        Array.isArray(disk.samples)
      )
        journal = disk;
    } catch {}
  }
  const now = Date.now();
  journal = advanceJournal(journal, results, now);
  let persistent = true;
  try {
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, "flashpoint-history.json");
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(journal));
    await rename(temp, file);
  } catch {
    persistent = false;
  }
  return {
    results,
    flashpoints: detectFlashpoints(journal, results, now, persistent),
  };
}
export async function monitorSnapshot() {
  if (cached && Date.now() - cached.at < 30_000) return cached.payload;
  if (pending) return pending;
  pending = collect();
  try {
    const payload = await pending;
    cached = { at: Date.now(), payload };
    return payload;
  } finally {
    pending = undefined;
  }
}
