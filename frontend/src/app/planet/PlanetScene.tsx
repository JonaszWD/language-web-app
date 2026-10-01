"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Render toggles. Cylinder (3D city drum) is hidden per request, kept intact
// for future use. Mission steps render as the zigzag checkpoint path.
const SHOW_CYLINDER = false;
const SHOW_MISSION_STEPS = true;

const R = 16; // cylinder radius
const H = 220; // drum length — the city now covers the whole cylinder
const MESH_H = H;
const UP = new THREE.Vector3(0, 1, 0);

const MODELS = [
  "/kenney-buildings-3d/building-sample-house-a.glb",
  "/kenney-buildings-3d/building-sample-house-b.glb",
  "/kenney-buildings-3d/building-sample-house-c.glb",
  "/kenney-buildings-3d/building-sample-tower-a.glb",
  "/kenney-buildings-3d/building-sample-tower-b.glb",
  "/kenney-buildings-3d/building-sample-tower-c.glb",
  "/kenney-buildings-3d/building-sample-tower-d.glb",
];
// Only fetch the building models when the city layer is actually shown — the
// Kenney .glb files are not bundled in public/ while it is switched off.
if (SHOW_CYLINDER) MODELS.forEach((m) => useGLTF.preload(m));

// Real Madrid (Salamanca) OSM data, projected to u,v in [0,1].
// u = lon fraction (0=W..1=E), v = lat fraction (0=S..1=N).
// buildings: [u, v, du, dv] — (du,dv) = nearest street direction in uv space.
type MapData = {
  roads: [number, number][][];
  parks: [number, number][][];
  buildings: [number, number, number, number][];
};

// Map a normalized (u,v) map point onto the cylinder surface. Derived from
// three's CylinderGeometry UV layout so the drawn road texture and the placed
// buildings share the exact same coordinate frame (they line up).
//   u -> angle around the axis;  v -> position along the height (north = top).
function uvToSurface(u: number, v: number) {
  const theta = u * Math.PI * 2;
  const normal = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
  const y = (v - 0.5) * H;
  const position = normal.clone().multiplyScalar(R).setY(y);
  // surface tangents: T_u runs around the circumference, T_v along the axis.
  const tU = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
  const tV = new THREE.Vector3(0, 1, 0);
  return { position, normal, tU, tV };
}

type Placement = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  modelIndex: number;
  scale: number;
};

