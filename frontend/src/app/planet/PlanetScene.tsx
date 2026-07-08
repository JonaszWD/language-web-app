"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Render toggles. Cylinder (3D city drum) and the mission step cards are hidden
// per request, but their code is kept intact for future use.
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
MODELS.forEach((m) => useGLTF.preload(m));

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

// Level progress bar — full-width row of dots at the top, one per level.
function LevelProgress({ total, current }: { total: number; current: number }) {
  return (
    <div
      style={{
        position: "fixed", top: 64, left: 0, right: 0, zIndex: 6,
        display: "flex", alignItems: "center",
        padding: "12px 40px", pointerEvents: "none",
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        const size = active ? 26 : 18;
        const color = done || active ? "#16140f" : "#d9d4cc";
        return (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center",
              flex: i === 0 ? "0 0 auto" : "1 1 0", // segments stretch to fill
            }}
          >
            {i > 0 && (
              <div
                style={{
                  flex: 1, height: 7, borderRadius: 4,
                  background: i <= current ? "#16140f" : "#d9d4cc",
                }}
              />
            )}
            <div
              style={{
                flex: "0 0 auto",
                width: size, height: size, borderRadius: "50%",
                background: color,
                boxShadow: active ? "0 0 0 4px rgba(99,27,8,.2)" : "none",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// Mission vocabulary — little cards aligned across the screen under the
// progress bar, mirroring the Vocabulary-tab grid (vo-card). Each shows the
// word, its English translation and the user's current 1-5 training level.
type VocabWord = { es: string; en: string; level?: number | null };

const VOCAB_LEVEL_LABEL = ["", "Recognise", "Build", "Recall", "Context", "Produce", "Mastered"];

// A circular progress ring that fills by level/5, coloured red (empty) → green
// (full). Sits on the right of a card. Empty/new reads grey.
function LevelRing({ level }: { level: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(level, 5)) / 5;
  const mastered = level >= 5;
  // Hue sweeps 0° (red) → 120° (green) with fill; level 0 is a neutral grey.
  const stroke = level <= 0 ? "#b7afa1" : `hsl(${Math.round(frac * 120)}, 70%, 45%)`;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ flex: "0 0 auto" }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--surface-3, #e7e2da)" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
        transform="rotate(-90 22 22)"
        style={{ transition: "stroke-dashoffset .3s" }}
      />
      {mastered && (
        <text x="22" y="22" dominantBaseline="central" textAnchor="middle"
          style={{ font: "700 14px system-ui", fill: stroke }}>★</text>
      )}
    </svg>
  );
}

// The mission's step-by-step levels, shown as a connected stepper beneath the
// vocab. `current` is the active step index. Clicking a step starts its
// practice via `onStep`.
function MissionSteps({ steps, current, onStep }: {
  steps: Level[]; current: number; onStep?: (i: number) => void;
}) {
  if (!steps.length) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center",
          alignItems: "flex-start", maxWidth: 900,
          padding: "10px 14px", borderRadius: 14,
          background: "rgba(255,255,255,.7)", backdropFilter: "blur(6px)",
          boxShadow: "0 6px 24px rgba(0,0,0,.1)",
        }}
      >
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const accent = done || active ? "#16140f" : "#b7afa1";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => onStep?.(i)}
                title={`Practise: ${s.name}${s.minutes ? ` · ~${s.minutes} min` : ""}`}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  border: "none", background: "transparent", cursor: "pointer",
                  padding: "4px 8px", borderRadius: 999,
                  transition: "background .14s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(99,27,8,.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span
                  style={{
                    width: 24, height: 24, borderRadius: "50%", flex: "0 0 auto",
                    display: "grid", placeItems: "center",
                    font: "700 12px system-ui", color: "#fff",
                    background: accent,
                    boxShadow: active ? "0 0 0 4px rgba(99,27,8,.18)" : "none",
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  style={{
                    font: (active ? "700 " : "600 ") + "13px system-ui",
                    color: done || active ? "#141210" : "#6b6459",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div style={{ width: 18, height: 2, borderRadius: 2, background: "#d9d4cc" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissionVocabList({ vocab, steps = [], current = 0, onStep }: {
  vocab: VocabWord[]; steps?: Level[]; current?: number; onStep?: (i: number) => void;
}) {
  if (!vocab.length && !steps.length) return null;
  return (
    <div
      style={{
        position: "fixed", top: 150, left: 0, right: 0, zIndex: 6,
        maxHeight: "calc(100vh - 170px)", overflowY: "auto",
        padding: "4px 40px 16px",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          display: "flex", flexWrap: "nowrap", gap: 8,
          overflowX: "auto", overflowY: "hidden", paddingBottom: 6,
          justifyContent: vocab.length > 4 ? "flex-start" : "center",
        }}
      >
        {vocab.map((w, i) => {
          const lvl = w.level ?? 0;
          return (
            <div
              className="sp-card vo-card"
              key={i}
              style={{ cursor: "default", flex: "0 0 210px", flexDirection: "row", alignItems: "center", gap: 10, padding: 10 }}
            >
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <div className="vo-es" style={{ fontSize: 16 }}>{w.es}</div>
                <div className="vo-en">{w.en}</div>
                <span className="vo-level-label">
                  {w.level == null ? "New" : lvl >= 5 ? "Mastered" : `Lvl ${lvl} · ${VOCAB_LEVEL_LABEL[lvl]}`}
                </span>
              </div>
              <LevelRing level={lvl} />
            </div>
          );
        })}
      </div>
      {/* Mission step cards removed from the window per request. MissionSteps
          kept above for future use. */}
      {SHOW_MISSION_STEPS && <MissionSteps steps={steps} current={current} onStep={onStep} />}
    </div>
  );
}

export default function PlanetScene({
  title,
  vocab = [],
  steps = [],
  level,
  nextLevel,
  levelIndex = 0,
  levelCount = 7,
  onLevel,
  onStep,
}: {
  title?: string;
  vocab?: VocabWord[];
  steps?: Level[];
  level?: Level;
  nextLevel?: Level;
  levelIndex?: number;
  levelCount?: number;
  onLevel?: () => void;
  onStep?: (i: number) => void;
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
            position: "fixed", top: 20, left: 0, right: 0, zIndex: 6,
            textAlign: "center", pointerEvents: "none",
            font: "600 26px var(--font-display, system-ui)",
            color: "var(--ink, #141210)",
          }}
        >
          {title}
        </div>
      )}
      <LevelProgress total={levelCount} current={levelIndex} />
      <MissionVocabList vocab={vocab} steps={steps} current={levelIndex} onStep={onStep} />
    </>
  );
}
