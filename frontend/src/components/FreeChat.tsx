"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { speakingApi, vocabApi } from "@/lib/api";
import type { SpeakingTurnResult, VocabListItem } from "@/types";
import AIVoiceButton from "@/components/AIVoiceButton";
import PronunciationPractice from "@/components/PronunciationPractice";

// Minimal local icon set (the shared Icon lives inside AppShell and isn't
// importable). Only the handful this screen needs.
function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor", xmlns: "http://www.w3.org/2000/svg" };
  switch (name) {
    case "coffee":
      return <svg {...p}><path d="M4 8h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="4" y="19" width="12" height="1.8" rx="0.9" /></svg>;
    case "people":
      return <svg {...p}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.4" /><path d="M3 19a6 6 0 0 1 12 0v1H3v-1Z" /><path d="M15 20v-1a7 7 0 0 0-1.2-3.9A4.5 4.5 0 0 1 21 19v1h-6Z" /></svg>;
    case "globe":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>;
    case "chat":
      return <svg {...p}><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /></svg>;
    case "speaker":
      return <svg {...p}><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 8.5a4 4 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
    case "mic":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3M9 21h6" /></svg>;
    case "check":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 6" /></svg>;
    case "chevron":
    default:
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;
  }
}

/* Free conversation with the AI (Speaking tab). The learner picks a scenario
   (or open chat), then holds a live back-and-forth: the NPC replies in
   character, speaks aloud, and quietly corrects mistakes. Reuses the same turn
   engine as the mission Final Challenge, just not tied to a mission. */

// A talking point plus the English keywords used to spot which of the
// learner's own known words would help answer it (matched against
// VocabListItem.english — see relevantWords in GoalsPanel).
type Objective = { text: string; keywords: string[] };

type Scenario = {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  role: string;      // NPC persona, Spanish
  role_en: string;
  setting: string;
  goal: string;
  opening: string;   // NPC's cold-open line (Spanish)
  opening_en: string;
  // Concrete, doable talking points for this scene — kept to things a
  // beginner can say with common vocabulary, not aspirational topics.
  objectives: Objective[];
};

const SCENARIOS: Scenario[] = [
  {
    id: "cafe", label: "At a café", icon: "coffee",
    blurb: "Order a drink and something to eat.",
    role: "camarero", role_en: "waiter", setting: "a café in Spain",
    goal: "Take the customer's order and chat a little.",
    opening: "¡Hola! Buenos días. ¿Qué le pongo?", opening_en: "Hi! Good morning. What can I get you?",
    objectives: [
      { text: "Say hello and ask for the menu", keywords: ["hello", "hi", "good morning", "good afternoon", "please", "menu"] },
      { text: "Order a drink and something to eat", keywords: ["coffee", "tea", "water", "juice", "beer", "wine", "milk", "drink", "eat", "food", "bread", "cake", "sandwich", "want", "would like", "i'd like"] },
      { text: "Ask how much it costs", keywords: ["how much", "cost", "price", "euro", "money", "pay"] },
      { text: "Say thank you and goodbye", keywords: ["thank you", "thanks", "goodbye", "bye", "see you"] },
    ],
  },
  {
    id: "directions", label: "Asking directions", icon: "globe",
    blurb: "Ask how to get somewhere and understand the answer.",
    role: "una persona en la calle", role_en: "a passerby", setting: "a street in Madrid",
    goal: "Help the person find their way.",
    opening: "¿Hola? ¿Necesitas ayuda con algo?", opening_en: "Hello? Do you need help with something?",
    objectives: [
      { text: "Greet them and say you need help", keywords: ["hello", "hi", "excuse me", "help", "please"] },
      { text: "Say where you want to go", keywords: ["street", "station", "museum", "hotel", "beach", "park", "market", "church", "airport", "where", "go", "looking for"] },
      { text: "Ask if it's near or far", keywords: ["near", "far", "close", "how far", "walk", "left", "right", "straight"] },
      { text: "Thank them for the help", keywords: ["thank you", "thanks", "goodbye", "bye"] },
    ],
  },
  {
    id: "smalltalk", label: "Meeting someone", icon: "people",
    blurb: "Introduce yourself and make small talk.",
    role: "una persona nueva", role_en: "someone new", setting: "a relaxed meetup",
    goal: "Get to know each other — names, where you're from, interests.",
    opening: "¡Hola! Encantada. ¿Cómo te llamas?", opening_en: "Hi! Nice to meet you. What's your name?",
    objectives: [
      { text: "Say your name", keywords: ["name", "call", "i am", "i'm", "my name is"] },
      { text: "Say where you are from", keywords: ["from", "country", "city", "live", "spain", "born"] },
      { text: "Ask their name and where they're from", keywords: ["what", "where", "you", "your name"] },
      { text: "Mention something you like", keywords: ["like", "love", "favorite", "music", "food", "sport", "movie", "book", "hobby"] },
    ],
  },
  {
    id: "free", label: "Open chat", icon: "chat",
    blurb: "Talk about anything — no goal, just practise.",
    role: "un hablante nativo amable", role_en: "a friendly native speaker", setting: "a casual conversation",
    goal: "Keep a natural, encouraging conversation going about whatever comes up.",
    opening: "¡Hola! ¿De qué te gustaría hablar hoy?", opening_en: "Hi! What would you like to talk about today?",
    objectives: [
      { text: "Say hello and how you're doing", keywords: ["hello", "hi", "how are you", "fine", "well", "good", "tired", "happy"] },
      { text: "Talk about your day or plans", keywords: ["today", "tomorrow", "work", "study", "weekend", "plan", "go", "did", "going to"] },
      { text: "Ask the other person a question", keywords: ["what", "how", "why", "when", "you", "do you"] },
      { text: "Say goodbye when you're done", keywords: ["goodbye", "bye", "see you", "take care"] },
    ],
  },
];

