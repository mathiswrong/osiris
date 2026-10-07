"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Flashpoint } from "@/lib/intelligence/flashpoints";
import { missionFor } from "@/lib/intelligence/profiles";
import type { Development, SatellitePosition } from "@/lib/intelligence/types";
import type { TrafficContact } from "@/lib/intelligence/traffic";
import type { RegionalHub } from "@/lib/intelligence/regional-hubs";
import { WATCH_STATUSES, watchTags, watchAttention } from "@/lib/intelligence/flashpoints";
import { layoutTile, tilesOverlap, type TilePlacement } from "@/lib/map-tile-layout";
interface Props {
  locales?: RegionalHub[];
  generatedAt?: string;
  theme?: "day" | "night";
  label?: string;
  onViewportChange?: (center: { lat: number; lng: number }) => void;
  contacts?: TrafficContact[];
  contextSatellites?: SatellitePosition[];
  focus?: { lat: number; lng: number };
  bounds?: [number, number, number, number];
  radiusKm?: number;
  items: Development[];
  flashpoints: Flashpoint[];
  satellites: SatellitePosition[];
  selected: string | null;
  highlighted?: string[];
  track: [number, number][][];
  onSelect: (id: string) => void;
  space: boolean;
}
export default function SituationMap({
  items,
  flashpoints,
  satellites,
  selected,
  highlighted = [],
  track,
  onSelect,
  space,
  theme = "night",
  contacts = [],
  contextSatellites = [],
  focus,
  bounds,
  radiusKm = 463,
  label,
  onViewportChange,
  locales,
  generatedAt,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    select = useRef(onSelect),
    viewportChange = useRef(onViewportChange);
  const [ready, setReady] = useState(0),
    [error, setError] = useState("");
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    title: string;
    description: string;
    context: string;
  } | null>(null);
  useEffect(() => {
    select.current = onSelect;
    viewportChange.current = onViewportChange;
  }, [onSelect, onViewportChange]);
  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl(
      `/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`,
    );
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style:
          theme === "day" ? "/positron-style.json" : "/dark-matter-style.json",
        center: [0, 0],
        zoom: 0.5,
        minZoom: -4,
        attributionControl: { compact: true },
      });
    } catch {
      // Map construction is an external-system failure; expose its fallback immediately.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Map unavailable. All records remain accessible in the list.");
      return;
    }
    map.current = m;
    // A reading page owns the wheel. The map's visible controls still zoom it.
    if (container.current.closest(".desk-reading, .regional-page") && !container.current.closest(".desk-tile-full"))
      m.scrollZoom.disable();
    const timer = setTimeout(() => {
      if (!m.isStyleLoaded())
        setError(
          "Basemap is taking longer to load. Provider links and records remain available.",
        );
    }, 15000);
    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    m.on("moveend", () => {
      const center = m.getCenter();
      viewportChange.current?.({ lat: center.lat, lng: center.lng });
    });
    m.on("load", () => {
      clearTimeout(timer);
      setError("");
      m.fitBounds([[-180, -85], [180, 85]], { padding: 8, duration: 0 });
      m.addSource("observations", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addSource("search-area", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "search-area-fill",
        source: "search-area",
        type: "fill",
        paint: { "fill-color": "#347bbb", "fill-opacity": 0.06 },
      });
      m.addLayer({
        id: "search-area-line",
        source: "search-area",
        type: "line",
        paint: {
          "line-color": "#347bbb",
          "line-width": 1.2,
          "line-dasharray": [3, 3],
        },
      });
      m.addSource("orbit", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      m.addLayer({
        id: "orbit-line",
        type: "line",
        source: "orbit",
        paint: { "line-color": "#82c5a0", "line-width": 1.5 },
      });
      m.addLayer({
        id: "observations",
        type: "circle",
        source: "observations",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "selected"], true],
            9,
            ["==", ["get", "kind"], "flashpoint"],
            9,
            ["==", ["get", "kind"], "satellite"],
            2.5,
            4.5,
          ],
          "circle-color": ["coalesce", ["get", "color"], [
            "match",
            ["get", "kind"],
            "earthquake",
            "#d78215",
            "hazard",
            "#d05e4e",
            "flashpoint",
            "#d16b2d",
            "aircraft",
            "#237cad",
            "vessel",
            "#05887a",
            "military",
            "#cf4366",
            "satellite",
            "#8d59c9",
            "#85c8a6",
          ]],
          "circle-stroke-width": [
            "case",
            ["==", ["get", "selected"], true],
            2,
            ["==", ["get", "kind"], "flashpoint"],
            2,
            0.5,
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "kind"], "flashpoint"],
            ["coalesce", ["get", "color"], "#d16b2d"],
            "#e1ebe4",
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "kind"], "flashpoint"],
            0,
            0.85,
          ],
        },
      });
      m.addLayer({
        id: "observation-hit",
        type: "circle",
        source: "observations",
        paint: { "circle-radius": 12, "circle-opacity": 0 },
      });
      m.on("mousemove", "observation-hit", (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        m.getCanvas().style.cursor = "pointer";
        setHover({
          x: Math.max(
            8,
            Math.min(e.point.x + 16, m.getContainer().clientWidth - 328),
          ),
          y: Math.max(
            8,
            Math.min(e.point.y + 16, m.getContainer().clientHeight - 280),
          ),
          title: String(p.title),
          description: String(p.description),
          context: String(p.context),
        });
      });
      m.on("movestart", () => setHover(null));
      m.on("click", "observation-hit", (e) => {
        setHover(null);
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "string") select.current(id);
      });
      m.on("mouseenter", "observation-hit", () => {
        m.getCanvas().style.cursor = "pointer";
      });
      m.on("mouseleave", "observation-hit", () => {
        setHover(null);
        m.getCanvas().style.cursor = "";
      });
      setReady((v) => v + 1);
    });
    const observer = new ResizeObserver(() => {
      if (!m.getContainer().clientWidth || !m.getContainer().clientHeight) return;
      m.resize();
      if (!m.isStyleLoaded()) return;
      if (bounds) m.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 30, duration: 0 });
    });
    observer.observe(container.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, [theme, bounds]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !locales) return;
    const markers = locales.flatMap((hub) => {
      if (!hub.center || !hub.watches.length) return [];
      const watch = hub.watches[0];
      const attention = watchAttention(watch, theme);
      const element = document.createElement("a");
      element.className = "locale-marker";
      element.href = `/regions/${hub.id}`;
      element.setAttribute("aria-label", `Open ${hub.name}: ${attention.label}, ${watch.count} ${watch.count === 1 ? "report" : "reports"}. ${watch.title}`);
      element.dataset.activity = attention.level;
      element.style.setProperty("--watch-color", attention.color);
      element.style.setProperty("--marker-size", attention.level === "low" ? "12px" : attention.level === "active" ? "15px" : "18px");
      const dot = document.createElement("span");
      dot.className = "locale-dot";
      const connector = document.createElement("span");
      connector.className = "locale-connector";
      const card = document.createElement("span");
      card.className = "locale-callout";
      const place = document.createElement("strong");
      place.textContent = hub.name;
      const badge = document.createElement("span");
      badge.className = "watch-tags";
      for (const id of watchTags(watch)) {
        const status = WATCH_STATUSES.find((candidate) => candidate.id === id)!;
        const pill = document.createElement("span");
        pill.className = "watch-tag";
        pill.style.setProperty("--watch-color", status.color);
        pill.textContent = status.label;
        badge.append(pill);
      }
      const headline = document.createElement("span");
      headline.className = "locale-headline";
      headline.textContent = watch.title;
      const context = document.createElement("small");
      context.textContent = `${attention.label} · ${watch.count} ${watch.count === 1 ? "report" : "reports"}`;
      context.title = `${watch.count} reports in this watch in 24h; ${hub.watches.length} watches and ${hub.sources.length} sources across ${hub.name}`;
      card.append(place, headline, badge, context);
      element.append(dot, connector, card);
      element.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        select.current(hub.id);
      });
      const marker = new maplibregl.Marker({ element, anchor: "center", opacityWhenCovered: 0 })
        .setLngLat([hub.center.lng, hub.center.lat]).addTo(m);
      return [{ marker, hub, element, card, connector }];
    });
    const place = () => {
      const viewport = { width: m.getContainer().clientWidth, height: m.getContainer().clientHeight };
      const geom = { width: viewport.width < 600 ? 180 : 216, imageHeight: 104, labelHeight: 24, gap: 26 };
      const chosen: TilePlacement[] = [];
      for (const { hub, element, card, connector } of markers) {
        const point = m.project([hub.center!.lng, hub.center!.lat]);
        const box = layoutTile(point, viewport, geom);
        card.style.left = `${box.x - point.x + 6}px`;
        card.style.top = `${box.y - point.y + 6}px`;
        connector.style.top = box.flipped ? "12px" : "-26px";
        connector.hidden = !box.anchored;
        const visible = !element.classList.contains("maplibregl-marker-covered") && point.x >= 0 && point.y >= 0 && point.x <= viewport.width && point.y <= viewport.height;
        const show = visible && chosen.length < (viewport.width < 600 ? 2 : 8) && !chosen.some((previous) => tilesOverlap(previous, box, geom));
        element.dataset.callout = String(show);
        element.style.zIndex = show ? "4" : "2";
        if (show) chosen.push(box);
      }
    };
    place();
    m.on("render", place);
    return () => { m.off("render", place); markers.forEach(({ marker }) => marker.remove()); };
  }, [ready, locales, generatedAt, theme]);
  useEffect(() => {
    if (
      !ready ||
      !map.current?.getSource("observations") ||
      !map.current.getSource("orbit")
    )
      return;
    const features: GeoJSON.Feature<GeoJSON.Point>[] = space
      ? satellites.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lng, s.lat] },
          properties: {
            id: s.id,
            title: s.name,
            description:
              missionFor(s)?.summary ||
              "Mission and operator not documented yet.",
            context: `${missionFor(s)?.scope || "Orbit only"} · ${s.altKm.toFixed(0)} km · elements ${s.elementAgeHours.toFixed(1)}h old`,
            kind: "satellite",
            selected: s.id === selected,
          },
        }))
      : items.flatMap((i) =>
          i.location
            ? [
                {
                  type: "Feature" as const,
                  geometry: {
                    type: "Point" as const,
                    coordinates: [i.location.lng, i.location.lat],
                  },
                  properties: {
                    id: i.id,
                    title: i.title,
                    description: i.summary,
                    context: `${i.source} · ${i.timeLabel || "observed"} ${new Date(i.occurredAt).toUTCString()} · ${i.sourceId === "gdacs" ? "alert published; onset not established by this timestamp" : i.location?.precision || "location unresolved"}`,
                    kind: i.kind,
                    selected: i.id === selected,
                  },
                },
              ]
            : [],
        );
    if (!space)
      for (const f of [...flashpoints].reverse()) {
        if (f.location)
          features.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [f.location.lng, f.location.lat],
            },
            properties: {
              id: f.id,
              kind: "flashpoint",
              color: watchAttention(f, theme).color,
              selected: f.id === selected || highlighted.includes(f.id),
              title: `${f.region} · ${f.topic}`,
              description: f.reasons[0],
              context: `${watchAttention(f, theme).label} · ${f.count} reports · ${f.state} · ${f.location.precision}`,
            },
          });
      }
    for (const c of contacts)
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
        properties: {
          id: c.id,
          kind: c.military ? "military" : c.kind,
          selected: c.id === selected,
          title: c.name,
          description: c.model || c.classification,
          context: `${c.source} · ${new Date(c.observedAt).toUTCString()} · nearby, no event link established`,
        },
      });
    for (const s of contextSatellites)
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id,
          kind: "satellite",
          selected: s.id === selected,
          title: s.name,
          description: missionFor(s)?.summary || "Mission not documented",
          context: `${s.altKm.toFixed(0)} km altitude · predicted ground subpoint, not sensor coverage`,
        },
      });
    (map.current.getSource("observations") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
    (map.current.getSource("orbit") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: space
        ? track.map((coordinates) => ({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates },
          }))
        : [],
    });
  }, [
    items,
    flashpoints,
    satellites,
    selected,
    highlighted,
    ready,
    track,
    space,
    contacts,
    contextSatellites,
    generatedAt,
    theme,
  ]);
  useEffect(() => {
    if (!ready || !selected || !map.current) return;
    const p = space
      ? satellites.find((s) => s.id === selected)
      : items.find((i) => i.id === selected)?.location ||
        flashpoints.find((f) => f.id === selected)?.location ||
        contacts.find((c) => c.id === selected) ||
        contextSatellites.find((s) => s.id === selected);
    if (p)
      map.current.easeTo({
        center: [p.lng, p.lat],
        zoom: space || selected.startsWith("flash:") ? 2.3 : 4,
        duration: 700,
      });
    // Selection moves the camera; a background data refresh must not move it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, space, ready]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !focus || !m.getSource("search-area")) return;
    const rad = Math.PI / 180,
      angular = radiusKm / 6371,
      phi = focus.lat * rad,
      lambda = focus.lng * rad;
    const coordinates = Array.from({ length: 97 }, (_, i) => {
      const bearing = (i / 96) * Math.PI * 2;
      const p = Math.asin(
        Math.sin(phi) * Math.cos(angular) +
          Math.cos(phi) * Math.sin(angular) * Math.cos(bearing),
      );
      const l =
        lambda +
        Math.atan2(
          Math.sin(bearing) * Math.sin(angular) * Math.cos(phi),
          Math.cos(angular) - Math.sin(phi) * Math.sin(p),
        );
      return [l / rad, p / rad];
    });
    (m.getSource("search-area") as GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [coordinates] },
    });
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500;
    if (bounds) m.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 30, duration });
    else m.easeTo({ center: [focus.lng, focus.lat], zoom: radiusKm <= 100 ? 7 : radiusKm <= 250 ? 5.8 : 4.8, duration });
  }, [focus, bounds, radiusKm, ready]);
  return (
    <div
      className="desk-map-wrap"
      onKeyDown={(e) => {
        if (e.key === "Escape") setHover(null);
      }}
    >
      {hover && (
        <div
          role="tooltip"
          className="desk-hover-card desk-map-hover"
          style={{ left: hover.x, top: hover.y }}
        >
          <strong>{hover.title}</strong>
          <p>{hover.description}</p>
          <p>{hover.context}</p>
          <small>Click to inspect full evidence</small>
        </div>
      )}
      <div
        ref={container}
        className="desk-map"
        aria-label={
          label || (focus
            ? "Combined regional investigation map"
            : "Global observation map")
        }
      />
      {error && (
        <div className="desk-map-error" role="status">
          {error}
        </div>
      )}
      <button
        className="desk-map-reset"
        onClick={() => bounds
          ? map.current?.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 30, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500 })
          : map.current?.fitBounds(
            [
              [-180, -85],
              [180, 85],
            ],
            { padding: 8, bearing: 0, pitch: 0, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500 },
          )
        }
      >
        {bounds ? "Region view" : locales ? "World map" : "Global view"}
      </button>
    </div>
  );
}
