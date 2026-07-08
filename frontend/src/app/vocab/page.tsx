"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import VocabTrainer from "@/components/VocabTrainer";
import "../dashboard/spanishup-app.css";

export default function VocabPage() {
  const router = useRouter();
  const [dark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("sp-theme");
    if (stored) return stored === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  return (
    <div className={"sp-root" + (dark ? " dark" : "")}>
      <div className="sp-bg" aria-hidden="true">
        <div className="sp-cursor-glow" />
        <div className="sp-blob b1" /><div className="sp-blob b2" /><div className="sp-blob b3" />
      </div>
      <div className="sp-app">
        <main className="sp-main">
          <VocabTrainer onBack={() => router.back()} onAuthError={() => router.push("/login")} />
        </main>
      </div>
    </div>
  );
}
