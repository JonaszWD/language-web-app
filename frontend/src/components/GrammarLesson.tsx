"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { studyApi } from "@/lib/api";
import { useBlockQueue } from "@/components/lessonQueue";
import SpeakButton from "@/components/SpeakButton";
import { generatedGrammar } from "@/content/generated";
import { recordMistake } from "@/lib/missionMistakes";

/* ─────────────────────────────────────────────────────────────────────────
   Mission grammar as micro-learning with immediate application. Gradual
   release: I show you → we do it together → you do it alone → you use it for
   real. One structure at a time, ≤15–20 s of explanation, then 70–80 % of the
   time is interactive. New structures are re-surfaced (review) after a couple
   of other interactions, not all-at-the-end. A whole lesson is 3–5 minutes.

   Schedule (per structure A/B/C):
     intro → learn A → recognise A → produce A → learn B → recognise B →
     produce B → review A → learn C → choose C → review B → mission
   ──────────────────────────────────────────────────────────────────────── */

export type GrammarCard =
  | { kind: "intro"; mission: string; goals: string[] }
  // `notice` is a one-line pattern-noticing callout (e.g. "Me llamo stays the
  // same — only the name changes"): enough grammar for a beginner, no tables.
  | { kind: "learn"; pattern: string; gloss: string; examples: { es: string; en?: string }[]; notice?: string }
  | { kind: "recognition"; question: string; options: string[]; answer: number }
  | { kind: "production"; instruction?: string; prompts: { cue: string; answer: string }[] }
  // Build-the-sentence: tap the word tiles into order. Reinforces Spanish word
  // order without full typing and breaks up the produce-from-blank repetition.
  | { kind: "build"; instruction?: string; cue: string; answer: string[] }
  // A tiny dialogue turn — the NPC says a line, the learner chooses the natural
  // reply. Rotates review away from always-fill-in-the-blank.
  | { kind: "respond"; label?: string; npc: string; npc_en?: string; options: string[]; answer: number }
  | { kind: "review"; label?: string; template: string; cue: string; answer: string }
  // `swap: true` marks NPC+you pairs whose order is shuffled each run, so the
  // finale feels like a conversation rather than a memorised recital. On the
  // learner's own lines (`you`), `en` is an English paraphrase of what to say —
  // the learner produces the Spanish from it rather than reading it off.
  | { kind: "mission"; intro?: string; lines: { who: string; es: string; you?: boolean; en?: string; swap?: boolean }[] };

export interface GrammarLessonScript {
  title: string;
  cards: GrammarCard[];
}

