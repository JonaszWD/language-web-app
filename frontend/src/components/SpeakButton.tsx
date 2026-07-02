"use client";

import { useState } from "react";

// Pronounces Spanish text via the browser SpeechSynthesis API (no backend /
// API key). Prefers an es-ES / es voice when the device has one.
export default function SpeakButton({
  text,
  label = "Hear it",
}: {
  text: string;
  label?: string;
}) {
  const [speaking, setSpeaking] = useState(false);

  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    u.rate = 0.9;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("es"));
    if (voice) u.voice = voice;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`${label}: ${text}`}
      title={label}
      className={"vt-speak" + (speaking ? " rec" : "")}
    >
      {label}
    </button>
  );
}
