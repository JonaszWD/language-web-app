"use client";

import { useEffect, useState } from "react";
import { authApi, grammarApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import { speakEs } from "@/lib/speak";
import {
  ADVANCED_SEVEN_STAGE_LESSONS,
  type PtBlank,
  type PtWhoItem,
  type SevenStageSpec,
} from "@/content/grammar-lessons";

function ReflectQ({ q, reveal, predict }: { q: string; reveal: string; predict?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ls-reflectq">
      <button className="ls-rq-q" onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <span className={"conn-chev" + (open ? " up" : "")}><Icon name="chevron" size={14} /></span>
      </button>
      {open && <div className={"ls-rq-a" + (predict ? " predict" : "")}>{reveal}</div>}
    </div>
  );
}

/* ════════════════════════ GRAMMAR ════════════════════════
   Acquisition flow, not a textbook:  Notice → Understand → Practice → Produce
   (+ error correction inside Practice). */
type GrNotice = { es: string; en: string; hl: string };
type GrEnding = { pron: string; stem: string; end: string };
type GrItem =
  | { kind: "mc"; before: string; after: string; en: string; options: string[]; answer: number }
  | { kind: "blank"; before: string; after: string; en: string; answer: string }
  | { kind: "transform"; instruction: string; source: string; en: string; answer: string }
  | { kind: "error"; sentence: string; bad: string; correct: string; why: string };
type GrLesson = {
  id: string; chip: string; verb: string; gloss: string; focus: string;
  notice: GrNotice[]; explain: string; endings: GrEnding[];
  items: GrItem[]; produce: { prompt: string; en: string; instruction: string };
};

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,!?¡¿]/g, "");

const GRAMMAR_LESSONS: GrLesson[] = [
  {
    id: "ar", chip: "Present · -AR", verb: "hablar", gloss: "to speak", focus: "Present tense, regular -AR verbs",
    notice: [
      { es: "Yo hablo español.", en: "I speak Spanish.", hl: "hablo" },
      { es: "Ella habla rápido.", en: "She speaks fast.", hl: "habla" },
      { es: "Nosotros hablamos mucho.", en: "We talk a lot.", hl: "hablamos" },
    ],
    explain: "Drop -ar from the infinitive, add the ending for the person. The stem (habl-) stays put.",
    endings: [
      { pron: "yo", stem: "habl", end: "o" }, { pron: "tú", stem: "habl", end: "as" },
      { pron: "él / ella", stem: "habl", end: "a" }, { pron: "nosotros", stem: "habl", end: "amos" },
      { pron: "vosotros", stem: "habl", end: "áis" }, { pron: "ellos", stem: "habl", end: "an" },
    ],
    items: [
      { kind: "mc", before: "Cada mañana, tú ", after: " con tus amigos.", en: "Every morning, you ___ with your friends.", options: ["hablo", "hablas", "habla", "hablamos"], answer: 1 },
      { kind: "blank", before: "Nosotros ", after: " inglés en clase.", en: "We ___ English in class.", answer: "hablamos" },
      { kind: "transform", instruction: "Rewrite for «ella»:", source: "Yo trabajo aquí.", en: "I work here. → She works here.", answer: "ella trabaja aqui" },
      { kind: "error", sentence: "Yo habla español.", bad: "habla", correct: "hablo", why: "«yo» takes -o, not -a." },
    ],
    produce: { prompt: "Describe tu mañana.", en: "Describe your morning.", instruction: "Use at least five present-tense verbs." },
  },
  {
    id: "er", chip: "Present · -ER", verb: "comer", gloss: "to eat", focus: "Present tense, regular -ER verbs",
    notice: [
      { es: "Yo como a las dos.", en: "I eat at two.", hl: "como" },
      { es: "Él come pan.", en: "He eats bread.", hl: "come" },
      { es: "Nosotros comemos juntos.", en: "We eat together.", hl: "comemos" },
    ],
    explain: "Same idea as -ar, but the endings use e: -o, -es, -e, -emos, -éis, -en.",
    endings: [
      { pron: "yo", stem: "com", end: "o" }, { pron: "tú", stem: "com", end: "es" },
      { pron: "él / ella", stem: "com", end: "e" }, { pron: "nosotros", stem: "com", end: "emos" },
      { pron: "vosotros", stem: "com", end: "éis" }, { pron: "ellos", stem: "com", end: "en" },
    ],
    items: [
      { kind: "mc", before: "¿Tú ", after: " carne?", en: "Do you eat meat?", options: ["como", "comes", "come", "comen"], answer: 1 },
      { kind: "blank", before: "Ellos ", after: " en el parque.", en: "They eat in the park.", answer: "comen" },
      { kind: "error", sentence: "Nosotros comen pizza.", bad: "comen", correct: "comemos", why: "«nosotros» takes -emos." },
    ],
    produce: { prompt: "¿Qué comes en un día normal?", en: "What do you eat in a normal day?", instruction: "Use at least four -er or -ir verbs." },
  },
  {
    id: "ir", chip: "Present · -IR", verb: "vivir", gloss: "to live", focus: "Present tense, regular -IR verbs",
    notice: [
      { es: "Yo vivo en Madrid.", en: "I live in Madrid.", hl: "vivo" },
      { es: "Ella vive sola.", en: "She lives alone.", hl: "vive" },
      { es: "Vosotros vivís cerca.", en: "You all live nearby.", hl: "vivís" },
    ],
    explain: "Almost identical to -er. Only nosotros (-imos) and vosotros (-ís) differ.",
    endings: [
      { pron: "yo", stem: "viv", end: "o" }, { pron: "tú", stem: "viv", end: "es" },
      { pron: "él / ella", stem: "viv", end: "e" }, { pron: "nosotros", stem: "viv", end: "imos" },
      { pron: "vosotros", stem: "viv", end: "ís" }, { pron: "ellos", stem: "viv", end: "en" },
    ],
    items: [
      { kind: "mc", before: "Nosotros ", after: " en España.", en: "We live in Spain.", options: ["vivo", "vives", "vivimos", "viven"], answer: 2 },
      { kind: "blank", before: "¿Dónde ", after: " tú?", en: "Where do you live?", answer: "vives" },
      { kind: "error", sentence: "Yo vives aquí.", bad: "vives", correct: "vivo", why: "«yo» takes -o." },
    ],
    produce: { prompt: "Describe dónde vives.", en: "Describe where you live.", instruction: "Use at least four present-tense verbs." },
  },
];

type GrStage = "notice" | "understand" | "practice" | "produce";
const GR_STAGES: { key: GrStage; label: string }[] = [
  { key: "notice", label: "Notice" }, { key: "understand", label: "Understand" },
  { key: "practice", label: "Practice" }, { key: "produce", label: "Produce" },
];

// CEFR grammar syllabus — mirrors the Speaking tab's picker structure (see
// FreeChat's ScenarioPicker): sections grouped by level, every level up to
// and including the learner's own shown open, the next level up shown
// grayed-out/locked, everything past that hidden.
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
type CefrLevel = (typeof CEFR_LEVELS)[number];
const CEFR_LEVEL_NAMES: Record<CefrLevel, string> = {
  A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper Intermediate", C1: "Advanced",
};
const CEFR_GRAMMAR_TOPICS: Record<CefrLevel, string[]> = {
  A1: [
    "Nouns: gender & number basics, definite/indefinite articles",
    "Adjectives: basic agreement, common placement",
    "Subject pronouns",
    "Present tense: regular -ar/-er/-ir verbs",
    "Ser vs. Estar: introduced (basic uses — identity vs. location/state)",
    "Basic reflexive verbs (llamarse)",
    "Simple prepositions (en, de, a, con)",
    "Basic negation (no)",
    "Question words (qué, dónde, cómo)",
    "Gustar-type verbs (basic)",
  ],
  A2: [
    "Preterite tense (regular + common irregulars)",
    "Imperfect tense (introduced)",
    "Direct object pronouns",
    "Possessive adjectives/pronouns",
    "Demonstratives",
    "Comparatives and superlatives",
    "Ir + a + infinitive (near future)",
    "More reflexive verbs",
    "Adverbs of frequency/manner",
    "Por vs. para: basic uses",
  ],
  B1: [
    "Preterite vs. imperfect (contrast — the real battle begins)",
    "Indirect object pronouns",
    "Double object pronouns (combining direct + indirect)",
    "Future tense (regular + irregular)",
    "Conditional tense (introduced)",
    "Present subjunctive: introduced (basic triggers — wishes, doubt)",
    "Commands (imperative — affirmative and negative)",
    "Relative pronouns (que, quien)",
    "Por vs. para: expanded",
  ],
  B2: [
    "Subjunctive: expanded (emotion, doubt, hypotheticals, adjective/adverb clauses)",
    "Imperfect subjunctive",
    "Compound tenses (present perfect, past perfect/pluperfect)",
    "Conditional + subjunctive combos (si clauses — hypothetical situations)",
    "Passive voice (ser + participle, passive se)",
    "Gerunds in complex constructions",
    "Sequence of tenses",
    "Subordinate clauses (more complex)",
  ],
  C1: [
    "Subjunctive: full range (concessive clauses, complex hypotheticals)",
    "All compound/perfect tenses across moods",
    "Nuanced ser/estar distinctions (idiomatic, non-obvious cases)",
    "Nuanced por/para distinctions",
    "Reported/indirect speech with tense shifts",
    "Stylistic word order variation",
    "Nominalization, complex connectors",
  ],
};
// One short, plain-English sentence per topic — shown under the progress bar
// on the topic card so the learner knows what the session covers before
// opening it.
const TOPIC_DESCRIPTIONS: Record<string, string> = {
  "Nouns: gender & number basics, definite/indefinite articles": "Learn why words are el or la, and how to make them plural.",
  "Adjectives: basic agreement, common placement": "Match adjectives to the noun they describe and know where to put them.",
  "Subject pronouns": "Yo, tú, él, nosotros — who's doing the action.",
  "Present tense: regular -ar/-er/-ir verbs": "Talk about what happens now, with regular verbs like hablar, comer and vivir.",
  "Ser vs. Estar: introduced (basic uses — identity vs. location/state)": "Two words for \"to be\" — one for what something is, one for where or how it is.",
  "Basic reflexive verbs (llamarse)": "Say your name and talk about things you do to yourself.",
  "Simple prepositions (en, de, a, con)": "Small words that link ideas — in, of, to, with.",
  "Basic negation (no)": "Turn a sentence around with a single word.",
  "Question words (qué, dónde, cómo)": "Ask what, where and how in Spanish.",
  "Gustar-type verbs (basic)": "Say what you like — the Spanish way round, not the English way.",
  "Preterite tense (regular + common irregulars)": "Talk about finished actions in the past — what happened.",
  "Imperfect tense (introduced)": "Describe how things used to be, or what was happening.",
  "Direct object pronouns": "Swap out the thing being acted on for a short pronoun — lo, la, los, las.",
  "Possessive adjectives/pronouns": "Say what's yours, mine, ours and theirs.",
  "Demonstratives": "Point things out — this, that, these, those.",
  "Comparatives and superlatives": "Say something is bigger, better, or the best.",
  "Ir + a + infinitive (near future)": "Talk about what you're going to do next.",
  "More reflexive verbs": "More everyday actions you do to yourself, beyond the basics.",
  "Adverbs of frequency/manner": "Say how often or how something happens.",
  "Por vs. para: basic uses": "Two words for \"for\" — the first everyday distinctions.",
  "Preterite vs. imperfect (contrast — the real battle begins)": "Decide which past tense fits — a finished event or a scene in progress.",
  "Indirect object pronouns": "Say who something is done to or for — le, les.",
  "Double object pronouns (combining direct + indirect)": "Use both pronouns together, in the right order.",
  "Future tense (regular + irregular)": "Talk about what will happen, without using ir + a.",
  "Conditional tense (introduced)": "Say what you would do.",
  "Present subjunctive: introduced (basic triggers — wishes, doubt)": "The mood for wishes, doubts and \"maybe\" — first triggers.",
  "Commands (imperative — affirmative and negative)": "Tell someone to do something, or not to.",
  "Relative pronouns (que, quien)": "Join two ideas together with \"that\" or \"who.\"",
  "Por vs. para: expanded": "More uses of por and para, beyond the basics.",
  "Subjunctive: expanded (emotion, doubt, hypotheticals, adjective/adverb clauses)": "The subjunctive shows up for feelings, doubts and hypotheticals — more triggers.",
  "Imperfect subjunctive": "The subjunctive's past-tense form, for wishes and hypotheticals about before.",
  "Compound tenses (present perfect, past perfect/pluperfect)": "Say what has happened or had happened, using haber.",
  "Conditional + subjunctive combos (si clauses — hypothetical situations)": "\"If this were true, I would...\" — hypothetical if-sentences.",
  "Passive voice (ser + participle, passive se)": "Shift focus onto what happened, rather than who did it.",
  "Gerunds in complex constructions": "The -ing form, used beyond simple progressive tenses.",
  "Sequence of tenses": "Keep verb tenses lining up correctly across a sentence.",
  "Subordinate clauses (more complex)": "Build longer sentences with clauses tucked inside clauses.",
  "Subjunctive: full range (concessive clauses, complex hypotheticals)": "The full range of the subjunctive, including \"even if\" and layered hypotheticals.",
  "All compound/perfect tenses across moods": "Every perfect tense, across indicative and subjunctive.",
  "Nuanced ser/estar distinctions (idiomatic, non-obvious cases)": "The tricky ser/estar cases that don't follow the basic rule.",
  "Nuanced por/para distinctions": "The tricky por/para cases native speakers just know.",
  "Reported/indirect speech with tense shifts": "Report what someone said, shifting the tense correctly.",
  "Stylistic word order variation": "Reorder a sentence for emphasis or style, without changing its meaning.",
  "Nominalization, complex connectors": "Turn verbs and ideas into nouns, and link complex sentences smoothly.",
};

