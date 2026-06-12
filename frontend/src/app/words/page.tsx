"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Word } from "@/types";
import { ApiError, wordsApi } from "@/lib/api";

const CATEGORIES = ["", "greetings", "numbers", "colours", "common_verbs", "food", "travel", "adjectives", "body"];
const LEVELS = ["", "A1", "A2"];
const PAGE_SIZE = 24;

export default function WordsPage() {
  const router = useRouter();
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await wordsApi.list({
          category: category || undefined,
          cefr_level: level || undefined,
          page,
          size: PAGE_SIZE,
        });
        setWords(data.items);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, category, level, router]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-brand-pink-text transition-colors">
          ← Dashboard
        </Link>
        <span className="font-semibold text-gray-700">Vocabulary ({total})</span>
        <Link
          href="/study"
          className="bg-brand-pink text-gray-900 text-sm px-3 py-1.5 rounded-lg hover:bg-brand-pink-hover transition-colors"
        >
          Study
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink bg-white"
          >
            <option value="">All categories</option>
            {CATEGORIES.filter(Boolean).map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={level}
            onChange={(e) => { setLevel(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink bg-white"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l || "All levels"}
              </option>
            ))}
          </select>
        </div>

        {/* Word grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-24 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {words.map((word) => (
              <div
                key={word.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-brand-aqua-text uppercase tracking-wider">
                    {word.cefr_level}
                  </span>
                  <span className="text-xs text-gray-400">{word.category.replace("_", " ")}</span>
                </div>
                <p className="font-bold text-gray-900 text-sm truncate">{word.spanish}</p>
                <p className="text-gray-500 text-xs truncate">{word.english}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