// Per-mission grammar scripts, keyed by mission id. A mission with no script
// falls back to the vocabulary trainer for its Grammar step.
const BASE_GRAMMAR_LESSONS: Record<string, GrammarLessonScript> = {
  "m001-coffee-shop": {
    title: "Order food at a café",
    cards: [
      {
        kind: "intro",
        mission: "Order food at a café.",
        goals: [
          "Ask for food politely.",
          "Ask for the menu.",
          "Say whether it's to go or for here.",
        ],
      },

      // ── Structure A: Quisiera… ─────────────────────────────────────────
      {
        kind: "learn",
        pattern: "Quisiera…",
        gloss: "“I would like…” — order politely.",
        examples: [
          { es: "Quisiera agua.", en: "I would like water." },
          { es: "Quisiera café.", en: "I would like coffee." },
        ],
        notice: "“Quisiera” stays put — just name what you want after it.",
      },
      { kind: "recognition", question: "Which means “I would like coffee”?", options: ["Café quisiera", "Quisiera café", "Me gusta café"], answer: 1 },
      { kind: "build", instruction: "Order politely.", cue: "Say “I would like a pizza.”", answer: ["Quisiera", "una", "pizza"] },
      {
        kind: "production",
        instruction: "You're at the counter — order it.",
        prompts: [
          { cue: "Order a coffee.", answer: "Quisiera café" },
          { cue: "Order a pizza.", answer: "Quisiera una pizza" },
        ],
      },

      // ── Structure B: ¿Me puede dar…? ───────────────────────────────────
      {
        kind: "learn",
        pattern: "¿Me puede dar…?",
        gloss: "“Can you give me…?” — ask for something.",
        examples: [
          { es: "¿Me puede dar el menú?", en: "Can you give me the menu?" },
          { es: "¿Me puede dar la cuenta?", en: "Can you give me the bill?" },
        ],
        notice: "“¿Me puede dar…?” is fixed — change only the thing you ask for.",
      },
      { kind: "recognition", question: "Which asks for the menu?", options: ["¿Me puede dar el menú?", "Quisiera el menú.", "El menú, aquí."], answer: 0 },
      {
        kind: "production",
        instruction: "Ask the waiter for it.",
        prompts: [
          { cue: "Ask for the menu.", answer: "¿Me puede dar el menú?" },
          { cue: "Ask for the bill.", answer: "¿Me puede dar la cuenta?" },
        ],
      },

      // ── Review A (Quisiera surfaced again, still fresh) ────────────────
      { kind: "review", label: "Quick review", template: "______ café.", cue: "I would like coffee.", answer: "Quisiera" },

      // ── Structure C: Aquí / Para llevar ────────────────────────────────
      {
        kind: "learn",
        pattern: "Aquí / Para llevar",
        gloss: "“For here” / “to go”.",
        examples: [
          { es: "Aquí, por favor.", en: "For here, please." },
          { es: "Para llevar.", en: "To go." },
        ],
      },
      { kind: "recognition", question: "Your food is to go. Say:", options: ["Aquí", "Para llevar"], answer: 1 },

      // ── Review B (¿Me puede dar…? surfaced again) ──────────────────────
      { kind: "review", label: "Quick review", template: "¿Me puede dar ______?", cue: "the bill", answer: "la cuenta" },

      // ── Final mission: everything used naturally ───────────────────────
      {
        kind: "mission",
        intro: "Put it together with the waiter.",
        lines: [
          { who: "Mesero", es: "Buenas tardes." },
          { who: "Tú", es: "¿Me puede dar el menú?", you: true, en: "Ask for the menu." },
          { who: "Mesero", es: "¿Qué desea?" },
          { who: "Tú", es: "Quisiera una pizza.", you: true, en: "Order a pizza, politely." },
          { who: "Mesero", es: "¿Aquí o para llevar?" },
          { who: "Tú", es: "Para llevar.", you: true, en: "Say it's to go." },
        ],
      },
    ],
  },

  "m002-airport": {
    title: "Check in and find your gate",
    cards: [
      {
        kind: "intro",
        mission: "Check in, find your gate and board your flight.",
        goals: [
          "Ask where the gate is.",
          "Ask what time the flight leaves.",
          "Say you're ready to board.",
        ],
      },

      // ── Structure A: ¿Dónde está…? ──────────────────────────────────────
      {
        kind: "learn",
        pattern: "¿Dónde está…?",
        gloss: "“Where is…?” — ask for a location.",
        examples: [
          { es: "¿Dónde está la puerta seis?", en: "Where is gate six?" },
          { es: "¿Dónde está la facturación?", en: "Where is check-in?" },
        ],
        notice: "“¿Dónde está…?” never changes — just name the place after it.",
      },
      { kind: "recognition", question: "Which asks “Where is the gate”?", options: ["La puerta está dónde", "¿Dónde está la puerta?", "¿Qué es la puerta?"], answer: 1 },
      { kind: "build", instruction: "Ask for a location.", cue: "Say “Where is the gate?”", answer: ["¿Dónde", "está", "la", "puerta?"] },
      {
        kind: "production",
        instruction: "You're lost — ask a staff member.",
        prompts: [
          { cue: "Ask where the gate is.", answer: "¿Dónde está la puerta?" },
          { cue: "Ask where check-in is.", answer: "¿Dónde está la facturación?" },
        ],
      },

      // ── Structure B: ¿A qué hora…? ──────────────────────────────────────
      {
        kind: "learn",
        pattern: "¿A qué hora sale…?",
        gloss: "“What time does… leave?” — ask about departure.",
        examples: [
          { es: "¿A qué hora sale el vuelo?", en: "What time does the flight leave?" },
          { es: "¿A qué hora sale el avión?", en: "What time does the plane leave?" },
        ],
        notice: "“¿A qué hora sale…?” is fixed — only the thing leaving changes.",
      },
      { kind: "recognition", question: "Which asks what time the flight leaves?", options: ["¿A qué hora sale el vuelo?", "¿Dónde sale el vuelo?", "El vuelo, ¿qué hora?"], answer: 0 },
      {
        kind: "respond", label: "Mini dialogue",
        npc: "Su vuelo sale pronto.", npc_en: "Your flight leaves soon.",
        options: ["¿Dónde está la puerta?", "Para llevar.", "Me llamo Ana."], answer: 0,
      },
      {
        kind: "production",
        instruction: "Check your departure — ask the agent.",
        prompts: [
          { cue: "Ask what time the flight leaves.", answer: "¿A qué hora sale el vuelo?" },
          { cue: "Ask what time the plane leaves.", answer: "¿A qué hora sale el avión?" },
        ],
      },

      // ── Review A (¿Dónde está…? surfaced again) ────────────────────────
      { kind: "review", label: "Quick review", template: "______ la puerta doce?", cue: "Where is gate twelve?", answer: "¿Dónde está" },

      // ── Structure C: Vamos a + infinitive ───────────────────────────────
      {
        kind: "learn",
        pattern: "Vamos a embarcar",
        gloss: "“Let's board” / “We're about to board” — announce readiness.",
        examples: [
          { es: "Vamos a embarcar ahora.", en: "We're boarding now." },
          { es: "Vamos a embarcar por la puerta doce.", en: "We're boarding at gate twelve." },
        ],
      },
      { kind: "recognition", question: "It's time to board. Say:", options: ["Vamos a embarcar", "Vamos a facturar"], answer: 0 },

      // ── Review B (¿A qué hora…? surfaced again) ─────────────────────────
      { kind: "review", label: "Quick review", template: "¿A qué hora sale ______?", cue: "the plane", answer: "el avión" },

      // ── Final mission: everything used naturally ────────────────────────
      {
        kind: "mission",
        intro: "Put it together at the check-in desk.",
        lines: [
          { who: "Agente", es: "Buenos días. ¿Su billete y pasaporte, por favor?" },
          { who: "Tú", es: "¿Dónde está la puerta de embarque?", you: true, en: "Ask where the boarding gate is." },
          { who: "Agente", es: "Puerta doce. ¿Algo más?" },
          { who: "Tú", es: "¿A qué hora sale el vuelo?", you: true, en: "Ask what time the flight leaves." },
          { who: "Agente", es: "A las tres. Vamos a embarcar pronto." },
          { who: "Tú", es: "Gracias.", you: true, en: "Thank the agent." },
        ],
      },
    ],
  },

  "m003-meeting-someone": {
    title: "Introduce yourself",
    cards: [
      {
        kind: "intro",
        mission: "Meet someone new.",
        goals: [
          "Say your name.",
          "Say where you're from.",
          "Ask their name and where they're from.",
        ],
      },

      // ── Structure A: Me llamo… ─────────────────────────────────────────
      {
        kind: "learn",
        pattern: "Me llamo…",
        gloss: "“My name is…” — give your name.",
        examples: [
          { es: "Me llamo Ana.", en: "My name is Ana." },
          { es: "Me llamo Carlos.", en: "My name is Carlos." },
        ],
        notice: "“Me llamo” never changes — only the name after it does.",
      },
      { kind: "recognition", question: "Which means “My name is Ana”?", options: ["Llamo me Ana", "Me llamo Ana", "Ana gusto"], answer: 1 },
      // Word order without typing — assemble the sentence from tiles.
      { kind: "build", instruction: "Introduce yourself as Ana.", cue: "Say “My name is Ana.”", answer: ["Me", "llamo", "Ana"] },
      {
        kind: "production",
        // Communicative framing: the learner thinks about the interaction, not
        // about filling a blank. Same answers, trimmed to two so it doesn't drill
        // the identical task three times.
        instruction: "You're meeting someone — say it.",
        prompts: [
          { cue: "Introduce yourself as Carlos.", answer: "Me llamo Carlos" },
          { cue: "Now introduce yourself as María.", answer: "Me llamo María" },
        ],
      },

      // ── Structure B: Soy de… ───────────────────────────────────────────
      {
        kind: "learn",
        pattern: "Soy de…",
        gloss: "“I'm from…” — say where you're from.",
        examples: [
          { es: "Soy de México.", en: "I'm from Mexico." },
          { es: "Soy de España.", en: "I'm from Spain." },
        ],
        notice: "“Soy de” stays the same — swap in any country.",
      },
      { kind: "recognition", question: "Which means “I'm from Spain”?", options: ["Soy de España", "De soy España", "España soy"], answer: 0 },
      { kind: "build", instruction: "Say where you're from.", cue: "Say “I'm from Spain.”", answer: ["Soy", "de", "España"] },
      {
        kind: "production",
        instruction: "Tell the person where you're from.",
        prompts: [
          { cue: "Tell Ana you're from Mexico.", answer: "Soy de México" },
          { cue: "Now say you're from Colombia.", answer: "Soy de Colombia" },
        ],
      },

      // ── Varied review: hear the question, choose the natural reply ──────
      {
        kind: "respond", label: "Mini dialogue",
        npc: "¡Hola! ¿Cómo te llamas?", npc_en: "Hi! What's your name?",
        options: ["Soy de México.", "Me llamo Ana.", "¡Adiós!"], answer: 1,
      },

      // ── Review A (Me llamo… surfaced as a cloze — spaced-review signal) ─
      { kind: "review", label: "Quick review", template: "______ Ana.", cue: "My name is Ana.", answer: "Me llamo" },

      // ── Structure C: asking back ───────────────────────────────────────
      {
        kind: "learn",
        pattern: "¿Cómo te llamas? / ¿De dónde eres?",
        gloss: "Ask “What's your name?” / “Where are you from?”.",
        examples: [
          { es: "¿Cómo te llamas?", en: "What's your name?" },
          { es: "¿De dónde eres?", en: "Where are you from?" },
        ],
        notice: "These turn it around — you're asking about the other person now.",
      },
      { kind: "recognition", question: "You want to ask their name. Say:", options: ["¿De dónde eres?", "¿Cómo te llamas?"], answer: 1 },

      // ── Review B (Soy de… surfaced again) ──────────────────────────────
      { kind: "review", label: "Quick review", template: "Soy de ______.", cue: "Colombia", answer: "Colombia" },

      // ── Final mission — Ana's two questions come in a random order, so it
      //    plays like a conversation, not a memorised script. ──────────────
      {
        kind: "mission",
        intro: "Meet Ana and introduce yourself.",
        lines: [
          { who: "Ana", es: "¡Hola! ¿Cómo te llamas?", swap: true },
          { who: "Tú", es: "Me llamo Carlos.", you: true, en: "Introduce yourself as Carlos.", swap: true },
          { who: "Ana", es: "Mucho gusto. ¿De dónde eres?", swap: true },
          { who: "Tú", es: "Soy de México.", you: true, en: "Say you're from Mexico.", swap: true },
          { who: "Ana", es: "¡Adiós!" },
          { who: "Tú", es: "Adiós.", you: true, en: "Say goodbye." },
        ],
      },
    ],
  },
};