// Which of the interactive GRAMMAR_LESSONS entries belong to a given topic.
// Every other topic is backed by a seven-stage spec (SEVEN_STAGE_LESSONS);
// a topic with neither falls back to a "coming soon" placeholder.
const TOPIC_LESSON_IDS: Record<string, string[]> = {
  "Present tense: regular -ar/-er/-ir verbs": ["ar", "er", "ir"],
};

function levelIndex(level: string): number {
  const i = CEFR_LEVELS.indexOf(level as CefrLevel);
  return i === -1 ? 0 : i;
}

// Orange at the start, green as stages complete, blue once every stage's
// been visited — shared between the in-lesson progress bar and each topic
// card's mini progress bar on the picker.
function ptLerpColor(from: [number, number, number], to: [number, number, number], t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
const PT_ORANGE: [number, number, number] = [237, 137, 54];
const PT_GREEN: [number, number, number] = [56, 178, 128];
const PT_BLUE: [number, number, number] = [59, 130, 246];

function ptProgressColor(stage: number, total: number): string {
  if (stage >= total) return `rgb(${PT_BLUE.join(", ")})`;
  return ptLerpColor(PT_ORANGE, PT_GREEN, Math.min(1, (stage - 1) / (total - 1)));
}

// Present tense's furthest-reached stage — the only topic with real content
// right now — persisted so the topic card can show progress across visits.
// No dedicated backend table for this trial; same client-side pattern as
// sp-completed-scenarios in FreeChat.
const PT_PROGRESS_KEY = "sp-pt-progress-stage";
const PT_TOTAL_STAGES = 7;
function loadPtProgressStage(): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(window.localStorage.getItem(PT_PROGRESS_KEY) ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}
function savePtProgressStage(stage: number) {
  if (typeof window === "undefined") return;
  if (stage > loadPtProgressStage()) window.localStorage.setItem(PT_PROGRESS_KEY, String(stage));
}

function GrammarTopicCard({ topic, locked, onPick }: { topic: string; locked: boolean; onPick: () => void }) {
  const sevenStageSpec = SEVEN_STAGE_LESSONS[topic];
  const hasContent = !!TOPIC_LESSON_IDS[topic] || !!sevenStageSpec;
  const clickable = !locked && hasContent;
  // Read client-side only — avoids an SSR/CSR hydration mismatch since the
  // value lives in localStorage.
  const [stageReached, setStageReached] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate localStorage progress after mount
    if (topic === PRESENT_TENSE_TOPIC) setStageReached(loadPtProgressStage());
    else if (sevenStageSpec) setStageReached(loadStageProgress(`sp-gr7-progress-${sevenStageSpec.id}`));
  }, [topic, sevenStageSpec]);
  const pct = stageReached > 0 ? Math.min(1, (stageReached - 1) / (PT_TOTAL_STAGES - 1)) : 0;

  return (
    <button
      className={"sp-card quick sp-mode gr-topic-card" + (locked ? " is-locked" : "")}
      onClick={locked ? undefined : onPick}
      disabled={locked}
      style={{ textAlign: "left", cursor: locked ? "default" : "pointer" }}
    >
      <div style={{ alignSelf: "stretch" }}>
        <div className="gr-topic-head">
          <span className="q-name">{topic}</span>
          {clickable && <span className="gr-topic-arrow"><Icon name="chevron" size={14} /></span>}
        </div>
        <div className="sp-progress gr-topic-progress">
          <i style={{ width: `${pct * 100}%`, background: ptProgressColor(stageReached || 1, PT_TOTAL_STAGES) }} />
        </div>
        {TOPIC_DESCRIPTIONS[topic] && <div className="q-sub gr-topic-desc">{TOPIC_DESCRIPTIONS[topic]}</div>}
        {!hasContent && !locked && <div className="q-sub">Coming soon</div>}
      </div>
      {locked && <span className="sp-tag ghost">Locked</span>}
    </button>
  );
}

