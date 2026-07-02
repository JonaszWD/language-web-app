"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { VocabAnswer, VocabCard, VocabRating } from "@/types";
import { ApiError, vocabApi } from "@/lib/api";
import VocabTipStrip from "@/components/VocabTipStrip";
import SpeakButton from "@/components/SpeakButton";
import "../dashboard/spanishup-app.css";

const LEVEL_LABELS: Record<number, string> = {
  1: "Recognise", 2: "Build it", 3: "Recall", 4: "In context", 5: "Produce",
};

// Speak a Spanish phrase — used for click-to-play on chunks / example sentences.
function playEs(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.9;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith("es"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;
}

export default function VocabPage() {
  const router = useRouter();
  const [card, setCard] = useState<VocabCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VocabAnswer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("sp-theme");
    if (stored) return stored === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  const loadNext = useCallback(async () => {
    try {
      const next = await vocabApi.next();
      setCard(next);
      setEmpty(!next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.push("/login");
      else setError("Failed to load vocabulary");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNext();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNext]);

  const handleNext = async () => {
    setLoading(true);
    setResult(null);
    setEmpty(false);
    await loadNext();
  };

  async function submit(payload: { rating?: VocabRating; answer?: string }) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      const res = await vocabApi.answer(card.card_id, payload);
      setResult(res);
      setReviewed((n) => n + 1);
    } catch {
      setError("Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  const back = () => router.back();

  return (
    <div className={"sp-root" + (dark ? " dark" : "")}>
      <div className="sp-bg" aria-hidden="true">
        <div className="sp-cursor-glow" />
        <div className="sp-blob b1" /><div className="sp-blob b2" /><div className="sp-blob b3" />
      </div>
      <div className="sp-app">
        <main className="sp-main">
          <div className={"vt-wrap" + (card && !error && !empty && !result && card.level === 1 ? " wide" : "")}>
            <div className="vt-topbar" style={{ width: "100%" }}>
              <button className="vt-back" onClick={back}><ChevronIcon /> Back</button>
              {card && !error && !empty && <span className="vt-level">Level {card.level} · {LEVEL_LABELS[card.level]}</span>}
            </div>

            {error ? (
              <div className="sp-card vt-card">
                <p className="vt-en" style={{ color: "#c0483f" }}>{error}</p>
                <button className="sp-btn sp-btn-primary" onClick={back}>Go back</button>
              </div>
            ) : loading ? (
              <div className="sp-sub" style={{ padding: 40 }}>Loading…</div>
            ) : empty || !card ? (
              <div className="sp-card vt-card">
                <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                <h2 className="sp-h2" style={{ marginBottom: 8 }}>Nothing due!</h2>
                <p className="sp-sub" style={{ marginBottom: 20 }}>
                  You trained {reviewed} word{reviewed !== 1 ? "s" : ""}. Save more words from a podcast
                  or come back later.
                </p>
                <button className="sp-btn sp-btn-primary" onClick={back}>Go back</button>
              </div>
            ) : (
              <>
                <div className="vt-dots">
                  {[1, 2, 3, 4, 5].map((n) => <span key={n} className={"vt-dot" + (n <= card.level ? " on" : "")} />)}
                </div>
                {result
                  ? <ResultPanel result={result} onNext={handleNext} />
                  : <Exercise card={card} submitting={submitting} onSubmit={submit} />}
                {/* Level 1 shows its tips inline + in a side panel on reveal; other levels keep the strip below. */}
                {!result && card.level !== 1 && <VocabTipStrip tips={card.tips} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ResultPanel({ result, onNext }: { result: VocabAnswer; onNext: () => void }) {
  return (
    <div className="sp-card vt-card">
      <div style={{ fontSize: 38, marginBottom: 6 }}>{result.correct ? "✅" : "❌"}</div>
      <p className="sp-h2" style={{ marginBottom: 6 }}>{result.correct ? "Correct!" : "Not quite"}</p>
      <p className="sp-sub" style={{ marginBottom: 10 }}>
        The word was <b style={{ color: "var(--ink)" }}>{result.spanish}</b>
      </p>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <SpeakButton text={result.spanish} label="Listen" />
      </div>
      {result.mastered && <p className="sp-tag pink" style={{ margin: "0 auto 12px" }}>🏆 Mastered — level 5</p>}
      {result.feedback && (
        <div className="vt-fb">
          <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Score: {result.feedback.score}/100</p>
          <p className="sp-sub" style={{ marginBottom: result.feedback.correction ? 8 : 0 }}>{result.feedback.feedback}</p>
          {result.feedback.correction && <p className="sp-sub"><b>Better: </b>{result.feedback.correction}</p>}
        </div>
      )}
      <button className="sp-btn sp-btn-primary" style={{ marginTop: 6 }} onClick={onNext}>Next word</button>
    </div>
  );
}
function Exercise({ card, submitting, onSubmit }: {
  card: VocabCard; submitting: boolean; onSubmit: (p: { rating?: VocabRating; answer?: string }) => void;
}) {
  if (card.level === 1) return <LevelOne card={card} submitting={submitting} onSubmit={onSubmit} />;
  if (card.level >= 2 && card.level <= 4) return <TypedExercise card={card} submitting={submitting} onSubmit={onSubmit} />;
  return <LevelFive card={card} submitting={submitting} onSubmit={onSubmit} />;
}

// Level 1 — word front & centre; on reveal each block gets its own box in a
// 3-column layout: collocations/watch-out (left) · word + choices + chunks
// (centre) · examples/antonyms (right).
function LevelOne({ card, submitting, onSubmit }: {
  card: VocabCard; submitting: boolean; onSubmit: (p: { rating?: VocabRating }) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const ex = card.exercise;
  const tips = card.tips;
  return (
    <div className="vt-l1-grid">
      {/* left */}
      <div className="vt-col">
        {revealed && tips.collocations && tips.collocations.length > 0 && (
          <div className="sp-card vt-box"><p className="vt-section-title">Collocations</p><p>{tips.collocations.join(" · ")}</p></div>
        )}
        {revealed && tips.common_mistakes && tips.common_mistakes.length > 0 && (
          <div className="sp-card vt-box"><p className="vt-section-title">Watch out</p>
            <ul className="vt-bullets">{tips.common_mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
      </div>

      {/* centre */}
      <div className="vt-col">
        <div className="sp-card vt-card vt-l1-card">
          <p className="vt-es">{ex.spanish}</p>
          <div className="vt-badges">
            {tips.gender && <span className="sp-tag aqua">{tips.gender}</span>}
            {tips.frequency && <span className="sp-tag ghost">{tips.frequency}</span>}
            {tips.pronunciation && <span className="sp-tag ghost">/{tips.pronunciation}/</span>}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SpeakButton text={ex.spanish ?? ""} label="Listen" />
          </div>
          {revealed ? (
            <>
              <div className="vt-divider" />
              <p className="vt-en">{ex.english}</p>
              <p className="vt-section-title" style={{ textAlign: "center" }}>How well do you know it?</p>
              <div className="vt-rates" style={{ marginTop: 10 }}>
                <button className="sp-btn sp-btn-ghost" disabled={submitting} onClick={() => onSubmit({ rating: "no_idea" })}>No idea</button>
                <button className="sp-btn sp-btn-soft" disabled={submitting} onClick={() => onSubmit({ rating: "shaky" })}>Shaky</button>
                <button className="sp-btn sp-btn-primary" disabled={submitting} onClick={() => onSubmit({ rating: "know" })}>I know it</button>
              </div>
            </>
          ) : (
            <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} onClick={() => setRevealed(true)}>Show</button>
          )}
        </div>

        {revealed && tips.example_sentences && tips.example_sentences.length > 0 && (
          <div className="sp-card vt-box"><p className="vt-section-title">Examples</p>
            <ul className="vt-list">{tips.example_sentences.map((s, i) => (
              <li key={i}>
                <button type="button" className="vt-play" onClick={() => playEs(s.es)} title="Play">
                  <i>{s.es}</i><span className="vt-dim"> — {s.en}</span>
                </button>
              </li>
            ))}</ul>
          </div>
        )}
      </div>

      {/* right */}
      <div className="vt-col">
        {revealed && tips.chunks && tips.chunks.length > 0 && (
          <div className="sp-card vt-box"><p className="vt-section-title">Chunks</p>
            <ul className="vt-list">{tips.chunks.map((c, i) => (
              <li key={i}>
                <button type="button" className="vt-play" onClick={() => playEs(c.es)} title="Play">
                  <b>{c.es}</b><span className="vt-dim"> — {c.en}</span>
                </button>
              </li>
            ))}</ul>
          </div>
        )}
        {revealed && tips.synonyms && tips.synonyms.length > 0 && (
          <div className="sp-card vt-box"><p className="vt-section-title">Synonyms</p><p>{tips.synonyms.join(", ")}</p></div>
        )}
        {revealed && tips.antonyms && tips.antonyms.length > 0 && (
          <div className="sp-card vt-box"><p className="vt-section-title">Antonyms</p><p>{tips.antonyms.join(", ")}</p></div>
        )}
      </div>
    </div>
  );
}

function TypedExercise({ card, submitting, onSubmit }: {
  card: VocabCard; submitting: boolean; onSubmit: (p: { answer: string }) => void;
}) {
  const [value, setValue] = useState("");
  const ex = card.exercise;
  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit({ answer: value }); }}>
      {card.level === 2 && ex.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ex.image_url} alt="" className="vt-img" />
      )}
      {card.level === 4 ? <p className="vt-sentence">{ex.sentence}</p> : <p className="vt-prompt">{ex.english}</p>}
      {card.level === 2 && ex.letters && <p className="vt-letters">{ex.letters.join(" ")}</p>}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <SpeakButton text={ex.spanish ?? ""} label="Pronounce" />
      </div>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type in Spanish…"
        className="gr-input" style={{ textAlign: "center" }} />
      <button type="submit" className="sp-btn sp-btn-primary" disabled={submitting || !value.trim()}>Check</button>
    </form>
  );
}

function LevelFive({ card, submitting, onSubmit }: {
  card: VocabCard; submitting: boolean; onSubmit: (p: { answer: string }) => void;
}) {
  const [value, setValue] = useState("");
  const ex = card.exercise;
  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit({ answer: value }); }}>
      <p className="sp-sub" style={{ marginBottom: 4 }}>Write a sentence using</p>
      <p className="vt-es">{ex.spanish}</p>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <SpeakButton text={ex.spanish ?? ""} label="Listen" />
      </div>
      <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} rows={3} placeholder="Escribe una frase…"
        className="gr-input" style={{ resize: "vertical" }} />
      <button type="submit" className="sp-btn sp-btn-primary" disabled={submitting || !value.trim()}>
        {submitting ? "Grading…" : "Submit"}
      </button>
    </form>
  );
}
