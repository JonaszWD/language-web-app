"use client";

import { useState } from "react";
import SpeakButton from "@/components/SpeakButton";
import { useBlockQueue } from "@/components/lessonQueue";
import { writingApi } from "@/lib/api";
import type { WritingCoach, WritingFeedback } from "@/types";

/* ─────────────────────────────────────────────────────────────────────────
   Mission writing as slow, structured production. Writing is "slow speaking":
   the same structures met in speaking/listening reappear, but now with time to
   reflect and higher accuracy expectations. Never grammar drills or essays —
   still mission-based communication, just without time pressure.

   Full freedom is delayed. The learner moves through seven stages:
     1 Copy & adapt    — model visible, reduce fear
     2 Build           — assemble from a word bank
     3 Prompt          — English cue → sentence, no full model
     4 Context         — write within a real situation
     5 Functional      — real micro-communication tasks
     6 Message         — short, natural multi-sentence output
     7 Free            — free writing within the mission, AI-evaluated

   Correction style is supportive, never binary: a valid variant is celebrated,
   an imperfect one gets "Good attempt — a more natural way is…" (the coach
   endpoint), and multiple correct answers are accepted (local list + the AI
   coach, which okays natural variants we didn't enumerate).
   ──────────────────────────────────────────────────────────────────────── */

type Produce = { cue: string; answer: string; accept?: string[] };

export type WritingCard =
  | { kind: "intro"; mission: string; goals: string[] }
  // Stage 1: copy the model or lightly adapt it. Everything visible.
  | { kind: "copy"; stage: 1; prompt: string; model: string; note?: string }
  // Stage 2: assemble the sentence from a word bank.
  | { kind: "build"; stage: 2; prompt: string; bank: string[]; answer: string; accept?: string[] }
  // Stage 3: English cue → Spanish sentence, only a starter hint.
  | { kind: "prompt"; stage: 3; prompt: string; hint?: string; answer: string; accept?: string[] }
  // Stage 4: write within a scenario; one or more follow-up prompts.
  | { kind: "context"; stage: 4; scenario: string; hint?: string; prompts: Produce[] }
  // Stage 5: functional real-life tasks (polite request, to-go, bill…).
  | { kind: "functional"; stage: 5; prompts: (Produce & { hint?: string })[] }
  // Stage 6: a short natural message. Coach-evaluated against a target; examples
  // shown afterwards as inspiration.
  | { kind: "message"; stage: 6; prompt: string; hint?: string; target: string; examples: string[] }
  // Stage 7: free writing within the mission, graded by the AI feedback engine.
  | { kind: "free"; stage: 7; scenario: string; hint?: string };

export interface WritingLessonScript {
  title: string;
  cards: WritingCard[];
}

const STAGE_LABELS: Record<number, string> = {
  1: "Copy",
  2: "Build",
  3: "Prompt",
  4: "Context",
  5: "Functional",
  6: "Message",
  7: "Free writing",
};