function GrammarTopicPicker({ userLevel, onPickTopic }: { userLevel: string; onPickTopic: (topic: string) => void }) {
  const upto = levelIndex(userLevel);
  // Every level the learner has reached, plus one more shown locked/grayed.
  const visibleLevels = CEFR_LEVELS.slice(0, Math.min(upto + 2, CEFR_LEVELS.length));

  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Grammar</p>
        <h1 className="sp-h1">Pick a topic</h1>
      </div>

      {visibleLevels.map((level, i) => {
        const locked = i > upto;
        return (
          <div key={level} className="sp-mode-section">
            <p className="sp-section-label">
              {level} ({CEFR_LEVEL_NAMES[level]}){locked ? " · Locked" : ""}
            </p>
            <div className="quick-row sp-modes">
              {CEFR_GRAMMAR_TOPICS[level].map((topic) => (
                <GrammarTopicCard key={topic} topic={topic} locked={locked} onPick={() => onPickTopic(topic)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GrammarTopicComingSoon({ topic, onExit }: { topic: string; onExit: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", margin: "0 0 16px" }}>
        <button
          type="button"
          className="sp-btn"
          onClick={onExit}
          aria-label="Back to topics"
          title="Back to topics"
        >
          <Icon name="chevron" size={16} /> Back
        </button>
        <div>
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Grammar</p>
          <h1 className="sp-h1">{topic}</h1>
        </div>
      </div>
      <div className="sp-card" style={{ padding: "clamp(24px, 4vw, 40px)", textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <h2 className="sp-h1" style={{ fontSize: 20 }}>This lesson is still being built</h2>
        <p className="sp-sub" style={{ maxWidth: "48ch" }}>Check back soon — practice for this topic is on the way.</p>
      </div>
    </div>
  );
}

function GrammarLessonFlow({ topic, lessonIds, onExit }: { topic: string; lessonIds: string[]; onExit: () => void }) {
  const lessons = GRAMMAR_LESSONS.filter((l) => lessonIds.includes(l.id));
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const [stage, setStage] = useState<GrStage>("notice");
  const lesson = lessons.find((l) => l.id === lessonId) || lessons[0];

  const pickLesson = (id: string) => { setLessonId(id); setStage("notice"); };

  return (
    <div>
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="sp-btn"
          onClick={onExit}
          aria-label="Back to topics"
          title="Back to topics"
        >
          <Icon name="chevron" size={16} /> Back
        </button>
        <div>
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Grammar · {topic}</p>
          <h1 className="sp-h1">{lesson.verb} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {lesson.gloss}</span></h1>
        </div>
      </div>

      {lessons.length > 1 && (
        <div className="gr-tools">
          {lessons.map((l) => (
            <span key={l.id} className={"sp-chip" + (l.id === lessonId ? " is-active" : "")} onClick={() => pickLesson(l.id)}>{l.chip}</span>
          ))}
        </div>
      )}

      <div className="gr-stepper">
        {GR_STAGES.map((s, i) => (
          <button key={s.key} className={"gr-step" + (s.key === stage ? " is-active" : "")} onClick={() => setStage(s.key)}>
            <span className="gr-step-n">{i + 1}</span>{s.label}
          </button>
        ))}
      </div>

      {stage === "notice" && <GrNoticeStage lesson={lesson} onNext={() => setStage("understand")} />}
      {stage === "understand" && <GrUnderstandStage lesson={lesson} onNext={() => setStage("practice")} />}
      {stage === "practice" && <GrPracticeStage lesson={lesson} onNext={() => setStage("produce")} />}
      {stage === "produce" && <GrProduceStage lesson={lesson} />}
    </div>
  );
}

function GrammarScreen() {
  const [userLevel, setUserLevel] = useState<string>("A1");
  useEffect(() => {
    authApi.me().then((u) => { if (u.cefr_level) setUserLevel(u.cefr_level); }).catch(() => {});
  }, []);
  const [topic, setTopic] = useState<string | null>(null);

  if (topic) {
    if (topic === PRESENT_TENSE_TOPIC) {
      return <PresentTenseFlow onExit={() => setTopic(null)} />;
    }
    const sevenStageSpec = SEVEN_STAGE_LESSONS[topic];
    if (sevenStageSpec) {
      return <SevenStageFlow spec={sevenStageSpec} onExit={() => setTopic(null)} />;
    }
    const lessonIds = TOPIC_LESSON_IDS[topic];
    return lessonIds
      ? <GrammarLessonFlow topic={topic} lessonIds={lessonIds} onExit={() => setTopic(null)} />
      : <GrammarTopicComingSoon topic={topic} onExit={() => setTopic(null)} />;
  }

  return <GrammarTopicPicker userLevel={userLevel} onPickTopic={setTopic} />;
}

function GrNoticeStage({ lesson, onNext }: { lesson: GrLesson; onNext: () => void }) {
  // Split each sentence so the highlighted ending stands out.
  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Read these. What changes? Notice the verb endings.</p>
      <div className="gr-notice-list">
        {lesson.notice.map((n, i) => {
          const idx = n.es.toLowerCase().indexOf(n.hl.toLowerCase());
          const pre = n.es.slice(0, idx);
          const post = n.es.slice(idx + n.hl.length);
          return (
            <div className="gr-notice" key={i}>
              <div className="gr-notice-es">
                {pre}<mark>{n.hl}</mark>{post}
                <button className="vo-speak" onClick={() => speakEs(n.es)} title="Listen"><Icon name="speaker" size={16} /></button>
              </div>
              <div className="gr-notice-en">{n.en}</div>
            </div>
          );
        })}
      </div>
      <button className="sp-btn sp-btn-primary" onClick={onNext}>Got it — why? <Icon name="chevron" size={16} /></button>
    </div>
  );
}

function GrUnderstandStage({ lesson, onNext }: { lesson: GrLesson; onNext: () => void }) {
  return (
    <div className="gr-grid">
      <div className="sp-card gr-stage-card">
        <p className="gr-stage-hint">The rule, in one breath:</p>
        <p className="gr-explain">{lesson.explain}</p>
        <button className="sp-btn sp-btn-primary" onClick={onNext}>Practice it <Icon name="chevron" size={16} /></button>
      </div>
      <div className="sp-card gr-table">
        <h4>{lesson.verb} · endings</h4>
        {lesson.endings.map((e, i) => (
          <div className="conj-row" key={i}>
            <span className="conj-pron">{e.pron}</span>
            <span className="conj-form">{e.stem}<b>{e.end}</b></span>
          </div>
        ))}
        <button className="sp-btn sp-btn-soft" style={{ width: "100%", marginTop: 14, minHeight: 42 }} onClick={() => speakEs(lesson.endings.map((e) => e.stem + e.end).join(", "))}>
          <Icon name="speaker" size={16} /> Hear all forms
        </button>
      </div>
    </div>
  );
}

function GrPracticeStage({ lesson, onNext }: { lesson: GrLesson; onNext: () => void }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const item = lesson.items[idx];
  const last = idx === lesson.items.length - 1;
  const advance = () => { if (last) setDone(true); else setIdx(idx + 1); };

  return (
    <div className="sp-card gr-stage-card">
      <div className="gr-prog">
        <div className="sp-progress aqua" style={{ width: 140 }}>
          <i style={{ width: `${((idx + (done ? 1 : 0)) / lesson.items.length) * 100}%` }} />
        </div>
        <span className="gr-prog-txt">{Math.min(idx + 1, lesson.items.length)} / {lesson.items.length}</span>
      </div>

      {done ? (
        <div className="gr-done">
          <div className="gr-done-ico"><Icon name="check" size={26} /></div>
          <p className="gr-stage-hint" style={{ marginBottom: 14 }}>Controlled practice complete. Now make it yours.</p>
          <button className="sp-btn sp-btn-primary" onClick={onNext}>Produce <Icon name="chevron" size={16} /></button>
        </div>
      ) : (
        <GrItemView key={idx} item={item} onNext={advance} lastLabel={last ? "Finish" : "Next"} />
      )}
    </div>
  );
}

function GrItemView({ item, onNext, lastLabel }: { item: GrItem; onNext: () => void; lastLabel: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [clicked, setClicked] = useState<string | null>(null);

  const kindTag: Record<GrItem["kind"], string> = {
    mc: "Multiple choice", blank: "Fill the blank", transform: "Transform", error: "Find the mistake",
  };

  let correct = false;
  if (item.kind === "mc") correct = picked === item.answer;
  else if (item.kind === "blank" || item.kind === "transform") correct = norm(typed) === norm(item.answer);
  else if (item.kind === "error") correct = clicked === item.bad;

  const checked = item.kind === "error" ? clicked !== null : revealed;

  return (
    <div className="gr-item">
      <span className="sp-tag ghost gr-kind">{kindTag[item.kind]}</span>

      {item.kind === "mc" && (
        <>
          <div className="gr-prompt">
            {item.before}<span className="blank">{picked !== null ? item.options[picked] : "_____"}</span>{item.after}
            <span className="en">{item.en}</span>
          </div>
          <div className="gr-answers">
            {item.options.map((o, i) => (
              <button
                key={i}
                className={"gr-answer" + (checked && i === item.answer ? " correct" : "") + (checked && picked === i && i !== item.answer ? " wrong" : "")}
                onClick={() => { if (!checked) { setPicked(i); setRevealed(true); } }}
              >
                <span className="key">{String.fromCharCode(65 + i)}</span>{o}
                {checked && i === item.answer && <span style={{ marginLeft: "auto" }}><Icon name="check" size={18} /></span>}
              </button>
            ))}
          </div>
        </>
      )}

      {(item.kind === "blank" || item.kind === "transform") && (
        <>
          <div className="gr-prompt">
            {item.kind === "blank"
              ? <>{item.before}<span className="blank">{typed || "_____"}</span>{item.after}</>
              : <><b>{item.instruction}</b> <span style={{ display: "block", marginTop: 6 }}>{item.source}</span></>}
            <span className="en">{item.en}</span>
          </div>
          <input
            className="gr-input"
            value={typed}
            placeholder="Type in Spanish…"
            disabled={revealed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) setRevealed(true); }}
          />
          {revealed && !correct && <p className="gr-fix">Answer: <b>{item.answer}</b></p>}
        </>
      )}

      {item.kind === "error" && (
        <>
          <p className="gr-stage-hint">Tap the word that&apos;s wrong.</p>
          <div className="gr-errsent">
            {item.sentence.split(/(\s+)/).map((tok, i) => {
              if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
              const clean = tok.replace(/[.,!?¡¿]/g, "");
              const isBad = clean === item.bad;
              const sel = clicked === clean;
              return (
                <span
                  key={i}
                  className={"gr-tok" + (checked && isBad ? " good" : "") + (checked && sel && !isBad ? " bad" : "")}
                  onClick={() => { if (!checked) setClicked(clean); }}
                >
                  {tok}
                </span>
              );
            })}
          </div>
          {checked && <p className="gr-fix">{item.bad} → <b>{item.correct}</b> · {item.why}</p>}
        </>
      )}

      <div className="gr-foot">
        <span className={"gr-verdict" + (checked ? (correct ? " ok" : " no") : "")}>
          {checked ? (correct ? "Correct" : "Not quite") : ""}
        </span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={!checked} onClick={onNext}>
          {lastLabel} <Icon name="chevron" size={16} />
        </button>
      </div>
    </div>
  );
}

function GrProduceStage({ lesson }: { lesson: Pick<GrLesson, "focus" | "produce"> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<import("@/types").GrammarCheck | null>(null);
  const [err, setErr] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const check = async () => {
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await grammarApi.check(lesson.focus, lesson.produce.instruction, text);
      setRes(r);
    } catch {
      setErr("Could not grade right now — check that MISTRAL_API_KEY or CLAUDE_API_KEY is set.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-card gr-stage-card">
      <div className="wr-sheet-head" style={{ marginBottom: 16 }}>
        <div className="wr-sheet-prompt">
          <span className="sp-tag pink"><Icon name="spark" size={13} /> Produce</span>
          <div className="wr-prompt-text">{lesson.produce.prompt}</div>
          <div className="wr-prompt-en">{lesson.produce.en}</div>
        </div>
        <span className="sp-tag ghost">{lesson.produce.instruction}</span>
      </div>

      <textarea
        className="wr-editor"
        style={{ minHeight: 160 }}
        placeholder="Escribe aquí…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="wr-editbar">
        <span className="wr-count">{words} words</span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={busy || !text.trim()} onClick={check}>
          <Icon name="check" size={16} /> {busy ? "Checking…" : "Check with AI"}
        </button>
      </div>

      {err && <p className="gr-fix" style={{ color: "var(--negative)" }}>{err}</p>}

      {res && (
        <div className="gr-result">
          <div className="gr-result-head">
            <div className={"gr-score" + (res.meets_requirement ? " ok" : "")}>{res.score}<small>/100</small></div>
            <div>
              <div className="gr-result-req">{res.meets_requirement ? "✓ Instruction met" : "Instruction not met yet"}</div>
              <p className="sp-sub">{res.feedback}</p>
            </div>
          </div>
          {res.verbs_used.length > 0 && (
            <div className="gr-verbs">
              {res.verbs_used.map((v, i) => <span key={i} className="sp-chip aqua is-active" style={{ cursor: "default" }}>{v}</span>)}
            </div>
          )}
          {res.corrections.length > 0 && (
            <div className="gr-corrections">
              <h4>Error correction</h4>
              {res.corrections.map((c, i) => (
                <div className="gr-corr" key={i}>
                  <span className="gr-corr-bad">{c.wrong}</span>
                  <Icon name="chevron" size={14} />
                  <span className="gr-corr-good">{c.correct}</span>
                  <span className="gr-corr-why">{c.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════ PRESENT TENSE (7-stage trial) ════════════════════════
   A second-language-acquisition-informed sequence for one topic only, as a
   trial: Notice (input, self-discovery) → Rule check → Structured input
   (comprehension, no production) → Controlled production (one verb category
   at a time) → Mixed/interleaved practice → Meaningful open production →
   Spaced retrieval on a fixed day schedule. See Schmidt 1990 (noticing),
   VanPatten (processing instruction), Bjork (desirable difficulty /
   interleaving), Roediger & Karpicke (testing effect). */
const PRESENT_TENSE_TOPIC = "Present tense: regular -ar/-er/-ir verbs";

const PT_STAGE_LABELS = ["Notice", "Rule check", "Structured input", "Controlled", "Mixed", "Produce", "Spaced review"];

function PtProgressBar({ stage, total }: { stage: number; total: number }) {
  const pct = Math.min(1, (stage - 1) / (total - 1));
  return (
    <div className="sp-progress" style={{ marginBottom: 16 }}>
      <i style={{ width: `${pct * 100}%`, background: ptProgressColor(stage, total), transition: "width .25s, background-color .25s" }} />
    </div>
  );
}

// Freely clickable for now — this trial has no completion gating between
// stages, so jumping around is how you check the structure.
function PtStepper({ stage, onPick }: { stage: number; onPick: (stage: number) => void }) {
  return (
    <div className="gr-stepper">
      {PT_STAGE_LABELS.map((label, i) => (
        <button
          key={label}
          type="button"
          className={"gr-step" + (i + 1 === stage ? " is-active" : "") + (i + 1 < stage ? " done" : "")}
          onClick={() => onPick(i + 1)}
        >
          <span className="gr-step-n">{i + 1}</span>{label}
        </button>
      ))}
    </div>
  );
}

/* ---- Stage 1 · Pattern noticing ------------------------------------- */
// hablar across every person, not a table — the learner circles the ending
// themselves before being told the rule.
const PT_NOTICE_ROWS: { pron: string; stem: string; end: string }[] = [
  { pron: "Yo", stem: "habl", end: "o" },
  { pron: "Tú", stem: "habl", end: "as" },
  { pron: "Ana", stem: "habl", end: "a" },
  { pron: "Nosotros", stem: "habl", end: "amos" },
  { pron: "Ellos", stem: "habl", end: "an" },
];
const PT_NOTICE_VERB = ["español", "inglés", "francés", "italiano", "alemán"];

function PtNoticeStage({ onNext }: { onNext: () => void }) {
  // Every letter of the whole verb form (stem + ending) is clickable — the
  // learner can highlight any of them, but "continue" only unlocks once the
  // ending letters specifically are lit, since that's the pattern to notice.
  const [lit, setLit] = useState<boolean[][]>(() => PT_NOTICE_ROWS.map((r) => (r.stem + r.end).split("").map(() => false)));
  const endingDone = PT_NOTICE_ROWS.every((r, i) => lit[i].slice(r.stem.length).every(Boolean));

  const toggleLetter = (rowIdx: number, letterIdx: number) => {
    setLit((prev) => prev.map((row, i) => (i === rowIdx ? row.map((v, j) => (j === letterIdx ? !v : v)) : row)));
  };

  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Read these sentences. What happens to the end of each verb?</p>
      <div className="gr-notice-list">
        {PT_NOTICE_ROWS.map((r, i) => (
          <div className="gr-notice" key={i}>
            <div className="gr-notice-es">
              {r.pron}{" "}
              <span className="pt-word">
                {(r.stem + r.end).split("").map((ch, j) => (
                  <button
                    key={j}
                    type="button"
                    className={"pt-letter" + (lit[i][j] ? " highlighted" : "")}
                    onClick={() => toggleLetter(i, j)}
                    title="Tap to highlight this letter"
                  >
                    {ch}
                  </button>
                ))}
              </span>{" "}
              {PT_NOTICE_VERB[i]}.
              <button className="vo-speak" onClick={() => speakEs(`${r.pron} ${r.stem}${r.end} ${PT_NOTICE_VERB[i]}.`)} title="Listen"><Icon name="speaker" size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      <p className="gr-stage-hint" style={{ marginTop: -4 }}>Task: click the letters that make up the ending of each verb. What changes? What stays the same?</p>
      <ReflectQ q="What changes? What stays the same?" reveal="The stem habl- never changes. Only the ending changes: -o, -as, -a, -amos, -an, depending on who's doing it." predict />
      <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} disabled={!endingDone} onClick={onNext}>
        {endingDone ? "Show me the rule" : "Highlight every ending first"} <Icon name="chevron" size={16} />
      </button>
    </div>
  );
}

/* ---- Stage 2 · Rule check -------------------------------------------- */
// Fill in the missing endings for hablar — the table becomes the exercise,
// not just a reference.
const PT_RULE_PRONOUNS: { pron: string; end: string }[] = [
  { pron: "yo", end: "o" }, { pron: "nosotros", end: "amos" },
  { pron: "tú", end: "as" }, { pron: "vosotros", end: "áis" },
  { pron: "él/ella", end: "a" }, { pron: "ellos/ellas", end: "an" },
];

function PtRuleStage({ onNext }: { onNext: () => void }) {
  const [typed, setTyped] = useState<string[]>(() => PT_RULE_PRONOUNS.map(() => ""));
  const [checked, setChecked] = useState(false);
  const allCorrect = PT_RULE_PRONOUNS.every((r, i) => norm(typed[i]) === norm(r.end));

  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Fill in the missing endings for hablar (-ar):</p>
      <div className="gr-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {PT_RULE_PRONOUNS.map((r, i) => {
          const correct = norm(typed[i]) === norm(r.end);
          return (
            <div key={i} className="conj-row" style={{ gap: 8 }}>
              <span className="conj-pron">{r.pron} habl___</span>
              <input
                className="gr-input"
                style={{ width: 90, margin: 0, padding: "8px 10px" }}
                value={typed[i]}
                disabled={checked}
                onChange={(e) => setTyped((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
              />
              {checked && (correct ? <Icon name="check" size={16} /> : <span className="gr-fix">→ <b>{r.end}</b></span>)}
            </div>
          );
        })}
      </div>
      {!checked ? (
        <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} disabled={typed.some((t) => !t.trim())} onClick={() => setChecked(true)}>
          Check <Icon name="check" size={16} />
        </button>
      ) : (
        <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} onClick={onNext}>
          {allCorrect ? "Nailed it — " : ""}Continue <Icon name="chevron" size={16} />
        </button>
      )}
    </div>
  );
}

/* ---- Stage 3 · Structured input (who's doing it?) --------------------- */
// The verb ending is the only clue — no subject pronoun shown.
const PT_WHO_ITEMS: PtWhoItem[] = [
  { es: "Coméis mucho los sábados.", options: ["yo", "vosotros", "ellos"], answer: 1 },
  { es: "Vive en Madrid.", options: ["yo", "tú", "él"], answer: 2 },
  { es: "Escribimos cartas.", options: ["nosotros", "ellos", "tú"], answer: 0 },
  { es: "Bebes café.", options: ["yo", "tú", "nosotros"], answer: 1 },
];

function PtStructuredStage({ onNext }: { onNext: () => void }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const item = PT_WHO_ITEMS[idx];
  const last = idx === PT_WHO_ITEMS.length - 1;
  const checked = picked !== null;
  const correct = picked === item.answer;

  const advance = () => {
    if (last) { onNext(); return; }
    setIdx(idx + 1);
    setPicked(null);
  };

  return (
    <div className="sp-card gr-stage-card">
      <div className="gr-prog">
        <div className="sp-progress aqua" style={{ width: 140 }}><i style={{ width: `${((idx + 1) / PT_WHO_ITEMS.length) * 100}%` }} /></div>
        <span className="gr-prog-txt">{idx + 1} / {PT_WHO_ITEMS.length}</span>
      </div>
      <p className="gr-stage-hint">Circle who is doing the action — the verb ending is the only clue.</p>
      <div className="gr-prompt">{item.es}</div>
      <div className="gr-answers" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {item.options.map((o, i) => (
          <button
            key={i}
            className={"gr-answer" + (checked && i === item.answer ? " correct" : "") + (checked && picked === i && i !== item.answer ? " wrong" : "")}
            onClick={() => { if (!checked) setPicked(i); }}
          >
            {o}
            {checked && i === item.answer && <span style={{ marginLeft: "auto" }}><Icon name="check" size={18} /></span>}
          </button>
        ))}
      </div>
      <div className="gr-foot">
        <span className={"gr-verdict" + (checked ? (correct ? " ok" : " no") : "")}>{checked ? (correct ? "Correct" : "Not quite") : ""}</span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={!checked} onClick={advance}>
          {last ? "Start controlled practice" : "Next"} <Icon name="chevron" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ---- Generic fill-in-the-blank sequence, reused by stages 4/5/7 -------- */

function PtBlankSequence({
  items, heading, lastLabel, onDone,
}: { items: PtBlank[]; heading?: string; lastLabel: string; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const item = items[idx];
  const last = idx === items.length - 1;
  const correct = norm(typed) === norm(item.answer);

  const advance = () => {
    if (last) { onDone(); return; }
    setIdx(idx + 1);
    setTyped("");
    setRevealed(false);
  };

  return (
    <div className="sp-card gr-stage-card">
      <div className="gr-prog">
        <div className="sp-progress aqua" style={{ width: 140 }}><i style={{ width: `${((idx + 1) / items.length) * 100}%` }} /></div>
        <span className="gr-prog-txt">{heading ? heading + " · " : ""}{idx + 1} / {items.length}</span>
      </div>
      <div className="gr-prompt">
        {item.before}<span className="blank">{typed || "_____"}</span>{item.after}
        <span className="en">({item.verb})</span>
      </div>
      <input
        className="gr-input"
        value={typed}
        placeholder="Type in Spanish…"
        disabled={revealed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) setRevealed(true); }}
      />
      {revealed && !correct && <p className="gr-fix">Answer: <b>{item.answer}</b></p>}
      <div className="gr-foot">
        <span className={"gr-verdict" + (revealed ? (correct ? " ok" : " no") : "")}>{revealed ? (correct ? "Correct" : "Not quite") : ""}</span>
        {revealed ? (
          <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={advance}>
            {last ? lastLabel : "Next"} <Icon name="chevron" size={16} />
          </button>
        ) : (
          <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={!typed.trim()} onClick={() => setRevealed(true)}>Check</button>
        )}
      </div>
    </div>
  );
}

/* ---- Stage 4 · Controlled production, one category at a time ---------- */
// Part A: full conjugation table for comer (-er). Part B: fill-in-the-blank
// with only -ir verbs (vivir/escribir/abrir) — one category at a time.
const PT_IR_BLANKS: PtBlank[] = [
  { before: "Yo ", verb: "vivir", after: " en Barcelona.", answer: "vivo" },
  { before: "Ella ", verb: "escribir", after: " una carta.", answer: "escribe" },
  { before: "Nosotros ", verb: "abrir", after: " la tienda.", answer: "abrimos" },
];

function PtControlledStage({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<"comer" | "ir">("comer");
  const [typed, setTyped] = useState<string[]>(() => PT_RULE_PRONOUNS.map(() => ""));
  const [checked, setChecked] = useState(false);
  const comerEndings = ["o", "es", "e", "emos", "éis", "en"];

  if (phase === "comer") {
    return (
      <div className="sp-card gr-stage-card">
        <p className="gr-stage-hint">Conjugate comer (-er) for every person:</p>
        <div className="gr-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {PT_RULE_PRONOUNS.map((r, i) => {
            const correct = norm(typed[i]) === norm(comerEndings[i]);
            return (
              <div key={i} className="conj-row" style={{ gap: 8 }}>
                <span className="conj-pron">{r.pron}</span>
                <input
                  className="gr-input"
                  style={{ width: 110, margin: 0, padding: "8px 10px" }}
                  value={typed[i]}
                  disabled={checked}
                  placeholder="com…"
                  onChange={(e) => setTyped((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
                />
                {checked && (correct ? <Icon name="check" size={16} /> : <span className="gr-fix">→ <b>com{comerEndings[i]}</b></span>)}
              </div>
            );
          })}
        </div>
        {!checked ? (
          <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} disabled={typed.some((t) => !t.trim())} onClick={() => setChecked(true)}>
            Check <Icon name="check" size={16} />
          </button>
        ) : (
          <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} onClick={() => setPhase("ir")}>
            Now -ir verbs <Icon name="chevron" size={16} />
          </button>
        )}
      </div>
    );
  }

  return <PtBlankSequence items={PT_IR_BLANKS} heading="-ir only" lastLabel="Start mixed practice" onDone={onNext} />;
}

/* ---- Stage 5 · Mixed practice (interleaved) ---------------------------- */
const PT_MIXED_BLANKS: PtBlank[] = [
  { before: "Ella ", verb: "trabajar", after: " en un banco.", answer: "trabaja" },
  { before: "Nosotros ", verb: "leer", after: " el periódico.", answer: "leemos" },
  { before: "Tú ", verb: "abrir", after: " la ventana.", answer: "abres" },
  { before: "Yo ", verb: "correr", after: " por el parque.", answer: "corro" },
  { before: "Ellos ", verb: "estudiar", after: " español.", answer: "estudian" },
  { before: "Vosotros ", verb: "recibir", after: " regalos.", answer: "recibís" },
];

// Fisher-Yates.
function ptShuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function PtMixedStage({ onDone }: { onDone: () => void }) {
  const [items] = useState(() => ptShuffle(PT_MIXED_BLANKS));
  return <PtBlankSequence items={items} heading="Mixed" lastLabel="Finish" onDone={onDone} />;
}

/* ---- Stage 6 · Meaningful production (3 open-ended prompts) ----------- */
const PT_PRODUCE_PROMPTS: Pick<GrLesson, "focus" | "produce">[] = [
  {
    focus: PRESENT_TENSE_TOPIC,
    produce: { prompt: "Describe tu rutina diaria.", en: "(¿A qué hora comes? ¿Dónde trabajas?)", instruction: "Write 3-5 present-tense sentences." },
  },
  {
    focus: PRESENT_TENSE_TOPIC,
    produce: { prompt: "Entrevista a un compañero: ¿Dónde vives? ¿Qué comes normalmente? ¿Qué idiomas hablas?", en: "Interview a partner.", instruction: "Write 3-5 present-tense sentences, as if answering for them." },
  },
  {
    focus: PRESENT_TENSE_TOPIC,
    produce: { prompt: "Describe a tu familia: ¿Qué hace cada persona? ¿Dónde vive?", en: "Describe your family.", instruction: "Write 3-5 present-tense sentences." },
  },
];

function PtProduceSequence({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<import("@/types").GrammarCheck | null>(null);
  const [err, setErr] = useState("");
  const lesson = PT_PRODUCE_PROMPTS[idx];
  const last = idx === PT_PRODUCE_PROMPTS.length - 1;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const check = async () => {
    setBusy(true); setErr(""); setRes(null);
    try {
      setRes(await grammarApi.check(lesson.focus, lesson.produce.instruction, text));
    } catch {
      setErr("Could not grade right now — check that MISTRAL_API_KEY or CLAUDE_API_KEY is set.");
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    if (last) { onDone(); return; }
    setIdx(idx + 1);
    setText("");
    setRes(null);
    setErr("");
  };

  return (
    <div className="sp-card gr-stage-card">
      <div className="gr-prog">
        <div className="sp-progress aqua" style={{ width: 140 }}><i style={{ width: `${((idx + 1) / PT_PRODUCE_PROMPTS.length) * 100}%` }} /></div>
        <span className="gr-prog-txt">Produce · {idx + 1} / {PT_PRODUCE_PROMPTS.length}</span>
      </div>
      <div className="wr-sheet-head" style={{ marginBottom: 16 }}>
        <div className="wr-sheet-prompt">
          <div className="wr-prompt-text">{lesson.produce.prompt}</div>
          <div className="wr-prompt-en">{lesson.produce.en}</div>
        </div>
        <span className="sp-tag ghost">{lesson.produce.instruction}</span>
      </div>
      <textarea className="wr-editor" style={{ minHeight: 140 }} placeholder="Escribe aquí…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="wr-editbar">
        <span className="wr-count">{words} words</span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={busy || !text.trim()} onClick={check}>
          <Icon name="check" size={16} /> {busy ? "Checking…" : "Check with AI"}
        </button>
      </div>
      {err && <p className="gr-fix" style={{ color: "var(--negative)" }}>{err}</p>}
      {res && (
        <>
          <div className="gr-result">
            <div className="gr-result-head">
              <div className={"gr-score" + (res.meets_requirement ? " ok" : "")}>{res.score}<small>/100</small></div>
              <div>
                <div className="gr-result-req">{res.meets_requirement ? "✓ Instruction met" : "Instruction not met yet"}</div>
                <p className="sp-sub">{res.feedback}</p>
              </div>
            </div>
            {res.corrections.length > 0 && (
              <div className="gr-corrections">
                <h4>Error correction</h4>
                {res.corrections.map((c, i) => (
                  <div className="gr-corr" key={i}>
                    <span className="gr-corr-bad">{c.wrong}</span>
                    <Icon name="chevron" size={14} />
                    <span className="gr-corr-good">{c.correct}</span>
                    <span className="gr-corr-why">{c.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} onClick={advance}>
            {last ? "Continue to spaced review" : "Next prompt"} <Icon name="chevron" size={16} />
          </button>
        </>
      )}
    </div>
  );
}

/* ---- Stage 7 · Spaced retrieval schedule ------------------------------- */
// Fixed day schedule, not a generic interval ladder — matches the plan given:
// Day 1 stages 4-5 (already done, this session), Day 2 a 5-min mixed quiz,
// Day 5 quiz + a production task, Day 12 quiz + conversation practice, Day 26
// a final check-in quiz. No dedicated backend table for this trial — kept
// client-side, same pattern as sp-completed-scenarios in FreeChat.
const PT_SPACED_KEY = "sp-pt-spaced-schedule";
type PtScheduleKind = "done" | "quiz" | "quiz+produce" | "quiz+conversation";
const PT_SCHEDULE_PLAN: { day: number; label: string; kind: PtScheduleKind }[] = [
  { day: 1, label: "Initial drills (stages 4-5)", kind: "done" },
  { day: 2, label: "5-min mixed retrieval quiz", kind: "quiz" },
  { day: 5, label: "Mixed quiz + 1 production task", kind: "quiz+produce" },
  { day: 12, label: "Mixed quiz + conversation practice", kind: "quiz+conversation" },
  { day: 26, label: "Final check-in quiz", kind: "quiz" },
];
type PtSchedule = { baseAt: number; stepIndex: number };
function loadPtSchedule(): PtSchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PT_SPACED_KEY);
    return raw ? (JSON.parse(raw) as PtSchedule) : null;
  } catch {
    return null;
  }
}
function savePtSchedule(s: PtSchedule) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PT_SPACED_KEY, JSON.stringify(s));
}

function PtSpacedStage() {
  const [schedule, setSchedule] = useState<PtSchedule | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<"quiz" | "produce" | "conversation" | null>(null);

  useEffect(() => {
    const existing = loadPtSchedule();
    // Day 1 (stages 4-5) is already behind the learner this session.
    const s = existing ?? { baseAt: Date.now(), stepIndex: 1 };
    if (!existing) savePtSchedule(s);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate localStorage schedule after mount
    setSchedule(s);
    setNow(Date.now());
  }, []);

  if (!schedule || now === null) return null;
  const finished = schedule.stepIndex >= PT_SCHEDULE_PLAN.length;
  const current = PT_SCHEDULE_PLAN[Math.min(schedule.stepIndex, PT_SCHEDULE_PLAN.length - 1)];
  const dueAt = schedule.baseAt + (current.day - 1) * 86400000;
  const due = !finished && now >= dueAt;

  const completeStep = () => {
    const next = { baseAt: schedule.baseAt, stepIndex: schedule.stepIndex + 1 };
    savePtSchedule(next);
    setSchedule(next);
    setActiveTask(null);
  };

  if (activeTask === "quiz") return <PtMixedStage onDone={() => (current.kind === "quiz" ? completeStep() : setActiveTask(current.kind === "quiz+produce" ? "produce" : "conversation"))} />;
  if (activeTask === "produce") return <PtProduceSequence onDone={completeStep} />;
  if (activeTask === "conversation") {
    return (
      <div className="sp-card gr-stage-card">
        <p className="gr-stage-hint">Now use it for real.</p>
        <p className="gr-explain">Head to the Speaking tab and have a short chat — try to use hablar/comer/vivir-type verbs naturally as you talk.</p>
        <button className="sp-btn sp-btn-primary" onClick={completeStep}>Mark as done <Icon name="check" size={16} /></button>
      </div>
    );
  }

  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Spaced review — re-tested at increasing intervals, so it sticks.</p>
      <div className="gr-notice-list">
        {PT_SCHEDULE_PLAN.map((entry, i) => (
          <div className="gr-notice" key={entry.day} style={{ opacity: i < schedule.stepIndex ? 0.6 : 1 }}>
            <div className="gr-notice-es" style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              {i < schedule.stepIndex ? <Icon name="check" size={16} /> : <span className="gr-step-n">{i + 1}</span>}
              Day {entry.day} · {entry.label}
            </div>
            {i === schedule.stepIndex && !finished && (
              <div className="gr-notice-en">{due ? "Due now" : `Due ${new Date(schedule.baseAt + (entry.day - 1) * 86400000).toLocaleDateString()}`}</div>
            )}
          </div>
        ))}
      </div>
      {finished ? (
        <p className="gr-fix">Schedule complete — this pattern has been retrieved at every interval.</p>
      ) : due ? (
        <button className="sp-btn sp-btn-primary" onClick={() => setActiveTask("quiz")}>Start · Day {current.day} <Icon name="chevron" size={16} /></button>
      ) : (
        <p className="sp-sub">Come back on {new Date(dueAt).toLocaleDateString()} for Day {current.day}.</p>
      )}
    </div>
  );
}

function PresentTenseFlow({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState(1);
  useEffect(() => { savePtProgressStage(stage); }, [stage]);
  return (
    <div>
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="sp-btn"
          onClick={onExit}
          aria-label="Back to topics"
          title="Back to topics"
        >
          <Icon name="chevron" size={16} /> Back
        </button>
        <div>
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Grammar</p>
          <h1 className="sp-h1">{PRESENT_TENSE_TOPIC}</h1>
        </div>
      </div>

      <PtProgressBar stage={stage} total={PT_STAGE_LABELS.length} />
      <PtStepper stage={stage} onPick={setStage} />

      {stage === 1 && <PtNoticeStage onNext={() => setStage(2)} />}
      {stage === 2 && <PtRuleStage onNext={() => setStage(3)} />}
      {stage === 3 && <PtStructuredStage onNext={() => setStage(4)} />}
      {stage === 4 && <PtControlledStage onNext={() => setStage(5)} />}
      {stage === 5 && <PtMixedStage onDone={() => setStage(6)} />}
      {stage === 6 && <PtProduceSequence onDone={() => setStage(7)} />}
      {stage === 7 && <PtSpacedStage />}
    </div>
  );
}

/* ════════════════════════ GENERIC 7-STAGE FLOW ════════════════════════
   Same acquisition sequence as the Present Tense trial above — Notice →
   Rule check → Structured input → Controlled → Mixed → Produce → Spaced
   review — generalised so every other A1 topic gets the identical shape,
   adapted to its own grammar point. Present Tense keeps its own bespoke
   components untouched; this engine is a parallel, data-driven version
   reusing the same shared primitives (PtBlankSequence, PtProgressBar,
   PtStepper, ptShuffle, ReflectQ, norm, speakEs). */

function loadStageProgress(key: string): number {
  if (typeof window === "undefined") return 0;
  const n = parseInt(window.localStorage.getItem(key) ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}
function saveStageProgress(key: string, stage: number) {
  if (typeof window === "undefined") return;
  if (stage > loadStageProgress(key)) window.localStorage.setItem(key, String(stage));
}

function SsNoticeStage({ spec, onNext }: { spec: SevenStageSpec; onNext: () => void }) {
  const [lit, setLit] = useState<boolean[][]>(() => spec.noticeRows.map((r) => (r.stem + r.end).split("").map(() => false)));
  const endingDone = spec.noticeRows.every((r, i) => lit[i].slice(r.stem.length).every(Boolean));

  const toggleLetter = (rowIdx: number, letterIdx: number) => {
    setLit((prev) => prev.map((row, i) => (i === rowIdx ? row.map((v, j) => (j === letterIdx ? !v : v)) : row)));
  };

  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">{spec.noticeHint}</p>
      <div className="gr-notice-list">
        {spec.noticeRows.map((r, i) => (
          <div className="gr-notice" key={i}>
            <div className="gr-notice-es">
              {r.pron}{" "}
              <span className="pt-word">
                {(r.stem + r.end).split("").map((ch, j) => (
                  <button
                    key={j}
                    type="button"
                    className={"pt-letter" + (lit[i][j] ? " highlighted" : "")}
                    onClick={() => toggleLetter(i, j)}
                    title="Tap to highlight this letter"
                  >
                    {ch}
                  </button>
                ))}
              </span>{" "}
              {r.tail}
              <button className="vo-speak" onClick={() => speakEs(`${r.pron} ${r.stem}${r.end} ${r.tail}`)} title="Listen"><Icon name="speaker" size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      <p className="gr-stage-hint" style={{ marginTop: -4 }}>Task: click the letters that make up the highlighted part of each word. What changes? What stays the same?</p>
      <ReflectQ q={spec.reflectQ} reveal={spec.reflectReveal} predict />
      <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} disabled={!endingDone} onClick={onNext}>
        {endingDone ? "Show me the rule" : "Highlight every ending first"} <Icon name="chevron" size={16} />
      </button>
    </div>
  );
}

function SsRuleStage({ spec, onNext }: { spec: SevenStageSpec; onNext: () => void }) {
  const [typed, setTyped] = useState<string[]>(() => spec.ruleItems.map(() => ""));
  const [checked, setChecked] = useState(false);
  const allCorrect = spec.ruleItems.every((r, i) => norm(typed[i]) === norm(r.end));

  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">{spec.ruleHint}</p>
      <div className="gr-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {spec.ruleItems.map((r, i) => {
          const correct = norm(typed[i]) === norm(r.end);
          return (
            <div key={i} className="conj-row" style={{ gap: 8 }}>
              <span className="conj-pron">{r.label.includes("___") ? r.label.replace("___", `${r.stem}___`) : `${r.label} ${r.stem}___`}</span>
              <input
                className="gr-input"
                style={{ width: 90, margin: 0, padding: "8px 10px" }}
                value={typed[i]}
                disabled={checked}
                onChange={(e) => setTyped((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
              />
              {checked && (correct ? <Icon name="check" size={16} /> : <span className="gr-fix">→ <b>{r.end}</b></span>)}
            </div>
          );
        })}
      </div>
      {!checked ? (
        <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} disabled={typed.some((t) => !t.trim())} onClick={() => setChecked(true)}>
          Check <Icon name="check" size={16} />
        </button>
      ) : (
        <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} onClick={onNext}>
          {allCorrect ? "Nailed it — " : ""}Continue <Icon name="chevron" size={16} />
        </button>
      )}
    </div>
  );
}

function SsStructuredStage({ spec, onNext }: { spec: SevenStageSpec; onNext: () => void }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const items = spec.structuredItems;
  const item = items[idx];
  const last = idx === items.length - 1;
  const checked = picked !== null;
  const correct = picked === item.answer;

  const advance = () => {
    if (last) { onNext(); return; }
    setIdx(idx + 1);
    setPicked(null);
  };

  return (
    <div className="sp-card gr-stage-card">
      <div className="gr-prog">
        <div className="sp-progress aqua" style={{ width: 140 }}><i style={{ width: `${((idx + 1) / items.length) * 100}%` }} /></div>
        <span className="gr-prog-txt">{idx + 1} / {items.length}</span>
      </div>
      <p className="gr-stage-hint">{spec.structuredHint}</p>
      <div className="gr-prompt">{item.es}</div>
      <div className="gr-answers" style={{ gridTemplateColumns: `repeat(${item.options.length}, 1fr)` }}>
        {item.options.map((o, i) => (
          <button
            key={i}
            className={"gr-answer" + (checked && i === item.answer ? " correct" : "") + (checked && picked === i && i !== item.answer ? " wrong" : "")}
            onClick={() => { if (!checked) setPicked(i); }}
          >
            {o}
            {checked && i === item.answer && <span style={{ marginLeft: "auto" }}><Icon name="check" size={18} /></span>}
          </button>
        ))}
      </div>
      <div className="gr-foot">
        <span className={"gr-verdict" + (checked ? (correct ? " ok" : " no") : "")}>{checked ? (correct ? "Correct" : "Not quite") : ""}</span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={!checked} onClick={advance}>
          {last ? spec.structuredLastLabel : "Next"} <Icon name="chevron" size={16} />
        </button>
      </div>
    </div>
  );
}

function SsControlledStage({ spec, onNext }: { spec: SevenStageSpec; onNext: () => void }) {
  const [phase, setPhase] = useState<"table" | "blanks">("table");
  const [typed, setTyped] = useState<string[]>(() => spec.controlledTableItems.map(() => ""));
  const [checked, setChecked] = useState(false);

  if (phase === "table") {
    return (
      <div className="sp-card gr-stage-card">
        <p className="gr-stage-hint">{spec.controlledTableHint}</p>
        <div className="gr-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {spec.controlledTableItems.map((r, i) => {
            const correct = norm(typed[i]) === norm(r.end);
            return (
              <div key={i} className="conj-row" style={{ gap: 8 }}>
                <span className="conj-pron">{r.label}</span>
                <input
                  className="gr-input"
                  style={{ width: 110, margin: 0, padding: "8px 10px" }}
                  value={typed[i]}
                  disabled={checked}
                  placeholder={spec.controlledTablePlaceholder}
                  onChange={(e) => setTyped((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
                />
                {checked && (correct ? <Icon name="check" size={16} /> : <span className="gr-fix">→ <b>{r.stem}{r.end}</b></span>)}
              </div>
            );
          })}
        </div>
        {!checked ? (
          <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} disabled={typed.some((t) => !t.trim())} onClick={() => setChecked(true)}>
            Check <Icon name="check" size={16} />
          </button>
        ) : (
          <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} onClick={() => setPhase("blanks")}>
            {spec.controlledNextLabel} <Icon name="chevron" size={16} />
          </button>
        )}
      </div>
    );
  }

  return <PtBlankSequence items={spec.controlledBlanks} heading={spec.controlledBlanksHeading} lastLabel="Start mixed practice" onDone={onNext} />;
}

function SsMixedStage({ spec, onDone }: { spec: SevenStageSpec; onDone: () => void }) {
  const [items] = useState(() => ptShuffle(spec.mixedBlanks));
  return <PtBlankSequence items={items} heading="Mixed" lastLabel="Finish" onDone={onDone} />;
}

function SsProduceSequence({ spec, onDone }: { spec: SevenStageSpec; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<import("@/types").GrammarCheck | null>(null);
  const [err, setErr] = useState("");
  const lesson = spec.producePrompts[idx];
  const last = idx === spec.producePrompts.length - 1;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const check = async () => {
    setBusy(true); setErr(""); setRes(null);
    try {
      setRes(await grammarApi.check(lesson.focus, lesson.produce.instruction, text));
    } catch {
      setErr("Could not grade right now — check that MISTRAL_API_KEY or CLAUDE_API_KEY is set.");
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    if (last) { onDone(); return; }
    setIdx(idx + 1);
    setText("");
    setRes(null);
    setErr("");
  };

  return (
    <div className="sp-card gr-stage-card">
      <div className="gr-prog">
        <div className="sp-progress aqua" style={{ width: 140 }}><i style={{ width: `${((idx + 1) / spec.producePrompts.length) * 100}%` }} /></div>
        <span className="gr-prog-txt">Produce · {idx + 1} / {spec.producePrompts.length}</span>
      </div>
      <div className="wr-sheet-head" style={{ marginBottom: 16 }}>
        <div className="wr-sheet-prompt">
          <div className="wr-prompt-text">{lesson.produce.prompt}</div>
          <div className="wr-prompt-en">{lesson.produce.en}</div>
        </div>
        <span className="sp-tag ghost">{lesson.produce.instruction}</span>
      </div>
      <textarea className="wr-editor" style={{ minHeight: 140 }} placeholder="Escribe aquí…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="wr-editbar">
        <span className="wr-count">{words} words</span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={busy || !text.trim()} onClick={check}>
          <Icon name="check" size={16} /> {busy ? "Checking…" : "Check with AI"}
        </button>
      </div>
      {err && <p className="gr-fix" style={{ color: "var(--negative)" }}>{err}</p>}
      {res && (
        <>
          <div className="gr-result">
            <div className="gr-result-head">
              <div className={"gr-score" + (res.meets_requirement ? " ok" : "")}>{res.score}<small>/100</small></div>
              <div>
                <div className="gr-result-req">{res.meets_requirement ? "✓ Instruction met" : "Instruction not met yet"}</div>
                <p className="sp-sub">{res.feedback}</p>
              </div>
            </div>
            {res.corrections.length > 0 && (
              <div className="gr-corrections">
                <h4>Error correction</h4>
                {res.corrections.map((c, i) => (
                  <div className="gr-corr" key={i}>
                    <span className="gr-corr-bad">{c.wrong}</span>
                    <Icon name="chevron" size={14} />
                    <span className="gr-corr-good">{c.correct}</span>
                    <span className="gr-corr-why">{c.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="sp-btn sp-btn-primary" style={{ marginTop: 16 }} onClick={advance}>
            {last ? "Continue to spaced review" : "Next prompt"} <Icon name="chevron" size={16} />
          </button>
        </>
      )}
    </div>
  );
}

function SsSpacedStage({ spec }: { spec: SevenStageSpec }) {
  const scheduleKey = `sp-gr7-spaced-${spec.id}`;
  const [schedule, setSchedule] = useState<PtSchedule | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<"quiz" | "produce" | "conversation" | null>(null);

  useEffect(() => {
    const existing = (() => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(scheduleKey);
        return raw ? (JSON.parse(raw) as PtSchedule) : null;
      } catch {
        return null;
      }
    })();
    const s = existing ?? { baseAt: Date.now(), stepIndex: 1 };
    if (!existing && typeof window !== "undefined") window.localStorage.setItem(scheduleKey, JSON.stringify(s));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate localStorage schedule after mount
    setSchedule(s);
    setNow(Date.now());
  }, [scheduleKey]);

  if (!schedule || now === null) return null;
  const finished = schedule.stepIndex >= PT_SCHEDULE_PLAN.length;
  const current = PT_SCHEDULE_PLAN[Math.min(schedule.stepIndex, PT_SCHEDULE_PLAN.length - 1)];
  const dueAt = schedule.baseAt + (current.day - 1) * 86400000;
  const due = !finished && now >= dueAt;

  const completeStep = () => {
    const next = { baseAt: schedule.baseAt, stepIndex: schedule.stepIndex + 1 };
    if (typeof window !== "undefined") window.localStorage.setItem(scheduleKey, JSON.stringify(next));
    setSchedule(next);
    setActiveTask(null);
  };

  if (activeTask === "quiz") return <SsMixedStage spec={spec} onDone={() => (current.kind === "quiz" ? completeStep() : setActiveTask(current.kind === "quiz+produce" ? "produce" : "conversation"))} />;
  if (activeTask === "produce") return <SsProduceSequence spec={spec} onDone={completeStep} />;
  if (activeTask === "conversation") {
    return (
      <div className="sp-card gr-stage-card">
        <p className="gr-stage-hint">Now use it for real.</p>
        <p className="gr-explain">{spec.conversationHint}</p>
        <button className="sp-btn sp-btn-primary" onClick={completeStep}>Mark as done <Icon name="check" size={16} /></button>
      </div>
    );
  }

  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Spaced review — re-tested at increasing intervals, so it sticks.</p>
      <div className="gr-notice-list">
        {PT_SCHEDULE_PLAN.map((entry, i) => (
          <div className="gr-notice" key={entry.day} style={{ opacity: i < schedule.stepIndex ? 0.6 : 1 }}>
            <div className="gr-notice-es" style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
              {i < schedule.stepIndex ? <Icon name="check" size={16} /> : <span className="gr-step-n">{i + 1}</span>}
              Day {entry.day} · {entry.label}
            </div>
            {i === schedule.stepIndex && !finished && (
              <div className="gr-notice-en">{due ? "Due now" : `Due ${new Date(schedule.baseAt + (entry.day - 1) * 86400000).toLocaleDateString()}`}</div>
            )}
          </div>
        ))}
      </div>
      {finished ? (
        <p className="gr-fix">Schedule complete — this pattern has been retrieved at every interval.</p>
      ) : due ? (
        <button className="sp-btn sp-btn-primary" onClick={() => setActiveTask("quiz")}>Start · Day {current.day} <Icon name="chevron" size={16} /></button>
      ) : (
        <p className="sp-sub">Come back on {new Date(dueAt).toLocaleDateString()} for Day {current.day}.</p>
      )}
    </div>
  );
}

function SevenStageFlow({ spec, onExit }: { spec: SevenStageSpec; onExit: () => void }) {
  const progressKey = `sp-gr7-progress-${spec.id}`;
  const [stage, setStage] = useState(1);
  useEffect(() => { saveStageProgress(progressKey, stage); }, [stage, progressKey]);
  return (
    <div>
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          className="sp-btn"
          onClick={onExit}
          aria-label="Back to topics"
          title="Back to topics"
        >
          <Icon name="chevron" size={16} /> Back
        </button>
        <div>
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Grammar</p>
          <h1 className="sp-h1">{spec.topic}</h1>
        </div>
      </div>

      <PtProgressBar stage={stage} total={PT_STAGE_LABELS.length} />
      <PtStepper stage={stage} onPick={setStage} />

      {stage === 1 && <SsNoticeStage spec={spec} onNext={() => setStage(2)} />}
      {stage === 2 && <SsRuleStage spec={spec} onNext={() => setStage(3)} />}
      {stage === 3 && <SsStructuredStage spec={spec} onNext={() => setStage(4)} />}
      {stage === 4 && <SsControlledStage spec={spec} onNext={() => setStage(5)} />}
      {stage === 5 && <SsMixedStage spec={spec} onDone={() => setStage(6)} />}
      {stage === 6 && <SsProduceSequence spec={spec} onDone={() => setStage(7)} />}
      {stage === 7 && <SsSpacedStage spec={spec} />}
    </div>
  );
}

const SEVEN_STAGE_LESSONS: Record<string, SevenStageSpec> = {
  ...ADVANCED_SEVEN_STAGE_LESSONS,
  "Nouns: gender & number basics, definite/indefinite articles": {
    id: "nouns",
    topic: "Nouns: gender & number basics, definite/indefinite articles",
    noticeHint: "Read these sentences. What happens to the end of each noun when there's more than one?",
    noticeRows: [
      { pron: "Los", stem: "chico", end: "s", tail: "son nuevos." },
      { pron: "Las", stem: "chica", end: "s", tail: "son altas." },
      { pron: "Los", stem: "profesor", end: "es", tail: "son buenos." },
      { pron: "Las", stem: "ciudad", end: "es", tail: "son grandes." },
      { pron: "Los", stem: "papel", end: "es", tail: "están aquí." },
    ],
    reflectQ: "What changes at the end of the noun? What decides -s vs. -es?",
    reflectReveal: "Nouns ending in a vowel add -s (chico → chicos). Nouns ending in a consonant add -es (profesor → profesores). The article shifts too: el/la → los/las.",
    ruleHint: "Fill in the missing plural ending:",
    ruleItems: [
      { label: "los", stem: "chico", end: "s" }, { label: "las", stem: "casa", end: "s" },
      { label: "los", stem: "profesor", end: "es" }, { label: "las", stem: "ciudad", end: "es" },
      { label: "los", stem: "papel", end: "es" }, { label: "las", stem: "flor", end: "es" },
    ],
    structuredHint: "Pick the article that matches the noun's gender and number.",
    structuredItems: [
      { es: "___ mesa es nueva.", options: ["El", "La", "Los"], answer: 1 },
      { es: "___ chicos son altos.", options: ["El", "La", "Los"], answer: 2 },
      { es: "___ papeles están aquí.", options: ["El", "Las", "Los"], answer: 2 },
      { es: "___ flores son bonitas.", options: ["El", "La", "Las"], answer: 2 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Make each singular noun plural:",
    controlledTableItems: [
      { label: "mesa", stem: "mesa", end: "s" }, { label: "libro", stem: "libro", end: "s" },
      { label: "ciudad", stem: "ciudad", end: "es" }, { label: "animal", stem: "animal", end: "es" },
      { label: "tren", stem: "tren", end: "es" }, { label: "pan", stem: "pan", end: "es" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now practice with articles",
    controlledBlanksHeading: "Articles + plural",
    controlledBlanks: [
      { before: "", verb: "the boys", after: " son simpáticos.", answer: "Los chicos" },
      { before: "", verb: "the cities", after: " son bonitas.", answer: "Las ciudades" },
      { before: "", verb: "the papers", after: " están en la mesa.", answer: "Los papeles" },
    ],
    mixedBlanks: [
      { before: "", verb: "the girl", after: " es alta.", answer: "La chica" },
      { before: "", verb: "the teachers (masc.)", after: " son buenos.", answer: "Los profesores" },
      { before: "", verb: "the flower", after: " es roja.", answer: "La flor" },
      { before: "", verb: "the trains", after: " llegan tarde.", answer: "Los trenes" },
      { before: "", verb: "the book", after: " es interesante.", answer: "El libro" },
      { before: "", verb: "the cities", after: " son grandes.", answer: "Las ciudades" },
    ],
    producePrompts: [
      { focus: "Nouns: gender & number basics, definite/indefinite articles", produce: { prompt: "Describe tres cosas en tu casa.", en: "(¿Cuántas hay? ¿el o la?)", instruction: "Write 3-5 sentences using at least three nouns with the correct article and plural forms." } },
      { focus: "Nouns: gender & number basics, definite/indefinite articles", produce: { prompt: "Describe a las personas en tu clase.", en: "Describe the people in your class.", instruction: "Write 3-5 sentences using at least three plural nouns." } },
      { focus: "Nouns: gender & number basics, definite/indefinite articles", produce: { prompt: "Haz una lista de la compra.", en: "Write a shopping list.", instruction: "Write at least four nouns, singular or plural, with the right article." } },
    ],
    conversationHint: "Head to the Speaking tab and describe the room you're in — try to get every article and plural right as you talk.",
  },
  "Adjectives: basic agreement, common placement": {
    id: "adj",
    topic: "Adjectives: basic agreement, common placement",
    noticeHint: "Read these. What changes on the adjective — and why?",
    noticeRows: [
      { pron: "Juan es", stem: "alt", end: "o", tail: "." },
      { pron: "María es", stem: "alt", end: "a", tail: "." },
      { pron: "Mis padres son", stem: "alt", end: "os", tail: "." },
      { pron: "Mis hermanas son", stem: "alt", end: "as", tail: "." },
      { pron: "El coche es", stem: "roj", end: "o", tail: "." },
    ],
    reflectQ: "What changes at the end of the adjective? What decides it?",
    reflectReveal: "The adjective matches the noun's gender and number: -o masc. sing., -a fem. sing., -os masc. pl., -as fem. pl.",
    ruleHint: "Fill in the missing adjective ending:",
    ruleItems: [
      { label: "masc. sing.", stem: "alt", end: "o" }, { label: "fem. sing.", stem: "alt", end: "a" },
      { label: "masc. pl.", stem: "alt", end: "os" }, { label: "fem. pl.", stem: "alt", end: "as" },
      { label: "masc. sing.", stem: "pequeñ", end: "o" }, { label: "fem. pl.", stem: "pequeñ", end: "as" },
    ],
    structuredHint: "Pick the adjective form that agrees with the noun.",
    structuredItems: [
      { es: "La casa es ___.", options: ["pequeño", "pequeña", "pequeños"], answer: 1 },
      { es: "Los libros son ___.", options: ["nuevo", "nueva", "nuevos"], answer: 2 },
      { es: "Las flores son ___.", options: ["rojo", "rojas", "rojos"], answer: 1 },
      { es: "El perro es ___.", options: ["negra", "negro", "negros"], answer: 1 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Conjugate «pequeño» for every gender/number:",
    controlledTableItems: [
      { label: "masc. sing.", stem: "pequeñ", end: "o" }, { label: "fem. sing.", stem: "pequeñ", end: "a" },
      { label: "masc. pl.", stem: "pequeñ", end: "os" }, { label: "fem. pl.", stem: "pequeñ", end: "as" },
      { label: "masc. sing. (nuevo)", stem: "nuev", end: "o" }, { label: "fem. pl. (nuevo)", stem: "nuev", end: "as" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now practice in sentences",
    controlledBlanksHeading: "Agreement in context",
    controlledBlanks: [
      { before: "Mi hermana es muy ", verb: "tall", after: ".", answer: "alta" },
      { before: "Los chicos son ", verb: "nice", after: ".", answer: "simpáticos" },
      { before: "La mesa es ", verb: "big (same for both genders)", after: ".", answer: "grande" },
    ],
    mixedBlanks: [
      { before: "Las casas son ", verb: "small", after: ".", answer: "pequeñas" },
      { before: "El profesor es ", verb: "smart", after: ".", answer: "inteligente" },
      { before: "Mis amigos son ", verb: "fun", after: ".", answer: "divertidos" },
      { before: "La película es ", verb: "boring", after: ".", answer: "aburrida" },
      { before: "Los coches son ", verb: "fast", after: ".", answer: "rápidos" },
      { before: "Las chicas son ", verb: "tall", after: ".", answer: "altas" },
    ],
    producePrompts: [
      { focus: "Adjectives: basic agreement, common placement", produce: { prompt: "Describe a tres personas de tu familia.", en: "(¿Cómo son? altos, simpáticos…)", instruction: "Write 3-5 sentences using adjectives that agree in gender and number." } },
      { focus: "Adjectives: basic agreement, common placement", produce: { prompt: "Describe tu habitación y las cosas en ella.", en: "Describe your room and its things.", instruction: "Write 3-5 sentences using at least four adjectives." } },
      { focus: "Adjectives: basic agreement, common placement", produce: { prompt: "Compara a dos amigos: ¿cómo son?", en: "Compare two friends.", instruction: "Write 3-5 sentences, describing each with different adjectives." } },
    ],
    conversationHint: "Head to the Speaking tab and describe three people you know — make every adjective agree as you talk.",
  },
  "Subject pronouns": {
    id: "pron",
    topic: "Subject pronouns",
    noticeHint: "Read these. Which word tells you who's doing it, even before the verb ending does?",
    noticeRows: [
      { pron: "", stem: "", end: "Yo", tail: "estudio español." },
      { pron: "", stem: "", end: "Tú", tail: "hablas rápido." },
      { pron: "", stem: "", end: "Ella", tail: "trabaja aquí." },
      { pron: "", stem: "", end: "Nosotros", tail: "vivimos en Lima." },
      { pron: "", stem: "", end: "Ellos", tail: "comen tarde." },
    ],
    reflectQ: "Why bother with a subject pronoun if the verb ending already shows who?",
    reflectReveal: "Pronouns are often dropped in Spanish — the verb ending carries the same information. Use them for emphasis, contrast, or clarity (ella vs. él, since both take the same verb form).",
    ruleHint: "Match the missing subject pronoun to its English translation:",
    ruleItems: [
      { label: "I", stem: "", end: "yo" }, { label: "you (informal)", stem: "", end: "tú" },
      { label: "she", stem: "", end: "ella" }, { label: "we", stem: "", end: "nosotros" },
      { label: "you all (Spain)", stem: "", end: "vosotros" }, { label: "they (masc.)", stem: "", end: "ellos" },
    ],
    structuredHint: "Circle who is doing the action — the verb ending is the only clue.",
    structuredItems: [
      { es: "Coméis mucho los sábados.", options: ["yo", "vosotros", "ellos"], answer: 1 },
      { es: "Vive en Madrid.", options: ["yo", "tú", "él"], answer: 2 },
      { es: "Escribimos cartas.", options: ["nosotros", "ellos", "tú"], answer: 0 },
      { es: "Bebes café.", options: ["yo", "tú", "nosotros"], answer: 1 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Fill in the subject pronoun for each translation:",
    controlledTableItems: [
      { label: "he", stem: "", end: "él" }, { label: "you (formal)", stem: "", end: "usted" },
      { label: "you all (Latin Am.)", stem: "", end: "ustedes" }, { label: "they (fem.)", stem: "", end: "ellas" },
      { label: "I", stem: "", end: "yo" }, { label: "we", stem: "", end: "nosotros" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now practice in sentences",
    controlledBlanksHeading: "Pronoun in context",
    controlledBlanks: [
      { before: "", verb: "she", after: " habla tres idiomas.", answer: "Ella" },
      { before: "", verb: "we", after: " somos estudiantes.", answer: "Nosotros" },
      { before: "", verb: "they (masc.)", after: " viven en Chile.", answer: "Ellos" },
    ],
    mixedBlanks: [
      { before: "", verb: "I", after: " trabajo en un banco.", answer: "Yo" },
      { before: "", verb: "you (informal)", after: " hablas muy bien.", answer: "Tú" },
      { before: "", verb: "he", after: " es médico.", answer: "Él" },
      { before: "", verb: "you all (Spain)", after: " coméis mucho.", answer: "Vosotros" },
      { before: "", verb: "they (fem.)", after: " son mis amigas.", answer: "Ellas" },
      { before: "", verb: "we", after: " vivimos aquí.", answer: "Nosotros" },
    ],
    producePrompts: [
      { focus: "Subject pronouns", produce: { prompt: "Preséntate y presenta a tu familia.", en: "(Yo soy... Mi hermano es...)", instruction: "Write 3-5 sentences using at least four different subject pronouns." } },
      { focus: "Subject pronouns", produce: { prompt: "Describe a tus amigos: ¿quiénes son y qué hacen?", en: "Describe your friends.", instruction: "Write 3-5 sentences, mixing pronouns for variety." } },
      { focus: "Subject pronouns", produce: { prompt: "Compara lo que tú haces con lo que hace tu familia.", en: "Compare what you do with what your family does.", instruction: "Write 3-5 sentences using at least three different pronouns." } },
    ],
    conversationHint: "Head to the Speaking tab and talk about your friends and family — use a different subject pronoun in each sentence.",
  },
  "Ser vs. Estar: introduced (basic uses — identity vs. location/state)": {
    id: "serestar",
    topic: "Ser vs. Estar: introduced (basic uses — identity vs. location/state)",
    noticeHint: "Read these. Which ones describe what something IS, and which describe WHERE or HOW it is?",
    noticeRows: [
      { pron: "Yo", stem: "s", end: "oy", tail: "profesor." },
      { pron: "Yo", stem: "est", end: "oy", tail: "en casa." },
      { pron: "Ella", stem: "", end: "es", tail: "médica." },
      { pron: "Ella", stem: "est", end: "á", tail: "cansada." },
      { pron: "Nosotros", stem: "s", end: "omos", tail: "amigos." },
    ],
    reflectQ: "Which sentences describe identity? Which describe location or a temporary state?",
    reflectReveal: "Ser = permanent identity: profession, origin, characteristics (soy profesor, somos amigos). Estar = location and temporary states: where something is, how it feels right now (estoy en casa, está cansada).",
    ruleHint: "Fill in the missing form of ser:",
    ruleItems: [
      { label: "yo", stem: "s", end: "oy" }, { label: "tú", stem: "er", end: "es" },
      { label: "él/ella", stem: "", end: "es" }, { label: "nosotros", stem: "s", end: "omos" },
      { label: "vosotros", stem: "s", end: "ois" }, { label: "ellos", stem: "s", end: "on" },
    ],
    structuredHint: "Pick ser or estar, whichever fits the meaning.",
    structuredItems: [
      { es: "Ella ___ médica.", options: ["es", "está"], answer: 0 },
      { es: "Nosotros ___ muy ocupados hoy.", options: ["somos", "estamos"], answer: 1 },
      { es: "El café ___ caliente.", options: ["es", "está"], answer: 1 },
      { es: "Yo ___ de México.", options: ["soy", "estoy"], answer: 0 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Conjugate estar for every person:",
    controlledTableItems: [
      { label: "yo", stem: "est", end: "oy" }, { label: "tú", stem: "est", end: "ás" },
      { label: "él/ella", stem: "est", end: "á" }, { label: "nosotros", stem: "est", end: "amos" },
      { label: "vosotros", stem: "est", end: "áis" }, { label: "ellos", stem: "est", end: "án" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now mix ser and estar",
    controlledBlanksHeading: "Ser or estar?",
    controlledBlanks: [
      { before: "Mi padre ", verb: "ser — profession", after: " ingeniero.", answer: "es" },
      { before: "Los niños ", verb: "estar — location", after: " en el parque.", answer: "están" },
      { before: "Tú ", verb: "estar — feeling", after: " cansado.", answer: "estás" },
    ],
    mixedBlanks: [
      { before: "Yo ", verb: "ser — origin", after: " de Argentina.", answer: "soy" },
      { before: "Ella ", verb: "estar — state", after: " enferma hoy.", answer: "está" },
      { before: "Nosotros ", verb: "ser — identity", after: " estudiantes.", answer: "somos" },
      { before: "Vosotros ", verb: "estar — location", after: " en la playa.", answer: "estáis" },
      { before: "El libro ", verb: "estar — location", after: " en la mesa.", answer: "está" },
      { before: "Ellos ", verb: "ser — characteristic", after: " muy altos.", answer: "son" },
    ],
    producePrompts: [
      { focus: "Ser vs. Estar: introduced (basic uses — identity vs. location/state)", produce: { prompt: "Descríbete: quién eres y cómo estás hoy.", en: "(Soy... / Estoy...)", instruction: "Write 3-5 sentences using ser at least twice and estar at least twice." } },
      { focus: "Ser vs. Estar: introduced (basic uses — identity vs. location/state)", produce: { prompt: "Describe dónde están tus cosas favoritas.", en: "Describe where your favorite things are.", instruction: "Write 3-5 sentences using estar for location." } },
      { focus: "Ser vs. Estar: introduced (basic uses — identity vs. location/state)", produce: { prompt: "Presenta a un amigo: quién es y cómo está.", en: "Introduce a friend.", instruction: "Write 3-5 sentences mixing ser and estar." } },
    ],
    conversationHint: "Head to the Speaking tab and describe yourself and how you're feeling today — notice every time you reach for ser or estar.",
  },
  "Basic reflexive verbs (llamarse)": {
    id: "reflexive",
    topic: "Basic reflexive verbs (llamarse)",
    noticeHint: "Read these. What small word appears right before the verb, and how does it change?",
    noticeRows: [
      { pron: "Yo me", stem: "llam", end: "o", tail: "Ana." },
      { pron: "Tú te", stem: "llam", end: "as", tail: "Marco." },
      { pron: "Él se", stem: "llam", end: "a", tail: "Diego." },
      { pron: "Nosotros nos", stem: "llam", end: "amos", tail: "Ana y Luis." },
      { pron: "Ellos se", stem: "llam", end: "an", tail: "Pablo y Marta." },
    ],
    reflectQ: "What changes — the reflexive pronoun, the verb ending, or both?",
    reflectReveal: "Both change together and must match the subject: me/te/se/nos/os/se pairs with -o/-as/-a/-amos/-áis/-an.",
    ruleHint: "Fill in the missing ending for llamarse:",
    ruleItems: [
      { label: "yo", stem: "me llam", end: "o" }, { label: "tú", stem: "te llam", end: "as" },
      { label: "él/ella", stem: "se llam", end: "a" }, { label: "nosotros", stem: "nos llam", end: "amos" },
      { label: "vosotros", stem: "os llam", end: "áis" }, { label: "ellos", stem: "se llam", end: "an" },
    ],
    structuredHint: "Pick the correct form of llamarse for the subject shown.",
    structuredItems: [
      { es: "¿Cómo ___ ustedes?", options: ["te llamas", "se llaman", "nos llamamos"], answer: 1 },
      { es: "Nosotros ___ Pablo y Marta.", options: ["me llamo", "se llama", "nos llamamos"], answer: 2 },
      { es: "Ella ___ Sofía.", options: ["se llama", "te llamas", "se llaman"], answer: 0 },
      { es: "Yo ___ Carlos.", options: ["se llama", "me llamo", "te llamas"], answer: 1 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Conjugate llamarse for every person, from scratch:",
    controlledTableItems: [
      { label: "yo", stem: "me llam", end: "o" }, { label: "tú", stem: "te llam", end: "as" },
      { label: "él/ella", stem: "se llam", end: "a" }, { label: "nosotros", stem: "nos llam", end: "amos" },
      { label: "vosotros", stem: "os llam", end: "áis" }, { label: "ellos", stem: "se llam", end: "an" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now practice in sentences",
    controlledBlanksHeading: "Llamarse in context",
    controlledBlanks: [
      { before: "¿Cómo ", verb: "te llamas — you all", after: " ustedes?", answer: "se llaman" },
      { before: "Nosotros ", verb: "nos llamamos", after: " Pablo y Marta.", answer: "nos llamamos" },
      { before: "Ella ", verb: "se llama", after: " Sofía.", answer: "se llama" },
    ],
    mixedBlanks: [
      { before: "Yo ", verb: "me llamo", after: " Carlos.", answer: "me llamo" },
      { before: "¿Tú cómo ", verb: "te llamas", after: "?", answer: "te llamas" },
      { before: "Mis primos ", verb: "se llaman", after: " Iker y Nora.", answer: "se llaman" },
      { before: "Vosotros ", verb: "os llamáis", after: " Ana y Pedro.", answer: "os llamáis" },
      { before: "Mi perro ", verb: "se llama", after: " Rocky.", answer: "se llama" },
      { before: "Nosotras ", verb: "nos llamamos", after: " Lucía y Elena.", answer: "nos llamamos" },
    ],
    producePrompts: [
      { focus: "Basic reflexive verbs (llamarse)", produce: { prompt: "Preséntate a un nuevo compañero de clase.", en: "(Me llamo... ¿Cómo te llamas?)", instruction: "Write a short exchange using llamarse to give your name and ask theirs." } },
      { focus: "Basic reflexive verbs (llamarse)", produce: { prompt: "Presenta a tres personas de tu familia por su nombre.", en: "Introduce three family members by name.", instruction: "Write 3 sentences using «se llama» for each person." } },
      { focus: "Basic reflexive verbs (llamarse)", produce: { prompt: "Escribe un diálogo breve de dos personas conociéndose.", en: "Write a short dialogue of two people meeting.", instruction: "Use llamarse at least three times across the dialogue." } },
    ],
    conversationHint: "Head to the Speaking tab and introduce yourself to your AI partner — ask their name with «¿Cómo te llamas?».",
  },
  "Simple prepositions (en, de, a, con)": {
    id: "prep",
    topic: "Simple prepositions (en, de, a, con)",
    noticeHint: "Read these. What tiny word links the ideas together, and what does it mean?",
    noticeRows: [
      { pron: "Vivo", stem: "", end: "en", tail: "Madrid." },
      { pron: "Soy", stem: "", end: "de", tail: "Chile." },
      { pron: "Voy", stem: "", end: "a", tail: "la tienda." },
      { pron: "Estudio", stem: "", end: "con", tail: "mi hermana." },
      { pron: "El libro es", stem: "", end: "de", tail: "mi profesora." },
    ],
    reflectQ: "What does each small word add to the sentence?",
    reflectReveal: "En = in/at (place). De = of/from (origin, possession). A = to/at (direction). Con = with (accompaniment).",
    ruleHint: "Fill in the missing preposition for each meaning:",
    ruleItems: [
      { label: "place — in/at", stem: "", end: "en" }, { label: "origin — from", stem: "", end: "de" },
      { label: "direction — to", stem: "", end: "a" }, { label: "accompaniment — with", stem: "", end: "con" },
      { label: "possession — of", stem: "", end: "de" }, { label: "destination — at", stem: "", end: "a" },
    ],
    structuredHint: "Pick the preposition that fits the meaning.",
    structuredItems: [
      { es: "Voy ___ la escuela.", options: ["en", "de", "a"], answer: 2 },
      { es: "El libro es ___ mi profesora.", options: ["en", "de", "con"], answer: 1 },
      { es: "Estudio ___ mi hermana.", options: ["a", "con", "de"], answer: 1 },
      { es: "Trabajo ___ una oficina.", options: ["en", "a", "de"], answer: 0 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Match each preposition to the phrase it completes:",
    controlledTableItems: [
      { label: "vivir ___ Madrid", stem: "", end: "en" }, { label: "ser ___ Perú", stem: "", end: "de" },
      { label: "ir ___ la playa", stem: "", end: "a" }, { label: "hablar ___ un amigo", stem: "", end: "con" },
      { label: "el color ___ el coche", stem: "", end: "de" }, { label: "llegar ___ las ocho", stem: "", end: "a" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now practice in sentences",
    controlledBlanksHeading: "Prepositions in context",
    controlledBlanks: [
      { before: "Vivimos ", verb: "in", after: " Barcelona.", answer: "en" },
      { before: "Somos ", verb: "from", after: " Colombia.", answer: "de" },
      { before: "Van ", verb: "to", after: " la fiesta.", answer: "a" },
    ],
    mixedBlanks: [
      { before: "Trabajo ", verb: "with", after: " mi padre.", answer: "con" },
      { before: "El regalo es ", verb: "of/from", after: " mi abuela.", answer: "de" },
      { before: "Estamos ", verb: "at", after: " casa.", answer: "en" },
      { before: "Camino ", verb: "to", after: " el parque.", answer: "a" },
      { before: "Como ", verb: "with", after: " mis amigos.", answer: "con" },
      { before: "Soy ", verb: "from", after: " España.", answer: "de" },
    ],
    producePrompts: [
      { focus: "Simple prepositions (en, de, a, con)", produce: { prompt: "Describe tu día usando en, de, a y con.", en: "(¿Dónde? ¿De dónde? ¿Adónde? ¿Con quién?)", instruction: "Write 3-5 sentences, using all four prepositions at least once." } },
      { focus: "Simple prepositions (en, de, a, con)", produce: { prompt: "Describe de dónde eres y dónde vives.", en: "Describe where you're from and where you live.", instruction: "Write 3-5 sentences using en, de and a." } },
      { focus: "Simple prepositions (en, de, a, con)", produce: { prompt: "Describe con quién haces las cosas.", en: "Describe who you do things with.", instruction: "Write 3-5 sentences using con at least twice." } },
    ],
    conversationHint: "Head to the Speaking tab and describe your day — try to use en, de, a and con naturally as you talk.",
  },
  "Basic negation (no)": {
    id: "neg",
    topic: "Basic negation (no)",
    noticeHint: "Read these. Where does «no» go?",
    noticeRows: [
      { pron: "", stem: "", end: "No", tail: "hablo francés." },
      { pron: "Ella", stem: "", end: "no", tail: "vive aquí." },
      { pron: "", stem: "", end: "No", tail: "tenemos tiempo." },
      { pron: "Yo", stem: "", end: "no", tail: "entiendo." },
      { pron: "Ellos", stem: "", end: "no", tail: "trabajan hoy." },
    ],
    reflectQ: "Where exactly does «no» sit, relative to the verb?",
    reflectReveal: "«No» goes directly before the verb, with nothing in between — no extra 'do/does' word like in English.",
    ruleHint: "Fill in the negative form (add «no» in the right place):",
    ruleItems: [
      { label: "hablar", stem: "", end: "No hablo" }, { label: "tener", stem: "", end: "No tengo" },
      { label: "vivir", stem: "", end: "No vivo" }, { label: "comer", stem: "", end: "No como" },
      { label: "trabajar", stem: "", end: "No trabajo" }, { label: "entender", stem: "", end: "No entiendo" },
    ],
    structuredHint: "Pick the correctly placed negative sentence.",
    structuredItems: [
      { es: "¿Cuál es correcto?", options: ["No hablo inglés.", "Hablo no inglés.", "No yo hablo inglés."], answer: 0 },
      { es: "¿Cuál es correcto?", options: ["Tengo no hambre.", "No tengo hambre.", "No hambre tengo."], answer: 1 },
      { es: "¿Cuál es correcto?", options: ["Vivimos no aquí.", "No aquí vivimos.", "No vivimos aquí."], answer: 2 },
      { es: "¿Cuál es correcto?", options: ["No entiende ella.", "Ella no entiende.", "Ella entiende no."], answer: 1 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Add «no» to negate each verb:",
    controlledTableItems: [
      { label: "correr", stem: "", end: "No corro" }, { label: "estudiar", stem: "", end: "No estudio" },
      { label: "escribir", stem: "", end: "No escribo" }, { label: "beber", stem: "", end: "No bebo" },
      { label: "llegar", stem: "", end: "No llego" }, { label: "abrir", stem: "", end: "No abro" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now practice in sentences",
    controlledBlanksHeading: "Negate the sentence",
    controlledBlanks: [
      { before: "", verb: "Tengo hambre. → negative", after: "", answer: "No tengo hambre" },
      { before: "", verb: "Ella vive aquí. → negative", after: "", answer: "Ella no vive aquí" },
      { before: "", verb: "Hablamos francés. → negative", after: "", answer: "No hablamos francés" },
    ],
    mixedBlanks: [
      { before: "", verb: "Comprendo la pregunta. → negative", after: "", answer: "No comprendo la pregunta" },
      { before: "", verb: "Tienen tiempo. → negative", after: "", answer: "No tienen tiempo" },
      { before: "", verb: "Trabajas los domingos. → negative", after: "", answer: "No trabajas los domingos" },
      { before: "", verb: "Vivo en Madrid. → negative", after: "", answer: "No vivo en Madrid" },
      { before: "", verb: "Come carne. → negative", after: "", answer: "No come carne" },
      { before: "", verb: "Estudiamos español. → negative", after: "", answer: "No estudiamos español" },
    ],
    producePrompts: [
      { focus: "Basic negation (no)", produce: { prompt: "Escribe qué cosas no te gustan o no haces.", en: "(No como... No trabajo...)", instruction: "Write 4-5 sentences, negating each with «no»." } },
      { focus: "Basic negation (no)", produce: { prompt: "Corrige a un amigo: di lo que NO es verdad sobre ti.", en: "Correct a friend's wrong assumptions about you.", instruction: "Write 3-5 negative sentences." } },
      { focus: "Basic negation (no)", produce: { prompt: "Describe un mal día: todo lo que no pasó.", en: "Describe a bad day — everything that didn't happen.", instruction: "Write 4-5 negative sentences." } },
    ],
    conversationHint: "Head to the Speaking tab and talk about things you don't do or don't like — put «no» right before the verb each time.",
  },
  "Question words (qué, dónde, cómo)": {
    id: "qwords",
    topic: "Question words (qué, dónde, cómo)",
    noticeHint: "Read these questions. Which word starts each one, and what does it ask for?",
    noticeRows: [
      { pron: "¿", stem: "", end: "Qué", tail: "es esto?" },
      { pron: "¿", stem: "", end: "Dónde", tail: "vives?" },
      { pron: "¿", stem: "", end: "Cómo", tail: "te llamas?" },
      { pron: "¿", stem: "", end: "Cuándo", tail: "es tu cumpleaños?" },
      { pron: "¿", stem: "", end: "Por qué", tail: "estudias español?" },
    ],
    reflectQ: "What do these words have in common in writing?",
    reflectReveal: "Question words always carry a written accent (qué, dónde, cómo, cuándo) and sit right at the start of the question, followed by the verb.",
    ruleHint: "Fill in the missing question word for each meaning:",
    ruleItems: [
      { label: "what", stem: "", end: "qué" }, { label: "where", stem: "", end: "dónde" },
      { label: "how", stem: "", end: "cómo" }, { label: "who", stem: "", end: "quién" },
      { label: "when", stem: "", end: "cuándo" }, { label: "why", stem: "", end: "por qué" },
    ],
    structuredHint: "Pick the question word that matches what's being asked.",
    structuredItems: [
      { es: "___ vives?", options: ["Qué", "Dónde", "Cómo"], answer: 1 },
      { es: "___ te llamas?", options: ["Cómo", "Dónde", "Quién"], answer: 0 },
      { es: "___ es tu cumpleaños?", options: ["Qué", "Cuándo", "Cómo"], answer: 1 },
      { es: "___ estudias español?", options: ["Dónde", "Cómo", "Por qué"], answer: 2 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Match each question word to what it asks for:",
    controlledTableItems: [
      { label: "asks for a place →", stem: "", end: "dónde" }, { label: "asks for a manner →", stem: "", end: "cómo" },
      { label: "asks for a thing →", stem: "", end: "qué" }, { label: "asks for a person →", stem: "", end: "quién" },
      { label: "asks for a time →", stem: "", end: "cuándo" }, { label: "asks for a reason →", stem: "", end: "por qué" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now practice in full questions",
    controlledBlanksHeading: "Ask the question",
    controlledBlanks: [
      { before: "¿", verb: "where", after: " está el baño?", answer: "Dónde" },
      { before: "¿", verb: "who", after: " es ese chico?", answer: "Quién" },
      { before: "¿", verb: "why", after: " no vienes?", answer: "Por qué" },
    ],
    mixedBlanks: [
      { before: "¿", verb: "what", after: " quieres comer?", answer: "Qué" },
      { before: "¿", verb: "when", after: " llegas?", answer: "Cuándo" },
      { before: "¿", verb: "how", after: " estás?", answer: "Cómo" },
      { before: "¿", verb: "where", after: " trabajas?", answer: "Dónde" },
      { before: "¿", verb: "who", after: " habla español aquí?", answer: "Quién" },
      { before: "¿", verb: "why", after: " estudias esto?", answer: "Por qué" },
    ],
    producePrompts: [
      { focus: "Question words (qué, dónde, cómo)", produce: { prompt: "Escribe tres preguntas para un nuevo amigo.", en: "(¿Cómo...? ¿Dónde...? ¿Qué...?)", instruction: "Write at least three questions, each with a different question word." } },
      { focus: "Question words (qué, dónde, cómo)", produce: { prompt: "Escribe las preguntas de una entrevista de trabajo.", en: "Write job-interview questions.", instruction: "Write 4-5 questions using different question words." } },
      { focus: "Question words (qué, dónde, cómo)", produce: { prompt: "Imagina que conoces a un famoso: ¿qué le preguntas?", en: "You meet a celebrity — what do you ask?", instruction: "Write 3-5 questions using different question words." } },
    ],
    conversationHint: "Head to the Speaking tab and interview your AI partner — ask qué, dónde, cómo, cuándo and por qué questions.",
  },
  "Gustar-type verbs (basic)": {
    id: "gustar",
    topic: "Gustar-type verbs (basic)",
    noticeHint: "Read these. What changes on «gustar» — and why?",
    noticeRows: [
      { pron: "Me", stem: "gust", end: "a", tail: "el café." },
      { pron: "Te", stem: "gust", end: "an", tail: "los perros." },
      { pron: "Le", stem: "gust", end: "a", tail: "bailar." },
      { pron: "Nos", stem: "gust", end: "an", tail: "las fiestas." },
      { pron: "Les", stem: "gust", end: "a", tail: "el chocolate." },
    ],
    reflectQ: "What decides gusta vs. gustan — the person who likes it, or the thing being liked?",
    reflectReveal: "Gustar works backwards: the thing liked is the grammatical subject. One thing (or an infinitive) → gusta. More than one thing → gustan. Me/te/le/nos/os/les show who's doing the liking.",
    ruleHint: "Fill in gusta or gustan:",
    ruleItems: [
      { label: "me (I) + el café", stem: "gust", end: "a" }, { label: "te (you) + los perros", stem: "gust", end: "an" },
      { label: "le (she) + leer", stem: "gust", end: "a" }, { label: "nos (we) + las fiestas", stem: "gust", end: "an" },
      { label: "les (they) + el cine", stem: "gust", end: "a" }, { label: "os (you all) + los libros", stem: "gust", end: "an" },
    ],
    structuredHint: "Pick the correct form — it agrees with the thing liked, not the person.",
    structuredItems: [
      { es: "A mí me ___ las manzanas.", options: ["gusta", "gustan"], answer: 1 },
      { es: "A ella le ___ leer.", options: ["gusta", "gustan"], answer: 0 },
      { es: "A nosotros nos ___ los perros.", options: ["gusta", "gustan"], answer: 1 },
      { es: "A ellos les ___ el fútbol.", options: ["gusta", "gustan"], answer: 0 },
    ],
    structuredLastLabel: "Start controlled practice",
    controlledTableHint: "Fill in gusta or gustan for each situation:",
    controlledTableItems: [
      { label: "I like coffee →", stem: "gust", end: "a" }, { label: "you like books →", stem: "gust", end: "an" },
      { label: "he likes to dance →", stem: "gust", end: "a" }, { label: "we like movies →", stem: "gust", end: "an" },
      { label: "you all like music →", stem: "gust", end: "a" }, { label: "they like parties →", stem: "gust", end: "an" },
    ],
    controlledTablePlaceholder: "…",
    controlledNextLabel: "Now practice in sentences",
    controlledBlanksHeading: "Gusta or gustan?",
    controlledBlanks: [
      { before: "A mí me ", verb: "chocolate (sing.)", after: " el chocolate.", answer: "gusta" },
      { before: "A ti te ", verb: "cats (pl.)", after: " los gatos.", answer: "gustan" },
      { before: "A nosotros nos ", verb: "to travel (infinitive → sing.)", after: " viajar.", answer: "gusta" },
    ],
    mixedBlanks: [
      { before: "A ella le ", verb: "flowers (pl.)", after: " las flores.", answer: "gustan" },
      { before: "A ustedes les ", verb: "the beach (sing.)", after: " la playa.", answer: "gusta" },
      { before: "A mí me ", verb: "video games (pl.)", after: " los videojuegos.", answer: "gustan" },
      { before: "A él le ", verb: "to cook (infinitive → sing.)", after: " cocinar.", answer: "gusta" },
      { before: "A nosotros nos ", verb: "documentaries (pl.)", after: " los documentales.", answer: "gustan" },
      { before: "A vosotros os ", verb: "the city (sing.)", after: " la ciudad.", answer: "gusta" },
    ],
    producePrompts: [
      { focus: "Gustar-type verbs (basic)", produce: { prompt: "Habla de tres cosas que te gustan y una que no te gusta.", en: "(Me gusta... No me gustan...)", instruction: "Write 4-5 sentences using gusta and gustan correctly." } },
      { focus: "Gustar-type verbs (basic)", produce: { prompt: "Describe lo que le gusta a tu familia.", en: "Describe what your family likes.", instruction: "Write 3-5 sentences using le/les gusta(n)." } },
      { focus: "Gustar-type verbs (basic)", produce: { prompt: "Compara tus gustos con los de un amigo.", en: "Compare your tastes with a friend's.", instruction: "Write 4-5 sentences mixing me/te/le/nos gusta(n)." } },
    ],
    conversationHint: "Head to the Speaking tab and talk about your likes and dislikes — check whether each one needs gusta or gustan as you go.",
  },
};

export default GrammarScreen;
