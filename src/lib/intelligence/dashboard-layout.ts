import { verticalCompactor, type Layout, type LayoutItem } from "react-grid-layout/core";

export const LAYOUT_KEY = "knuckletat:bricks:v1";
export type TileDefinition = { id: string; w: number; h: number };
// A complete row at each breakpoint keeps related tools next to one another.
const DEFAULT_TILES: Record<string, { w: number; h: number; tabletW?: number; group: string }> = {
  flashpoints: { w: 6, h: 12, group: "overview" },
  "signal-watch": { w: 3, h: 12, group: "overview" },
  developments: { w: 3, h: 12, group: "overview" },
  situation: { w: 3, h: 20, group: "maps" },
  satellites: { w: 3, h: 20, group: "maps" },
  "air-traffic": { w: 3, h: 20, group: "maps" },
  "maritime-traffic": { w: 3, h: 20, group: "maps" },
  "video-": { w: 3, h: 10, group: "broadcasts" },
  signals: { w: 4, h: 17, tabletW: 6, group: "signals" },
  activity: { w: 4, h: 17, tabletW: 3, group: "signals" },
  telegram: { w: 4, h: 17, tabletW: 3, group: "signals" },
  "desk-details": { w: 6, h: 10, group: "evidence" },
  context: { w: 6, h: 10, group: "evidence" },
  catalogue: { w: 6, h: 18, tabletW: 6, group: "orbital" },
  mission: { w: 6, h: 9, tabletW: 6, group: "orbital" },
  "satellite-dossier": { w: 6, h: 9, tabletW: 6, group: "orbital" },
  channels: { w: 4, h: 15, tabletW: 6, group: "sources" },
  social: { w: 4, h: 15, tabletW: 3, group: "sources" },
  lookup: { w: 4, h: 15, tabletW: 3, group: "sources" },
  "investigation-tile": { w: 12, h: 24, group: "evidence" },
};
export function recommendedTiles<T extends TileDefinition>(tiles: T[], cols: number) {
  const keys = Object.keys(DEFAULT_TILES);
  const key = (id: string) => id.startsWith("video-") ? "video-" : id;
  const rank = (id: string) => { const index = keys.indexOf(key(id)); return index < 0 ? keys.length : index; };
  return tiles.map((tile) => {
    const preset = DEFAULT_TILES[key(tile.id)];
    return preset ? { ...tile, w: Math.min(cols, cols === 6 ? preset.tabletW ?? preset.w : preset.w), h: preset.h, group: preset.group } : { ...tile, group: "tools" };
  }).sort((a, b) => rank(a.id) - rank(b.id));
}
export type SavedLayouts = Record<string, Layout>;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

export function parseLayouts(raw: string | null): SavedLayouts {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: SavedLayouts = {};
    for (const cols of [1, 6, 12]) {
      const rows: unknown = value[cols];
      if (!Array.isArray(rows)) continue;
      const seen = new Set<string>();
      result[cols] = rows.slice(0, 100).flatMap((row) => {
        if (!row || typeof row.i !== "string" || seen.has(row.i) || ![row.x, row.y, row.w, row.h].every(Number.isFinite)) return [];
        seen.add(row.i);
        const w = clamp(row.w, Math.min(3, cols), cols);
        return [{ i: row.i, x: clamp(row.x, 0, cols - w), y: clamp(row.y, 0, 10000), w, h: clamp(row.h, 7, 40) }];
      });
    }
    return result;
  } catch { return {}; }
}

export function tileLayout(tiles: TileDefinition[], cols: number, saved: Layout = []): Layout {
  const placed: LayoutItem[] = [];
  for (const tile of tiles) {
    const previous = saved.find((item) => item.i === tile.id);
    const minW = Math.min(3, cols);
    const w = previous?.w ?? Math.min(tile.w, cols);
    const h = previous?.h ?? tile.h;
    // Place new tiles in the earliest gap that can hold them; existing tiles retain their arrangement.
    let x = previous?.x ?? 0;
    let y = previous?.y ?? 0;
    if (!previous) {
      while (true) {
        const collision = placed.some((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);
        if (!collision) break;
        x++;
        if (x + w > cols) { x = 0; y++; }
      }
    }
    placed.push({ i: tile.id, x, y, w, h, minW, minH: 7, maxH: 40 });
  }
  return verticalCompactor.compact(placed, cols);
}