// Per-mission writing scripts, keyed by mission id. A mission with no script
// falls back to the vocabulary trainer for its Writing step.
export const WRITING_LESSONS: Record<string, WritingLessonScript> = {
  "m001-coffee-shop": {
    title: "Write at a café",
    cards: [
      {
        kind: "intro",
        mission: "Write your way through a café — slowly and accurately.",
        goals: [
          "Write your order and polite requests.",
          "Handle the menu, to-go and the bill.",
          "Write a short message about being at a café.",
        ],
      },
      { kind: "copy", stage: 1, prompt: "Write your order.", model: "Quisiera un café con leche.", note: "Copy it, or swap the drink (un té, un café)." },
      { kind: "build", stage: 2, prompt: "Build your order.", bank: ["Quisiera", "un", "café", "con", "leche"], answer: "Quisiera un café con leche", accept: ["Quisiera un café"] },
      { kind: "prompt", stage: 3, prompt: "coffee with milk", hint: "Quisiera…", answer: "Quisiera un café con leche", accept: ["Quiero un café con leche", "Un café con leche, por favor"] },
      {
        kind: "context", stage: 4, scenario: "You are in a café. Write your order.", hint: "Quisiera…",
        prompts: [
          { cue: "Your order", answer: "Quisiera un café", accept: ["Quisiera un café con leche", "Quisiera un té", "Quiero un café", "Un café, por favor"] },
          { cue: "Now write what your friend orders", answer: "Mi amigo quiere un café", accept: ["Mi amiga quiere un café", "Mi amigo quiere una tostada", "Mi amigo quiere un té"] },
        ],
      },
      {
        kind: "functional", stage: 5,
        prompts: [
          { cue: "Ask politely for the menu.", hint: "¿Me puede dar…?", answer: "¿Me puede dar el menú?", accept: ["¿Me puede dar la carta?", "¿Me trae el menú?", "¿Me trae la carta?"] },
          { cue: "Say you want your food to go.", hint: "Para llevar…", answer: "Para llevar, por favor.", accept: ["Quisiera para llevar", "Para llevar"] },
          { cue: "Ask for the bill.", hint: "¿Me puede dar…?", answer: "¿Me puede dar la cuenta?", accept: ["La cuenta, por favor", "¿Me trae la cuenta?"] },
        ],
      },
      {
        kind: "message", stage: 6, prompt: "Write a message to a friend: you're at a café ordering coffee.", hint: "Estoy en… Quisiera…",
        target: "Estoy en un café. Quisiera un café con leche.",
        examples: ["Estoy en un café. Quisiera un café con leche.", "Estoy en una cafetería y voy a pedir un café."],
      },
      { kind: "free", stage: 7, scenario: "You are at a café. Write the whole interaction: greet the waiter, order a coffee with milk, ask the price, and ask for the bill.", hint: "Buenos días · Quisiera… · ¿Cuánto es? · La cuenta, por favor" },
    ],
  },

  "m002-airport": {
    title: "Write at the airport",
    cards: [
      {
        kind: "intro",
        mission: "Write your way through airport check-in — clearly and accurately.",
        goals: [
          "Write questions about your gate and flight.",
          "Handle check-in with the agent.",
          "Write a short message from the airport.",
        ],
      },
      { kind: "copy", stage: 1, prompt: "Write a question for the agent.", model: "¿A qué hora sale el vuelo?", note: "Copy it, or ask about the gate instead." },
      { kind: "build", stage: 2, prompt: "Build the question.", bank: ["¿Dónde", "está", "la", "puerta", "doce?"], answer: "¿Dónde está la puerta doce?", accept: ["Dónde está la puerta doce"] },
      { kind: "prompt", stage: 3, prompt: "where is gate twelve", hint: "¿Dónde está…?", answer: "¿Dónde está la puerta doce?", accept: ["¿Dónde está la puerta 12?", "Dónde está la puerta doce"] },
      {
        kind: "context", stage: 4, scenario: "You are at check-in. Write what you say to the agent.", hint: "Aquí tiene… · ¿A qué hora…?",
        prompts: [
          { cue: "Hand over your ticket", answer: "Aquí tiene mi billete.", accept: ["Aquí tiene el billete", "Hola, aquí tiene mi billete", "Aquí está mi billete"] },
          { cue: "Ask what time your flight leaves", answer: "¿A qué hora sale el vuelo?", accept: ["¿A qué hora es el vuelo?", "¿Cuándo sale el vuelo?"] },
        ],
      },
      {
        kind: "functional", stage: 5,
        prompts: [
          { cue: "Ask where the boarding gate is.", hint: "¿Dónde está…?", answer: "¿Dónde está la puerta de embarque?", accept: ["¿Dónde está la puerta?", "¿Dónde está el embarque?"] },
          { cue: "Ask what time the flight leaves.", hint: "¿A qué hora…?", answer: "¿A qué hora sale el vuelo?", accept: ["¿A qué hora es el vuelo?"] },
          { cue: "Say this is your suitcase.", hint: "Esta es…", answer: "Esta es mi maleta.", accept: ["Es mi maleta", "Esta maleta es mía"] },
        ],
      },
      {
        kind: "message", stage: 6, prompt: "Message a friend: you're at the airport waiting for your flight at gate twelve.", hint: "Estoy en el aeropuerto…",
        target: "Estoy en el aeropuerto. Mi vuelo sale por la puerta doce.",
        examples: ["Estoy en el aeropuerto. Mi vuelo sale por la puerta doce.", "Estoy esperando mi vuelo en la puerta doce."],
      },
      { kind: "free", stage: 7, scenario: "You are at airport check-in. Write the whole interaction: greet the agent, give your ticket, and ask your gate and departure time.", hint: "Buenos días · Aquí tiene mi billete · ¿Cuál es la puerta? · ¿A qué hora sale?" },
    ],
  },

  "m003-meeting-someone": {
    title: "Write an introduction",
    cards: [
      {
        kind: "intro",
        mission: "Write how you introduce yourself — calmly and accurately.",
        goals: [
          "Write your name and where you're from.",
          "Ask someone their name and origin.",
          "Write a short introduction message.",
        ],
      },
      { kind: "copy", stage: 1, prompt: "Introduce yourself.", model: "Me llamo Carlos.", note: "Copy it, or use your own name." },
      { kind: "build", stage: 2, prompt: "Build the introduction.", bank: ["Me", "llamo", "Carlos", "y", "soy", "de", "México"], answer: "Me llamo Carlos y soy de México", accept: ["Me llamo Carlos"] },
      { kind: "prompt", stage: 3, prompt: "my name is Ana", hint: "Me llamo…", answer: "Me llamo Ana", accept: ["Soy Ana"] },
      {
        kind: "context", stage: 4, scenario: "You meet someone new. Write what you say.", hint: "Me llamo… · ¿Cómo…?",
        prompts: [
          { cue: "Introduce yourself", answer: "Me llamo Carlos.", accept: ["Me llamo Carlos y soy de México", "Hola, me llamo Carlos", "Soy Carlos"] },
          { cue: "Ask their name", answer: "¿Cómo te llamas?", accept: ["¿Cuál es tu nombre?", "¿Y tú, cómo te llamas?"] },
        ],
      },
      {
        kind: "functional", stage: 5,
        prompts: [
          { cue: "Ask where they're from.", hint: "¿De dónde…?", answer: "¿De dónde eres?", accept: ["¿De dónde es usted?"] },
          { cue: "Say you're from Mexico.", hint: "Soy de…", answer: "Soy de México.", accept: ["Soy de Mexico"] },
          { cue: "Say nice to meet you.", hint: "Mucho…", answer: "Mucho gusto.", accept: ["Encantado", "Encantada"] },
        ],
      },
      {
        kind: "message", stage: 6, prompt: "Message a new friend: greet them, say your name and where you're from.", hint: "Hola, me llamo… soy de…",
        target: "Hola, me llamo Carlos y soy de México.",
        examples: ["Hola, me llamo Carlos y soy de México.", "¡Hola! Soy Ana, soy de España."],
      },
      { kind: "free", stage: 7, scenario: "You meet someone at a party. Write the whole introduction: greet them, give your name and where you're from, and ask about them.", hint: "Hola · Me llamo… · Soy de… · ¿Y tú?" },
    ],
  },
};