// Fisher-Yates-lite: enough shuffling for a small suggestion list.
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Speak Spanish via the browser's own voice — last-resort fallback when the
// ElevenLabs backend call fails (key unset, network, etc). Resolves once
// playback actually finishes, so callers can safely re-arm the mic afterward
// instead of racing the audio.
function speakBrowser(text: string): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return Promise.resolve();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.95;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith("es"));
  if (v) u.voice = v;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    u.onend = finish;
    u.onerror = finish;
    // Chrome has a long-standing bug where onend/onerror silently never fire
    // (notably once the tab loses focus) — without a fallback, callers that
    // await this (e.g. re-arming the mic afterward) hang forever, which looks
    // like "the AI stops listening after one reply." Cap the wait at a
    // generous estimate of how long the utterance itself should take.
    const timeoutMs = Math.max(4000, text.length * 120);
    setTimeout(finish, timeoutMs);
    window.speechSynthesis.speak(u);
  });
}

// Bumped on every speak() call so a stale call (e.g. React StrictMode's
// dev-only double-invoke of the opening-line effect, or any other accidental
// double-trigger) can tell it's been superseded and skip playing entirely,
// instead of layering two voices reading the same line.
let speakGeneration = 0;

// Speak Spanish via the backend's ElevenLabs voice (services.speech_engine).
// Falls back to the browser's own voice if the ElevenLabs call fails (key
// unset, network hiccup, quota) so a reply is never silently dropped.
async function speak(text: string): Promise<void> {
  if (!text) return;
  const myGeneration = ++speakGeneration;
  const superseded = () => myGeneration !== speakGeneration;
  try {
    const blob = await speakingApi.speak(text);
    if (superseded()) return;
    const url = URL.createObjectURL(blob);
    try {
      await new Promise<void>((resolve, reject) => {
        if (superseded()) { resolve(); return; }
        const audio = new Audio(url);
        let settled = false;
        const finish = () => { if (settled) return; settled = true; resolve(); };
        const fail = (err: unknown) => { if (settled) return; settled = true; reject(err); };
        audio.onended = finish;
        audio.onerror = () => fail(new Error("Audio element error"));
        const timeoutMs = Math.max(4000, text.length * 120);
        setTimeout(finish, timeoutMs);
        // play() rejects on autoplay-policy blocks, decode failures, etc — a
        // caught-and-swallowed rejection here used to look like "the AI never
        // speaks," with no error and no fallback. Reject up to the outer
        // catch instead, so it falls back to the browser voice.
        audio.play().catch(fail);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if (superseded()) return;
    console.warn("ElevenLabs playback failed, falling back to browser voice:", err);
    await speakBrowser(text);
  }
}

// Minimal Web Speech API SpeechRecognition wrapper (Chrome/Edge/Safari). When
// unsupported, callers fall back to the text box.
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
  start: () => void; stop: () => void;
};
function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
// If a session dies faster than this after starting, the browser/mic combo
// can't hold a recognition session open — auto-restarting anyway spins in a
// tight loop (the tab's recording indicator flickering on every tick,
// without ever capturing real speech).
const MIN_SESSION_MS = 300;

// Fires once the learner has been silent for `pauseMs` after saying
// something — the caller's cue to auto-send without a Send click, so the
// mic can just stay on for a continuous back-and-forth.
function useSpeechInput(pauseMs = 1400, onSilence?: (text: string, confidence: number | null) => void) {
  const Ctor = useMemo(() => getRecognitionCtor(), []);
  const [listening, setListening] = useState(false);
  // On/off intent — unlike `listening`, this stays true through the muted
  // gap between "learner paused" and "mic resumes after the NPC reply", so
  // UI toggles reflect "hands-free mode is on" rather than the moment-to-
  // moment engine state.
  const [handsFree, setHandsFree] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const recRef = useRef<Recognition | null>(null);
  // Whether the user still wants the mic on — distinct from `listening`,
  // which tracks the underlying engine's (unreliable) session state. Chrome
  // ends a recognition session on any brief pause even with continuous=true,
  // and again after ~60s regardless; onend restarts it while this is true,
  // instead of dropping whatever the learner already said.
  const wanted = useRef(false);
  // True between "the learner just paused, hand the utterance off" and
  // resume() being called once the NPC's reply is fully shown — engine
  // restarts are suppressed while this is set, so the mic doesn't sit there
  // capturing dead air (or the caller's own TTS, briefly) while the reply
  // streams in.
  const pausedRef = useRef(false);
  // When the current session started — lets onend tell "engine forced a
  // normal ~60s-cap restart" apart from "this browser/mic combo can't hold a
  // session open at all," which otherwise auto-restarts in a tight loop
  // (visible as the tab's recording indicator flickering on every tick,
  // never actually capturing anything).
  const sessionStartedAt = useRef(0);
  // Finalized text from sessions the engine has already closed (restarts
  // reset the engine's own result list, so this is how it survives across
  // them). Kept separate from the current session's own finalized text,
  // which e.results reports cumulatively on every onresult call — appending
  // that each time (the previous bug) re-added already-finalized words on
  // every subsequent word, e.g. "hola" said once became "hola hola hola...".
  const priorFinal = useRef("");
  const sessionFinal = useRef("");
  const confidenceRef = useRef<number | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSilenceRef = useRef(onSilence);
  useEffect(() => { onSilenceRef.current = onSilence; }, [onSilence]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  }, []);

  const armSilenceTimer = useCallback(() => {
    if (!onSilenceRef.current) return;
    clearSilenceTimer();
    silenceTimer.current = setTimeout(() => {
      const text = [priorFinal.current, sessionFinal.current].filter(Boolean).join(" ").trim();
      if (!text) return;
      priorFinal.current = "";
      sessionFinal.current = "";
      setTranscript("");
      pausedRef.current = true;
      recRef.current?.stop();
      onSilenceRef.current?.(text, confidenceRef.current);
    }, pauseMs);
  }, [pauseMs, clearSilenceTimer]);

  // Holds the latest `attach` so its own onend handler can re-attach a fresh
  // Recognition instance without a self-referential (TDZ-unsafe) closure.
  const attachRef = useRef<(rec: Recognition) => void>(() => {});

  const attach = useCallback((rec: Recognition) => {
    rec.lang = "es-ES";
    rec.interimResults = true;
    rec.continuous = true;
    // Sessions get replaced often (pause-on-silence, resume-after-reply,
    // Chrome's own forced restarts) — a callback firing late from an instance
    // that's already been superseded must not touch shared state, or it can
    // spawn a second, competing Recognition (which then makes neither one
    // pick anything up).
    const isCurrent = () => recRef.current === rec;
    rec.onresult = (e) => {
      if (!isCurrent()) return;
      let finalized = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i] as unknown as { 0: { transcript: string; confidence: number }; isFinal: boolean };
        if (r.isFinal) finalized += r[0].transcript;
        else interim += r[0].transcript;
      }
      // e.results (and thus `finalized`) is the whole current session's
      // finalized text so far — overwrite, don't append.
      sessionFinal.current = finalized.trim();
      const parts = [priorFinal.current, sessionFinal.current].filter(Boolean);
      setTranscript(parts.join(" ") + (interim ? (parts.length ? " " : "") + interim : ""));
      const last = e.results[e.results.length - 1]?.[0]?.confidence;
      if (typeof last === "number" && !Number.isNaN(last)) { setConfidence(last); confidenceRef.current = last; }
      armSilenceTimer();
    };
    rec.onend = () => {
      if (!isCurrent()) return;
      const livedMs = Date.now() - sessionStartedAt.current;
      if (livedMs < MIN_SESSION_MS) {
        // This browser/mic can't keep a session open at all — restarting
        // would just spin forever, hammering the recording indicator without
        // ever capturing speech. Give up instead of looping.
        console.warn(`Speech recognition session ended after only ${livedMs}ms — stopping instead of restart-looping.`);
        wanted.current = false;
        clearSilenceTimer();
        setListening(false);
        setHandsFree(false);
        return;
      }
      if (wanted.current && !pausedRef.current && Ctor) {
        // Engine's own forced session end (natural micro-pause, ~60s cap) —
        // fold this session's finalized text in and keep listening.
        priorFinal.current = [priorFinal.current, sessionFinal.current].filter(Boolean).join(" ");
        sessionFinal.current = "";
        const next = new Ctor();
        attachRef.current(next);
        recRef.current = next;
        sessionStartedAt.current = Date.now();
        next.start();
      } else {
        setListening(false);
      }
    };
    rec.onerror = (e) => {
      if (!isCurrent()) return;
      // "no-speech" is just silence since start/last restart — let onend
      // restart it as usual. "aborted" fires whenever *we* call .stop()
      // ourselves (the pause-to-mute-during-TTS dance below does this every
      // turn) — expected, not a real failure. Anything else (mic denied,
      // hardware gone, network unreachable — Chrome's recognizer is cloud-
      // based, so a "recording" indicator with zero results usually means
      // this fired with "network" or "service-not-allowed") is a genuine stop.
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn(`Speech recognition error: "${e.error}" — stopping hands-free mode.`);
        wanted.current = false;
        clearSilenceTimer();
        setListening(false);
        setHandsFree(false);
      }
    };
  }, [Ctor, armSilenceTimer, clearSilenceTimer]);
  useEffect(() => { attachRef.current = attach; }, [attach]);

  const stop = useCallback(() => {
    wanted.current = false;
    pausedRef.current = false;
    clearSilenceTimer();
    recRef.current?.stop();
    setListening(false);
    setHandsFree(false);
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    if (!Ctor) return;
    window.speechSynthesis?.cancel();
    wanted.current = true;
    pausedRef.current = false;
    priorFinal.current = "";
    sessionFinal.current = "";
    setTranscript("");
    setConfidence(null);
    confidenceRef.current = null;
    const rec = new Ctor();
    attach(rec);
    recRef.current = rec;
    sessionStartedAt.current = Date.now();
    setListening(true);
    setHandsFree(true);
    rec.start();
  }, [Ctor, attach]);

  // Re-arms the mic after a paused turn (the NPC finished speaking) — a
  // no-op if hands-free mode isn't active or nothing is actually paused.
  const resume = useCallback(() => {
    if (!Ctor || !wanted.current || !pausedRef.current) return;
    pausedRef.current = false;
    const rec = new Ctor();
    attach(rec);
    recRef.current = rec;
    sessionStartedAt.current = Date.now();
    setListening(true);
    rec.start();
  }, [Ctor, attach]);

  useEffect(() => () => clearSilenceTimer(), [clearSilenceTimer]);

  return { supported: !!Ctor, listening, handsFree, transcript, confidence, start, stop, resume, setTranscript };
}

