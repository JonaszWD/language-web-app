"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VocabAnswer, VocabCard } from "@/types";
import { ApiError, vocabApi } from "@/lib/api";
import VocabTipStrip from "@/components/VocabTipStrip";
import SpeakButton from "@/components/SpeakButton";

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

/**
 * The 5-level vocabulary trainer — identical exercises, information and levels
 * whether it runs on the Vocabulary tab (/vocab) or inside a mission's
 * Vocabulary step. Pass `missionId` to restrict the pool to a mission's words.
 */
export default function VocabTrainer({
  missionId,
  words,
  advanceThreshold,
  missionVocabLevels,
  onBack,
  onDone,
  backLabel = "Back",
  emptyTitle = "Nothing due!",
  onAuthError,
}: {
  missionId?: string;
  /** Narrow the mission's pool to this subset — one burst of its vocab. */
  words?: string[];
  /**
   * When set, the session ends as soon as every word in `missionVocabLevels`
   * reaches this level — not when the queue drains (which would require full
   * mastery, i.e. level 5). Mastery keeps accruing later via ordinary FSRS
   * review, interleaved with every other mission's words.
   */
  advanceThreshold?: number;
  missionVocabLevels?: { es: string; level?: number | null }[];
  onBack: () => void;
  /** Shown as the empty-state action when set (e.g. advance the mission step). */
  onDone?: () => void;
  backLabel?: string;
  emptyTitle?: string;
  onAuthError?: () => void;
}) {
  const [card, setCard] = useState<VocabCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VocabAnswer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  // The user's last submitted answer — used to diff against the correct word.
  const [lastAnswer, setLastAnswer] = useState("");
  // Background performance telemetry (silent): time the card was shown, and how
  // many hints the user revealed on it. Reset whenever a new card loads.
  const startedAt = useRef(0);
  const hintCount = useRef(0);

  // Words this session must reach `advanceThreshold` for, and which of them
  // already have (seeded from the mission's current per-word levels, then kept
  // current from each answer). The argument expression only matters on the
  // very first render — React ignores it thereafter — so this stays a one-time
  // seed even though it's recomputed (cheaply) on every render.
  const targetWords = useRef<Set<string>>(
    new Set(advanceThreshold != null ? (missionVocabLevels ?? []).map((v) => v.es.trim().toLowerCase()) : []),
  );
  const readyWords = useRef<Set<string>>(
    new Set(
      advanceThreshold != null
        ? (missionVocabLevels ?? [])
            .filter((v) => (v.level ?? 0) >= advanceThreshold)
            .map((v) => v.es.trim().toLowerCase())
        : [],
    ),
  );
  const thresholdMet = () =>
    targetWords.current.size > 0 && readyWords.current.size >= targetWords.current.size;

  const loadNext = useCallback(async () => {
    if (thresholdMet()) {
      setCard(null);
      setEmpty(true);
      setLoading(false);
      return;
    }
    try {
      const next = await vocabApi.next(missionId, words);
      setCard(next);
      setEmpty(!next);
      startedAt.current = performance.now();
      hintCount.current = 0;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onAuthError?.();
      else setError("Failed to load vocabulary");
    } finally {
      setLoading(false);
    }
  }, [missionId, words, onAuthError]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadNext(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNext]);

  // Advance without a "Loading…" flash: keep the current card/result on screen
  // while the next card is fetched, then swap it in only once it's ready.
  const advancing = useRef(false);
  const handleNext = async () => {
    if (advancing.current) return;
    advancing.current = true;
    await loadNext();
    setResult(null);
    advancing.current = false;
  };

  async function submit(payload: { answer?: string }) {
    if (!card || submitting) return;
    setLastAnswer(payload.answer ?? "");
    setSubmitting(true);
    try {
      const res = await vocabApi.answer(card.card_id, {
        ...payload,
        response_ms: Math.round(performance.now() - startedAt.current),
        hints: hintCount.current,
      });
      if (advanceThreshold != null && readyWords.current && res.level >= advanceThreshold) {
        readyWords.current.add(res.spanish.trim().toLowerCase());
      }
      setReviewed((n) => n + 1);
      setResult(res);
    } catch {
      setError("Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  const doneAction = onDone ?? onBack;
  const doneLabel = onDone ? "Continue" : "Go back";

  return (
    <div className={"vt-wrap" + (card && !error && !empty && result && card.level >= 1 && card.level <= 4 ? " wide" : "")}>
      <div className="vt-topbar" style={{ width: "100%" }}>
        <button className="vt-back" onClick={onBack}><ChevronIcon /> {backLabel}</button>
        {card && !error && !empty && <span className="vt-level">Level {card.level} · {LEVEL_LABELS[card.level]}</span>}
      </div>

      {error ? (
        <div className="sp-card vt-card">
          <p className="vt-en" style={{ color: "var(--negative)" }}>{error}</p>
          <button className="sp-btn sp-btn-primary" onClick={onBack}>Go back</button>
        </div>
      ) : loading ? (
        <div className="sp-sub" style={{ padding: 40 }}>Loading…</div>
      ) : empty || !card ? (
        <div className="sp-card vt-card">
          <div style={{ fontSize: 44, marginBottom: 8 }}>✦</div>
          <h2 className="sp-h2" style={{ marginBottom: 8 }}>{emptyTitle}</h2>
          <p className="sp-sub" style={{ marginBottom: 20 }}>
            You trained {reviewed} word{reviewed !== 1 ? "s" : ""}.
            {missionId ? " Come back later to keep them fresh." : " Save more words from a podcast or come back later."}
          </p>
          <button className="sp-btn sp-btn-primary" onClick={doneAction}>{doneLabel}</button>
        </div>
      ) : (
        <>
          <div className="vt-dots">
            {[1, 2, 3, 4, 5].map((n) => <span key={n} className={"vt-dot" + (n <= card.level ? " on" : "")} />)}
          </div>
          {result ? (
            // Levels 1-4 flank the result card with tip boxes (left/right),
            // examples underneath. Level 5 (Gemini feedback): plain panel.
            card.level >= 1 && card.level <= 4
              ? <LevelTwoReveal result={result} tips={card.tips} userAnswer={lastAnswer} onNext={handleNext} />
              : <ResultPanel result={result} onNext={handleNext} />
          ) : (
            <Exercise card={card} submitting={submitting} onSubmit={submit} />
          )}
          {/* Level 5 keeps the tip strip visible below during the exercise. */}
          {!result && card.level === 5 && <VocabTipStrip tips={card.tips} />}
        </>
      )}
    </div>
  );
}

// Accent/case-insensitive single-character normaliser (matches the backend's
// forgiving comparison) for the wrong-answer diff.
function normChar(ch: string): string {
  return ch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Position-by-position diff of the user's spelling against the correct word
// (spaces ignored, as tiles never produce them): the user's wrong letters go
// red, and the correct letters they missed go green underneath.
function WordDiff({ user, correct }: { user: string; correct: string }) {
  const u = Array.from(user.trim());
  const c = Array.from(correct.trim());
  const n = Math.max(u.length, c.length);
  const userCells: { ch: string; ok: boolean }[] = [];
  const correctCells: { ch: string; ok: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const uc = u[i] ?? "";
    const cc = c[i] ?? "";
    const ok = uc !== "" && cc !== "" && normChar(uc) === normChar(cc);
    if (uc !== "") userCells.push({ ch: uc, ok });
    if (cc !== "") correctCells.push({ ch: cc, ok });
  }
  return (
    <div className="vt-diff">
      <p className="vt-diff-label">Your answer</p>
      <p className="vt-diff-row">
        {userCells.map((x, i) => <span key={i} className={x.ok ? "" : "vt-diff-bad"}>{x.ch}</span>)}
      </p>
      <p className="vt-diff-label">Correct</p>
      <p className="vt-diff-row">
        {correctCells.map((x, i) => <span key={i} className={x.ok ? "" : "vt-diff-good"}>{x.ch}</span>)}
      </p>
    </div>
  );
}

function ResultPanel({ result, onNext, userAnswer }: { result: VocabAnswer; onNext: () => void; userAnswer?: string }) {
  const showDiff = !result.correct && !!userAnswer;
  return (
    <div className="sp-card vt-card">
      <p className="sp-h2" style={{ marginBottom: 6 }}>{result.correct ? "Correct!" : "Not quite"}</p>
      {showDiff ? (
        <WordDiff user={userAnswer!} correct={result.spanish} />
      ) : (
        <p className="sp-sub" style={{ marginBottom: 10 }}>
          The word was <b style={{ color: "var(--ink)" }}>{result.spanish}</b>
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <SpeakButton text={result.spanish} label="Listen" />
      </div>
      {result.mastered && <p className="sp-tag pink" style={{ margin: "0 auto 12px" }}>★ Mastered — level 5</p>}
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
  card: VocabCard; submitting: boolean; onSubmit: (p: { answer: string }) => void;
}) {
  if (card.level === 1) return <LevelOne card={card} submitting={submitting} onSubmit={onSubmit} />;
  if (card.level === 2) return <LevelTwo card={card} submitting={submitting} onSubmit={onSubmit} />;
  if (card.level === 3 || card.level === 4) return <TypedExercise card={card} submitting={submitting} onSubmit={onSubmit} />;
  return <LevelFive card={card} submitting={submitting} onSubmit={onSubmit} />;
}

// Level 1 — a real recall task: word front & centre, pick its meaning from 4
// options (the correct gloss shuffled among distractors by the backend). Not
// a self-rating — self-reported familiarity is an unreliable signal (the
// "fluency illusion") that lets weak items slip through as "known".
function LevelOne({ card, submitting, onSubmit }: {
  card: VocabCard; submitting: boolean; onSubmit: (p: { answer: string }) => void;
}) {
  const ex = card.exercise;
  return (
    <div className="sp-card vt-card vt-l1-card">
      <p className="vt-es">{ex.spanish}</p>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <SpeakButton text={ex.spanish ?? ""} label="Listen" />
      </div>
      <p className="vt-section-title" style={{ textAlign: "center" }}>What does this mean?</p>
      <div className="vt-rates" style={{ marginTop: 10, flexDirection: "column" }}>
        {(ex.options ?? []).map((opt, i) => (
          <button
            key={i}
            type="button"
            className="sp-btn sp-btn-soft"
            disabled={submitting}
            onClick={() => onSubmit({ answer: opt })}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// Level-2 reveal: the result card in the centre, flanked by tip boxes — chunks
// + collocations on the left, watch-out + synonyms + antonyms on the right —
// with examples full-width underneath. Same 3-column layout as level 1.
function LevelTwoReveal({ result, tips, userAnswer, onNext }: {
  result: VocabAnswer; tips: VocabCard["tips"]; userAnswer?: string; onNext: () => void;
}) {
  return (
    <div className="vt-l1-grid">
        {/* left */}
        <div className="vt-col">
          {tips.chunks && tips.chunks.length > 0 && (
            <div className="sp-card vt-box"><p className="vt-section-title">Chunks</p>
              <ul className="vt-list">{tips.chunks.map((c, i) => (
                <li key={i}><button type="button" className="vt-play" onClick={() => playEs(c.es)} title="Play"><b>{c.es}</b><span className="vt-dim"> — {c.en}</span></button></li>
              ))}</ul>
            </div>
          )}
          {tips.collocations && tips.collocations.length > 0 && (
            <div className="sp-card vt-box"><p className="vt-section-title">Collocations</p><p>{tips.collocations.join(" · ")}</p></div>
          )}
        </div>

        {/* centre: the result card, with examples directly beneath it so they
            are exactly as wide as the card */}
        <div className="vt-col">
          <ResultPanel result={result} userAnswer={userAnswer} onNext={onNext} />
          {tips.example_sentences && tips.example_sentences.length > 0 && (
            <div className="sp-card vt-box"><p className="vt-section-title">Examples</p>
              <ul className="vt-list">{tips.example_sentences.map((s, i) => (
                <li key={i}><button type="button" className="vt-play" onClick={() => playEs(s.es)} title="Play"><i>{s.es}</i><span className="vt-dim"> — {s.en}</span></button></li>
              ))}</ul>
            </div>
          )}
        </div>

        {/* right */}
        <div className="vt-col">
          {tips.common_mistakes && tips.common_mistakes.length > 0 && (
            <div className="sp-card vt-box"><p className="vt-section-title">Watch out</p>
              <ul className="vt-bullets">{tips.common_mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
          {tips.synonyms && tips.synonyms.length > 0 && (
            <div className="sp-card vt-box"><p className="vt-section-title">Synonyms</p><p>{tips.synonyms.join(", ")}</p></div>
          )}
          {tips.antonyms && tips.antonyms.length > 0 && (
            <div className="sp-card vt-box"><p className="vt-section-title">Antonyms</p><p>{tips.antonyms.join(", ")}</p></div>
          )}
        </div>
      </div>
  );
}

// Level 2 — guided spelling: image + English prompt, spell the word by tapping
// the scrambled letter tiles (no free typing, no pronounce button). The tip
// boxes appear only after Check (handled by the result view).
function LevelTwo({ card, submitting, onSubmit }: {
  card: VocabCard; submitting: boolean; onSubmit: (p: { answer: string }) => void;
}) {
  const ex = card.exercise;
  // One tile per distinct letter (a word with two "l"s shows a single "l").
  // Tiles are reusable, so one key can still spell repeated letters.
  // Ordered alphabetically, with special characters (accents, ñ, etc.) last.
  const isBasic = (c: string) => /^[a-z]$/i.test(c);
  const letters = Array.from(new Set(ex.letters ?? [])).sort((a, b) => {
    const ba = isBasic(a), bb = isBasic(b);
    if (ba !== bb) return ba ? -1 : 1;
    return a.localeCompare(b, "es");
  });
  const multiWord = (ex.spanish ?? "").trim().includes(" ");
  const [answer, setAnswer] = useState("");
  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); if (answer) onSubmit({ answer }); }}>
      {ex.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ex.image_url} alt="" className="vt-img" />
      )}
      <p className="vt-prompt">{ex.english}</p>
      <div className="vt-answer-slots">{answer || " "}</div>
      <div className="vt-keyboard">
        {letters.map((ch, i) => (
          <button type="button" key={i} className="vt-key" onClick={() => setAnswer((a) => a + ch)}>{ch}</button>
        ))}
        {multiWord && (
          <button type="button" className="vt-key vt-key-space" onClick={() => setAnswer((a) => a + " ")}>space</button>
        )}
      </div>
      <div className="vt-key-actions">
        <button type="button" className="sp-btn sp-btn-ghost" onClick={() => setAnswer((a) => a.slice(0, -1))} disabled={!answer}>⌫ Back</button>
        <button type="button" className="sp-btn sp-btn-soft" onClick={() => setAnswer("")} disabled={!answer}>Clear</button>
      </div>
      <button type="submit" className="sp-btn sp-btn-primary" disabled={submitting || !answer}>Check</button>
    </form>
  );
}

function TypedExercise({ card, submitting, onSubmit }: {
  card: VocabCard; submitting: boolean; onSubmit: (p: { answer: string }) => void;
}) {
  const [value, setValue] = useState("");
  const ex = card.exercise;
  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit({ answer: value }); }}>
      {card.level === 4 ? (
        <div className="vt-desc">
          <p className="vt-desc-es">{ex.description_es || ex.english}</p>
          {ex.description_en && <p className="vt-desc-en">{ex.description_en}</p>}
        </div>
      ) : <p className="vt-prompt">{ex.english}</p>}
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