// Accent/case/punctuation-insensitive compare, matching the grammar + listening
// trainers so "quisiera un cafe" ≈ "Quisiera un café."
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(value: string, answers: string[]): boolean {
  const v = norm(value);
  return answers.some((a) => norm(a) === v);
}

function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;
}

export default function WritingLesson({
  script,
  onExit,
  onDone,
  backLabel = "Mission",
}: {
  script: WritingLessonScript;
  onExit: () => void;
  onDone?: () => void;
  backLabel?: string;
}) {
  const { cardIndex, pos, isLast, next, requeue } = useBlockQueue(script.cards.length, onDone ?? onExit);
  const card = script.cards[cardIndex];
  const wrong = requeue; // a wrong answer requeues the card before the block's finale

  return (
    <div className="vt-wrap">
      <div className="vt-topbar" style={{ width: "100%" }}>
        <button className="vt-back" onClick={onExit}><ChevronIcon /> {backLabel}</button>
        <span className="vt-level">
          Writing{card.kind !== "intro" ? ` · Stage ${card.stage} · ${STAGE_LABELS[card.stage]}` : ` · ${script.title}`}
        </span>
      </div>

      <div className="vt-dots">
        {script.cards.map((_, n) => <span key={n} className={"vt-dot" + (n <= pos ? " on" : "")} />)}
      </div>

      {card.kind === "intro" && <IntroCard key={pos} card={card} onNext={next} />}
      {card.kind === "copy" && <CopyCard key={pos} card={card} onNext={next} />}
      {card.kind === "build" && <BuildCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "prompt" && <PromptCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "context" && <SequenceCard key={pos} intro={card.scenario} hint={card.hint} prompts={card.prompts} onNext={next} onWrong={wrong} />}
      {card.kind === "functional" && <SequenceCard key={pos} prompts={card.prompts} onNext={next} onWrong={wrong} />}
      {card.kind === "message" && <MessageCard key={pos} card={card} onNext={next} onWrong={wrong} />}
      {card.kind === "free" && <FreeCard key={pos} card={card} onNext={next} lastLabel={isLast ? "Finish" : "Continue"} />}
    </div>
  );
}

