"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi, ApiError } from "@/lib/api";

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

type Step = "welcome" | "account" | "test" | "result" | "done";

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

const STEPS: Step[] = ["welcome", "account", "test", "result", "done"];

function scoreToCefr(correct: number): CefrBand {
  return CEFR_BANDS.find((b) => correct <= b.max) ?? CEFR_BANDS[CEFR_BANDS.length - 1];
}

// ── UI primitives ─────────────────────────────────────────────────────
function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="su-progress-bar" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      <div className="su-progress-fill" style={{ width: `${pct}%` }} />
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
      className={`su-option${selected ? " is-selected" : ""}`}
      onClick={onClick}
    >
      <span className="su-option-key">{label}</span>
      <span className="su-option-text">{text}</span>
    </button>
  );
}

function Field({
  label, hint, error, children,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <label className="su-field">
      <span className="su-field-label">
        {label}
        {hint && <span className="su-field-hint">{hint}</span>}
      </span>
      {children}
      {error && <span className="su-field-error">{error}</span>}
    </label>
  );
}

// ── Screens ───────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="su-card su-screen su-welcome">
      <h1 className="su-h1">¡Hola! Let&apos;s find your level.</h1>
      <p className="su-lead">
        Create your free account, then take a quick 20-question placement test —
        we&apos;ll pinpoint your CEFR level and build a learning path that fits you.
      </p>
      <div className="su-ladder">
        {TIERS.map((t) => (
          <div key={t.level} className="su-ladder-step">
            <span className="su-ladder-level">{t.level}</span>
            <span className="su-ladder-name">{t.name}</span>
          </div>
        ))}
      </div>
      <button className="su-btn su-btn-primary su-btn-lg" onClick={onStart}>
        Get started
      </button>
      <p className="su-fineprint">Free account · 20-question test · about 4 minutes</p>
    </div>
  );
}

function TestScreen({ onFinish }: { onFinish: (correct: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(QUESTIONS.length).fill(null));
  const q = QUESTIONS[idx];
  const chosen = answers[idx];
  const isLast = idx === QUESTIONS.length - 1;

  function choose(i: number) {
    if (chosen !== null) return;
    const next = answers.slice();
    next[idx] = i;
    setAnswers(next);
    setTimeout(() => {
      if (isLast) {
        const correct = next.reduce((n, a, qi) => n + (a === QUESTIONS[qi].ans ? 1 : 0), 0);
        onFinish(correct);
      } else {
        setIdx((v) => v + 1);
      }
    }, 260);
  }

  function back() {
    if (idx === 0) return;
    setIdx((v) => v - 1);
  }

  return (
    <div className="su-card su-screen su-test">
      <div className="su-test-top">
        <button className="su-link-btn" onClick={back} disabled={idx === 0} aria-label="Previous question">
          ‹ Back
        </button>
        <span className="su-test-count">
          {idx + 1} <span className="su-of">/ {QUESTIONS.length}</span>
        </span>
      </div>
      <Progress current={idx} total={QUESTIONS.length} />
      <div className="su-tier-chip" data-tier={q.tier}>
        <span className="su-tier-level">{q.tier}</span>
        <span className="su-tier-skill">{q.skill}</span>
      </div>
      <h2 className="su-question" lang="es">{q.q}</h2>
      <div className="su-options">
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
    <div className="su-card su-screen su-result">
      <p className="su-result-eyebrow">Your Spanish level is</p>
      <div className="su-level-badge" data-tier={band.level}>
        <span className="su-level-code">{band.level}</span>
        <span className="su-level-name">{band.name}</span>
      </div>
      <p className="su-result-score">
        You answered <strong>{correct} of {QUESTIONS.length}</strong> correctly
      </p>
      <p className="su-lead su-result-summary">{band.summary}</p>
      <div className="su-result-can">
        <span className="su-can-label">At this level</span>
        <p>{band.can}</p>
      </div>
      <button className="su-btn su-btn-primary su-btn-lg" onClick={onContinue}>
        Save my level &amp; start learning
      </button>
      <p className="su-fineprint">Your level is saved to your account — streaks &amp; XP start now.</p>
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
    <div className="su-card su-screen su-account">
      <div className="su-account-head">
        <h1 className="su-h1">Create your account</h1>
      </div>
      <p className="su-lead">
        Set up your free account first — then we&apos;ll measure your level and keep your
        streaks and XP waiting next time.
      </p>

      {serverError && <p className="su-error-banner">{serverError}</p>}

      <form className="su-form" onSubmit={submit} noValidate>
        <Field label="What should we call you?" error={errors.name}>
          <input
            className={`su-input${errors.name ? " has-error" : ""}`}
            type="text"
            value={name}
            placeholder="e.g. María"
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            className={`su-input${errors.email ? " has-error" : ""}`}
            type="email"
            value={email}
            placeholder="you@email.com"
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label="Password" hint="min 8 characters" error={errors.password}>
          <input
            className={`su-input${errors.password ? " has-error" : ""}`}
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <button className="su-btn su-btn-primary su-btn-lg" type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account & start test"}
        </button>
      </form>
      <p className="su-fineprint">
        Already have an account?{" "}
        <Link className="su-textlink" href="/login">Sign in</Link>
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
    <div className="su-card su-screen su-done">
      <h1 className="su-h1">¡Bienvenido, {name}!</h1>
      <p className="su-lead">Your account is ready. Here&apos;s where you&apos;ll pick up.</p>
      <div className="su-dash-preview">
        <div className="su-dash-stat">
          <span className="su-dash-num">{level}</span>
          <span className="su-dash-cap">your level</span>
        </div>
        <div className="su-dash-stat">
          <span className="su-dash-num">0</span>
          <span className="su-dash-cap">day streak</span>
        </div>
        <div className="su-dash-stat">
          <span className="su-dash-num">0</span>
          <span className="su-dash-cap">XP today</span>
        </div>
      </div>
      <button className="su-btn su-btn-primary su-btn-lg" onClick={onStart}>
        Start your first lesson →
      </button>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [correct, setCorrect] = useState(0);
  const [userName, setUserName] = useState("");
  const band = scoreToCefr(correct);

  function go(next: Step) {
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }

  async function handleAccountSubmit(data: { name: string; email: string; password: string }) {
    await authApi.register(data.email, data.password);
    if (typeof window !== "undefined") {
      localStorage.setItem("display_name", data.name);
    }
    setUserName(data.name);
    go("test");
  }

  return (
    <div className="su-root">
      <div className="su-stage">
        <header className="su-topbar">
          <div className="su-logo" style={{ fontSize: 20 }}>
            <span className="su-logo-mark" aria-hidden="true">S</span>
            <span className="su-logo-text">
              Spanish<span className="su-accent-text">Up</span>
            </span>
          </div>
          {step !== "welcome" && step !== "done" && (
            <span className="su-topbar-step">
              {step === "account" ? "Create account" : step === "test" ? "Placement test" : "Your result"}
            </span>
          )}
        </header>

        <main className="su-main">
          {step === "welcome" && (
            <WelcomeScreen onStart={() => go("account")} />
          )}
          {step === "account" && (
            <AccountScreen onSubmit={handleAccountSubmit} />
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
              onStart={() => router.push("/study")}
            />
          )}
        </main>

        <footer className="su-footdots">
          {STEPS.map((s) => (
            <span key={s} className={`su-footdot${s === step ? " is-active" : ""}`} />
          ))}
        </footer>
      </div>
    </div>
  );
}