// Hand-authored scripts, with generated missions merged in (generated wins only
// for ids not authored by hand).
export const GRAMMAR_LESSONS: Record<string, GrammarLessonScript> = {
  ...generatedGrammar,
  ...BASE_GRAMMAR_LESSONS,
};

// Accent/case/punctuation-insensitive compare, matching the vocab trainer's
// forgiving check so "quisiera agua" ≈ "Quisiera agua".
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function GrammarLesson({
  script,
  onExit,
  onDone,
  patterns,
  missionId,
}: {
  script: GrammarLessonScript;
  onExit: () => void;
  onDone?: () => void;
  // The mission's backend GrammarPattern rows, matched to this script's
  // "review" cards by cloze_template — lets a review answer here also post an
  // FSRS review for the pattern (see services.grammar_pattern), so it re-enters
  // spaced review instead of being forgotten once the lesson ends.
  patterns?: { id: string; cloze_template: string }[];
  // Feeds the Feedback/Correction step's mistake round-up (see
  // lib/missionMistakes) — omitted, mistakes just aren't recorded.
  missionId?: string;
}) {
  const cards = useMemo(() => script.cards.filter((c) => c.kind !== "intro"), [script]);
  const { cardIndex, pos, isLast, next, requeue } = useBlockQueue(cards.length, onDone ?? onExit);
  const card = cards[cardIndex];
  const wrong = requeue; // a wrong answer requeues the card before the block's finale
  const wrongWith = (es: string, en?: string) => () => {
    if (missionId) recordMistake(missionId, { step: "Grammar", es, en });
    wrong();
  };

  return (
    <div className="vt-wrap">
      <div className="vt-progress">
        <div className="vt-progress-fill" style={{ width: `${((pos + 1) / cards.length) * 100}%` }} />
      </div>

      {card.kind === "learn" && <LearnCard key={pos} card={card} onNext={next} />}
      {card.kind === "recognition" && <RecognitionCard key={pos} card={card} onNext={next} onWrong={wrongWith(card.options[card.answer])} />}
      {card.kind === "build" && <BuildCard key={pos} card={card} onNext={next} onWrong={wrongWith(card.answer.join(" "))} />}
      {card.kind === "respond" && <RespondCard key={pos} card={card} onNext={next} onWrong={wrongWith(card.options[card.answer])} />}
      {card.kind === "production" && <ProductionCard key={pos} card={card} onNext={next} onWrong={wrongWith(card.prompts[card.prompts.length - 1].answer)} />}
      {card.kind === "review" && (
        <ReviewCard
          key={pos}
          card={card}
          onNext={next}
          onWrong={wrongWith(card.template.replace("______", card.answer))}
          patternId={patterns?.find((p) => p.cloze_template === card.template)?.id}
        />
      )}
      {card.kind === "mission" && <MissionCard key={pos} card={card} onNext={next} lastLabel={isLast ? "Finish" : "Continue"} />}
    </div>
  );
}