// ── Intro: the goal. Why we're writing. ──
function IntroCard({ card, onNext }: { card: Extract<WritingCard, { kind: "intro" }>; onNext: () => void }) {
  return (
    <div className="sp-card vt-card gl-mission">
      <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Mission</p>
      <p className="vt-es" style={{ marginBottom: 14 }}>{card.mission}</p>
      <p className="sp-sub" style={{ marginBottom: 8 }}>By the end you&apos;ll be able to:</p>
      <ul className="gl-goals">
        {card.goals.map((g, i) => <li key={i}>{g}</li>)}
      </ul>
      <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} onClick={onNext}>Start writing</button>
    </div>
  );
}

// Shared success reveal — celebrates, offers a more natural phrasing to listen to.
function SuccessReveal({ model, onNext, nextLabel = "Continue" }: { model: string; onNext: () => void; nextLabel?: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <p className="sp-h2" style={{ marginBottom: 6 }}>¡Bien escrito!</p>
      <p className="sp-sub" style={{ marginBottom: 10 }}>A natural way to write it: <b style={{ color: "var(--ink)" }}>{model}</b></p>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <SpeakButton text={model} label="Listen" />
      </div>
      <button className="sp-btn sp-btn-primary" onClick={onNext}>{nextLabel}</button>
    </div>
  );
}

// ── Stage 1: copy & adapt. The model is always visible. ──
function CopyCard({ card, onNext }: { card: Extract<WritingCard, { kind: "copy" }>; onNext: () => void }) {
  const [value, setValue] = useState("");
  const [done, setDone] = useState(false);
  // Accept the model verbatim or any non-trivial adaptation (a real attempt).
  const ok = matchesAny(value, [card.model]) || value.trim().split(/\s+/).length >= 2;
  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); if (ok) setDone(true); }}>
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>Copy & adapt</p>
      <p className="vt-prompt">{card.prompt}</p>
      <div className="wr-model">
        <span>{card.model}</span>
        <SpeakButton text={card.model} label="Listen" />
      </div>
      {card.note && <p className="wr-hint">{card.note}</p>}
      {!done ? (
        <>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Write it here…" className="gr-input" style={{ textAlign: "center" }} />
          <button type="submit" className="sp-btn sp-btn-primary" disabled={!ok}>Done</button>
        </>
      ) : (
        <SuccessReveal model={card.model} onNext={onNext} />
      )}
    </form>
  );
}

