"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";
import "../(app)/spanishup-app.css";

// ── Types ─────────────────────────────────────────────────────────────
interface Question {
  tier: string;
  skill: string;
  q: string;
  opts: string[];
  ans: number;
}

interface CefrBand {
  max: number;
  level: string;
  name: string;
  summary: string;
  can: string;
}

type Step = "account" | "language" | "priority" | "motivation" | "level" | "welcome" | "test" | "result" | "done";

interface LanguageOption {
  code: string;
  name: string;
  native: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: "ES", name: "Spanish", native: "Español" },
];

interface PickOption {
  code: string;
  name: string;
  desc: string;
}

const SKILL_PRIORITIES: PickOption[] = [
  { code: "SPK", name: "Speaking", desc: "Conversation, pronunciation, fluency" },
  { code: "LIS", name: "Listening", desc: "Understanding native speakers, media, audio" },
  { code: "RD", name: "Reading", desc: "Comprehension of text, articles, books" },
  { code: "WR", name: "Writing", desc: "Grammar, composition, texting/emailing" },
];

const MOTIVATIONS: PickOption[] = [
  { code: "1", name: "Travel", desc: "Survival phrases, ordering food, asking directions" },
  { code: "2", name: "Work / business", desc: "Professional communication, emails, meetings" },
  { code: "3", name: "Academic study", desc: "Exams, coursework, research" },
  { code: "4", name: "Living abroad / relocation", desc: "Day-to-day fluency, bureaucracy, integration" },
  { code: "5", name: "Family or heritage", desc: "Reconnecting with roots, talking to relatives" },
  { code: "6", name: "Dating or a partner", desc: "Connecting with someone in their language" },
  { code: "7", name: "Making friends", desc: "Socializing with new people" },
  { code: "8", name: "Consuming media", desc: "Movies, music, books, YouTube without subtitles" },
  { code: "9", name: "Gaming / online communities", desc: "Chatting and playing with others in that language" },
];

// ── Data ──────────────────────────────────────────────────────────────
const QUESTIONS: Question[] = [
  // A1 · Beginner
  { tier: "A1", skill: "Vocabulary", q: "What does \"gato\" mean?", opts: ["Dog", "Cat", "House", "Water"], ans: 1 },
  { tier: "A1", skill: "Gender agreement", q: "Choose the correct article: \"___ casa es grande.\"", opts: ["El", "La", "Los", "Un"], ans: 1 },
  { tier: "A1", skill: "Verb · ser", q: "Complete: \"Yo ___ estudiante.\"", opts: ["es", "soy", "eres", "son"], ans: 1 },
  { tier: "A1", skill: "Vocabulary", q: "Which word means \"thank you\"?", opts: ["Hola", "Adiós", "Gracias", "Por favor"], ans: 2 },
  // A2 · Elementary
  { tier: "A2", skill: "Ser vs estar", q: "Complete (a temporary state): \"La sopa ___ caliente.\"", opts: ["es", "está", "ser", "son"], ans: 1 },
  { tier: "A2", skill: "Preterite", q: "Complete: \"Ayer (yo) ___ al cine.\"", opts: ["voy", "iba", "fui", "iré"], ans: 2 },
  { tier: "A2", skill: "False friend", q: "\"Estoy embarazada\" means:", opts: ["I'm embarrassed", "I'm pregnant", "I'm tired", "I'm busy"], ans: 1 },
  { tier: "A2", skill: "Reflexive verbs", q: "Complete (I wake up): \"Me ___ a las siete.\"", opts: ["despierto", "despierta", "despertar", "despiertas"], ans: 0 },
  // B1 · Intermediate
  { tier: "B1", skill: "Subjunctive", q: "Complete: \"Espero que él ___ aquí mañana.\"", opts: ["está", "esté", "es", "sea"], ans: 1 },
  { tier: "B1", skill: "Preterite vs imperfect", q: "Complete: \"Cuando era niño, ___ mucho.\"", opts: ["jugué", "jugaba", "juego", "jugaré"], ans: 1 },
  { tier: "B1", skill: "Por vs para", q: "Complete: \"Estudio español ___ mi trabajo.\"", opts: ["por", "para", "pora", "de"], ans: 1 },
  { tier: "B1", skill: "Idioms", q: "\"Tener ganas de\" means:", opts: ["To be afraid of", "To feel like (doing something)", "To be right", "To be in a hurry"], ans: 1 },
  // B2 · Upper-intermediate
  { tier: "B2", skill: "Accidental se", q: "Complete (I forgot the keys): \"Se me ___ las llaves.\"", opts: ["olvidé", "olvidaron", "olvidó", "olvidan"], ans: 1 },
  { tier: "B2", skill: "Past subjunctive", q: "Complete: \"Si yo ___ rico, viajaría por el mundo.\"", opts: ["soy", "fuera", "seré", "era"], ans: 1 },
  { tier: "B2", skill: "Connectors", q: "Complete (Although he was tired…): \"___ estaba cansado, terminó el trabajo.\"", opts: ["Aunque", "Porque", "Como", "Mientras"], ans: 0 },
  { tier: "B2", skill: "Vocabulary nuance", q: "\"Realizar un sueño\" most precisely means:", opts: ["To realize (notice) a dream", "To fulfill / achieve a dream", "To dream a lot", "To wake from a dream"], ans: 1 },
  // C1/C2 · Advanced
  { tier: "C1", skill: "Subjunctive nuance", q: "Complete: \"No es que no ___, es que no puedo.\"", opts: ["quiero", "quiera", "querré", "quería"], ans: 1 },
  { tier: "C1", skill: "Idioms", q: "\"Estar en las nubes\" means:", opts: ["To be very happy", "To be daydreaming / distracted", "To be flying", "To be unsure about the weather"], ans: 1 },
  { tier: "C2", skill: "Proverbs", q: "Complete the proverb: \"A buen entendedor, ___ palabras bastan.\"", opts: ["muchas", "pocas", "todas", "ningunas"], ans: 1 },
  { tier: "C2", skill: "Syntax & concession", q: "Which is correct? \"Por mucho que ___, no lo lograrás.\"", opts: ["intentas", "intentes", "intentarás", "intentabas"], ans: 1 },
];

