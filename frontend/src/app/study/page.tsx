"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Rating, UserCard } from "@/types";
import { ApiError, studyApi } from "@/lib/api";
import FlashCard from "@/components/FlashCard";
import RatingButtons from "@/components/RatingButtons";

export default function StudyPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<UserCard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const sessionId = useRef<string | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [cards, session] = await Promise.all([
          studyApi.due(),
          studyApi.startSession(),
        ]);
        setQueue(cards);
        sessionId.current = session.id;
        if (cards.length === 0) setDone(true);
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

  async function handleRate(rating: Rating) {
    const card = queue[current];
    setSubmitting(true);
    try {
      await studyApi.review(card.id, rating);
      const nextReviewed = reviewed + 1;
      const nextCorrect = correct + (rating >= 3 ? 1 : 0);
      setReviewed(nextReviewed);
      setCorrect(nextCorrect);

      const next = current + 1;
      if (next >= queue.length) {
        if (sessionId.current) {
          await studyApi.endSession(sessionId.current, nextReviewed, nextCorrect);
        }
        setDone(true);
      } else {
        setCurrent(next);
        setFlipped(false);
      }
    } catch {
      setError("Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
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
          <div className="text-5xl mb-4">🎉</div>
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

  const card = queue[current];
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
        <FlashCard card={card} onFlipped={() => setFlipped(true)} />

        {flipped && (
          <div className="w-full animate-in fade-in duration-300">
            <RatingButtons onRate={handleRate} disabled={submitting} />
          </div>
        )}

        {!flipped && (
          <p className="text-sm text-gray-400">Tap the card to reveal the answer</p>
        )}
      </main>
    </div>
  );
}
