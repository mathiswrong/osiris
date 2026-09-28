import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SourceDefinition, SourceResult } from "./types";
interface Snapshot<T> {
  data: T[];
  fetchedAt: string;
}
export interface Stored<T> {
  current: Snapshot<T> | null;
  previous: Snapshot<T> | null;
  checkedAt: string;
  error: string | null;
}
const memory = new Map<string, Stored<unknown>>();
const pending = new Map<string, Promise<SourceResult<unknown>>>();
const directory =
  process.env.INTELLIGENCE_DATA_DIR ||
  path.join(process.cwd(), ".cache", "intelligence");
export function resultFor<T>(
  def: SourceDefinition,
  state: Stored<T>,
): SourceResult<T> {
  return {
    data: state.current?.data || [],
    health: {
      ...def,
      state: state.error
        ? state.current
          ? "stale"
          : "unavailable"
        : "healthy",
      count: state.current?.data.length || 0,
      fetchedAt: state.current?.fetchedAt || null,
      checkedAt: state.checkedAt,
      nextCheckAt: new Date(
        Date.parse(state.checkedAt) + def.refreshMs,
      ).toISOString(),
      error: state.error,
    },
  };
}
/** Successful empty responses replace previous data. Failure never advances observation freshness. */
export function transition<T>(
  previous: Stored<T> | undefined,
  data: T[] | Error,
  now: string,
): Stored<T> {
  return data instanceof Error
    ? {
        current: previous?.current || null,
        previous: previous?.previous || null,
        checkedAt: now,
        error: data.message,
      }
    : {
        current: { data, fetchedAt: now },
        previous: previous?.current || null,
        checkedAt: now,
        error: null,
      };
}
export async function sourceRead<T>(
  def: SourceDefinition,
  loader: () => Promise<T[]>,
): Promise<SourceResult<T>> {
  if (pending.has(def.id))
    return pending.get(def.id)! as Promise<SourceResult<T>>;
  const task = (async () => {
    let state = memory.get(def.id) as Stored<T> | undefined;
    const file = path.join(directory, `${def.id}.json`);
    if (!state) {
      try {
        const disk = JSON.parse(await readFile(file, "utf8"));
        if (
          disk.checkedAt &&
          (!disk.current || Array.isArray(disk.current.data))
        )
          state = disk;
      } catch {
        /* first run */
      }
    }
    if (state && Date.now() - Date.parse(state.checkedAt) < def.refreshMs) {
      memory.set(def.id, state);
      return resultFor(def, state);
    }
    let data: T[] | Error;
    try {
      data = await loader();
    } catch (error) {
      data =
        error instanceof Error ? error : new Error("Provider request failed");
    }
    state = transition(state, data, new Date().toISOString());
    memory.set(def.id, state);
    try {
      await mkdir(directory, { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(state));
      await rename(temp, file);
    } catch {
      console.warn(`Intelligence cache persistence unavailable: ${def.id}`);
    }
    return resultFor(def, state);
  })();
  pending.set(def.id, task as Promise<SourceResult<unknown>>);
  try {
    return await task;
  } finally {
    pending.delete(def.id);
  }
}
export async function providerFetch(url: string, timeoutMs = 12_000): Promise<Response> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "KnuckleTat/0.2 (public-source-dashboard)" },
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response;
}
