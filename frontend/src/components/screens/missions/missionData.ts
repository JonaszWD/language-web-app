// Shared mission types + hand-authored/generated content overlays + the
// buildMission()/buildMissionSteps() helpers used by both the mission list
// (id/title/blurb summaries) and the mission detail screen (full playable
// content). Extracted from the old AppShell.tsx MISSION section.

import { generatedOverlays, type GeneratedOverlay } from "@/content/generated";
import type { ContextPreview, MissionSpeaking } from "@/types";

export const MISSION_ADVANCE_LEVEL = 2;
// Which vocab burst (0-indexed) a step drills, for the generated Vocabulary
// I/II/III steps — undefined for every other step (Listening, Grammar, ...).
export type MissionLevel = { name: string; learn: string; minutes: number; vocabBurst?: number };
export type Mission = {
  id: string; icon: string; title: string; blurb: string; tag: string;
  lat: number; lon: number;
  vocab: { es: string; en: string; level?: number | null }[];
  grammar: { es: string; en: string }[];
  listening: { es: string; en: string; q: { question: string; options: string[]; answer: number } };
  speaking: { es: string; en: string };
  writing: { promptEn: string; targetEs: string };
  levels?: MissionLevel[]; // the step-by-step levels shown on the planet
  // The LLM-generated 7-stage speaking role-play, loaded from the API on open.
  speakingScript?: MissionSpeaking | null;
  // The LLM-generated Context Preview (situation + key phrases), loaded from
  // the API on open. Null until the enrichment pipeline generates it.
  contextPreview?: ContextPreview | null;
  // The current user's progress: null/undefined if never started, else
  // "available" or "completed". Drives guided-flow vs free-practice-menu.
  status?: string | null;
  // The mission's backend GrammarPattern rows (id + cloze_template), loaded
  // from the API — lets GrammarLesson's hardcoded review cards post an FSRS
  // review for the matching pattern.
  grammarPatterns?: { id: string; cloze_template: string }[];
  // True when this mission's topics match the user's onboarding motivation
  // (see backend services.missions.MOTIVATION_TOPIC_MAP) — a soft "recommended
  // for you" nudge, from GET /missions' MissionSummary.recommended.
  recommended?: boolean;
};
const MISSIONS: Mission[] = [
  {
    id: "m001-coffee-shop", icon: "coffee", title: "Ordering Coffee", blurb: "Walk into a café and order like a local.", tag: "A1 · Café", lat: 40.4, lon: -3.7,
    vocab: [
      { es: "el café", en: "coffee" }, { es: "el té", en: "tea" },
      { es: "la leche", en: "milk" }, { es: "el azúcar", en: "sugar" },
      { es: "el agua", en: "water" }, { es: "la cuenta", en: "the bill" },
      { es: "el vaso", en: "glass" }, { es: "la taza", en: "cup" },
    ],
    grammar: [
      { es: "Quisiera un café.", en: "I would like a coffee. (polite)" },
      { es: "Me gustaría un café con leche.", en: "I would like a coffee with milk." },
    ],
    listening: { es: "Buenos días, ¿qué le pongo?", en: "Good morning, what can I get you?",
      q: { question: "What is the waiter asking?", options: ["What you'd like to order", "Where you live", "The time"], answer: 0 } },
    speaking: { es: "Quisiera un café con leche, por favor.", en: "I'd like a coffee with milk, please." },
    writing: { promptEn: "Order a coffee with milk and sugar, then ask for the bill.", targetEs: "Quisiera un café con leche y azúcar, y la cuenta, por favor." },
    levels: [
      { name: "Listening", learn: "“Buenos días.” · “¿Algo más?” — hear the words in context before drilling them.", minutes: 4 },
      { name: "Grammar", learn: "Quisiera… · Me gustaría… · ¿Me puede dar…? — pulled from the same conversation, short explanation then practice.", minutes: 5 },
      { name: "Speaking", learn: "Talk with an AI waiter — order and complete the interaction naturally.", minutes: 6 },
      { name: "Writing", learn: "Write your order, what your friend orders, and a polite request.", minutes: 5 },
      { name: "Final Challenge", learn: "A real café conversation — no hints, native speed, multiple responses.", minutes: 7 },
    ],
  },
  {
    id: "m002-airport", icon: "plane", title: "At the Airport", blurb: "Check in and find your gate.", tag: "A2 · Travel", lat: 19.4, lon: -99.1,
    vocab: [
      { es: "el vuelo", en: "flight" }, { es: "la maleta", en: "suitcase" },
      { es: "la puerta", en: "gate" }, { es: "el billete", en: "ticket" },
    ],
    grammar: [
      { es: "¿Dónde está la puerta seis?", en: "Where is gate six?" },
      { es: "¿A qué hora sale el vuelo?", en: "What time does the flight leave?" },
    ],
    listening: { es: "Su vuelo sale por la puerta doce.", en: "Your flight leaves from gate twelve.",
      q: { question: "Which gate is the flight?", options: ["Gate two", "Gate twelve", "Gate twenty"], answer: 1 } },
    speaking: { es: "¿Dónde está la puerta de embarque, por favor?", en: "Where is the boarding gate, please?" },
    writing: { promptEn: "Ask where gate twelve is and what time the flight leaves.", targetEs: "¿Dónde está la puerta doce y a qué hora sale el vuelo?" },
    levels: [
      { name: "Listening", learn: "“Su billete y pasaporte.” · “Puerta doce.” — hear the words in context before drilling them.", minutes: 4 },
      { name: "Grammar", learn: "¿Dónde está…? · ¿A qué hora sale…? · Vamos a embarcar — pulled from the same conversation, short explanation then practice.", minutes: 5 },
      { name: "Speaking", learn: "Talk with an AI check-in agent — check in and find your gate naturally.", minutes: 6 },
      { name: "Writing", learn: "Write your gate question, departure time question and a thank-you.", minutes: 5 },
      { name: "Final Challenge", learn: "A real check-in desk conversation — no hints, native speed, multiple responses.", minutes: 7 },
    ],
  },
  {
    id: "m003-meeting-someone", icon: "people", title: "Meeting Someone", blurb: "Say hi and introduce yourself.", tag: "A1 · Social", lat: 4.7, lon: -74.1,
    vocab: [
      { es: "hola", en: "hello" }, { es: "me llamo", en: "my name is" },
      { es: "soy", en: "I am" }, { es: "gracias", en: "thank you" },
    ],
    grammar: [
      { es: "Me llamo Carlos.", en: "My name is Carlos." },
      { es: "Soy de México.", en: "I'm from Mexico." },
    ],
    listening: { es: "Hola, me llamo Ana. ¿Y tú?", en: "Hi, my name is Ana. And you?",
      q: { question: "What is she telling you?", options: ["Her name", "The time", "Where she lives"], answer: 0 } },
    speaking: { es: "Hola, me llamo Carlos. Mucho gusto.", en: "Hi, my name is Carlos. Nice to meet you." },
    writing: { promptEn: "Greet someone, give your name and say where you're from.", targetEs: "Hola, me llamo Carlos y soy de México." },
    levels: [
      { name: "Listening", learn: "“¡Hola!” · “¿Cómo estás?” — hear the words in context before drilling them.", minutes: 4 },
      { name: "Grammar", learn: "Me llamo… · Soy de… · ¿Cómo te llamas? · ¿De dónde eres? — pulled from the same conversation, short explanation then practice.", minutes: 5 },
      { name: "Speaking", learn: "Introduce yourself to an AI partner — name, where you're from, greetings.", minutes: 6 },
      { name: "Writing", learn: "Write a greeting, your name and where you're from.", minutes: 5 },
      { name: "Final Challenge", learn: "A real introduction — no hints, native speed, back and forth.", minutes: 7 },
    ],
  },
  {
    id: "m004-doctor", icon: "health", title: "At the Doctor", blurb: "Describe your symptoms and understand the doctor's advice.", tag: "B1 · Health", lat: -34.6, lon: -58.4,
    vocab: [
      { es: "me duele", en: "my … hurts" }, { es: "la cabeza", en: "head" },
      { es: "la garganta", en: "throat" }, { es: "tener fiebre", en: "to have a fever" },
      { es: "la receta", en: "prescription" }, { es: "descansar", en: "to rest" },
    ],
    grammar: [
      { es: "Me duele la cabeza.", en: "My head hurts." },
      { es: "Me duele desde hace dos días.", en: "It's hurt for two days." },
      { es: "¿Puede recetarme algo?", en: "Can you prescribe me something?" },
    ],
    listening: { es: "¿Qué le pasa? ¿Desde cuándo le duele?", en: "What's wrong? Since when has it hurt?",
      q: { question: "What is the doctor asking?", options: ["What's wrong and since when", "Your name", "The price"], answer: 0 } },
    speaking: { es: "Me duele la garganta desde hace tres días.", en: "My throat has hurt for three days." },
    writing: { promptEn: "Tell the doctor what hurts, for how long, and ask for medication.", targetEs: "Me duele la cabeza desde hace dos días. ¿Puede recetarme algo?" },
    levels: [
      { name: "Listening", learn: "“¿Qué le pasa?” · “¿Desde cuándo?” — hear a real consultation before drilling the words.", minutes: 4 },
      { name: "Grammar", learn: "Me duele / me duelen · Desde hace… · ¿Puede recetarme…? — one structure at a time, then practice.", minutes: 5 },
      { name: "Vocabulary", learn: "cabeza, garganta, estómago, fiebre, tos, receta, medicamento — recognition, recall, pronunciation.", minutes: 6 },
      { name: "Speaking", learn: "Describe symptoms to an AI doctor and understand the advice.", minutes: 6 },
      { name: "Writing", learn: "Write what hurts, how long, and a request for medication.", minutes: 5 },
      { name: "Final Challenge", learn: "A real consultation — no hints, native speed, describe, clarify, ask.", minutes: 7 },
    ],
  },
];

