"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { speakingApi, vocabApi } from "@/lib/api";
import { getSR, type SRInstance } from "@/lib/speechRecognition";
import { normSent } from "@/lib/textNorm";
import { Icon } from "@/components/icons";

/* ════════════════════════ PRONUNCIATION ════════════════════════
   Say a word or phrase, get per-word feedback, and track which Spanish sounds
   give you trouble over time. Scoring runs fully in the browser: the Web
   Speech API (es-ES) returns up to five transcript alternatives, and each
   target word is matched against the closest heard word with an edit-distance
   similarity. A word the recogniser could not reconstruct is marked
   "struggle", and every sound it contains is charged a miss in the
   per-sound tally (localStorage), which drives the "Sounds to work on" panel
   and biases which practice items come up next. Each attempt's score is also
   logged to the `pronunciation` skill row for the Home dashboard. */

export const PRONUNCIATION_TALLY_KEY = "sp-pronunciation-sounds";

type Sound = { id: string; label: string; tip: string; test: RegExp };

// The classic trouble spots for English speakers. `test` runs on a lower-cased,
// accent-preserving word.
export const SOUNDS: Sound[] = [
  { id: "rr", label: "Rolled R (rr)", tip: "Trill the tongue tip against the ridge behind your top teeth — rr, and r at the start of a word.", test: /rr|^r/ },
  { id: "r", label: "Tapped R", tip: "A single quick flick of the tongue, like the tt in American \"butter\".", test: /[^r]r[^r]|[^r]r$/ },
  { id: "j", label: "J / soft G", tip: "A raspy h from the back of the throat — j, and g before e or i.", test: /j|g[ei]/ },
  { id: "ñ", label: "Ñ", tip: "Like the ny in \"canyon\" — one sound, not two.", test: /ñ/ },
  { id: "ll", label: "LL / Y", tip: "Like the y in \"yes\" in most regions — never the l in \"million\".", test: /ll|y[aeiouáéíóú]/ },
  { id: "z", label: "Z / soft C", tip: "An s sound in Latin America, th in most of Spain — z, and c before e or i.", test: /z|c[eiéí]/ },
  { id: "bv", label: "B / V", tip: "Both sound the same: a hard b at the start, softer with lips barely touching between vowels.", test: /[bv]/ },
  { id: "d", label: "Soft D", tip: "Between vowels the d softens toward the th in \"this\".", test: /[aeiouáéíóú]d[aeiouáéíóú]|d$/ },
  { id: "vowels", label: "Pure vowels", tip: "Keep a, e, i, o, u short and crisp — no gliding like English \"oh-oo\".", test: /[aeiouáéíóú]{2}/ },
];

function soundsIn(word: string): string[] {
  const w = word.toLowerCase();
  return SOUNDS.filter((s) => s.test.test(w)).map((s) => s.id);
}

type Item = { es: string; en: string; source: "deck" | "drill" };

// Built-in drills — one or two per sound so a learner with an empty deck can
// still practise every trouble spot.
const DRILLS: Item[] = [
  { es: "el perro corre rápido", en: "the dog runs fast", source: "drill" },
  { es: "el ratón y la rueda", en: "the mouse and the wheel", source: "drill" },
  { es: "pero quiero un café caro", en: "but I want an expensive coffee", source: "drill" },
  { es: "el joven toma jugo de naranja", en: "the young man drinks orange juice", source: "drill" },
  { es: "la gente generosa", en: "generous people", source: "drill" },
  { es: "mañana voy a España", en: "tomorrow I'm going to Spain", source: "drill" },
  { es: "el niño tiene un año", en: "the boy is one year old", source: "drill" },
  { es: "me llamo Guillermo y llevo una llave", en: "my name is Guillermo and I carry a key", source: "drill" },
  { es: "la cerveza en la plaza", en: "the beer in the square", source: "drill" },
  { es: "cinco zapatos azules", en: "five blue shoes", source: "drill" },
  { es: "la verdad es que vivo bien", en: "the truth is I live well", source: "drill" },
  { es: "todo el día cansado", en: "tired all day", source: "drill" },
  { es: "la ciudad tiene un buen aeropuerto", en: "the city has a good airport", source: "drill" },
  { es: "buenos días, ¿cómo está usted?", en: "good morning, how are you?", source: "drill" },
];

// ── per-sound history ─────────────────────────────────────────────
type Tally = Record<string, { hit: number; miss: number }>;

