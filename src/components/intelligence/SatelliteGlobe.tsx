"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type {
  SatellitePosition,
  SatelliteResult,
} from "@/lib/intelligence/types";
import { missionFor } from "@/lib/intelligence/profiles";
import {
  orbitalVector,
  satelliteCategory,
  SATELLITE_COLORS,
} from "@/lib/intelligence/orbital-view";

type Engine = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  orbit: THREE.Line;
  context: THREE.Group;
  pin: THREE.Mesh;
  rows: SatellitePosition[];
  starts: Float32Array;
  ends: Float32Array;
  selected: string | null;
};
function fleetDistance(e: Engine) {
  let radius = 1;
  for (let i = 0; i < e.starts.length; i += 3)
    radius = Math.max(
      radius,
      Math.hypot(e.starts[i], e.starts[i + 1], e.starts[i + 2]),
    );
  const vertical = (e.camera.fov * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * e.camera.aspect);
  return (radius / Math.sin(Math.min(vertical, horizontal))) * 1.08;
}
export default function SatelliteGlobe({
  satellites,
  selected,
  orbit,
  contextOrbits,
  onSelect,
}: {
  satellites: SatellitePosition[];
  selected: SatellitePosition | null;
  contextOrbits: NonNullable<SatelliteResult["contextOrbits"]>;
  orbit: NonNullable<SatelliteResult["orbit"]>;
  onSelect: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null),
    select = useRef(onSelect);
  const [ready, setReady] = useState(0),
    [error, setError] = useState("");
  const [scale, setScale] = useState<"spread" | "true">("spread"),
    [hideStarlink, setHideStarlink] = useState(false),
    [regime, setRegime] = useState("all"),
    [rotate, setRotate] = useState(false);
  const [hover, setHover] = useState<{
    s: SatellitePosition;
    x: number;
    y: number;
  } | null>(null);
  const rows = useMemo(
    () =>
      satellites.filter(
        (s) =>
          (!hideStarlink ||
            satelliteCategory(s) !== "Starlink" ||
            s.id === selected?.id) &&
          (regime === "all" ||
            (regime === "leo" ? s.altKm < 2000 : s.altKm >= 2000)),
      ),
    [satellites, hideStarlink, regime, selected?.id],
  );
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(47, 1, 0.01, 150);
    camera.position.set(3.3, 2.4, 4.9);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // Expose a failure to initialize the external WebGL renderer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        "3D rendering is unavailable. Search and inspect the full catalogue below.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive satellite globe. Drag to orbit; use the zoom buttons to change scale. Use the catalogue below for keyboard selection.",
    );
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    // Keep the document scrollable when the pointer is over the globe.
    controls.enableZoom = false;
    controls.minDistance = 1.12;
    controls.maxDistance = 80;
    controls.autoRotateSpeed = 0.22;
    scene.add(new THREE.AmbientLight(0xbddfff, 2));
    const light = new THREE.DirectionalLight(0xd8edff, 2.2);
    light.position.set(4, 3, 5);
    scene.add(light);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 80, 64),
      new THREE.MeshPhongMaterial({
        color: 0x214b64,
        shininess: 14,
        specular: 0x244659,
      }),
    );
    scene.add(earth);
    // Cartographic land geometry, not satellite imagery. Lighting is illustrative.
    const controller = new AbortController();
    void fetch("/data/ne_110m_land.geojson", { signal: controller.signal })
      .then((r) => r.json())
      .then(
        (
          geo: GeoJSON.FeatureCollection<
            GeoJSON.Polygon | GeoJSON.MultiPolygon
          >,
        ) => {
          const canvas = document.createElement("canvas");
          canvas.width = 2048;
          canvas.height = 1024;
          const ctx = canvas.getContext("2d");
          if (!ctx || controller.signal.aborted) return;
          ctx.fillStyle = "#0b263d";
          ctx.fillRect(0, 0, 2048, 1024);
          ctx.fillStyle = "#30647b";
          ctx.strokeStyle = "#68a9bf";
          ctx.lineWidth = 1.3;
          for (const feature of geo.features) {
            const polygons =
              feature.geometry.type === "Polygon"
                ? [feature.geometry.coordinates]
                : feature.geometry.coordinates;
            for (const polygon of polygons) {
              ctx.beginPath();
              for (const ring of polygon)
                ring.forEach(([lng, lat], i) => {
                  const x = ((lng + 180) / 360) * 2048,
                    y = ((90 - lat) / 180) * 1024;
                  if (i) ctx.lineTo(x, y);
                  else ctx.moveTo(x, y);
                });
              ctx.fill("evenodd");
              ctx.stroke();
            }
          }
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          earth.material.map = texture;
          earth.material.color.set(0xffffff);
          earth.material.needsUpdate = true;
        },
      )
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Coastline map unavailable; orbital positions still visible.",
          );
      });
    const grid = new THREE.Group();
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = Array.from({ length: 181 }, (_, i) =>
        new THREE.Vector3(...orbitalVector(lat, i * 2 - 180, 0)).multiplyScalar(
          1.002,
        ),
      );
      grid.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({
            color: 0x5da1c0,
            transparent: true,
            opacity: 0.18,
          }),
        ),
      );
    }
    for (let lng = 0; lng < 360; lng += 30) {
      const pts = Array.from({ length: 91 }, (_, i) =>
        new THREE.Vector3(...orbitalVector(i * 2 - 90, lng, 0)).multiplyScalar(
          1.002,
        ),
      );
      grid.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({
            color: 0x5da1c0,
            transparent: true,
            opacity: 0.18,
          }),
        ),
      );
    }
    scene.add(grid);
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.035, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {},
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        vertexShader:
          "varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}",
        fragmentShader:
          "varying vec3 n; varying vec3 v; void main(){float a=pow(1.-abs(dot(n,v)),3.);gl_FragColor=vec4(.18,.61,.9,a*.55);}",
      }),
    );
    scene.add(atmosphere);
    const points = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.ShaderMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
        vertexShader:
          "attribute float size; varying vec3 c; uniform float pixelRatio; void main(){c=color; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=size*pixelRatio;}",
        fragmentShader:
          "varying vec3 c; void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; gl_FragColor=vec4(c,(1.-smoothstep(.3,1.,d))*.95);}",
      }),
    );
    const trail = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x68f5da,
        transparent: true,
        opacity: 0.82,
      }),
    );
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    pin.visible = false;
    const context = new THREE.Group();
    scene.add(points, trail, pin, context);
    const state: Engine = {
      scene,
      camera,
      controls,
      points,
      orbit: trail,
      context,
      pin,
      rows: [],
      starts: new Float32Array(),
      ends: new Float32Array(),
      selected: null,
    };
    engine.current = state;
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const ray = new THREE.Raycaster();
    const sphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const occlusion = new THREE.Vector3();
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      ray.setFromCamera(
        new THREE.Vector2((x / rect.width) * 2 - 1, 1 - (y / rect.height) * 2),
        camera,
      );
      ray.params.Points.threshold = camera.position.length() * 0.006;
      const earthHit = ray.ray.intersectSphere(sphere, occlusion);
      const earthDistance = earthHit
        ? camera.position.distanceTo(earthHit)
        : Infinity;
      const hits = ray
        .intersectObject(points)
        .filter((h) => h.distance < earthDistance)
        .sort((a, b) => (a.distanceToRay || 0) - (b.distanceToRay || 0));
      const s = hits[0]?.index === undefined ? null : state.rows[hits[0].index];
      return s
        ? {
            s,
            x: Math.max(8, Math.min(x + 14, rect.width - 310)),
            y: Math.max(8, Math.min(y + 12, rect.height - 290)),
          }
        : null;
    };
    let pointerDown: { x: number; y: number } | null = null;
    const move = (e: PointerEvent) => {
      if (e.buttons) return;
      const hit = pick(e);
      setHover(hit);
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
    };
    const down = (e: PointerEvent) => {
      pointerDown = { x: e.clientX, y: e.clientY };
      setHover(null);
    };
    const up = (e: PointerEvent) => {
      if (
        pointerDown &&
        Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) < 5
      ) {
        const hit = pick(e);
        if (hit) select.current(hit.s.id);
      }
      pointerDown = null;
    };
    const leave = () => setHover(null);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointerleave", leave);
    let frame = 0,
      last = 0,
      previous = performance.now();
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden) {
        previous = time;
        return;
      }
      controls.update(Math.min((time - previous) / 1000, 0.1));
      previous = time;
      if (time - last > 100 && state.rows.length) {
        const values = points.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        const elapsed = Math.min(
          1,
          Math.max(
            0,
            (Date.now() - Date.parse(state.rows[0].predictedAt)) / 60000,
          ),
        );
        for (let i = 0; i < state.starts.length; i++)
          values.array[i] =
            state.starts[i] + (state.ends[i] - state.starts[i]) * elapsed;
        values.needsUpdate = true;
        const index = state.rows.findIndex((s) => s.id === state.selected);
        pin.visible = index >= 0;
        if (index >= 0) pin.position.fromBufferAttribute(values, index);
        last = time;
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(draw);
    setReady((v) => v + 1);
    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointerleave", leave);
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.Points
        ) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if ("map" in m && m.map instanceof THREE.Texture) m.map.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const e = engine.current;
    if (!e || !ready) return;
    const starts = new Float32Array(rows.length * 3),
      ends = new Float32Array(rows.length * 3),
      colors = new Float32Array(rows.length * 3),
      sizes = new Float32Array(rows.length);
    rows.forEach((s, i) => {
      starts.set(orbitalVector(s.lat, s.lng, s.altKm, scale), i * 3);
      const next = s.next || s;
      ends.set(orbitalVector(next.lat, next.lng, next.altKm, scale), i * 3);
      const category = satelliteCategory(s);
      new THREE.Color(SATELLITE_COLORS[category]).toArray(colors, i * 3);
      sizes[i] =
        s.id === selected?.id ? 10 : category === "Starlink" ? 2.5 : 4.5;
    });
    e.points.geometry.dispose();
    e.points.geometry = new THREE.BufferGeometry();
    e.points.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starts.slice(), 3),
    );
    e.points.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3),
    );
    e.points.geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    e.points.geometry.computeBoundingSphere();
    const firstCatalogue = !e.rows.length && rows.length > 0;
    e.rows = rows;
    e.starts = starts;
    e.ends = ends;
    e.selected = selected?.id || null;
    if (firstCatalogue && !selected?.id) {
      e.camera.position.normalize().multiplyScalar(fleetDistance(e));
      e.controls.update();
    }
  }, [rows, selected?.id, scale, ready]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.orbit.geometry.dispose();
    e.orbit.geometry = new THREE.BufferGeometry().setFromPoints(
      orbit.map(
        (p) =>
          new THREE.Vector3(...orbitalVector(p.lat, p.lng, p.altKm, scale)),
      ),
    );
  }, [orbit, scale, ready]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    for (const line of [...e.context.children]) {
      e.context.remove(line);
      if (line instanceof THREE.Line) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    }
    for (const path of contextOrbits) {
      const s = rows.find((s) => s.id === path.id);
      if (!s || s.id === selected?.id) continue;
      e.context.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(
            path.points.map(
              (p) =>
                new THREE.Vector3(
                  ...orbitalVector(p.lat, p.lng, p.altKm, scale),
                ),
            ),
          ),
          new THREE.LineBasicMaterial({
            color: SATELLITE_COLORS[satelliteCategory(s)],
            transparent: true,
            opacity: 0.35,
          }),
        ),
      );
    }
  }, [contextOrbits, rows, selected?.id, scale, ready]);
  useEffect(() => {
    if (engine.current) engine.current.controls.autoRotate = rotate;
  }, [rotate, ready]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    if (selected) {
      const point = new THREE.Vector3(
        ...orbitalVector(selected.lat, selected.lng, selected.altKm, scale),
      );
      e.camera.position.copy(
        point
          .clone()
          .normalize()
          .multiplyScalar(Math.max(3, point.length() * 2.9)),
      );
    } else
      e.camera.position
        .set(3.3, 2.4, 4.9)
        .normalize()
        .multiplyScalar(fleetDistance(e));
    e.controls.update();
    // A new selection/scale focuses once; background refresh must preserve the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, scale, ready]);
  return (
    <div className="orbital-workspace">
      <div className="orbital-toolbar">
        <label>
          <input
            type="checkbox"
            checked={!hideStarlink}
            onChange={(e) => setHideStarlink(!e.target.checked)}
          />{" "}
          Starlink constellation
        </label>
        <select
          aria-label="Orbit altitude filter"
          value={regime}
          onChange={(e) => setRegime(e.target.value)}
        >
          <option value="all">All altitudes</option>
          <option value="leo">Low Earth · under 2,000 km</option>
          <option value="high">Medium & high orbits</option>
        </select>
        <select
          aria-label="Orbital distance scale"
          value={scale}
          onChange={(e) => setScale(e.target.value as "spread" | "true")}
        >
          <option value="spread">Spread altitude for clarity</option>
          <option value="true">True distance scale</option>
        </select>
      </div>
      <div
        className="orbital-canvas-wrap"
        onKeyDown={(e) => {
          if (e.key === "Escape") setHover(null);
        }}
      >
        <div ref={host} className="orbital-canvas" />
        <div className="orbital-heading">
          <span>EARTH / ORBITAL TRAFFIC</span>
          <strong>
            {rows.length.toLocaleString()}{" "}
            {rows.length === 1 ? "object" : "objects"}
          </strong>
          <small>
            {scale === "spread"
              ? "Altitude expanded / compressed for visibility"
              : "Earth radius and altitude at true scale"}
          </small>
        </div>
        <div className="orbital-actions">
          <button onClick={() => setRotate((v) => !v)} aria-pressed={rotate}>
            {rotate ? "Pause rotation" : "Rotate globe"}
          </button>
          <button
            aria-label="Zoom in on globe"
            onClick={() => {
              const e = engine.current;
              if (e) {
                e.camera.position.multiplyScalar(0.8);
                e.controls.update();
              }
            }}
          >
            ＋
          </button>
          <button
            aria-label="Zoom out from globe"
            onClick={() => {
              const e = engine.current;
              if (e) {
                e.camera.position.multiplyScalar(1.25);
                e.controls.update();
              }
            }}
          >
            −
          </button>
          <button
            onClick={() => {
              const e = engine.current;
              if (e) {
                e.camera.position
                  .set(3.3, 2.4, 4.9)
                  .normalize()
                  .multiplyScalar(fleetDistance(e));
                e.controls.update();
              }
            }}
          >
            Fit fleet
          </button>
        </div>
        {hover && (
          <div
            role="tooltip"
            className="desk-hover-card orbital-hover"
            style={{ left: hover.x, top: hover.y }}
          >
            <strong>
              {hover.s.name} <small>#{hover.s.id}</small>
            </strong>
            <p>
              {missionFor(hover.s)?.operator || "Operator not established"} ·{" "}
              {missionFor(hover.s)?.purpose || "Mission not documented"}
            </p>
            <div className="orbital-telemetry">
              <span>
                <b>{hover.s.altKm.toFixed(0)}</b> km altitude
              </span>
              <span>
                <b>{hover.s.speedKmS?.toFixed(2) || "—"}</b> km/s
              </span>
              <span>
                <b>{hover.s.inclination?.toFixed(1) || "—"}°</b> inclination
              </span>
              <span>
                <b>{hover.s.periodMinutes.toFixed(1)}</b> min orbit
              </span>
            </div>
            <p>
              {missionFor(hover.s)?.summary ||
                "Only orbital data is established for this object."}
            </p>
            <small>
              Elements {hover.s.elementAgeHours.toFixed(1)}h old · Click for
              dossier
            </small>
          </div>
        )}
        {error && (
          <p className="orbital-error" role="status">
            {error}
          </p>
        )}
        {selected && (
          <div className="orbital-selection">
            <i />
            <strong>{selected.name}</strong>
            <span>Selected · NORAD {selected.id}</span>
          </div>
        )}
        <div className="orbital-hint">
          Drag to orbit · Use zoom buttons · Hover to identify · Click for mission
          & clients
        </div>
      </div>
      <div className="orbital-legend">
        {Object.entries(SATELLITE_COLORS).map(([name, color]) => (
          <span key={name}>
            <i style={{ background: color }} />
            {name}
          </span>
        ))}
      </div>
      <p className="orbital-note">
        SGP4 predictions · motion interpolated between 60-second predictions,
        then held until refresh ·{" "}
        {orbit.length
          ? "Selected trail: next orbital period in an Earth-fixed frame · "
          : ""}
        Faint trails: sample missions · Land: Natural Earth · illustrative
        lighting
      </p>
    </div>
  );
}