type ChatLine = { speaker: "npc" | "learner"; text: string; correction?: string };

// Which scenarios the learner has already completed (hit every objective and
// got the AI's closing line). No backend field for this yet, so it's kept in
// localStorage — good enough to split the picker into "new" vs "completed"
// across visits without needing a migration.
const COMPLETED_KEY = "sp-completed-scenarios";
function loadCompleted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COMPLETED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveCompleted(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPLETED_KEY, JSON.stringify([...ids]));
}

type SpeakingView = "picker" | "pronunciation";

export default function FreeChat() {
  const [view, setView] = useState<SpeakingView>("picker");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => loadCompleted());
  const markCompleted = useCallback((id: string) => {
    setCompletedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveCompleted(next);
      return next;
    });
  }, []);

  if (view === "pronunciation") {
    return <PronunciationPractice onExit={() => setView("picker")} speak={speak} />;
  }
  if (scenario) {
    return (
      <Conversation
        key={scenario.id}
        scenario={scenario}
        onExit={() => setScenario(null)}
        onCompleted={() => markCompleted(scenario.id)}
      />
    );
  }
  return (
    <ScenarioPicker
      onPick={setScenario}
      onPickPronunciation={() => setView("pronunciation")}
      completedIds={completedIds}
    />
  );
}