function loadTally(): Tally {
  try {
    const raw = window.localStorage.getItem(PRONUNCIATION_TALLY_KEY);
    return raw ? (JSON.parse(raw) as Tally) : {};
  } catch {
    return {};
  }
}
function saveTally(t: Tally) {
  try { window.localStorage.setItem(PRONUNCIATION_TALLY_KEY, JSON.stringify(t)); } catch { /* storage unavailable */ }
}

// ── scoring ───────────────────────────────────────────────────────
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length);
}

type WordScore = { word: string; good: boolean };
type Result = { words: WordScore[]; heard: string; score: number };

// One wrong letter in a short word (pero vs perro = 0.8) must count as a
// miss — those minimal pairs are exactly the sounds being trained — while
// longer words still tolerate a single recogniser slip (8 letters, 1 edit = 0.875).
const GOOD_THRESHOLD = 0.85;

function scoreAttempt(target: string, alternatives: string[]): Result {
  const targetWords = target.split(/\s+/).filter(Boolean);
  let best: Result | null = null;
  for (const alt of alternatives) {
    const heard = normSent(alt).split(" ").filter(Boolean);
    const words = targetWords.map((w) => {
      const t = normSent(w);
      if (!t) return { word: w, good: true };
      const top = heard.reduce((m, h) => Math.max(m, similarity(t, h)), 0);
      return { word: w, good: top >= GOOD_THRESHOLD };
    });
    const score = Math.round((words.filter((w) => w.good).length / Math.max(1, words.length)) * 100);
    if (!best || score > best.score) best = { words, heard: alt, score };
  }
  return best ?? { words: targetWords.map((w) => ({ word: w, good: false })), heard: "", score: 0 };
}