// ── Learn: one structure, ≤20 s. Pattern + gloss + a couple of examples. ──
function LearnCard({ card, onNext }: { card: Extract<GrammarCard, { kind: "learn" }>; onNext: () => void }) {
  return (
    <div className="sp-card vt-card">
      <p className="vt-es">{card.pattern}</p>
      <p className="sp-sub">{card.gloss}</p>
      <div className="gl-examples">
        {card.examples.map((ex, i) => (
          <div key={i} className="gl-example">
            <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
              <span className="gl-example-es">{ex.es}</span>
              {ex.en && <span className="gl-example-en">{ex.en}</span>}
            </div>
            <SpeakButton text={ex.es} label="Listen" />
          </div>
        ))}
      </div>
      {card.notice && (
        <p className="gl-notice">
          <span className="gl-notice-eye">Notice</span>
          {card.notice}
        </p>
      )}
      <button className="sp-btn sp-btn-primary" onClick={onNext}>Got it</button>
    </div>
  );
}

// ── Recognition: pick the right phrase. Should feel easy. ──
function RecognitionCard({ card, onNext, onWrong }: { card: Extract<GrammarCard, { kind: "recognition" }>; onNext: () => void; onWrong: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === card.answer;
  return (
    <div className="sp-card vt-card">
      <p className="vt-prompt">{card.question}</p>
      <div className="gl-options">
        {card.options.map((opt, i) => {
          const state = picked === null ? "" : i === card.answer ? " ok" : i === picked ? " bad" : "";
          return (
            <button key={i} type="button" className={"gl-option" + state} disabled={picked !== null} onClick={() => { if (picked === null) setPicked(i); }}>
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="vt-stack">
          <p className="sp-sub">{correct ? "¡Correcto!" : "Not quite — the highlighted one is right."}</p>
          <button className="sp-btn sp-btn-primary" onClick={correct ? onNext : onWrong}>Continue</button>
        </div>
      )}
    </div>
  );
}

// ── Build: tap word tiles into the right order. Word order without typing. ──
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function BuildCard({ card, onNext, onWrong }: { card: Extract<GrammarCard, { kind: "build" }>; onNext: () => void; onWrong: () => void }) {
  // Pool tiles carry a stable id (index) so repeated words stay distinguishable.
  type Tile = { id: number; word: string };
  const [pool, setPool] = useState<Tile[]>(() => {
    const tiles = card.answer.map((word, id) => ({ id, word }));
    // Reshuffle until the pool isn't already in the answer order (when possible).
    let s = shuffled(tiles);
    for (let tries = 0; tries < 6 && s.every((t, k) => t.word === card.answer[k]); tries++) s = shuffled(tiles);
    return s;
  });
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [checked, setChecked] = useState(false);
  const full = placed.length === card.answer.length;
  const correct = full && placed.every((t, k) => norm(t.word) === norm(card.answer[k]));

  const place = (t: Tile) => { if (checked) return; setPool((p) => p.filter((x) => x.id !== t.id)); setPlaced((p) => [...p, t]); };
  const unplace = (t: Tile) => { if (checked) return; setPlaced((p) => p.filter((x) => x.id !== t.id)); setPool((p) => [...p, t]); };

  return (
    <div className="sp-card vt-card">
      <p className="vt-prompt">{card.cue}</p>

      <div className="gl-build-slots">
        {placed.length === 0 && <span className="gl-build-ph">Tap the words in order…</span>}
        {placed.map((t) => (
          <button key={t.id} type="button" className="gl-tile placed" disabled={checked} onClick={() => unplace(t)}>{t.word}</button>
        ))}
      </div>

      {!checked ? (
        <>
          <div className="gl-build-pool">
            {pool.map((t) => (
              <button key={t.id} type="button" className="gl-tile" onClick={() => place(t)}>{t.word}</button>
            ))}
          </div>
          <button type="button" className="sp-btn sp-btn-primary" disabled={!full} onClick={() => setChecked(true)}>Check</button>
        </>
      ) : (
        <Reveal correct={correct} answer={card.answer.join(" ")} onContinue={correct ? onNext : onWrong} />
      )}
    </div>
  );
}

// ── Respond: the NPC speaks; the learner picks the natural reply. ──
function RespondCard({ card, onNext, onWrong }: { card: Extract<GrammarCard, { kind: "respond" }>; onNext: () => void; onWrong: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === card.answer;
  return (
    <div className="sp-card vt-card">
      <div className="gl-line">
        <span className="gl-who">NPC</span>
        <span className="gl-bubble">
          {card.npc}
          <SpeakButton text={card.npc} label="Listen" />
        </span>
      </div>
      {card.npc_en && <p className="sp-sub">{card.npc_en}</p>}
      <div className="gl-options">
        {card.options.map((opt, i) => {
          const state = picked === null ? "" : i === card.answer ? " ok" : i === picked ? " bad" : "";
          return (
            <button key={i} type="button" className={"gl-option" + state} disabled={picked !== null} onClick={() => { if (picked === null) setPicked(i); }}>
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="vt-stack">
          <p className="sp-sub">{correct ? "¡Correcto!" : "Not quite — the highlighted one is right."}</p>
          <button className="sp-btn sp-btn-primary" onClick={correct ? onNext : onWrong}>Continue</button>
        </div>
      )}
    </div>
  );
}

// ── Production: produce the phrase from an English cue, 2–5 prompts. ──
function ProductionCard({ card, onNext, onWrong }: { card: Extract<GrammarCard, { kind: "production" }>; onNext: () => void; onWrong: () => void }) {
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [wrongAny, setWrongAny] = useState(false); // any prompt wrong → requeue the card
  const p = card.prompts[idx];
  const last = idx === card.prompts.length - 1;
  const correct = norm(value) === norm(p.answer);

  const advance = () => {
    const anyWrong = wrongAny || !correct;
    if (last) { anyWrong ? onWrong() : onNext(); return; }
    setWrongAny(anyWrong);
    setIdx((n) => n + 1);
    setValue("");
    setChecked(false);
  };

  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); if (value.trim()) setChecked(true); }}>
      <p className="sp-eyebrow">{idx + 1}/{card.prompts.length}</p>
      <p className="vt-prompt">{p.cue}</p>
      {!checked ? (
        <>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Say it in Spanish…"
            className="gr-input" style={{ textAlign: "center" }} />
          <button type="submit" className="sp-btn sp-btn-primary" disabled={!value.trim()}>Check</button>
        </>
      ) : (
        <Reveal correct={correct} answer={p.answer} onContinue={advance} nextLabel={last ? "Continue" : "Next"} />
      )}
    </form>
  );
}

// ── Review: a cloze bringing an earlier structure back while still fresh. ──
function ReviewCard({ card, onNext, onWrong, patternId }: {
  card: Extract<GrammarCard, { kind: "review" }>; onNext: () => void; onWrong: () => void; patternId?: string;
}) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = norm(value) === norm(card.answer);
  const [before, after] = card.template.split("______");
  const mountedAt = useRef<number | null>(null);
  useEffect(() => { mountedAt.current = Date.now(); }, []);
  const submitReview = () => {
    setChecked(true);
    // Fire-and-forget: this is the pattern's spaced-review signal, not a
    // blocking part of the in-lesson flow. Silently skipped if the pattern
    // couldn't be matched (e.g. content drifted from the seeded JSON).
    if (patternId) void studyApi.reviewGrammar(patternId, value, Date.now() - (mountedAt.current ?? Date.now())).catch(() => {});
  };
  return (
    <form className="sp-card vt-card" onSubmit={(e) => { e.preventDefault(); if (value.trim()) submitReview(); }}>
      <p className="sp-sub">{card.cue}</p>
      {!checked ? (
        <>
          <div className="gl-cloze">
            <span>{before}</span>
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="gl-cloze-input" placeholder="…" />
            <span>{after}</span>
          </div>
          <button type="submit" className="sp-btn sp-btn-primary" disabled={!value.trim()}>Check</button>
        </>
      ) : (
        <Reveal correct={correct} answer={card.template.replace("______", card.answer)} onContinue={correct ? onNext : onWrong} />
      )}
    </form>
  );
}

// Shared correct/incorrect reveal used by build/production/review cards. A wrong
// answer no longer offers an in-place retry — the single "Continue" routes to
// the parent, which requeues the card so the learner meets it again later.
function Reveal({ correct, answer, onContinue, nextLabel = "Continue" }: {
  correct: boolean; answer: string; onContinue: () => void; nextLabel?: string;
}) {
  return (
    <div className="vt-stack">
      <p className="sp-h2">{correct ? "¡Perfecto!" : "Not quite"}</p>
      <p className="sp-sub">
        {correct ? "That's it." : <>The answer is <b style={{ color: "var(--ink)" }}>{answer}</b>.</>}
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <SpeakButton text={answer} label="Listen" />
      </div>
      <div className="vt-rates">
        <button className="sp-btn sp-btn-primary" onClick={onContinue}>{correct ? nextLabel : "Continue"}</button>
      </div>
    </div>
  );
}

// ── Mission: the structures used naturally in the real dialogue. ──
type MissionLine = Extract<GrammarCard, { kind: "mission" }>["lines"][number];

// Shuffle the NPC's interchangeable questions so the finale isn't a memorised
// recital: consecutive `swap` lines are chunked into NPC+you pairs and reordered.
function orderMissionLines(lines: MissionLine[]): MissionLine[] {
  const out: MissionLine[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].swap) { out.push(lines[i]); i++; continue; }
    let j = i;
    while (j < lines.length && lines[j].swap) j++;
    const run = lines.slice(i, j);
    const pairs: MissionLine[][] = [];
    for (let k = 0; k < run.length; k += 2) pairs.push(run.slice(k, k + 2));
    shuffled(pairs).forEach((p) => out.push(...p));
    i = j;
  }
  return out;
}

