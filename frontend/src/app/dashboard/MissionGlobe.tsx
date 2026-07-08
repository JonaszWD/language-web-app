"use client";

/* Interactive low-poly earth for the Mission screen.
   Loads /low-poly-earth.obj, lets the user spin it freely, and drops a
   clickable pin on the globe for every mission. */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type GlobePin = { id: string; title: string; lat: number; lon: number; locked?: boolean };

// lat/lon (degrees) -> point on a unit sphere of the given radius.
function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export default function MissionGlobe({
  pins,
  onSelect,
  renderCard,
}: {
  pins: GlobePin[];
  onSelect: (id: string) => void;
  renderCard?: (pin: GlobePin) => ReactNode;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  // Pointer marker DOM nodes, keyed by pin id — positioned imperatively each frame (no React re-render).
  const markerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 3.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.touchAction = "none";

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 2, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd9b0, 0.4);
    rim.position.set(-4, -1, -3);
    scene.add(rim);

    const world = new THREE.Group(); // spins with user drag
    scene.add(world);

    const RADIUS = 1;
    // Invisible anchors at each mission's lat/lon — used only to place the cards.
    const anchors: THREE.Object3D[] = [];

    const addPins = () => {
      pins.forEach((p) => {
        const anchor = new THREE.Object3D();
        anchor.position.copy(latLonToVec3(p.lat, p.lon, RADIUS));
        anchor.userData = { pin: p };
        world.add(anchor);
        anchors.push(anchor);
      });
    };

    const loader = new GLTFLoader();
    loader.load(
      "/low-poly-earth.glb",
      (gltf) => {
        const obj = gltf.scene;
        // Center + normalize to unit radius.
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);
        const size = box.getSize(new THREE.Vector3());
        const scale = (RADIUS * 2) / Math.max(size.x, size.y, size.z);
        obj.scale.setScalar(scale);

        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // Keep baked vertex colors, but flat-shade for the low-poly look.
            child.material = new THREE.MeshStandardMaterial({
              vertexColors: true,
              flatShading: true,
              roughness: 0.85,
              metalness: 0.05,
            });
          }
        });
        world.add(obj);
        addPins();
        setReady(true);
      },
      undefined,
      () => {
        // GLB failed — still show pins on a plain sphere so the tab works.
        const fallback = new THREE.Mesh(
          new THREE.IcosahedronGeometry(RADIUS, 2),
          new THREE.MeshStandardMaterial({ color: 0x2f6b4f, flatShading: true }),
        );
        world.add(fallback);
        addPins();
        setReady(true);
      },
    );

    // ---- interaction: drag to spin ----
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let velX = 0.0025; // idle spin
    let velY = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      velY = dx * 0.005;
      velX = dy * 0.005;
      world.rotation.y += velY;
      world.rotation.x = THREE.MathUtils.clamp(world.rotation.x + velX, -1.2, 1.2);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
    };

    const el = renderer.domElement;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);

    // ---- resize ----
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ---- per-frame: project each pin to screen + position its card imperatively ----
    const wp = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const positionCards = () => {
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      anchors.forEach((a) => {
        const id = (a.userData.pin as GlobePin).id;
        const marker = markerRefs.current.get(id);
        if (!marker) return;
        a.getWorldPosition(wp);
        nrm.copy(wp).normalize(); // globe centered at origin → outward normal
        toCam.copy(camera.position).sub(wp).normalize();
        const visible = nrm.dot(toCam) > 0.1; // front hemisphere only
        wp.project(camera);
        const x = (wp.x * 0.5 + 0.5) * w;
        const y = (-wp.y * 0.5 + 0.5) * h;
        // GPU transform, no layout — centre the pointer on the projected point.
        marker.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        marker.style.opacity = visible ? "1" : "0";
        marker.style.pointerEvents = visible ? "auto" : "none";
        marker.style.zIndex = String(Math.round((wp.z) * -1000) + 1000); // nearer pins on top
      });
    };

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!dragging) {
        world.rotation.y += velY || 0.0015; // gentle idle drift
        velY *= 0.95;
      }
      renderer.render(scene, camera);
      positionCards();
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [pins]);

  return (
    <div className="mi-globe">
      <div ref={mountRef} className="mi-globe-canvas" />
      {!ready && <div className="mi-globe-load">Loading globe…</div>}
      {ready && (
        <div className="mi-globe-cards">
          {pins.map((p) => (
            <div
              key={p.id}
              className={"mi-marker" + (p.locked ? " is-locked" : "")}
              ref={(el) => {
                if (el) markerRefs.current.set(p.id, el);
                else markerRefs.current.delete(p.id);
              }}
              onClick={() => { if (!p.locked) onSelectRef.current(p.id); }}
            >
              <button className="mi-dot" aria-label={p.title} />
              {renderCard && <div className="mi-float">{renderCard(p)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