const CEFR_BANDS: CefrBand[] = [
  { max: 4,  level: "A1", name: "Beginner",          summary: "You're just getting started — you recognize core words and greetings. We'll build your foundation from the ground up, one solid brick at a time.", can: "You can greet people, share basic personal details, and recognize everyday words." },
  { max: 8,  level: "A2", name: "Elementary",        summary: "You can handle simple, everyday phrases with confidence. Next up: stringing them together into real, flowing conversations.", can: "You can order food, ask for directions, and talk about routines and familiar topics." },
  { max: 12, level: "B1", name: "Intermediate",      summary: "You hold your own in familiar situations and past/future tenses no longer scare you. We'll push you toward genuine fluency and nuance.", can: "You can manage most travel situations and describe experiences, hopes, and plans." },
  { max: 16, level: "B2", name: "Upper-intermediate", summary: "You're confident and capable across most topics. Time to polish the tricky bits — subjunctive, idioms, and register.", can: "You can converse fluently with native speakers and follow films, news, and debates." },
  { max: 20, level: "C1/C2", name: "Advanced",       summary: "Impressive. You navigate nuance, idioms, and complex grammar with ease. We'll keep you sharp with native-level material and the finest details.", can: "You can express yourself precisely in academic, professional, and literary contexts." },
];

const TIERS = [
  { level: "A1", name: "Beginner" },
  { level: "A2", name: "Elementary" },
  { level: "B1", name: "Intermediate" },
  { level: "B2", name: "Upper-int." },
  { level: "C1/C2", name: "Advanced" },
];

const STEPS: Step[] = ["account", "language", "priority", "motivation", "level", "welcome", "test", "result", "done"];

function scoreToCefr(correct: number): CefrBand {
  return CEFR_BANDS.find((b) => correct <= b.max) ?? CEFR_BANDS[CEFR_BANDS.length - 1];
}