// ── Stage 2: build from a word bank. Tap words to assemble. ──
function BuildCard({ card, onNext, onWrong }: { card: Extract<WritingCard, { kind: "build" }>; onNext: () => void; onWrong: () => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const sentence = picked.map((i) => card.bank[i]).join(" ");
  const correct = matchesAny(sentence, [card.answer, ...(card.accept ?? [])]);
  const reset = () => { setPicked([]); setChecked(false); };
  return (
    <div className="sp-card vt-card">
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>Build the sentence</p>
      <p className="vt-prompt">{card.prompt}</p>
      <div className="wr-slot">{sentence || <span className="wr-slot-empty">Tap the words in order…</span>}</div>
      <div className="wr-bank">
        {card.bank.map((w, i) => (
          <button key={i} type="button" className="wr-chip" disabled={picked.includes(i) || checked}
            onClick={() => setPicked((p) => [...p, i])}>{w}</button>
        ))}
      </div>
      {!checked ? (
        <div className="vt-rates">
          {picked.length > 0 && <button className="sp-btn sp-btn-soft" onClick={reset}>Clear</button>}
          <button className="sp-btn sp-btn-primary" disabled={!picked.length} onClick={() => setChecked(true)}>Check</button>
        </div>
      ) : correct ? (
        <SuccessReveal model={card.answer} onNext={onNext} />
      ) : (
        <div style={{ marginTop: 8 }}>
          <p className="sp-h2" style={{ marginBottom: 6 }}>Not quite</p>
          <p className="sp-sub" style={{ marginBottom: 10 }}>The right order is <b style={{ color: "var(--ink)" }}>{card.answer}</b>. You&apos;ll build this one again shortly.</p>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><SpeakButton text={card.answer} label="Listen" /></div>
          <button className="sp-btn sp-btn-primary" onClick={onWrong}>Continue</button>
        </div>
      )}
    </div>
  );
}

// ── Stage 3: a single English cue → Spanish sentence, coach-backed. ──
function PromptCard({ card, onNext, onWrong }: { card: Extract<WritingCard, { kind: "prompt" }>; onNext: () => void; onWrong: () => void }) {
  return (
    <div className="sp-card vt-card">
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>Write it in Spanish</p>
      <ProduceInput promptEn={card.prompt} display={card.prompt} hint={card.hint} answer={card.answer} accept={card.accept}
        onDone={(wasWrong) => (wasWrong ? onWrong() : onNext())} />
    </div>
  );
}

// ── Stages 4-5: a sequence of typed prompts (scenario / functional tasks).
// Any prompt answered wrong requeues the whole card. ──
function SequenceCard({ intro, hint, prompts, onNext, onWrong }: {
  intro?: string; hint?: string; prompts: (Produce & { hint?: string })[]; onNext: () => void; onWrong: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [wrongAny, setWrongAny] = useState(false);
  const p = prompts[idx];
  const last = idx === prompts.length - 1;
  const done = (wasWrong: boolean) => {
    const anyWrong = wrongAny || wasWrong;
    if (last) { anyWrong ? onWrong() : onNext(); return; }
    setWrongAny(anyWrong);
    setIdx((n) => n + 1);
  };
  return (
    <div className="sp-card vt-card">
      {intro && <p className="wr-scenario">{intro}</p>}
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>{intro ? "Task" : "Functional task"} · {idx + 1}/{prompts.length}</p>
      <ProduceInput key={idx} promptEn={p.cue} display={p.cue} hint={p.hint ?? hint} answer={p.answer} accept={p.accept}
        onDone={done} nextLabel={last ? "Continue" : "Next"} />
    </div>
  );
}

// Typed answer with supportive, non-binary checking:
//   1. local accept-list match → instant success
//   2. otherwise ask the coach — it okays natural variants we didn't list, and
//      when wrong returns a friendlier phrasing + why (never "Wrong, try again").
function ProduceInput({ promptEn, display, hint, answer, accept, onDone, nextLabel = "Continue" }: {
  promptEn: string; display: string; hint?: string; answer: string; accept?: string[];
  onDone: (wasWrong: boolean) => void; nextLabel?: string;
}) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [coach, setCoach] = useState<WritingCoach | null>(null);
  const [solvedLocal, setSolvedLocal] = useState(false);

  const solved = solvedLocal || (coach?.correct ?? false);
  const wrongDone = coach !== null && !coach.correct; // answered, not accepted

  const check = async () => {
    if (!value.trim()) return;
    if (matchesAny(value, [answer, ...(accept ?? [])])) { setSolvedLocal(true); setCoach(null); return; }
    setChecking(true);
    try {
      const res = await writingApi.coach(promptEn, answer, value);
      setCoach(res);
    } catch {
      // Coach unavailable — treat as not-accepted and show the model answer, so
      // the learner is never hard-blocked (the card requeues instead).
      setCoach({ correct: false, natural: answer, why: "", think: "" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void check(); }}>
      <p className="vt-prompt">{display}</p>
      {hint && !solved && !wrongDone && <p className="wr-hint">Hint: {hint}</p>}
      {solved ? (
        <SuccessReveal model={answer} onNext={() => onDone(false)} nextLabel={nextLabel} />
      ) : wrongDone ? (
        // One wrong attempt: tell the learner, show the natural version, then
        // requeue (they'll write it again later in the block).
        <div style={{ marginTop: 4 }}>
          <p className="sp-h2" style={{ marginBottom: 6 }}>Not quite</p>
          <p className="sp-sub" style={{ marginBottom: 6 }}>A more natural way is:</p>
          <p className="wr-coach-natural">{coach!.natural}</p>
          {coach!.why && <p className="wr-hint" style={{ marginTop: 6 }}>{coach!.why}</p>}
          <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 4px" }}>
            <SpeakButton text={coach!.natural} label="Listen" />
          </div>
          <p className="wr-hint" style={{ marginBottom: 10 }}>You&apos;ll write this one again shortly.</p>
          <button type="button" className="sp-btn sp-btn-primary" onClick={() => onDone(true)}>Continue</button>
        </div>
      ) : (
        <>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Write it in Spanish…" className="gr-input" style={{ textAlign: "center" }} disabled={checking} />
          <button type="submit" className="sp-btn sp-btn-primary" disabled={!value.trim() || checking}>{checking ? "Checking…" : "Check"}</button>
        </>
      )}
    </form>
  );
}

// ── Stage 6: a short natural message, coached against a target. ──
function MessageCard({ card, onNext, onWrong }: { card: Extract<WritingCard, { kind: "message" }>; onNext: () => void; onWrong: () => void }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [coach, setCoach] = useState<WritingCoach | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  const check = async () => {
    if (!value.trim()) return;
    setChecking(true);
    try {
      setCoach(await writingApi.coach(card.prompt, card.target, value));
    } catch {
      setCoach({ correct: true, natural: card.target, why: "", think: "" });
    } finally {
      setChecking(false);
      setShowExamples(true);
    }
  };

  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); void check(); }}>
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>Write a short message</p>
      <p className="vt-prompt">{card.prompt}</p>
      {card.hint && !coach && <p className="wr-hint">Hint: {card.hint}</p>}
      <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Write your message…" className="gr-input wr-textarea" rows={3} disabled={checking} />
      {coach && (
        <div className="wr-coach">
          <p className="sp-h2" style={{ marginBottom: 6 }}>{coach.correct ? "Nice message!" : "Good attempt"}</p>
          <p className="sp-sub" style={{ marginBottom: 6 }}>{coach.correct ? "Clear and natural." : "A more natural way is:"}</p>
          <p className="wr-coach-natural">{coach.natural}</p>
          {coach.why && <p className="wr-hint" style={{ marginTop: 6 }}>{coach.why}</p>}
        </div>
      )}
      {showExamples && (
        <div className="wr-examples">
          <p className="sp-eyebrow" style={{ margin: "10px 0 6px" }}>Other natural messages</p>
          {card.examples.map((ex, i) => (
            <div key={i} className="wr-example"><span>{ex}</span><SpeakButton text={ex} label="Listen" /></div>
          ))}
        </div>
      )}
      {coach && !coach.correct && <p className="wr-hint" style={{ textAlign: "center" }}>You&apos;ll write this one again shortly.</p>}
      <div className="vt-rates">
        {!coach ? (
          <button type="submit" className="sp-btn sp-btn-primary" disabled={!value.trim() || checking}>{checking ? "Checking…" : "Check"}</button>
        ) : (
          <button type="button" className="sp-btn sp-btn-primary" onClick={coach.correct ? onNext : onWrong}>Continue</button>
        )}
      </div>
    </form>
  );
}