// Reveal NPC lines up to the next learner turn: returns the index of the next
// `you` line at/after `from` (or the end). Everything skipped is an NPC line the
// learner just reads; we stop and hand the turn over at each `you` line.
function nextTurn(lines: MissionLine[], from: number): number {
  let i = from;
  while (i < lines.length && !lines[i].you) i++;
  return i;
}

function MissionCard({ card, onNext, lastLabel }: {
  card: Extract<GrammarCard, { kind: "mission" }>; onNext: () => void; lastLabel: string;
}) {
  const [lines] = useState(() => orderMissionLines(card.lines));
  // `revealed` lines are shown as finished bubbles. The line at `revealed`, when
  // present, is the learner's active turn — they produce it from the paraphrase.
  const [revealed, setRevealed] = useState(() => nextTurn(lines, 0));
  const done = revealed >= lines.length;
  const active = done ? null : lines[revealed];

  const advance = () => setRevealed((r) => nextTurn(lines, r + 1));

  return (
    <div className="sp-card vt-card gl-mission">
      {card.intro && <p className="sp-sub">{card.intro}</p>}
      <div className="gl-dialogue">
        {lines.slice(0, revealed).map((l, n) => (
          <div key={n} className={"gl-line" + (l.you ? " you" : "")}>
            <span className="gl-who">{l.who}</span>
            <span className="gl-bubble">
              {l.es}
              {l.you && <SpeakButton text={l.es} label="Say it" />}
            </span>
          </div>
        ))}
        {active && <MissionTurn key={revealed} line={active} onDone={advance} />}
      </div>
      {done && <button className="sp-btn sp-btn-primary" onClick={onNext}>{lastLabel}</button>}
    </div>
  );
}

