"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GrammarReviewCard, Rating, UserCard } from "@/types";
import { ApiError, studyApi } from "@/lib/api";
import FlashCard from "@/components/FlashCard";
import RatingButtons from "@/components/RatingButtons";
import GrammarClozeCard from "@/components/GrammarClozeCard";

// A single interleaved review queue mixing words and grammar patterns —
// same "mixed, not separated" interleaving the rest of the app already does
// for cross-mission vocab, now extended to grammar so patterns don't decay
// once a GrammarLesson ends.
type ReviewItem =
  | { kind: "word"; card: UserCard }
  | { kind: "grammar"; card: GrammarReviewCard };

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function StudyPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const sessionId = useRef<string | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  // Background telemetry (silent): time the current card was shown and whether
  // the answer was revealed (flip = 1 hint). Reset per card below.
  const startedAt = useRef(0);
  const hintCount = useRef(0);

  useEffect(() => {
    if (queue.length === 0) return;
    startedAt.current = performance.now();
    hintCount.current = 0;
  }, [current, queue.length]);

  useEffect(() => {
    async function load() {
      try {
        const [words, grammar, session] = await Promise.all([
          studyApi.due(),
          studyApi.dueGrammar(),
          studyApi.startSession(),
        ]);
        const merged = shuffled<ReviewItem>([
          ...words.map((card) => ({ kind: "word" as const, card })),
          ...grammar.map((card) => ({ kind: "grammar" as const, card })),
        ]);
        setQueue(merged);
        sessionId.current = session.id;
        if (merged.length === 0) setDone(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
        } else {
          setError("Failed to load cards");
        }
      }
    }
    load();
  }, [router]);

  function advance(nextReviewed: number, nextCorrect: number) {
    setReviewed(nextReviewed);
    setCorrect(nextCorrect);
    const next = current + 1;
    if (next >= queue.length) {
      if (sessionId.current) {
        void studyApi.endSession(sessionId.current, nextReviewed, nextCorrect);
      }
      setDone(true);
    } else {
      setCurrent(next);
      setFlipped(false);
    }
  }

  async function handleRate(rating: Rating) {
    const item = queue[current];
    if (item.kind !== "word") return;
    setSubmitting(true);
    try {
      await studyApi.review(item.card.id, rating, {
        response_ms: Math.round(performance.now() - startedAt.current),
        hints: hintCount.current,
      });
      advance(reviewed + 1, correct + (rating >= 3 ? 1 : 0));
    } catch {
      setError("Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGrammarResult(wasCorrect: boolean) {
    advance(reviewed + 1, correct + (wasCorrect ? 1 : 0));
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/dashboard" className="text-brand-pink-text underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">✦</div>
          <h2 className="text-2xl font-bold mb-2">All caught up!</h2>
          <p className="text-gray-500 mb-6">
            You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""} today.
            Come back tomorrow for more.
          </p>
          <Link
            href="/dashboard"
            className="bg-brand-pink text-gray-900 font-semibold rounded-xl py-3 px-8 hover:bg-brand-pink-hover transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading cards…</div>
      </div>
    );
  }

  const item = queue[current];
  const progress = `${current + 1} / ${queue.length}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-brand-pink-text transition-colors">
          ← Dashboard
        </Link>
        <span className="text-sm font-medium text-gray-700">{progress}</span>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-8">
        {item.kind === "grammar" ? (
          <GrammarClozeCard card={item.card} onResult={handleGrammarResult} />
        ) : (
          <>
            <FlashCard card={item.card} onFlipped={() => { hintCount.current = 1; setFlipped(true); }} />

            {flipped && (
              <div className="w-full animate-in fade-in duration-300">
                <RatingButtons onRate={handleRate} disabled={submitting} />
              </div>
            )}

            {!flipped && (
              <p className="text-sm text-gray-400">Tap the card to reveal the answer</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