// The mission LIST is loaded from the API (missionsApi) so seeded missions —
// and every future one — appear automatically. The hardcoded MISSIONS above act
// as a per-id "overlay" of rich playable content (grammar/listening/speaking/
// writing/levels/emoji/coords) for missions that have it authored. A DB mission
// with no overlay still shows, driven by its title + vocab.
// A generated mission's overlay carries only presentation + levels; fill the
// unused lesson-array fields (the real lessons come from the *_LESSONS maps).
function generatedToMission(o: GeneratedOverlay): Mission {
  return {
    ...o,
    vocab: [],
    grammar: [],
    listening: { es: "", en: "", q: { question: "", options: [], answer: 0 } },
    speaking: { es: "", en: "" },
    writing: { promptEn: "", targetEs: "" },
  };
}

// Hand-authored overlays win over generated ones for the same id.
const MISSION_OVERLAY: Record<string, Mission> = {
  ...Object.fromEntries(Object.values(generatedOverlays).map((o) => [o.id, generatedToMission(o)])),
  ...Object.fromEntries(MISSIONS.map((m) => [m.id, m])),
};

// Globe coordinates for missions with no authored overlay, so they still pin.
const FALLBACK_COORDS: [number, number][] = [
  [40.4, -3.7], [19.4, -99.1], [-12.0, -77.0], [48.9, 2.3],
  [-34.6, -58.4], [41.4, 2.2], [35.7, 139.7], [-33.9, 151.2],
];