// The learner's turn in the finale: they see an English paraphrase of what to
// say and produce the Spanish (forgiving compare). The real line is revealed
// after — right or wrong — so the conversation always flows on.
function MissionTurn({ line, onDone }: { line: MissionLine; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = norm(value) === norm(line.es);

  if (checked) {
    return (
      <div className="gl-line you">
        <span className="gl-who">{line.who}</span>
        <span className="gl-bubble">
          {line.es}
          <SpeakButton text={line.es} label="Say it" />
        </span>
        <p className="sp-sub gl-turn-verdict">
          {correct ? "¡Perfecto!" : <>You could say: <b style={{ color: "var(--ink)" }}>{line.es}</b></>}
        </p>
        <div className="vt-rates">
          {!correct && <button className="sp-btn sp-btn-soft" onClick={() => { setChecked(false); setValue(""); }}>Try again</button>}
          <button className="sp-btn sp-btn-primary" onClick={onDone}>Continue</button>
        </div>
      </div>
    );
  }

  return (
    <form className="gl-line you gl-turn" onSubmit={(e) => { e.preventDefault(); if (value.trim()) setChecked(true); }}>
      <span className="gl-who">{line.who}</span>
      <span className="gl-turn-cue">Your turn — {line.en ?? "say your line."}</span>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Say it in Spanish…"
        className="gr-input gl-turn-input" />
      <button type="submit" className="sp-btn sp-btn-primary" disabled={!value.trim()}>Check</button>
    </form>
  );
}