// Answer options are authored with the correct choice always in the same
// slot — shuffle each question's options (and remap `ans` to match) so the
// correct answer isn't predictably "B" every time.
function shuffleQuestionOptions(q: Question): Question {
  const order = q.opts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, opts: order.map((i) => q.opts[i]), ans: order.indexOf(q.ans) };
}

// ── UI primitives ─────────────────────────────────────────────────────
function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="sp-progress" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      <i style={{ width: `${pct}%`, background: "var(--acc-deep)" }} />
    </div>
  );
}

function OptionButton({
  label, text, selected, onClick,
}: {
  label: string; text: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ob-option${selected ? " is-selected" : ""}`}
      onClick={onClick}
    >
      <span className="ob-option-key">{label}</span>
      <span className="ob-option-text">{text}</span>
    </button>
  );
}

function Field({
  label, hint, error, children,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <label className="ob-field">
      <span className="ob-field-label">
        {label}
        {hint && <span className="ob-field-hint">{hint}</span>}
      </span>
      {children}
      {error && <span className="ob-field-error">{error}</span>}
    </label>
  );
}

// ── Screens ───────────────────────────────────────────────────────────
function LanguageScreen({ onPick }: { onPick: () => void }) {
  return (
    <div className="sp-card ob-card ob-welcome">
      <h1 className="sp-h1">Pick a language</h1>
      <p className="sp-sub">Choose what you want to learn.</p>
      <div className="ob-lang-list">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            className="ob-lang-card"
            onClick={onPick}
          >
            <span className="ob-lang-code">{l.code}</span>
            <span className="ob-lang-body">
              <span className="ob-lang-name">{l.name}</span>
              <span className="ob-lang-native">{l.native}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PickListScreen({
  title, sub, options, onPick,
}: {
  title: string; sub: string; options: PickOption[]; onPick: (name: string) => void;
}) {
  return (
    <div className="sp-card ob-card ob-welcome">
      <h1 className="sp-h1">{title}</h1>
      <p className="sp-sub">{sub}</p>
      <div className="ob-lang-list">
        {options.map((o) => (
          <button key={o.code} type="button" className="ob-lang-card" onClick={() => onPick(o.name)}>
            <span className="ob-lang-code">{o.code}</span>
            <span className="ob-lang-body">
              <span className="ob-lang-name">{o.name}</span>
              <span className="ob-lang-native">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LevelChoiceScreen({ onBeginner, onFindLevel }: { onBeginner: () => void; onFindLevel: () => void }) {
  return (
    <div className="sp-card ob-card ob-welcome">
      <h1 className="sp-h1">What&apos;s your starting point?</h1>
      <p className="sp-sub">
        Tell us where you&apos;re at — or take a quick placement test and we&apos;ll work it out for you.
      </p>
      <div className="ob-lang-list">
        <button type="button" className="ob-lang-card" onClick={onBeginner}>
          <span className="ob-lang-code">A1</span>
          <span className="ob-lang-body">
            <span className="ob-lang-name">I&apos;m a beginner</span>
            <span className="ob-lang-native">Start from the basics</span>
          </span>
        </button>
        <button type="button" className="ob-lang-card" onClick={onFindLevel}>
          <span className="ob-lang-code">?</span>
          <span className="ob-lang-body">
            <span className="ob-lang-name">Find my level</span>
            <span className="ob-lang-native">Take a 20-question placement test</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="sp-card ob-card ob-welcome">
      <h1 className="sp-h1">¡Hola! Let&apos;s find your level.</h1>
      <p className="sp-sub">
        Take a quick 20-question placement test — we&apos;ll pinpoint your CEFR level and
        build a learning path that fits you.
      </p>
      <div className="ob-ladder">
        {TIERS.map((t) => (
          <div key={t.level} className="ob-ladder-step">
            <span className="ob-ladder-level">{t.level}</span>
            <span className="ob-ladder-name">{t.name}</span>
          </div>
        ))}
      </div>
      <button className="sp-btn sp-btn-primary" style={{ width: "100%" }} onClick={onStart}>
        Get started
      </button>
      <p className="ob-fineprint">20-question test · about 4 minutes</p>
    </div>
  );
}

function TestScreen({ onFinish }: { onFinish: (correct: number) => void }) {
  const [questions] = useState<Question[]>(() => QUESTIONS.map(shuffleQuestionOptions));
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(questions.length).fill(null));
  const q = questions[idx];
  const chosen = answers[idx];
  const isLast = idx === questions.length - 1;

  function choose(i: number) {
    if (chosen !== null) return;
    const next = answers.slice();
    next[idx] = i;
    setAnswers(next);
    setTimeout(() => {
      if (isLast) {
        const correct = next.reduce<number>((n, a, qi) => n + (a === questions[qi].ans ? 1 : 0), 0);
        onFinish(correct);
      } else {
        setIdx((v) => v + 1);
      }
    }, 260);
  }

  return (
    <div className="sp-card ob-card">
      <div className="ob-test-top">
        <span className="ob-test-count">
          {idx + 1} <span className="ob-of">/ {questions.length}</span>
        </span>
      </div>
      <Progress current={idx} total={questions.length} />
      <h2 className="ob-question" lang="es">{q.q}</h2>
      <div className="ob-options">
        {q.opts.map((opt, i) => (
          <OptionButton
            key={i}
            label={"ABCD"[i]}
            text={opt}
            selected={chosen === i}
            onClick={() => choose(i)}
          />
        ))}
      </div>
    </div>
  );
}

function ResultScreen({ correct, onContinue }: { correct: number; onContinue: () => void }) {
  const band = scoreToCefr(correct);
  return (
    <div className="sp-card ob-card ob-result">
      <p className="ob-result-eyebrow">Your Spanish level is</p>
      <div className="ob-level-badge">
        <span className="ob-level-code">{band.level}</span>
        <span className="ob-level-name">{band.name}</span>
      </div>
      <p className="ob-result-score">
        You answered <strong>{correct} of {QUESTIONS.length}</strong> correctly
      </p>
      <p className="sp-sub ob-result-summary">{band.summary}</p>
      <div className="ob-result-can">
        <span className="ob-can-label">At this level</span>
        <p>{band.can}</p>
      </div>
      <button className="sp-btn sp-btn-primary" style={{ width: "100%" }} onClick={onContinue}>
        Save my level &amp; start learning
      </button>
      <p className="ob-fineprint">Your level is saved to your account — streaks &amp; XP start now.</p>
    </div>
  );
}

function AccountScreen({
  onSubmit,
}: {
  onSubmit: (data: { name: string; email: string; password: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Tell us what to call you.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address.";
    if (password.length < 8) e.password = "At least 8 characters.";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError("");
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), email, password });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Registration failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="sp-card ob-card">
      <div className="ob-account-head">
        <h1 className="sp-h1">Create your account</h1>
      </div>
      <p className="sp-sub">
        Set up your free account first — then we&apos;ll measure your level and keep your
        streaks and XP waiting next time.
      </p>

      {serverError && <p className="ob-error-banner">{serverError}</p>}

      <form className="ob-form" onSubmit={submit} noValidate>
        <Field label="What should we call you?" error={errors.name}>
          <input
            className={`gr-input${errors.name ? " has-error" : ""}`}
            style={{ margin: 0 }}
            type="text"
            value={name}
            placeholder="e.g. María"
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            className={`gr-input${errors.email ? " has-error" : ""}`}
            style={{ margin: 0 }}
            type="email"
            value={email}
            placeholder="you@email.com"
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Password" hint="min 8 characters" error={errors.password}>
          <input
            className={`gr-input${errors.password ? " has-error" : ""}`}
            style={{ margin: 0 }}
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <button className="sp-btn sp-btn-primary" style={{ width: "100%" }} type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account & start test"}
        </button>
      </form>
      <p className="ob-fineprint">
        Already have an account?{" "}
        <Link className="ob-textlink" href="/login">Sign in</Link>
      </p>
    </div>
  );
}

function DoneScreen({
  name, level, onStart,
}: {
  name: string; level: string; onStart: () => void;
}) {
  return (
    <div className="sp-card ob-card ob-done">
      <h1 className="sp-h1">¡Bienvenido, {name}!</h1>
      <p className="sp-sub">Your account is ready. Here&apos;s where you&apos;ll pick up.</p>
      <div className="ob-dash-preview">
        <div className="ob-dash-stat">
          <span className="ob-dash-num">{level}</span>
          <span className="ob-dash-cap">your level</span>
        </div>
        <div className="ob-dash-stat">
          <span className="ob-dash-num">0</span>
          <span className="ob-dash-cap">day streak</span>
        </div>
        <div className="ob-dash-stat">
          <span className="ob-dash-num">0</span>
          <span className="ob-dash-cap">XP today</span>
        </div>
      </div>
      <button className="sp-btn sp-btn-primary" style={{ width: "100%" }} onClick={onStart}>
        Start your first lesson →
      </button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const [history, setHistory] = useState<Step[]>(["account"]);
  const step = history[history.length - 1];
  const [correct, setCorrect] = useState(0);
  const [userName, setUserName] = useState("");
  const band = scoreToCefr(correct);

  function handlePriorityPick(name: string) {
    if (typeof window !== "undefined") localStorage.setItem("onboarding_skill_priority", name);
    authApi.setOnboardingPreferences({ skill_priority: name }).catch(() => {});
    go("motivation");
  }

  function handleMotivationPick(name: string) {
    if (typeof window !== "undefined") localStorage.setItem("onboarding_motivation", name);
    authApi.setOnboardingPreferences({ motivation: name }).catch(() => {});
    go("level");
  }

  // History-based (not index-based) so branching paths — e.g. "I'm a
  // beginner" skipping straight to "done" — back up through where the user
  // actually came from, not a fixed linear order.
  function go(next: Step) {
    setHistory((h) => [...h, next]);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }

  function goBack() {
    if (history.length <= 1) { router.push("/login"); return; }
    setHistory((h) => h.slice(0, -1));
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }

  async function handleAccountSubmit(data: { name: string; email: string; password: string }) {
    await authApi.register(data.email, data.password);
    if (typeof window !== "undefined") {
      localStorage.setItem("display_name", data.name);
    }
    setUserName(data.name);
    go("language");
  }

  return (
    <div className="sp-root">
      <div className="sp-bg" aria-hidden="true">
        <div className="sp-blob b1" />
        <div className="sp-blob b2" />
        <div className="sp-blob b3" />
      </div>

      <div className="ob-page">
        <header className="ob-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="ob-back-btn" onClick={goBack} aria-label="Back">
              ‹ Back
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="ob-brand">Plauda</span>
            <Image src="/logo/plauda-fox.png" alt="" width={28} height={28} className="ob-brand-logo" />
          </div>
        </header>

        {step === "account" && (
          <AccountScreen onSubmit={handleAccountSubmit} />
        )}
        {step === "language" && (
          <LanguageScreen onPick={() => go("priority")} />
        )}
        {step === "priority" && (
          <PickListScreen
            title="What do you want to focus on?"
            sub="We'll shape your lessons around this skill first."
            options={SKILL_PRIORITIES}
            onPick={handlePriorityPick}
          />
        )}
        {step === "motivation" && (
          <PickListScreen
            title="What's motivating you to learn?"
            sub="This helps us pick topics and scenarios that actually matter to you."
            options={MOTIVATIONS}
            onPick={handleMotivationPick}
          />
        )}
        {step === "level" && (
          <LevelChoiceScreen
            onBeginner={() => { setCorrect(0); go("done"); }}
            onFindLevel={() => go("welcome")}
          />
        )}
        {step === "welcome" && (
          <WelcomeScreen onStart={() => go("test")} />
        )}
        {step === "test" && (
          <TestScreen onFinish={(n) => { setCorrect(n); go("result"); }} />
        )}
        {step === "result" && (
          <ResultScreen correct={correct} onContinue={() => go("done")} />
        )}
        {step === "done" && (
          <DoneScreen
            name={userName || "amigo"}
            level={band.level}
            onStart={() => router.push("/home")}
          />
        )}

        <footer className="ob-footdots" style={{ marginTop: 20 }}>
          {STEPS.map((s) => (
            <span key={s} className={`ob-footdot${s === step ? " is-active" : ""}`} />
          ))}
        </footer>
      </div>
    </div>
  );
}
