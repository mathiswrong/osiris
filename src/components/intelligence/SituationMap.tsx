"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Flashpoint } from "@/lib/intelligence/flashpoints";
import { missionFor } from "@/lib/intelligence/profiles";
import type { Development, SatellitePosition } from "@/lib/intelligence/types";
import type { TrafficContact } from "@/lib/intelligence/traffic";
interface Props {
  theme?: "day" | "night";
  label?: string;
  onViewportChange?: (center: { lat: number; lng: number }) => void;
  contacts?: TrafficContact[];
  contextSatellites?: SatellitePosition[];
  focus?: { lat: number; lng: number };
  radiusKm?: number;
  items: Development[];
  flashpoints: Flashpoint[];
  satellites: SatellitePosition[];
  selected: string | null;
  track: [number, number][][];
  onSelect: (id: string) => void;
  space: boolean;
}
export default function SituationMap({
  items,
  flashpoints,
  satellites,
  selected,
  track,
  onSelect,
  space,
  theme = "night",
  contacts = [],
  contextSatellites = [],
  focus,
  radiusKm = 463,
  label,
  onViewportChange,
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
        center: [0, 15],
        zoom: 0.5,
        renderWorldCopies: false,
        attributionControl: { compact: true },
      });
    } catch {
      // Map construction is an external-system failure; expose its fallback immediately.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Map unavailable. All records remain accessible in the list.");
      return;
    }
    map.current = m;
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
      m.fitBounds(
        [
          [-180, -62],
          [180, 80],
        ],
        { padding: 8, duration: 0 },
      );
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
          "circle-color": [
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
          ],
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
            "#d16b2d",
            "#e1ebe4",
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "kind"], "flashpoint"],
            0.15,
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
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(container.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, [theme]);
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
      for (const f of flashpoints) {
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
              selected: f.id === selected,
              title: `${f.region} · ${f.topic}`,
              description: f.reasons[0],
              context: `${f.state} · ${f.location.precision}`,
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
    ready,
    track,
    space,
    contacts,
    contextSatellites,
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
    m.easeTo({
      center: [focus.lng, focus.lat],
      zoom: radiusKm <= 100 ? 7 : radiusKm <= 250 ? 5.8 : 4.8,
      duration: 500,
    });
  }, [focus, radiusKm, ready]);
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
        onClick={() =>
          map.current?.fitBounds(
            [
              [-180, -62],
              [180, 80],
            ],
            { padding: 8, duration: 500 },
          )
        }
      >
        Global view
      </button>
    </div>
  );
}
