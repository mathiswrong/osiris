import { describe, expect, it } from "vitest";
import { parseLayouts, tileLayout, recommendedTiles } from "./dashboard-layout";
const tiles = [ { id: "map", w: 6, h: 18 }, { id: "feed", w: 3, h: 12 }, { id: "video", w: 3, h: 12 } ];
function overlaps(layout: ReturnType<typeof tileLayout>) {
  return layout.some((a, i) => layout.slice(i + 1).some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y));
}
describe("dashboard layouts", () => {
  it("fits a mixed row on desktop and a single column on phones", () => {
    const desktop = tileLayout(tiles, 12);
    expect(desktop.map((p) => [p.x, p.y, p.w])).toEqual([[0, 0, 6], [6, 0, 3], [9, 0, 3]]);
    const mobile = tileLayout(tiles, 1);
    expect(mobile.every((p) => p.x === 0 && p.w === 1)).toBe(true);
    expect(overlaps(mobile)).toBe(false);
  });
  it("discards corrupt storage and clamps untrusted dimensions", () => {
    expect(parseLayouts("broken")).toEqual({});
    expect(parseLayouts("null")).toEqual({});
    expect(parseLayouts(JSON.stringify({12:[{i:"map",x:-4,y:-8,w:100,h:100},{i:"map",x:1,y:1,w:3,h:8},{i:"bad",x:0,y:0,w:null,h:10}]}))[12]).toEqual([{i:"map",x:0,y:0,w:12,h:40}]);
  });
  it("restores dimensions and fills newly added panels without overlaps", () => {
    const saved = [{i:"feed",x:0,y:0,w:4,h:15}, {i:"map",x:4,y:0,w:8,h:18}];
    const layout = tileLayout(tiles,12,saved);
    expect(layout.find((p) => p.i === "map")).toMatchObject({x:4,y:0,w:8,h:18});
    expect(overlaps(layout)).toBe(false);
    expect(layout).toHaveLength(3);
  });
  it("ignores removed panels and compacts the remaining tiles", () => {
    const saved = [{i:"closed-investigation",x:0,y:0,w:12,h:20},{i:"map",x:0,y:20,w:6,h:18}];
    const layout = tileLayout([tiles[0]],12,saved);
    expect(layout).toHaveLength(1);
    expect(layout[0].y).toBe(0);
  });
});

it.each([12, 6, 1])("keeps capability groups together without gaps at %s columns", (cols) => {
  const ids = ["flashpoints", "signal-watch", "developments", "situation", "satellites", "air-traffic", "maritime-traffic", "video-dw", "video-france24", "video-aljazeera", "video-sky", "signals", "activity", "telegram", "desk-details", "context", "catalogue", "mission", "satellite-dossier", "channels", "social", "lookup"];
  const defaults = recommendedTiles(ids.map((id) => ({ id, w: 3, h: 10 })), cols);
  const layout = tileLayout(defaults, cols);
  expect(overlaps(layout)).toBe(false);
  expect(layout.every((tile) => tile.x >= 0 && tile.x + tile.w <= cols)).toBe(true);
  for (let row = 0; row < Math.max(...layout.map((tile) => tile.y + tile.h)); row++) {
    expect(layout.filter((tile) => tile.y <= row && tile.y + tile.h > row).reduce((sum, tile) => sum + tile.w, 0)).toBe(cols);
  }
  const maps = layout.filter((tile) => defaults.find((item) => item.id === tile.i)?.group === "maps");
  if (cols === 12) expect(maps.map((tile) => [tile.x, tile.y, tile.w])).toEqual([[0, 12, 3], [3, 12, 3], [6, 12, 3], [9, 12, 3]]);
  const video = layout.find((tile) => tile.i === "video-dw")!;
  expect(video.y).toBe(Math.max(...maps.map((tile) => tile.y + tile.h)));
});
