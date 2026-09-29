"use client";
import { Children, isValidElement, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import { moveElement, verticalCompactor, type Layout } from "react-grid-layout/core";
import { Grip, Maximize2, Minimize2, RotateCcw, LockKeyhole, UnlockKeyhole } from "lucide-react";
import { LAYOUT_KEY, parseLayouts, tileLayout, type TileDefinition } from "@/lib/intelligence/dashboard-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./dashboard-grid.css";

type TileProps = TileDefinition & { title: string; kind?: "map" | "video"; children: ReactNode };
// Descriptors keep the content and its owning hooks together. The grid supplies the tile chrome.
export function DashboardTile({ children }: TileProps) { return children; }

let pendingReveal: string | null = null;
export function revealDashboardTile(id: string) {
  pendingReveal = id;
  window.dispatchEvent(new Event("knuckletat:reveal-tile"));
}
const order = ["flashpoints", "signal-watch", "telegram", "situation", "satellites", "air-traffic", "maritime-traffic", "video-", "developments", "desk-details", "signals", "activity", "channels", "mission", "catalogue", "satellite-dossier", "context", "social", "lookup", "investigation-tile"];
const rank = (id: string) => order.findIndex((key) => id === key || (key === "video-" && id.startsWith(key)));

export default function DashboardGrid({ children }: { children: ReactNode }) {
  const { width, mounted, containerRef } = useContainerWidth({ measureBeforeMount: true });
  const tiles = Children.toArray(children).filter(isValidElement<TileProps>).map((child) => child.props).sort((a, b) => rank(a.id) - rank(b.id));
  return <div className="desk-bricks" ref={containerRef}>
    {mounted ? <Workspace tiles={tiles} width={width} cols={width >= 1100 ? 12 : width >= 700 ? 6 : 1} /> : <div className="desk-empty">Preparing your workspace…</div>}
  </div>;
}

function Workspace({ tiles, width, cols }: { tiles: TileProps[]; width: number; cols: number }) {
  const [saved, setSaved] = useState(() => {
    try { return parseLayouts(localStorage.getItem(LAYOUT_KEY)); } catch { return {}; }
  });
  const [locked, setLocked] = useState(false);
  const [full, setFull] = useState<string | null>(null);
  // A transient investigation can be closed from inside its expanded content.
  if (full && !tiles.some((tile) => tile.id === full)) setFull(null);
  const [message, setMessage] = useState("Drag a tile’s grip · resize from its corner · expand for full screen");
  const [interacting, setInteracting] = useState(false);
  const layout = tileLayout(tiles, cols, saved[cols]);
  function commit(next: Layout) {
    const compact = verticalCompactor.compact(next, cols);
    // Keep temporarily closed investigation positions without leaving an empty tile.
    const absent = (saved[cols] || []).filter((item) => !tiles.some((tile) => tile.id === item.i));
    const updated = { ...saved, [cols]: [...compact, ...absent] };
    setSaved(updated);
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(updated)); setMessage("Layout saved on this device"); }
    catch { setMessage("Layout changed for this visit; browser storage is unavailable"); }
    setInteracting(false);
  }
  useEffect(() => {
    if (!full) return;
    const tile = document.getElementById(full);
    if (!tile) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    // Keep the same DOM and players mounted; isolate the expanded tile for keyboard and assistive technology.
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    let current: HTMLElement | null = tile;
    while (current && current !== document.body) {
      for (const child of Array.from(current.parentElement?.children || [])) {
        if (child !== current && child instanceof HTMLElement) { siblings.push({ element: child, inert: child.inert }); child.inert = true; }
      }
      current = current.parentElement;
    }
    tile.querySelector<HTMLButtonElement>(".desk-tile-expand")?.focus();
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setFull(null); }
      if (event.key !== "Tab") return;
      const nodes = Array.from(tile.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea, iframe, [tabindex="0"]')).filter((node) => node.getClientRects().length && !node.closest("[inert]"));
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === tile)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      previousFocus?.focus({ preventScroll: true });
    };
  }, [full]);
  useEffect(() => {
    const reveal = () => {
      const id = pendingReveal;
      if (!id) return;
      pendingReveal = null;
      setFull(null);
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" }), 0);
    };
    window.addEventListener("knuckletat:reveal-tile", reveal);
    reveal();
    return () => window.removeEventListener("knuckletat:reveal-tile", reveal);
  }, []);
  // Deep links still reach their tile after the measured grid has mounted.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) window.setTimeout(() => document.getElementById(id)?.scrollIntoView(), 0);
  }, []);
  function keyboard(event: KeyboardEvent, id: string) {
    if (locked || full || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const item = layout.find((tile) => tile.i === id)!;
    const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (event.shiftKey) {
      commit(layout.map((tile) => tile.i === id ? { ...tile, w: Math.max(tile.minW || 1, Math.min(cols - tile.x, tile.w + dx)), h: Math.max(7, Math.min(40, tile.h + dy)) } : tile));
    } else {
      const next = layout.map((tile) => ({ ...tile }));
      const moving = next.find((tile) => tile.i === id)!;
      commit(moveElement(next, moving, Math.max(0, Math.min(cols - item.w, item.x + dx)), Math.max(0, item.y + dy), true, false, "vertical", cols));
    }
  }
  return <div className={interacting ? "desk-grid-interacting" : ""}>
    <div className="desk-layout-toolbar">
      <div><strong><Grip size={16} /> Your workspace</strong><span role="status">{message}</span></div>
      <div className="desk-layout-actions">
        <button aria-pressed={locked} onClick={() => setLocked(!locked)}>{locked ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}{locked ? "Unlock layout" : "Lock layout"}</button>
        <button onClick={() => { const next = { ...saved }; delete next[cols]; setSaved(next); try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); setMessage("Default layout restored for this screen size"); } catch { setMessage("Default layout restored for this visit"); } }}><RotateCcw size={14} /> Reset layout</button>
      </div>
    </div>
    <p className="desk-sr-only" id="tile-keyboard-help">Use arrow keys on a tile grip to move it. Hold Shift and use arrow keys to resize. Escape closes full screen.</p>
    <GridLayout width={width} layout={layout} gridConfig={{ cols, rowHeight: 22, margin: [10, 10], containerPadding: [0, 0] }}
      dragConfig={{ enabled: !locked && !full, handle: ".desk-tile-grip" }} resizeConfig={{ enabled: !locked && !full, handles: ["se"] }}
      onDragStart={() => setInteracting(true)} onResizeStart={() => setInteracting(true)} onDragStop={commit} onResizeStop={commit}>
      {tiles.map((tile) => <div key={tile.id} id={tile.id} data-tile={tile.id} className={`desk-tile ${tile.kind ? `desk-tile-${tile.kind}` : ""} ${full === tile.id ? "desk-tile-full" : ""}`}
        role={full === tile.id ? "dialog" : "region"} aria-modal={full === tile.id || undefined} aria-label={tile.title}
        onClickCapture={(event) => { const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]'); const target = anchor && document.getElementById(anchor.hash.slice(1)); if (full && target && !event.currentTarget.contains(target)) { setFull(null); setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 0); } }}>
        <div className="desk-tile-bar">
          <button className="desk-tile-grip" disabled={locked || !!full} aria-label={`Move ${tile.title}`} aria-describedby="tile-keyboard-help" title="Drag to move. Arrow keys move; Shift + arrows resize." onKeyDown={(event) => keyboard(event, tile.id)}><Grip size={16} /><span>{tile.title}</span></button>
          <button className="desk-tile-expand" aria-label={`${full === tile.id ? "Exit full screen" : "Full screen"}: ${tile.title}`} title={full === tile.id ? "Exit full screen (Esc)" : "Full screen"} onClick={() => setFull(full === tile.id ? null : tile.id)}>{full === tile.id ? <Minimize2 size={16} /> : <Maximize2 size={16} />}{full === tile.id && <span>Close · Esc</span>}</button>
        </div>
        <div className="desk-tile-content">{tile.children}</div>
      </div>)}
    </GridLayout>
  </div>;
}
