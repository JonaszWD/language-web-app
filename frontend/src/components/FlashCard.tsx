"use client";

import { useState, useCallback } from "react";
import type { UserCard } from "@/types";

interface FlashCardProps {
  card: UserCard;
  onFlipped?: () => void;
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

export default function FlashCard({ card, onFlipped }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = useCallback(() => {
    if (!flipped) {
      setFlipped(true);
      onFlipped?.();
    }
  }, [flipped, onFlipped]);

  const word = card.word;

  return (
    <div
      className="perspective-1000 w-full max-w-sm mx-auto cursor-pointer select-none"
      style={{ height: "220px" }}
      onClick={handleFlip}
      role="button"
      aria-label={flipped ? "Card back" : "Tap to reveal answer"}
    >
      <div
        className={`relative w-full h-full transform-style-3d transition-transform duration-500 ${
          flipped ? "rotate-y-180" : ""
        }`}
      >
        {/* Front */}
        <div className="backface-hidden absolute inset-0 bg-white rounded-2xl shadow-lg flex flex-col items-center justify-center p-6 gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-aqua-text">
            {word?.category ?? "—"}
          </p>
          <p className="text-4xl font-bold text-gray-900">{word?.spanish ?? "…"}</p>
          <p className="text-xs text-gray-400">{word?.cefr_level}</p>
          <button
            className="mt-2 flex items-center gap-1 text-sm text-gray-500 hover:text-brand-pink-text transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (word) speak(word.spanish);
            }}
            aria-label="Play pronunciation"
          >
            🔊 Listen
          </button>
          <p className="text-xs text-gray-400 mt-1">Tap to reveal</p>
        </div>

        {/* Back */}
        <div className="backface-hidden rotate-y-180 absolute inset-0 bg-brand-pink-soft rounded-2xl shadow-lg flex flex-col items-center justify-center p-6 gap-2 text-center">
          <p className="text-3xl font-bold text-gray-900">{word?.english ?? "—"}</p>
          {word?.example_sentence && (
            <p className="text-sm text-gray-600 italic max-w-xs">
              &ldquo;{word.example_sentence}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