// Build a Mission from its DB fields. Vocab is passed separately: the list
// renders with an empty vocab (loaded lazily per mission on open), the detail
// fetch passes the real vocab.
// Balanced [start, end) ranges splitting `total` words into exactly two
// vocabulary units (one, for a near-empty mission) so every mission's new
// words are taught across two bursts, never more.
export function vocabBurstRanges(total: number): [number, number][] {
  if (total <= 0) return [];
  const burstCount = total <= 1 ? 1 : 2;
  const size = Math.ceil(total / burstCount);
  const ranges: [number, number][] = [];
  for (let start = 0; start < total; start += size) {
    ranges.push([start, Math.min(total, start + size)]);
  }
  return ranges;
}

const VOCAB_BURST_LABEL = ["I", "II"];

// Onboarding skill priority (User.skill_priority) → the MissionLevel step name
// it should bump to the front. Every mission's ladder is the same fixed
// content for every user (see backend mission_gen.py::_LEVELS) — there's no
// per-user step content to generate, so personalization is just a stable
// reorder of that shared list. "Reading" has no dedicated step yet; the
// closest existing one (Vocabulary, comprehension-adjacent) stands in for it.
const SKILL_PRIORITY_STEP: Record<string, string> = {
  Speaking: "Speaking",
  Listening: "Listening",
  Writing: "Writing",
  Reading: "Vocabulary",
};

// Moves the step matching the user's skill priority to the front, keeping
// every other step's relative order untouched (stable sort). No-op when the
// user has no priority set, or the mission has no matching step name — e.g. a
// "Vocabulary I/II/III" burst only matches a plain "Reading" priority once
// vocabBurstRanges collapses to a single "Vocabulary" burst.
function prioritiseStep(steps: MissionLevel[], skillPriority?: string | null): MissionLevel[] {
  const wanted = skillPriority ? SKILL_PRIORITY_STEP[skillPriority] : undefined;
  if (!wanted) return steps;
  const idx = steps.findIndex((s) => s.name === wanted);
  if (idx <= 0) return steps;
  const copy = steps.slice();
  const [step] = copy.splice(idx, 1);
  copy.unshift(step);
  return copy;
}