// ---- light, label-free street texture rendered from the OSM roads ----
function makeStreetTexture(data: MapData): THREE.CanvasTexture {
  const S = 2048;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#eceae5"; // light "paper" base
  ctx.fillRect(0, 0, S, S);

  // parks / green / water — filled under the roads (also the no-build zones)
  ctx.fillStyle = "#cfe0c3";
  for (const poly of data.parks) {
    ctx.beginPath();
    poly.forEach(([u, v], i) => {
      const x = u * S, y = (1 - v) * S;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = "#c2beb4"; // roads
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.lineWidth = 3;
  for (const line of data.roads) {
    ctx.beginPath();
    line.forEach(([u, v], i) => {
      const x = u * S;
      const y = (1 - v) * S; // north up
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // paper strips at the top/bottom edges so the clamped extension is clean
  const m = Math.round(S * 0.03);
  ctx.fillStyle = "#eceae5";
  ctx.fillRect(0, 0, S, m);
  ctx.fillRect(0, S - m, S, m);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // The mesh is longer than the city band: map the city into the centre and
  // clamp so the plain paper edge colour extends over the rest (bare ground).
  tex.wrapS = THREE.RepeatWrapping; // around the circumference
  tex.wrapT = THREE.ClampToEdgeWrapping; // along the length
  tex.repeat.set(1, MESH_H / H);
  tex.offset.set(0, 0.5 * (1 - MESH_H / H));
  return tex;
}

function buildPlacements(data: MapData): Placement[] {
  const m = new THREE.Matrix4();
  return data.buildings.map(([u, v, du, dv]) => {
    const { position, normal, tU, tV } = uvToSurface(u, v);
    // street direction on the curved surface: weight uv rates by the actual
    // arc lengths (circumference vs height) so it points along the road.
    const forward = tU
      .clone()
      .multiplyScalar(du * 2 * Math.PI * R)
      .add(tV.clone().multiplyScalar(dv * H))
      .normalize();
    // orthonormal basis: Y=up (outward normal), Z=along street, X=Y×Z
    const right = new THREE.Vector3().crossVectors(normal, forward).normalize();
    m.makeBasis(right, normal, forward);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(m);
    // half-turn flips so building rows don't all face the same side of a street
    if (Math.random() < 0.5) {
      quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(UP, Math.PI)
      );
    }
    return {
      position,
      quaternion,
      modelIndex: Math.floor(Math.random() * MODELS.length),
      scale: 0.7 + Math.random() * 0.5,
    };
  });
}

// All buildings drawn with InstancedMesh — one draw call per model sub-mesh
// instead of one per building, so thousands stay cheap.
function InstancedBuildings({ data }: { data: MapData }) {
  const gltfs = useGLTF(MODELS);
  const group = useMemo(() => {
    const placements = buildPlacements(data);
    const byModel: Placement[][] = MODELS.map(() => []);
    for (const p of placements) byModel[p.modelIndex].push(p);

    const root = new THREE.Group();
    const tmp = new THREE.Matrix4();
    const sv = new THREE.Vector3();

    gltfs.forEach((gltf, mi) => {
      const ps = byModel[mi];
      if (!ps.length) return;
      const scene = gltf.scene;
      scene.updateWorldMatrix(true, true);
      const minY = new THREE.Box3().setFromObject(scene).min.y;
      const baseOffset = new THREE.Matrix4().makeTranslation(0, -minY, 0);

      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        // mesh transform within the model, base dropped to y=0
        const meshLocal = new THREE.Matrix4().multiplyMatrices(
          baseOffset,
          mesh.matrixWorld
        );
        const inst = new THREE.InstancedMesh(
          mesh.geometry,
          mesh.material as THREE.Material,
          ps.length
        );
        ps.forEach((p, i) => {
          sv.setScalar(p.scale);
          tmp.compose(p.position, p.quaternion, sv).multiply(meshLocal);
          inst.setMatrixAt(i, tmp);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.frustumCulled = false;
        root.add(inst);
      });
    });
    return root;
  }, [data, gltfs]);

  return <primitive object={group} />;
}

function City({ data }: { data: MapData }) {
  const tex = useMemo(() => makeStreetTexture(data), [data]);
  return (
    <>
      <mesh>
        <cylinderGeometry args={[R, R, MESH_H, 96, 1, true]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
      </mesh>
      <InstancedBuildings data={data} />
    </>
  );
}

function CityLoader() {
  const [data, setData] = useState<MapData | null>(null);
  useEffect(() => {
    fetch("/kenney-buildings-3d/madrid-data.json")
      .then((r) => r.json())
      .then(setData);
  }, []);
  if (!data) return null;
  return <City data={data} />;
}

const OFFSET_Y = -29; // locked vertical position of the drum (lifted up by 5)

type Level = { name: string; learn: string; minutes: number; vocabBurst?: number };

// A pin + info card sitting on the drum surface at a random map location on
// the visible near face. Lives inside the city's transform frame.
// Shared card size for every level card — identical across levels/missions.
const CARD_W = 220;
const CARD_H = 118;
// Clamp the description so long text can't change the card's height.
const clamp2: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

// Deterministic 0..1 from a string + salt — so a level keeps the same spot
// every load instead of being re-randomised.
function hash01(str: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function LevelMarker({
  level,
  scale,
  onOpen,
}: {
  level: Level;
  scale: number;
  onOpen?: () => void;
}) {
  const { position } = useMemo(() => {
    // Fixed spot derived from the level name. Kept inside the visible window:
    // u near the front (0.71 faces the camera); v near the centre because v
    // maps to the drum's long axis (screen horizontal) which runs off-screen.
    const u = 0.64 + hash01(level.name, 1) * 0.14; // ~0.64..0.78 (front face)
    const v = 0.42 + hash01(level.name, 2) * 0.16; // ~0.42..0.58 (on screen)
    const s = uvToSurface(u, v);
    s.position.addScaledVector(s.normal, 1.0);
    return s;
  }, [level.name]);
  const clickable = !!onOpen;
  return (
    <group position={position}>
      <mesh onClick={onOpen}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color="#16140f" />
      </mesh>
      <Html distanceFactor={40} position={[0, 1.2, 0]} center zIndexRange={[100, 60]}>
        <div
          onClick={onOpen}
          style={{
            width: CARD_W, height: CARD_H, boxSizing: "border-box",
            transform: `translateY(-100%) scale(${scale})`,
            transformOrigin: "center bottom",
            background: "#fff", color: "#141210",
            border: "1.5px solid #16140f", borderRadius: 12,
            padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.18)",
            font: "13px/1.4 system-ui",
            pointerEvents: clickable ? "auto" : "none",
            cursor: clickable ? "pointer" : "default",
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ font: "700 15px system-ui", marginBottom: 4 }}>
            {level.name}
          </div>
          <div style={{ opacity: 0.8, marginBottom: 8, ...clamp2 }}>
            {level.learn}
          </div>
          <div style={{ font: "600 12px system-ui", color: "#16140f", marginTop: "auto",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⏱ ~{level.minutes} min</span>
            {clickable && <span style={{ fontWeight: 700 }}>Review →</span>}
          </div>
        </div>
      </Html>
    </group>
  );
}

// The upcoming level — grayed out, half-buried in the planet at the top so
// only ~70% of the sphere pokes out (30% hidden behind the surface).
function NextLevelMarker({
  level,
  scale,
  occlude,
}: {
  level: Level;
  scale: number;
  occlude?: React.RefObject<THREE.Object3D>[];
}) {
  const NEXT_R = 1.8;
  const { position, normal } = uvToSurface(0.5, 0.5); // top crest, in the background
  // centre at 0.4*r above the surface -> (h+r)/(2r)=0.7 of the sphere pokes out
  position.addScaledVector(normal, 0.4 * NEXT_R);
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[NEXT_R, 20, 20]} />
        <meshBasicMaterial color="#9a938c" />
      </mesh>
      <Html
        distanceFactor={40}
        position={[0, NEXT_R + 0.6, 0]}
        center
        occlude={occlude}
        zIndexRange={[40, 0]}
      >
        <div
          style={{
            width: CARD_W, height: CARD_H, boxSizing: "border-box",
            transform: `translateY(-100%) scale(${scale})`,
            transformOrigin: "center bottom", opacity: 0.55,
            background: "#f1efea", color: "#5b544d",
            border: "1.5px dashed #9a938c", borderRadius: 12,
            padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            font: "13px/1.4 system-ui", pointerEvents: "none",
            filter: "grayscale(1)",
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ font: "700 15px system-ui", marginBottom: 4 }}>
            Next: {level.name}
          </div>
          <div style={{ opacity: 0.8, marginBottom: 8, ...clamp2 }}>
            {level.learn}
          </div>
          <div style={{ font: "600 12px system-ui", marginTop: "auto" }}>
            ⏱ ~{level.minutes} min
          </div>
        </div>
      </Html>
    </group>
  );
}

// The mission's step-by-step levels, shown as a Duolingo-style zigzag
// checkpoint path beneath the vocab. `current` is the active step index —
// steps before it are done, the step at it is current (pulsing ring), steps
// after it are locked. Clicking ANY node (done/current/locked) starts that
// step's real practice via `onStep` — locked is a visual state only, not a
// hard gate, matching this app's existing "practice in any order" behavior.
const MP_ROW = 140;
const MP_NODE_R = 44;
const MP_RING_R = 52;
const MP_AMPLITUDE = 104;
// The final trophy node reads as the mission's payoff — much bigger than
// every other step, ring included, and (being the last node) deliberately
// left tall enough to bleed off the bottom of the screen rather than shrink
// to fit.
const MP_TROPHY_SCALE = 2.3;
const MP_TROPHY_R = MP_NODE_R * MP_TROPHY_SCALE;
const MP_TROPHY_RING_R = MP_RING_R * MP_TROPHY_SCALE;

// The node radius connectors should route around: trophy > active ring >
// a plain node, in that priority (a currently-active trophy uses the
// (bigger) trophy ring, not the plain ring).
function nodeOuterRadius(name: string, active: boolean): number {
  const isTrophy = name === "Final Challenge";
  if (active) return isTrophy ? MP_TROPHY_RING_R : MP_RING_R;
  return isTrophy ? MP_TROPHY_R : MP_NODE_R;
}
// No label text under the nodes (the icon + title tooltip carry the
// meaning) — the path only needs to clear the ring's outer edge.
const MP_PATH_WIDTH = 2 * (MP_AMPLITUDE + MP_RING_R) + 24;

// One glyph per step type — done steps always show a checkmark regardless of
// type (progress signal beats "what kind of step was this"); the trophy
// keeps its own icon in every state so Final Challenge stays identifiable at
// a glance. Plain SVG paths, no emoji, per this app's icon convention.
function stepIconPath(name: string, done: boolean): ReactNode {
  const isTrophy = name === "Final Challenge";
  if (done && !isTrophy) {
    return <path d="m5 12 5 5L20 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (isTrophy) {
    return (
      <>
        <path d="M12 2a4 4 0 0 0-4 4H6a1 1 0 0 0-1 1c0 2.8 1.9 5.1 4.4 5.8A4 4 0 0 0 11 15.9V18H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.1a4 4 0 0 0 1.6-3.1c2.5-.7 4.4-3 4.4-5.8a1 1 0 0 0-1-1h-2a4 4 0 0 0-4-4Z" />
        <path d="M7 8H6a3 3 0 0 0 2 2.8A6 6 0 0 1 7 8Zm11 0h-1a6 6 0 0 1-1 2.8A3 3 0 0 0 18 8Z" />
      </>
    );
  }
  if (name === "Listening") {
    return <path d="M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h2v0a6 6 0 1 0-12 0v0h2v7H6a2 2 0 0 1-2-2v-5Z" />;
  }
  if (name.startsWith("Vocabulary")) {
    return (
      <>
        <rect x="6" y="3" width="13" height="15" rx="3" opacity=".4" />
        <rect x="3" y="6" width="13" height="15" rx="3" />
      </>
    );
  }
  if (name === "Grammar") {
    return (
      <>
        <path d="M11 5.5C9.5 4.4 7.6 4 5.5 4 4.4 4 3.3 4.2 2.5 4.5 2.2 4.6 2 4.9 2 5.2v12.3c0 .5.5.9 1 .7.7-.2 1.6-.4 2.5-.4 2.1 0 4 .5 5.5 1.6V5.5Z" />
        <path d="M13 5.5C14.5 4.4 16.4 4 18.5 4c1.1 0 2.2.2 3 .5.3.1.5.4.5.7v12.3c0 .5-.5.9-1 .7-.7-.2-1.6-.4-2.5-.4-2.1 0-4 .5-5.5 1.6V5.5Z" />
      </>
    );
  }
  if (name === "Speaking") {
    return (
      <>
        <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 0 0-8 0v5a4 4 0 0 0 4 4Z" />
        <path d="M6 11a1 1 0 1 1 2 0 4 4 0 0 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.92V19h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.08A6 6 0 0 1 6 11Z" />
      </>
    );
  }
  if (name === "Writing") {
    return (
      <>
        <path d="M14.8 4.2 19.8 9.2 9 20H4v-5L14.8 4.2Z" />
        <path d="M16.2 2.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8l-1 1-5-5 1-1Z" />
      </>
    );
  }
  return <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />;
}

// Cheap string hash so the "random" horizontal offset is deterministic per
// step (stable across re-renders/scroll — nodes don't jump around) without
// needing a seed prop threaded in from outside.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// Horizontal offset for node i, pseudo-randomized per step (name+index seed)
// rather than a fixed 0/+A/-A cycle, so the path doesn't read as a uniform
// repeating zigzag — except the very last node (the mission's final step),
// which is always recentered so the path visually resolves back to the middle.
function mpOffset(i: number, lastIndex: number, name: string, seed: string): number {
  if (i === lastIndex) return 0;
  const h = hashStr(`${seed}:${i}:${name}`);
  return (h % 1000) / 1000 * MP_AMPLITUDE;
}

function MissionSteps({ steps, current, onStep, pathSeed = "" }: {
  steps: Level[]; current: number; onStep?: (i: number) => void; pathSeed?: string;
}) {
  if (!steps.length) return null;
  const lastIndex = steps.length - 1;
  const width = MP_PATH_WIDTH;
  const center = width / 2;
  const pathHeight = steps.length * MP_ROW;

  let doneD = "";
  let lockedD = "";
  for (let i = 0; i < lastIndex; i++) {
    const x1 = center + mpOffset(i, lastIndex, steps[i].name, pathSeed);
    const x2 = center + mpOffset(i + 1, lastIndex, steps[i + 1].name, pathSeed);
    const r1 = nodeOuterRadius(steps[i].name, i === current);
    const r2 = nodeOuterRadius(steps[i + 1].name, i + 1 === current);
    const rowCenter = MP_ROW / 2;
    const y1 = i * MP_ROW + rowCenter + r1 + 3;
    // Every node is vertically centered in its row (rowCenter ± radius) —
    // except the trophy, which anchors to its row's TOP instead (so its much
    // bigger circle only grows downward). Route the connector to its actual
    // top edge rather than the generic centered formula.
    const nextIsTrophy = steps[i + 1].name === "Final Challenge";
    const y2 = nextIsTrophy
      ? (i + 1) * MP_ROW - 3
      : (i + 1) * MP_ROW + rowCenter - r2 - 3;
    const midY = (y1 + y2) / 2;
    const segment = `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2} `;
    if (i < current) doneD += segment; else lockedD += segment;
  }

  // The trophy is the mission's payoff, deliberately too big to fully fit —
  // scrolling (and the content box itself) stops exactly at its vertical
  // center rather than growing to reveal all of it. Only applies when the
  // last step really is the trophy; any other mission shape keeps the old
  // "show everything, scroll if it doesn't fit" sizing.
  const lastIsTrophy = steps[lastIndex].name === "Final Challenge";
  const innerHeight = lastIsTrophy
    ? 16 + lastIndex * MP_ROW + MP_TROPHY_R
    : 16 + pathHeight + 16;

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
      <div
        style={{
          position: "relative", width, maxWidth: "100%",
          height: innerHeight, overflow: lastIsTrophy ? "hidden" : "visible",
          padding: "16px 0 0",
        }}
      >
        <svg
          width={width} height={pathHeight} viewBox={`0 0 ${width} ${pathHeight}`}
          preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 16 }}
        >
          <path d={doneD} fill="none" stroke="var(--acc)" strokeWidth={4} strokeLinecap="round" strokeDasharray="2 14" />
          <path d={lockedD} fill="none" stroke="var(--border)" strokeWidth={4} strokeLinecap="round" strokeDasharray="2 14" />
        </svg>
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const isTrophy = s.name === "Final Challenge";

          let bg: string, shadow: string, iconColor: string;
          if (done || active) {
            bg = isTrophy ? "#D9A441" : "var(--acc)";
            shadow = `0 5px 0 ${isTrophy ? "#B98620" : "color-mix(in oklab, var(--acc) 70%, black)"}`;
            iconColor = "#fff";
          } else {
            bg = "var(--surface-2)";
            shadow = "0 5px 0 var(--border)";
            iconColor = "var(--muted)";
          }

          return (
            <div
              key={i}
              style={{
                display: "flex", justifyContent: "center",
                // Every other row centers its node vertically. The trophy row
                // anchors to its own top instead, so the node's much bigger
                // circle only grows downward — past the row, past the path's
                // bottom edge — rather than overflowing evenly both ways.
                alignItems: isTrophy ? "flex-start" : "center",
                height: MP_ROW, position: "relative",
              }}
            >
              <button
                type="button"
                className="mp-node-btn"
                onClick={() => onStep?.(i)}
                title={`Practise: ${s.name}${s.minutes ? ` · ~${s.minutes} min` : ""}`}
                aria-label={s.name}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  border: "none", background: "transparent", cursor: "pointer",
                  transform: `translateX(${mpOffset(i, lastIndex, s.name, pathSeed)}px)`,
                  position: "relative", zIndex: 1,
                }}
              >
                {active && (
                  <span
                    style={{
                      position: "absolute", top: -6,
                      width: (isTrophy ? MP_TROPHY_RING_R : MP_RING_R) * 2 - 6,
                      height: (isTrophy ? MP_TROPHY_RING_R : MP_RING_R) * 2 - 6,
                      borderRadius: "50%",
                      background: isTrophy ? "rgba(217,164,65,.4)" : "color-mix(in oklab, var(--acc) 40%, transparent)",
                      animation: "mp-pulse-ring 2s ease-out 4",
                      animationFillMode: "forwards",
                    }}
                  />
                )}
                <span
                  style={{
                    width: (isTrophy ? MP_TROPHY_R : MP_NODE_R) * 2,
                    height: (isTrophy ? MP_TROPHY_R : MP_NODE_R) * 2,
                    borderRadius: "50%",
                    display: "flex",
                    // A plain node centers its icon. The trophy circle is
                    // much taller than it is visible (its bottom half bleeds
                    // off-screen by design), so its icon sits near the top
                    // instead — the part guaranteed to stay on-screen.
                    alignItems: isTrophy ? "flex-start" : "center",
                    justifyContent: "center",
                    paddingTop: isTrophy ? 28 : 0,
                    background: bg, boxShadow: shadow, position: "relative", zIndex: 1,
                  }}
                >
                  <svg width={isTrophy ? 52 : 32} height={isTrophy ? 52 : 32} viewBox="0 0 24 24" fill="currentColor" style={{ color: iconColor }}>
                    {stepIconPath(s.name, done)}
                  </svg>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Fixed-position frame for the checkpoint path, sitting under the title.
// Width is pinned to half the viewport so the path reads as a focused column
// rather than spanning the full screen.
function MissionStepsFrame({ steps = [], current = 0, onStep, pathSeed = "" }: {
  steps?: Level[]; current?: number; onStep?: (i: number) => void; pathSeed?: string;
}) {
  if (!steps.length) return null;
  return (
    // Full-width scroll container so the scrollbar sits at the actual window
    // edge, not hugging the narrow content column — the centered inner div
    // below is what's actually sized to the path's content.
    <div
      style={{
        // Below the top nav (24-76px) and the mission title (92px, ~26px
        // tall) with a little breathing room.
        position: "fixed", top: 150, left: 0, right: 0, zIndex: 6,
        maxHeight: "calc(100vh - 170px)", overflowY: "auto",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          // The path's node/label geometry is a fixed pixel layout, not
          // fluid — size this column to exactly what it needs so nothing
          // clips or gets squeezed by maxWidth:100%.
          width: MP_PATH_WIDTH, margin: "0 auto",
          // Extra top padding (24px, vs the 4px elsewhere) so the first
          // node's pulsing ring — which overhangs above the node itself —
          // has clearance and isn't flush against the scroll area's top edge.
          padding: "24px 0 16px",
        }}
      >
        {SHOW_MISSION_STEPS && <MissionSteps steps={steps} current={current} onStep={onStep} pathSeed={pathSeed} />}
      </div>
    </div>
  );
}

export default function PlanetScene({
  title,
  steps = [],
  level,
  nextLevel,
  levelIndex = 0,
  onLevel,
  onStep,
  pathSeed,
}: {
  title?: string;
  steps?: Level[];
  level?: Level;
  nextLevel?: Level;
  levelIndex?: number;
  onLevel?: () => void;
  onStep?: (i: number) => void;
  // Mission id (or similar) used to seed the checkpoint path's zigzag
  // randomization, so each mission's layout differs from the next rather
  // than every mission producing the identical pattern for the same step
  // names ("Listening" is always step 0, etc).
  pathSeed?: string;
}) {
  const cardScale = 1.4; // locked
  const cityRef = useRef<THREE.Group>(null);
  return (
    <>
      {SHOW_CYLINDER && (
      <Canvas
        camera={{ position: [0, -12.15, 68.9], fov: 45 }}
        gl={{ alpha: true }}
        style={{ width: "100vw", height: "100vh", background: "transparent" }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[20, 30, 20]} intensity={1.3} />
        <hemisphereLight args={["#ffffff", "#c9c4b8", 0.5]} />
        {/* locked vertical position */}
        <group position={[0, OFFSET_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <group ref={cityRef}>
              <Suspense fallback={null}>
                <CityLoader />
              </Suspense>
            </group>
            {level && <LevelMarker level={level} scale={cardScale} onOpen={onLevel} />}
            {nextLevel && (
              <NextLevelMarker
                level={nextLevel}
                scale={cardScale}
                occlude={[cityRef]}
              />
            )}
          </group>
        </group>
        {/* fully locked: fixed zoom (dist 80) and fixed Y-tilt (polar 100°) */}
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          minDistance={70}
          maxDistance={70}
          minAzimuthAngle={0}
          maxAzimuthAngle={0}
          minPolarAngle={(100 * Math.PI) / 180}
          maxPolarAngle={(100 * Math.PI) / 180}
        />
      </Canvas>
      )}
      {title && (
        <div
          style={{
            // Below the persistent top nav (fixed, top:24, height:52, plus a
            // little clearance) rather than under it — the nav now stays
            // visible/clickable over this screen instead of being covered.
            position: "fixed", top: 92, left: 0, right: 0, zIndex: 6,
            textAlign: "center", pointerEvents: "none",
            font: "600 26px var(--font-display, system-ui)",
            color: "var(--ink, #141210)",
          }}
        >
          {title}
        </div>
      )}
      <MissionStepsFrame steps={steps} current={levelIndex} onStep={onStep} pathSeed={pathSeed} />
    </>
  );
}