// ── component ─────────────────────────────────────────────────────
export default function PronunciationPractice({ onExit, speak }: {
  onExit: () => void;
  speak: (text: string) => Promise<void>;
}) {
  const [deck, setDeck] = useState<Item[]>([]);
  const [tally, setTally] = useState<Tally>({});
  const [item, setItem] = useState<Item | null>(null);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SRInstance | null>(null);

  useEffect(() => {
    const t = loadTally();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client-only state after mount
    setTally(t);
    setSupported(getSR() !== null);
    vocabApi.cards()
      .then((cards) => setDeck(cards.map((c) => ({ es: c.spanish, en: c.english, source: "deck" as const }))))
      .catch(() => {});
    return () => recRef.current?.stop();
  }, []);

  const pool = useMemo(() => [...deck, ...DRILLS], [deck]);

  const weakSounds = useMemo(
    () =>
      SOUNDS.map((s) => {
        const t = tally[s.id] ?? { hit: 0, miss: 0 };
        const total = t.hit + t.miss;
        return { ...s, total, accuracy: total ? t.hit / total : 1 };
      })
        .filter((s) => s.total > 0)
        .sort((a, b) => a.accuracy - b.accuracy),
    [tally],
  );

  // Prefer items containing the learner's weakest sound (when it's actually weak).
  const nextItem = () => {
    const focus = weakSounds.find((s) => s.accuracy < 0.8);
    const candidates = focus ? pool.filter((p) => p.es.split(/\s+/).some((w) => soundsIn(w).includes(focus.id))) : pool;
    const from = (candidates.length ? candidates : pool).filter((p) => p.es !== item?.es);
    setItem(from[Math.floor(Math.random() * from.length)] ?? pool[0]);
    setResult(null);
    setError("");
  };

  const record = () => {
    if (!item) return;
    const rec = getSR();
    if (!rec) { setSupported(false); return; }
    recRef.current = rec;
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 5;
    let got = false;
    rec.onresult = (e) => {
      got = true;
      const alts = Array.from(e.results[0] ?? []).map((a) => a.transcript);
      const r = scoreAttempt(item.es, alts);
      setResult(r);
      speakingApi.pronunciation(r.score).catch(() => { /* stats are best-effort */ });
      setTally((prev) => {
        const next: Tally = { ...prev };
        for (const w of r.words) {
          for (const id of soundsIn(w.word)) {
            const cur = next[id] ?? { hit: 0, miss: 0 };
            next[id] = w.good ? { ...cur, hit: cur.hit + 1 } : { ...cur, miss: cur.miss + 1 };
          }
        }
        saveTally(next);
        return next;
      });
    };
    rec.onerror = () => setError("Couldn't hear you — check microphone permission and try again.");
    rec.onend = () => {
      setRecording(false);
      if (!got) setError((e) => e || "Nothing was recognised — try speaking a little louder.");
    };
    setResult(null);
    setError("");
    setRecording(true);
    rec.start();
  };

  const stop = () => recRef.current?.stop();

  const resetHistory = () => {
    setTally({});
    saveTally({});
  };

  const struggles = result?.words.filter((w) => !w.good) ?? [];
  const tipsForAttempt = SOUNDS.filter((s) => struggles.some((w) => soundsIn(w.word).includes(s.id)));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", margin: "0 0 16px" }}>
        <button type="button" className="sp-btn" onClick={onExit} aria-label="Back to scenarios" title="Back to scenarios">
          <Icon name="chevron" size={16} /> Back
        </button>
        <div>
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Speaking · Pronunciation</p>
          <h1 className="sp-h1">Where are you struggling?</h1>
        </div>
      </div>

      {!supported && (
        <div className="sp-card gr-stage-card" style={{ marginBottom: 16 }}>
          <p className="sp-sub">
            Your browser doesn&apos;t support speech recognition. Pronunciation practice works in Chrome, Edge and Safari.
          </p>
        </div>
      )}

      <div className="pr-layout">
        <div className="sp-card gr-stage-card pr-main">
          {!item ? (
            <>
              <p className="gr-stage-hint">
                Say a word or phrase out loud and see which words came through clearly. Every attempt is tallied by
                sound (rr, j, ñ, ll…), so practice steers toward what you find hardest.
              </p>
              <p className="sp-sub" style={{ marginBottom: 18 }}>
                {deck.length ? `${deck.length} words from your deck plus ${DRILLS.length} sound drills.` : `${DRILLS.length} sound drills — save words to practise your own deck too.`}
              </p>
              <button className="sp-btn sp-btn-primary" onClick={nextItem} disabled={!supported}>
                Start <Icon name="chevron" size={16} />
              </button>
            </>
          ) : (
            <>
              <p className="sp-eyebrow">{item.source === "deck" ? "From your deck" : "Sound drill"}</p>
              <div className="pr-target">
                {result
                  ? result.words.map((w, i) => (
                    <span key={i} className={"gr-tok " + (w.good ? "good" : "bad")}>{w.word}</span>
                  ))
                  : item.es}
              </div>
              <p className="gr-notice-en">{item.en}</p>

              <div className="pr-actions">
                <button className="sp-btn sp-btn-soft" onClick={() => void speak(item.es)}>
                  <Icon name="speaker" size={16} /> Listen
                </button>
                <button
                  className={"sp-btn sp-btn-primary" + (recording ? " ls-rec is-rec" : "")}
                  onClick={recording ? stop : record}
                  disabled={!supported}
                >
                  <Mic size={16} /> {recording ? "Stop" : result ? "Try again" : "Record"}
                </button>
                <button className="sp-btn sp-btn-ghost" onClick={nextItem}>
                  Next <Icon name="chevron" size={16} />
                </button>
              </div>

              {error && <p className="pc-error">{error}</p>}
              {result && (
                <div className="pr-result">
                  <div className="ls-score-top"><span>Clarity</span><span>{result.score}%</span></div>
                  <div className="sp-progress"><i style={{ width: `${result.score}%` }} /></div>
                  <p className="sp-sub" style={{ marginTop: 10 }}>Heard: “{result.heard || "…"}”</p>
                  {tipsForAttempt.length > 0 && (
                    <ul className="pr-tips">
                      {tipsForAttempt.map((s) => (
                        <li key={s.id}><strong>{s.label}:</strong> {s.tip}</li>
                      ))}
                    </ul>
                  )}
                  {result.score === 100 && <p className="gr-fix">Every word came through clearly.</p>}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="sp-card gr-stage-card pr-side">
          <p className="sp-eyebrow" style={{ marginBottom: 12 }}>Sounds to work on</p>
          {weakSounds.length === 0 ? (
            <p className="sp-sub">No attempts yet — your per-sound accuracy builds up here as you practise.</p>
          ) : (
            <>
              <div className="ls-scores">
                {weakSounds.map((s) => (
                  <div key={s.id}>
                    <div className="ls-score-top"><span>{s.label}</span><span>{Math.round(s.accuracy * 100)}%</span></div>
                    <div className="sp-progress"><i style={{ width: `${s.accuracy * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <button className="sp-btn sp-btn-soft" onClick={resetHistory}>Reset history</button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