function ScenarioCard({ s, onPick }: { s: Scenario; onPick: (s: Scenario) => void }) {
  return (
    <button className="sp-card quick sp-mode" onClick={() => onPick(s)} style={{ textAlign: "left", cursor: "pointer" }}>
      <div className="q-ico"><Icon name={s.icon} size={22} /></div>
      <div>
        <div className="q-name">{s.label}</div>
        <div className="q-sub">{s.blurb}</div>
      </div>
      <span className="sp-tag"><Icon name="chevron" size={14} /></span>
    </button>
  );
}

function PronunciationCard({ onPick }: { onPick: () => void }) {
  return (
    <button className="sp-card quick sp-mode" onClick={onPick} style={{ textAlign: "left", cursor: "pointer" }}>
      <div className="q-ico"><Icon name="mic" size={22} /></div>
      <div>
        <div className="q-name">Pronunciation</div>
        <div className="q-sub">Practise saying words and get feedback on where you&apos;re struggling.</div>
      </div>
      <span className="sp-tag"><Icon name="chevron" size={14} /></span>
    </button>
  );
}

function ScenarioPicker({
  onPick,
  onPickPronunciation,
  completedIds,
}: {
  onPick: (s: Scenario) => void;
  onPickPronunciation: () => void;
  completedIds: Set<string>;
}) {
  const openChat = SCENARIOS.find((s) => s.id === "free")!;
  const rest = SCENARIOS.filter((s) => s.id !== "free");
  const newScenarios = rest.filter((s) => !completedIds.has(s.id));
  const completedScenarios = rest.filter((s) => completedIds.has(s.id));

  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Speaking</p>
        <h1 className="sp-h1">Have a chat about...</h1>
      </div>

      <div className="sp-mode-section">
        <div className="quick-row sp-modes">
          <ScenarioCard s={openChat} onPick={onPick} />
          <PronunciationCard onPick={onPickPronunciation} />
        </div>
      </div>

      {newScenarios.length > 0 && (
        <div className="sp-mode-section">
          <p className="sp-section-label">New chats</p>
          <div className="quick-row sp-modes">
            {newScenarios.map((s) => <ScenarioCard key={s.id} s={s} onPick={onPick} />)}
          </div>
        </div>
      )}

      {completedScenarios.length > 0 && (
        <div className="sp-mode-section">
          <p className="sp-section-label">Completed chats</p>
          <div className="quick-row sp-modes">
            {completedScenarios.map((s) => <ScenarioCard key={s.id} s={s} onPick={onPick} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// Splits Spanish text into word / non-word runs, so each word can be
// checked against the learner's known deck and rendered separately.
const WORD_RUN = /[A-Za-zÀ-ÿ]+(?:'[A-Za-zÀ-ÿ]+)?|[^A-Za-zÀ-ÿ]+/g;
function tokenize(text: string): string[] {
  return text.match(WORD_RUN) ?? [text];
}
function isWord(token: string): boolean {
  return /[A-Za-zÀ-ÿ]/.test(token);
}

// Lowercase, strip accents/punctuation, collapse whitespace — so a correction
// that's really just the learner's own (correct) sentence restated with
// different capitalization/punctuation/accents is recognized as "no real
// correction" rather than shown as one.
function normalizeForCompare(text: string): string {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Fixed expressions whose meaning isn't just the sum of their words (a
// beginner can know "buenos" and "días" separately and still not click that
// "buenos días" together means "good morning") — matched and glossed as one
// unit instead of word-by-word. Sorted longest-first below so a longer phrase
// wins over a shorter one starting at the same spot (e.g. "cómo te llamas"
// over "cómo").
const COMMON_PHRASES = [
  "buenos días", "buenas tardes", "buenas noches", "por favor", "de nada",
  "lo siento", "mucho gusto", "hasta luego", "hasta pronto", "qué tal",
  "cuánto cuesta", "cuánto es", "cómo estás", "cómo te llamas", "me llamo",
  "encantado de conocerte", "encantada de conocerte", "con permiso",
  "no pasa nada", "qué hora es", "para llevar", "aquí tienes",
  "muchas gracias", "buen provecho", "a la derecha", "a la izquierda",
  "todo recto", "qué te pongo", "qué le pongo", "de dónde eres",
  "mucho gusto en conocerte",
];
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const PHRASE_RE = new RegExp(
  [...COMMON_PHRASES].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|"),
  "gi"
);

type TextSegment = { text: string; phrase: boolean };
// Splits `text` into phrase matches and the plain runs between them, so the
// caller can render known multi-word phrases as one glossable unit.
function splitPhrases(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  PHRASE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PHRASE_RE.exec(text))) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), phrase: false });
    segments.push({ text: m[0], phrase: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), phrase: false });
  return segments;
}

// Translations fetched via /vocab/translate, cached across the whole tab
// session so hovering the same word twice (or across turns) never re-fetches.
const glossCache = new Map<string, string>();

// One word the AI just said that the learner hasn't saved to their deck —
// underlined and glowing, with the English gloss shown only on hover (fetched
// lazily, once, the first time it's hovered).
function UnknownWord({ word }: { word: string }) {
  const key = word.toLowerCase();
  const [gloss, setGloss] = useState<string | null>(() => glossCache.get(key) ?? null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);

  const onEnter = () => {
    setHover(true);
    if (gloss || loading) return;
    const cached = glossCache.get(key);
    if (cached) { setGloss(cached); return; }
    setLoading(true);
    vocabApi.translate(word)
      .then((r) => { glossCache.set(key, r.english); setGloss(r.english); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return (
    <span
      className="fc-unknown-word"
      onMouseEnter={onEnter}
      onMouseLeave={() => setHover(false)}
    >
      {word}
      {hover && (gloss || loading) && (
        <span className="fc-word-gloss">{loading ? "…" : gloss}</span>
      )}
    </span>
  );
}

// Renders NPC Spanish text: fixed phrases ("buenos días") glossed as one
// unit, everything else word-by-word — known words plain, unknown words (not
// in the learner's deck) glossable on hover.
function SpanishText({ text, known }: { text: string; known: Set<string> }) {
  const segments = useMemo(() => splitPhrases(text), [text]);
  return (
    <>
      {segments.map((seg, si) => {
        if (seg.phrase) {
          return known.has(seg.text.toLowerCase())
            ? <span key={si}>{seg.text}</span>
            : <UnknownWord key={si} word={seg.text} />;
        }
        return tokenize(seg.text).map((t, i) =>
          isWord(t) && !known.has(t.toLowerCase())
            ? <UnknownWord key={`${si}-${i}`} word={t} />
            : <span key={`${si}-${i}`}>{t}</span>
        );
      })}
    </>
  );
}

// Does this known card look useful for answering `objective` — i.e. does its
// English translation contain (or get contained by) one of the objective's
// keywords? Substring both ways so "drink" matches both "a drink" and
// "soft drink".
function cardMatchesObjective(card: VocabListItem, objective: Objective): boolean {
  const en = card.english.toLowerCase();
  return objective.keywords.some((kw) => en.includes(kw) || kw.includes(en));
}

// Side panel: the scene's talking points, each with a handful of the
// learner's own known words (from their vocab deck) that would actually help
// answer it, so the objectives stay doable rather than aspirational. `met`
// tracks completion per objective (same order as scenario.objectives) —
// ticked off as the AI judges the learner has hit each one, and never
// un-ticked once true. `cards` is the learner's practised deck, fetched once
// by the parent Conversation (also used there to gloss unknown AI-reply words).
function GoalsPanel({ scenario, met, cards }: { scenario: Scenario; met: boolean[]; cards: VocabListItem[] }) {
  const doneCount = met.filter(Boolean).length;
  // Picked once when the deck first loads (chat opens), not re-shuffled on
  // every render — `met` changes after every AI turn, and re-sampling then
  // would make the suggested words jump around mid-conversation.
  const relatedByObjective = useMemo(
    () => scenario.objectives.map((o) => sample(cards.filter((c) => cardMatchesObjective(c, o)), 4)),
    [scenario, cards]
  );

  return (
    <aside className="fc-goals sp-card">
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>
        Goals for this chat <span className="fc-goal-count">{doneCount}/{scenario.objectives.length}</span>
      </p>
      <ul className="fc-goal-list">
        {scenario.objectives.map((o, i) => {
          const related = relatedByObjective[i];
          return (
            <li key={i} className={"fc-goal-item" + (met[i] ? " done" : "")}>
              {met[i] ? <Icon name="check" size={13} /> : <span className="fc-goal-dot" />}
              <span>
                <span>{o.text}</span>
                {!met[i] && related.length > 0 && (
                  <div className="fc-word-chips">
                    {related.map((w) => (
                      <span key={w.card_id} className="fc-word-chip" title={w.english}>{w.spanish}</span>
                    ))}
                  </div>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// How many characters to reveal per tick of the typewriter — a couple at a
// time reads as "typing" without lagging behind long replies.
const TYPE_CHARS_PER_TICK = 2;
const TYPE_TICK_MS = 16;

function Conversation({ scenario, onExit, onCompleted }: { scenario: Scenario; onExit: () => void; onCompleted: () => void }) {
  const [history, setHistory] = useState<ChatLine[]>([
    { speaker: "npc", text: scenario.opening },
  ]);
  // Mirrors `history`, updated synchronously wherever history is (see
  // updateHistory below) so runTurn can always read the latest conversation
  // without depending on (and being recreated by) `history` itself — needed
  // so the auto-fired closing turn can call a fresh runTurn right after the
  // one that completed the last objective, with no stale-closure risk.
  const historyRef = useRef<ChatLine[]>(history);
  const updateHistory = useCallback((updater: (h: ChatLine[]) => ChatLine[]) => {
    setHistory((h) => {
      const next = updater(h);
      historyRef.current = next;
      return next;
    });
  }, []);
  // The learner's practised vocab deck — fetched once, used both to gloss
  // unknown words in AI replies (below) and by GoalsPanel's related-words hints.
  const [vocabCards, setVocabCards] = useState<VocabListItem[]>([]);
  const knownWords = useMemo(
    () => new Set(vocabCards.map((c) => c.spanish.toLowerCase())),
    [vocabCards]
  );
  // Words the learner has actually practised (level > 0) are the ones worth
  // suggesting for the goals panel; fall back to the full deck for brand-new
  // accounts with nothing trained yet.
  const practisedCards = useMemo(() => {
    const known = vocabCards.filter((c) => c.level > 0);
    return known.length ? known : vocabCards;
  }, [vocabCards]);
  useEffect(() => {
    let cancelled = false;
    vocabApi.cards().then((cards) => { if (!cancelled) setVocabCards(cards); }).catch(() => setVocabCards([]));
    return () => { cancelled = true; };
  }, []);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  // True once the reply bubble has been created and is being typed out —
  // hides the "typing…" dots in favour of the real (growing) bubble.
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState("");
  // Which of the scene's objectives have been hit so far — same order as
  // scenario.objectives, only ever flips false → true.
  const [objectivesMet, setObjectivesMet] = useState<boolean[]>(() => scenario.objectives.map(() => false));
  // True once every objective is hit AND the AI's own closing message has
  // finished — the scene is over, chat locks, "Completed" banner shows.
  const [completed, setCompleted] = useState(false);
  // Guards the auto-fired closing turn so it only ever fires once.
  const closingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Typewriter machinery: SSE deltas (or the final reply, if nothing streamed)
  // land in a queue; a ticking interval peels characters off it into the
  // bubble, so the reply visibly types itself in regardless of how the
  // network happened to chunk it.
  const queueRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDrainedRef = useRef<(() => void) | null>(null);

  // A turn that arrives (via auto-send-on-pause) while the previous one is
  // still in flight waits here instead of being dropped, and fires as soon
  // as `busy` clears.
  const pendingTurn = useRef<{ text: string; confidence: number | null } | null>(null);
  // Lets runTurn re-arm (or, once the scene is complete, permanently stop)
  // the mic, without needing `mic` itself in its dependency list (mic is
  // created below from a callback that itself depends on runTurn).
  const micControls = useRef<{ resume: () => void; stop: () => void } | null>(null);

  const stopTyping = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);
  useEffect(() => () => stopTyping(), [stopTyping]);

  const ensureTyping = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      if (!queueRef.current) {
        if (onDrainedRef.current) {
          const onDrained = onDrainedRef.current;
          onDrainedRef.current = null;
          stopTyping();
          onDrained();
        }
        return;
      }
      const chunk = queueRef.current.slice(0, TYPE_CHARS_PER_TICK);
      queueRef.current = queueRef.current.slice(TYPE_CHARS_PER_TICK);
      updateHistory((h) => {
        const copy = [...h];
        copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + chunk };
        return copy;
      });
    }, TYPE_TICK_MS);
  }, [stopTyping, updateHistory]);

  // Speak the opening line once, so the scene "walks in". Guarded by a ref
  // (not just speak()'s own generation counter) so React StrictMode's dev-only
  // double-invoke of this effect doesn't even fire a second ElevenLabs call.
  const openingSpokenRef = useRef(false);
  useEffect(() => {
    if (openingSpokenRef.current) return;
    openingSpokenRef.current = true;
    speak(scenario.opening);
  }, [scenario.opening]);
  // Keep the latest line in view.
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [history, busy]);

  // `silent` is used for the one auto-fired closing turn once every
  // objective is hit: it still gets a real, dynamic reply from the AI, but
  // skips adding a (fake) learner line, and locks the scene down afterward
  // instead of re-arming the mic for another exchange.
  const runTurn = useCallback(async (utterance: string, confidence: number | null, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    setError("");
    const priorHistory = historyRef.current.map((l) => ({ speaker: l.speaker, text: l.text }));
    if (!silent) updateHistory((h) => [...h, { speaker: "learner", text: utterance }]);
    setBusy(true);
    let started = false;
    let finalNpcReply = "";
    try {
      const res: SpeakingTurnResult = await speakingApi.turn(
        {
          role: scenario.role,
          setting: scenario.setting,
          goal: scenario.goal,
          history: priorHistory,
          utterance,
          confidence: confidence ?? undefined,
          objectives: scenario.objectives.map((o) => o.text),
          recorded: confidence != null,
        },
        (delta) => {
          if (!started) {
            started = true;
            setRevealing(true);
            updateHistory((h) => [...h, { speaker: "npc", text: "" }]);
          }
          queueRef.current += delta;
          ensureTyping();
        }
      );
      finalNpcReply = res.npc_reply;
      if (!silent) {
        updateHistory((h) => {
          const copy = [...h];
          const lastLearner = [...copy].reverse().find((l) => l.speaker === "learner");
          if (
            lastLearner &&
            res.correction &&
            normalizeForCompare(res.correction) !== normalizeForCompare(lastLearner.text)
          ) {
            lastLearner.correction = res.correction;
          }
          return copy;
        });
      }
      if (res.objectives_met) {
        const hit = res.objectives_met;
        setObjectivesMet((prev) => {
          const merged = prev.map((v, i) => v || !!hit[i]);
          if (!silent && merged.every(Boolean) && !closingRef.current) {
            closingRef.current = true;
          }
          return merged;
        });
      }
      if (!started) {
        // Nothing streamed in (e.g. an instant scripted reply) — type out the
        // full reply from scratch instead of dumping it in all at once.
        setRevealing(true);
        updateHistory((h) => [...h, { speaker: "npc", text: "" }]);
        queueRef.current = res.npc_reply;
      }
      await new Promise<void>((resolve) => {
        onDrainedRef.current = resolve;
        ensureTyping();
      });
      if (!silent) setValue("");
      if (silent) {
        setCompleted(true);
        onCompleted();
        micControls.current?.stop();
      } else {
        // Unmute the instant the reply is fully shown, rather than waiting for
        // the TTS audio to finish — waiting left an ugly dead pause before the
        // learner could speak again. (Trade-off: over speakers rather than
        // headphones, the mic may catch a little of the NPC's own voice.)
        micControls.current?.resume();
      }
      void speak(finalNpcReply);
    } catch {
      stopTyping();
      queueRef.current = "";
      setError("Could not reach the conversation partner. Try again in a moment.");
    } finally {
      setBusy(false);
      setRevealing(false);
      if (!silent) micControls.current?.resume();
    }
  }, [scenario, ensureTyping, stopTyping, updateHistory, onCompleted]);

  // Auto-send: fires when the mic detects a long-enough pause, so the
  // learner can hold a hands-free back-and-forth without touching Send. If a
  // turn is already in flight, the new utterance queues instead of racing it.
  const handleAutoSend = useCallback((text: string, confidence: number | null) => {
    if (completed) return;
    if (busy) { pendingTurn.current = { text, confidence }; return; }
    void runTurn(text, confidence);
  }, [busy, completed, runTurn]);

  const mic = useSpeechInput(1400, handleAutoSend);

  useEffect(() => { micControls.current = { resume: mic.resume, stop: mic.stop }; }, [mic.resume, mic.stop]);

  // Fire a turn that queued up while the previous one was still in flight.
  useEffect(() => {
    if (!busy && pendingTurn.current) {
      const { text, confidence } = pendingTurn.current;
      pendingTurn.current = null;
      void runTurn(text, confidence);
    }
  }, [busy, runTurn]);

  // Every objective just got hit (closingRef flips true inside runTurn,
  // synchronously with the state update above) — have the AI send one real
  // closing line, once the turn that completed the last objective is fully
  // done, then lock the scene.
  useEffect(() => {
    if (closingRef.current && !busy && !completed) {
      void runTurn(
        "(No digas nada más — despídete de forma natural y cierra la conversación en una o dos frases.)",
        null,
        { silent: true }
      );
    }
  }, [busy, completed, runTurn]);

  const send = useCallback(() => {
    const utterance = (mic.handsFree ? mic.transcript : value).trim();
    if (!utterance || busy || completed) return;
    if (mic.handsFree) { mic.stop(); setValue(utterance); }
    void runTurn(utterance, mic.confidence ?? null);
  }, [mic, value, busy, completed, runTurn]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", margin: "0 0 16px" }}>
        <button
          type="button"
          className="sp-btn"
          onClick={onExit}
          aria-label="Back to scenarios"
          title="Back to scenarios"
        >
          <Icon name="chevron" size={16} /> Back
        </button>
        <div>
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Speaking · {scenario.label}</p>
          <h1 className="sp-h1" style={{ fontSize: "clamp(20px, 3vw, 28px)" }}>Chatting with {scenario.role_en}</h1>
        </div>
      </div>

      <div className="fc-layout">
        <div className="fc-spacer" aria-hidden="true" />
        <div className="fc-main">
          {/* Same chat-thread layout as ListeningSession (.ls-chat/.ls-thread):
              messages accumulate in a scrolling thread; the learner's own
              turns render as the "second character" bubble (gl-line.you),
              same as the NPC's — a real chat, not a transcript with a form
              bolted underneath. */}
          <div className="ls-chat">
            <div ref={scrollRef} className="ls-thread">
              {history.map((l, i) => (
                <div key={i} className={"gl-line" + (l.speaker === "learner" ? " you" : "")}>
                  <span className="gl-who">{l.speaker === "learner" ? "You" : scenario.role_en}</span>
                  <span className="gl-bubble" style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <span>{l.speaker === "npc" ? <SpanishText text={l.text} known={knownWords} /> : l.text}</span>
                    {l.correction && (
                      <span className="fc-correction">
                        <Icon name="check" size={12} /> {l.correction}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {mic.listening && mic.transcript && (
                // Live preview of what's being heard, updated on every partial
                // result — replaced by the real bubble the instant the pause
                // fires and the turn is sent (transcript clears then, right
                // before runTurn pushes the finalized line onto history).
                <div className="gl-line you">
                  <span className="gl-who">You</span>
                  <span className="gl-bubble fc-live-transcript">{mic.transcript}</span>
                </div>
              )}
              {busy && !revealing && (
                <div className="gl-line">
                  <span className="gl-who">{scenario.role_en}</span>
                  <span className="gl-bubble fc-typing"><i /><i /><i /></span>
                </div>
              )}
            </div>

            {!completed && mic.supported && (
              <div className="ls-dock ls-dock-plain fc-mic-dock">
                <AIVoiceButton
                  // Reflects whether the engine can actually hear the learner
                  // right now, not just "hands-free mode is on" — mic.handsFree
                  // stays true through the muted gap between "learner paused"
                  // and "mic resumes once the reply is shown," so the animation
                  // should sit still through that gap rather than keep spinning
                  // as if still listening.
                  active={mic.listening}
                  onToggle={() => { if (mic.handsFree) send(); else mic.start(); }}
                />
              </div>
            )}

            {!completed && !mic.supported && (
              <div className="ls-dock ls-dock-plain">
                <form className="ls-dock-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Type in Spanish…"
                    className="gr-input"
                    disabled={busy}
                  />
                  <button type="submit" className="sp-btn sp-btn-primary" disabled={!value.trim() || busy}>
                    Send <Icon name="chevron" size={15} />
                  </button>
                </form>
              </div>
            )}
          </div>

          {completed && (
            <div className="fc-done">
              <div className="fc-done-badge"><Icon name="check" size={18} /></div>
              <div className="fc-done-txt">
                <b>Chat complete</b>
                <span>You hit every goal for this scene.</span>
              </div>
              <button className="sp-btn sp-btn-soft" onClick={onExit}>New chat</button>
            </div>
          )}

          {error && <p className="sp-sub" style={{ marginTop: 10, color: "var(--ink)" }}>{error}</p>}
          {!mic.supported && (
            <p className="sp-sub" style={{ marginTop: 10 }}>Tip: use Chrome or Edge to speak your replies out loud; here you can type them.</p>
          )}
        </div>

        <GoalsPanel scenario={scenario} met={objectivesMet} cards={practisedCards} />
      </div>
    </div>
  );
}
