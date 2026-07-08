"use client";

import dynamic from "next/dynamic";

// WebGL is browser-only — disable SSR for the whole scene.
const PlanetScene = dynamic(() => import("./PlanetScene"), { ssr: false });

export default function PlanetPage() {
  return (
    <>
      <PlanetScene />
      {/* OSM attribution is required (ODbL) when using OpenStreetMap data. */}
      <div
        style={{
          position: "fixed", bottom: 6, right: 8, zIndex: 5,
          font: "11px system-ui", color: "#cbd5e1",
          background: "rgba(0,0,0,0.4)", padding: "2px 6px", borderRadius: 4,
        }}
      >
        Street data © <a style={{ color: "#93c5fd" }} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
      </div>
    </>
  );
}
