"use client";

import { useState } from "react";
import type { GrammarReviewCard } from "@/types";
import { studyApi } from "@/lib/api";

interface GrammarClozeCardProps {
  card: GrammarReviewCard;
  onResult: (correct: boolean) => void;
}

// Accent/case/punctuation-insensitive compare, matching the vocab trainer's
// forgiving check.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// The review-tab counterpart of FlashCard, for a grammar pattern instead of a
// word: fill the blank, then reveal right/wrong before the caller advances.
export default function GrammarClozeCard({ card, onResult }: GrammarClozeCardProps) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [before, after] = card.cloze_template.split("______");

  async function check() {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await studyApi.reviewGrammar(card.pattern_id, value);
      setCorrect(res.correct);
      setCorrectAnswer(res.cloze_answer);
      setChecked(true);
    } catch {
      // Fall back to a local check so the learner isn't stuck if the network call fails.
      setCorrect(norm(value) === norm(card.pattern));
      setCorrectAnswer(null);
      setChecked(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-aqua-text">Grammar</p>
      {card.mission_title && <p className="text-xs text-gray-400">From: {card.mission_title}</p>}
      <p className="text-sm text-gray-500 text-center">{card.gloss}</p>
      {!checked ? (
        <>
          <p className="text-xl font-bold text-gray-900 text-center">
            {before}
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void check(); }}
              className="inline-block w-32 border-b-2 border-brand-pink text-center outline-none mx-1"
              placeholder="…"
            />
            {after}
          </p>
          <button
            onClick={() => void check()}
            disabled={!value.trim() || submitting}
            className="mt-2 bg-brand-pink hover:bg-brand-pink-hover disabled:opacity-40 text-gray-900 font-semibold rounded-xl py-2 px-8 transition-colors"
          >
            Check
          </button>
        </>
      ) : (
        <>
          <p className={`text-lg font-bold ${correct ? "text-green-600" : "text-red-600"}`}>
            {correct ? "Correct!" : "Not quite"}
          </p>
          {!correct && (
            <p className="text-sm text-gray-600">
              {before}<b>{correctAnswer ?? card.pattern}</b>{after}
            </p>
          )}
          <button
            onClick={() => onResult(correct)}
            className="mt-2 bg-brand-pink hover:bg-brand-pink-hover text-gray-900 font-semibold rounded-xl py-2 px-8 transition-colors"
          >
            Continue
          </button>
        </>
      )}
    </div>
  );
}