// ── Stage 7: free writing, graded by the AI feedback engine. ──
function FreeCard({ card, onNext, lastLabel }: {
  card: Extract<WritingCard, { kind: "free" }>; onNext: () => void; lastLabel: string;
}) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [fb, setFb] = useState<WritingFeedback | null>(null);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!value.trim()) return;
    setChecking(true);
    setError("");
    try {
      setFb(await writingApi.feedback("mission", card.scenario, value));
    } catch {
      setError("Could not reach the writing coach. Your writing still counts — continue when ready.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>Free writing</p>
      <p className="wr-scenario">{card.scenario}</p>
      {card.hint && !fb && <p className="wr-hint">You could use: {card.hint}</p>}
      <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Write freely in Spanish…" className="gr-input wr-textarea" rows={5} disabled={checking} />
      {error && <p className="wr-hint" style={{ color: "var(--ink)" }}>{error}</p>}
      {fb && (
        <div className="wr-coach" style={{ textAlign: "left" }}>
          <div className="wr-score">Score <b>{fb.score}</b>/100</div>
          {fb.feedback && <p className="sp-sub" style={{ margin: "8px 0" }}>{fb.feedback}</p>}
          {fb.corrections.length > 0 && (
            <div className="wr-fb-block">
              <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Corrections</p>
              {fb.corrections.map((c, i) => (
                <p key={i} className="wr-fb-line"><span className="wr-bad">{c.wrong}</span> → <span className="wr-good">{c.correct}</span>{c.note ? ` · ${c.note}` : ""}</p>
              ))}
            </div>
          )}
          {fb.natural.length > 0 && (
            <div className="wr-fb-block">
              <p className="sp-eyebrow" style={{ marginBottom: 6 }}>More natural</p>
              {fb.natural.map((n, i) => (
                <p key={i} className="wr-fb-line"><span className="wr-good">{n.better}</span>{n.why ? ` · ${n.why}` : ""}</p>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="vt-rates">
        {!fb ? (
          <>
            {error && <button type="button" className="sp-btn sp-btn-soft" onClick={onNext}>Skip</button>}
            <button type="submit" className="sp-btn sp-btn-primary" disabled={!value.trim() || checking}>{checking ? "Checking…" : "Submit"}</button>
          </>
        ) : (
          <button type="button" className="sp-btn sp-btn-primary" onClick={onNext}>{lastLabel}</button>
        )}
      </div>
    </form>
  );
}