// Splices generated Vocabulary I/II steps into a mission's authored non-vocab
// steps (Listening, Grammar, Speaking, Writing, Final Challenge): burst 1
// after Listening, burst 2 after Grammar. A "Review" step covering every word
// taught in those two bursts is inserted right before Final Challenge. Any
// legacy "Vocabulary" step still authored on `base` (older content, teaching
// the full list at once) is dropped — the two bursts + Review step replace it.
function buildMissionSteps(
  base: MissionLevel[], vocabCount: number, skillPriority?: string | null,
): MissionLevel[] {
  const ranges = vocabBurstRanges(vocabCount);
  const vocabSteps: MissionLevel[] = ranges.map(([start, end], i) => ({
    name: ranges.length === 1 ? "Vocabulary" : `Vocabulary ${VOCAB_BURST_LABEL[i] ?? i + 1}`,
    learn: `${end - start} new word${end - start === 1 ? "" : "s"} — image recognition, active recall, pronunciation.`,
    minutes: Math.max(3, end - start),
    vocabBurst: i,
  }));
  const listening = base.find((s) => s.name === "Listening");
  const grammar = base.find((s) => s.name === "Grammar");
  const rest = base.filter((s) => s !== listening && s !== grammar && s.name !== "Vocabulary");
  const steps: MissionLevel[] = [];
  if (listening) steps.push(listening);
  if (vocabSteps[0]) steps.push(vocabSteps[0]);
  if (grammar) steps.push(grammar);
  if (vocabSteps[1]) steps.push(vocabSteps[1]);

  // Feedback/Correction: a mistake round-up from everything just practised
  // (Vocab/Grammar/Speaking/Writing), spliced right after Writing.
  const writingIdx = rest.findIndex((s) => s.name === "Writing");
  const feedback: MissionLevel = {
    name: "Feedback",
    learn: "A quick look at what tripped you up before it counts.",
    minutes: 2,
  };
  if (writingIdx === -1) rest.push(feedback); else rest.splice(writingIdx + 1, 0, feedback);

  const finalIdx = rest.findIndex((s) => s.name === "Final Challenge");
  if (vocabCount > 0) {
    const recap: MissionLevel = {
      name: "Vocabulary Recap",
      learn: `All ${vocabCount} new word${vocabCount === 1 ? "" : "s"} from this mission, mixed together — a last check before the real conversation.`,
      minutes: Math.max(3, Math.min(7, vocabCount)),
    };
    if (finalIdx === -1) rest.push(recap); else rest.splice(finalIdx, 0, recap);
  }
  steps.push(...rest); // Speaking, Writing, Feedback, Vocabulary Recap, Final Challenge, in order
  const ordered = prioritiseStep(steps, skillPriority);
  // Context Preview always leads the ladder — pinned after skill-priority
  // reordering so it's never displaced from position 0.
  const preview: MissionLevel = {
    name: "Context Preview",
    learn: "The situation and a few key phrases, before you dive in.",
    minutes: 2,
  };
  return [preview, ...ordered];
}

export function buildMission(
  id: string,
  title: string,
  description: string | null,
  vocab: { es: string; en: string }[],
  i: number,
  speakingScript?: MissionSpeaking | null,
  status?: string | null,
  grammarPatterns?: { id: string; cloze_template: string }[],
  recommended?: boolean,
  skillPriority?: string | null,
  contextPreview?: ContextPreview | null,
): Mission {
  const base = MISSION_OVERLAY[id];
  if (base) {
    // Rich content from the overlay, but title/blurb/vocab stay DB-driven, and
    // the vocab-burst steps are generated fresh from the real word count.
    const levels = base.levels ? buildMissionSteps(base.levels, vocab.length, skillPriority) : undefined;
    return {
      ...base, id, title, blurb: description ?? base.blurb, vocab, levels,
      speakingScript, status, grammarPatterns, recommended, contextPreview,
    };
  }
  const [lat, lon] = FALLBACK_COORDS[i % FALLBACK_COORDS.length];
  return {
    id,
    icon: "globe",
    title,
    blurb: description ?? "",
    tag: "Mission",
    lat,
    lon,
    vocab,
    grammar: [],
    listening: { es: "", en: "", q: { question: "", options: [], answer: 0 } },
    speaking: { es: "", en: "" },
    writing: { promptEn: "", targetEs: "" },
    speakingScript,
    status,
    recommended,
    contextPreview,
  };
}

