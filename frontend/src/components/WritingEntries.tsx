"use client";

import { useState } from "react";
import { writingApi } from "@/lib/api";
import type { WritingFeedback } from "@/types";

// Minimal local icon set, mirroring FreeChat's (the shared Icon lives inside
// AppShell and isn't importable from here).
function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor", xmlns: "http://www.w3.org/2000/svg" };
  switch (name) {
    case "coffee":
      return <svg {...p}><path d="M4 8h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="4" y="19" width="12" height="1.8" rx="0.9" /></svg>;
    case "globe":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>;
    case "people":
      return <svg {...p}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.4" /><path d="M3 19a6 6 0 0 1 12 0v1H3v-1Z" /><path d="M15 20v-1a7 7 0 0 0-1.2-3.9A4.5 4.5 0 0 1 21 19v1h-6Z" /></svg>;
    case "pencil":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "check":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 6" /></svg>;
    case "chevron":
    default:
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;
  }
}

/* Free writing with the AI (Writing tab). The learner picks a topic (or an
   open entry), then writes freely about it in a single field while a goals
   panel tracks which of the entry's talking points show up in the text.
   Mirrors FreeChat's scenario picker one-to-one — "chats" become "entries",
   and the live back-and-forth becomes a single writing field with the same
   objectives box, now describing what to write rather than what to say. */

// One thing the entry expects the writing to cover, plus a few Spanish
// trigger words/phrases that count as having covered it — checked directly
// against the learner's own text (unlike Speaking, there's no NPC turn to
// judge intent, so this is a local, best-effort signal, not an AI verdict).
type Objective = { text: string; triggers: string[] };

// Which tense the entry calls for, plus a short, structured refresher of how
// to form it — shown under Goals so the learner doesn't have to go hunting
// for the rule before they can write.
type ConjugationRow = { pronoun: string; ar: string; erIr: string };
type Grammar = {
  tense: string;
  intro: string;
  rows: ConjugationRow[];
  irregulars: string;
  // An extra rule tacked on for entries that mix two tenses (e.g. the open
  // entry: preterite for today, near future for tomorrow's plan).
  extra?: { label: string; note: string };
};

type Entry = {
  id: string;
  label: string;
  icon: string;
  blurb: string;
  scenario: string;    // what to write about, shown above the field
  scenario_en?: string;
  objectives: Objective[];
  grammar: Grammar;
};

const PRETERITE_INTRO = "You're recounting something that already happened.";
const PRETERITE_ROWS: ConjugationRow[] = [
  { pronoun: "yo", ar: "-é (hablé)", erIr: "-í (comí)" },
  { pronoun: "tú", ar: "-aste (hablaste)", erIr: "-iste (comiste)" },
  { pronoun: "él/ella/usted", ar: "-ó (habló)", erIr: "-ió (comió)" },
  { pronoun: "nosotros", ar: "-amos (hablamos)", erIr: "-imos (comimos)" },
  { pronoun: "vosotros", ar: "-asteis (hablasteis)", erIr: "-isteis (comisteis)" },
  { pronoun: "ellos/ustedes", ar: "-aron (hablaron)", erIr: "-ieron (comieron)" },
];
const PRETERITE_IRREGULARS = "fui/fuiste/fue (ir/ser), pedí, dijo, estuvo.";

const ENTRIES: Entry[] = [
  {
    id: "cafe", label: "At a café", icon: "coffee",
    blurb: "Write your order and something to eat.",
    scenario: "Write about being at a café: what you ordered, what it cost, and whether you liked it.",
    objectives: [
      { text: "What you ordered to drink", triggers: ["café", "té", "agua", "jugo", "cerveza", "vino", "leche", "refresco"] },
      { text: "What you ordered to eat", triggers: ["pan", "tostada", "sándwich", "tarta", "croissant", "bocadillo", "comí"] },
      { text: "How much it cost", triggers: ["cuánto", "cuesta", "costó", "precio", "euros", "pesos"] },
      { text: "Whether you liked it", triggers: ["me gustó", "estaba rico", "estaba bueno", "delicioso", "no me gustó"] },
    ],
    grammar: { tense: "Preterite", intro: PRETERITE_INTRO, rows: PRETERITE_ROWS, irregulars: PRETERITE_IRREGULARS },
  },
  {
    id: "directions", label: "Asking directions", icon: "globe",
    blurb: "Write about asking how to get somewhere.",
    scenario: "Write about asking someone for directions: where you were trying to go, who you asked, and whether you found it.",
    objectives: [
      { text: "Where you were trying to go", triggers: ["la calle", "la estación", "el museo", "el hotel", "la playa", "el parque", "iba a", "buscaba"] },
      { text: "Who you asked for help", triggers: ["le pregunté", "un hombre", "una mujer", "una persona", "el policía"] },
      { text: "The directions they gave you", triggers: ["a la derecha", "a la izquierda", "todo recto", "cerca", "lejos", "dos calles"] },
      { text: "Whether you found it", triggers: ["encontré", "llegué", "no encontré", "me perdí"] },
    ],
    grammar: { tense: "Preterite", intro: PRETERITE_INTRO, rows: PRETERITE_ROWS, irregulars: PRETERITE_IRREGULARS },
  },
  {
    id: "smalltalk", label: "Meeting someone", icon: "people",
    blurb: "Write an introduction — who you are, where you're from.",
    scenario: "Write about meeting someone new: their name, where they're from, and something you have in common.",
    objectives: [
      { text: "Their name", triggers: ["se llama", "su nombre"] },
      { text: "Where they're from", triggers: ["es de", "vive en", "españa", "méxico", "argentina"] },
      { text: "Something you have in common", triggers: ["también", "los dos", "igual que yo"] },
      { text: "What you talked about", triggers: ["hablamos de", "me contó", "le pregunté"] },
    ],
    grammar: { tense: "Preterite", intro: PRETERITE_INTRO, rows: PRETERITE_ROWS, irregulars: PRETERITE_IRREGULARS },
  },
  {
    id: "free", label: "Open entry", icon: "pencil",
    blurb: "Write about anything — no goals, just practise.",
    scenario: "Write freely, in Spanish, about your day.",
    objectives: [
      { text: "What you did today", triggers: ["hoy", "hice", "fui", "trabajé", "estudié"] },
      { text: "One thing that surprised you", triggers: ["me sorprendió", "no esperaba", "de repente"] },
      { text: "Your plan for tomorrow", triggers: ["mañana", "voy a", "planeo", "quiero"] },
    ],
    grammar: {
      tense: "Preterite + ir a + infinitive",
      intro: PRETERITE_INTRO + " For tomorrow's plan, switch to the near future.",
      rows: PRETERITE_ROWS,
      irregulars: PRETERITE_IRREGULARS,
      extra: {
        label: "Near future (tomorrow's plan)",
        note: "ir (voy, vas, va, vamos, vais, van) + a + infinitive — voy a estudiar, va a llover.",
      },
    },
  },
];

// Accent/case/punctuation-insensitive normaliser, matching the other trainers.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function metObjectives(text: string, objectives: Objective[]): boolean[] {
  const n = norm(text);
  return objectives.map((o) => o.triggers.some((t) => n.includes(norm(t))));
}

const COMPLETED_KEY = "sp-completed-writing-entries";
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

export default function WritingEntries() {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => loadCompleted());
  const markCompleted = (id: string) => {
    setCompletedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveCompleted(next);
      return next;
    });
  };
  if (!entry) return <EntryPicker onPick={setEntry} completedIds={completedIds} />;
  return (
    <WritingPane
      key={entry.id}
      entry={entry}
      onExit={() => setEntry(null)}
      onCompleted={() => markCompleted(entry.id)}
    />
  );
}

function EntryCard({ e, onPick }: { e: Entry; onPick: (e: Entry) => void }) {
  return (
    <button className="sp-card quick sp-mode" onClick={() => onPick(e)} style={{ textAlign: "left", cursor: "pointer" }}>
      <div className="q-ico"><Icon name={e.icon} size={22} /></div>
      <div>
        <div className="q-name">{e.label}</div>
        <div className="q-sub">{e.blurb}</div>
      </div>
      <span className="sp-tag"><Icon name="chevron" size={14} /></span>
    </button>
  );
}

function EntryPicker({ onPick, completedIds }: { onPick: (e: Entry) => void; completedIds: Set<string> }) {
  const openEntry = ENTRIES.find((e) => e.id === "free")!;
  const rest = ENTRIES.filter((e) => e.id !== "free");
  const newEntries = rest.filter((e) => !completedIds.has(e.id));
  const completedEntries = rest.filter((e) => completedIds.has(e.id));

  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Writing</p>
        <h1 className="sp-h1">Write about...</h1>
      </div>

      <div className="sp-mode-section">
        <p className="sp-section-label">Open entry</p>
        <div className="quick-row sp-modes sp-modes-single">
          <EntryCard e={openEntry} onPick={onPick} />
        </div>
      </div>

      {newEntries.length > 0 && (
        <div className="sp-mode-section">
          <p className="sp-section-label">New entries</p>
          <div className="quick-row sp-modes">
            {newEntries.map((e) => <EntryCard key={e.id} e={e} onPick={onPick} />)}
          </div>
        </div>
      )}

      {completedEntries.length > 0 && (
        <div className="sp-mode-section">
          <p className="sp-section-label">Completed entries</p>
          <div className="quick-row sp-modes">
            {completedEntries.map((e) => <EntryCard key={e.id} e={e} onPick={onPick} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalsPanel({ objectives, met, grammar }: { objectives: Objective[]; met: boolean[]; grammar: Grammar }) {
  const doneCount = met.filter(Boolean).length;
  return (
    <aside className="fc-goals sp-card">
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>
        Goals for this entry <span className="fc-goal-count">{doneCount}/{objectives.length}</span>
      </p>
      <ul className="fc-goal-list">
        {objectives.map((o, i) => (
          <li key={i} className={"fc-goal-item" + (met[i] ? " done" : "")}>
            {met[i] ? <Icon name="check" size={13} /> : <span className="fc-goal-dot" />}
            <span>{o.text}</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-2)" }}>
        <p className="sp-eyebrow" style={{ marginBottom: 8 }}>Grammar · {grammar.tense}</p>
        <p className="wr-gram-intro">{grammar.intro}</p>
        <div className="wr-gram-table">
          <div className="wr-gram-row wr-gram-head">
            <span /><span>-ar</span><span>-er/-ir</span>
          </div>
          {grammar.rows.map((r) => (
            <div className="wr-gram-row" key={r.pronoun}>
              <span className="wr-gram-pronoun">{r.pronoun}</span>
              <span className="wr-gram-form">{r.ar}</span>
              <span className="wr-gram-form">{r.erIr}</span>
            </div>
          ))}
        </div>
        <p className="wr-gram-irregulars"><b>Watch for irregulars:</b> {grammar.irregulars}</p>
        {grammar.extra && (
          <div className="wr-gram-extra">
            <p className="wr-gram-extra-label">{grammar.extra.label}</p>
            <p className="wr-gram-extra-note">{grammar.extra.note}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function WritingFeedbackPanel({ fb }: { fb: WritingFeedback }) {
  return (
    <div className="gr-result">
      <div className="gr-result-head">
        <div className={"gr-score" + (fb.score >= 70 ? " ok" : "")}>{fb.score}<small>/100</small></div>
        <p className="sp-sub">{fb.feedback}</p>
      </div>
      {fb.corrections.length > 0 && (
        <div className="gr-corrections">
          <h4>Grammar corrections</h4>
          {fb.corrections.map((c, i) => (
            <div className="gr-corr" key={i}>
              <span className="gr-corr-bad">{c.wrong}</span><Icon name="chevron" size={14} />
              <span className="gr-corr-good">{c.correct}</span><span className="gr-corr-why">{c.note}</span>
            </div>
          ))}
        </div>
      )}
      {fb.natural.length > 0 && (
        <div className="gr-corrections">
          <h4>Natural phrasing</h4>
          {fb.natural.map((c, i) => (
            <div className="gr-corr" key={i}>
              <span className="gr-corr-bad">{c.original}</span><Icon name="chevron" size={14} />
              <span className="gr-corr-good">{c.better}</span><span className="gr-corr-why">{c.why}</span>
            </div>
          ))}
        </div>
      )}
      {fb.vocab_upgrades.length > 0 && (
        <div className="gr-corrections">
          <h4>Vocabulary upgrades</h4>
          {fb.vocab_upgrades.map((c, i) => (
            <div className="gr-corr" key={i}>
              <span className="gr-corr-bad">{c.from_word}</span><Icon name="chevron" size={14} />
              <span className="gr-corr-good">{c.to_word}</span><span className="gr-corr-why">{c.why}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WritingPane({ entry, onExit, onCompleted }: { entry: Entry; onExit: () => void; onCompleted: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<WritingFeedback | null>(null);
  const [error, setError] = useState("");
  const met = metObjectives(text, entry.objectives);
  const allMet = met.every(Boolean);

  const check = async () => {
    if (!text.trim()) return;
    setBusy(true); setError(""); setFb(null);
    try {
      const result = await writingApi.feedback(`entry:${entry.id}`, entry.scenario, text);
      setFb(result);
      if (allMet && result.score >= 70) onCompleted();
    } catch {
      setError("Could not reach the writing coach. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", margin: "0 0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="sp-btn"
            onClick={onExit}
            aria-label="Back to entries"
            title="Back to entries"
          >
            <Icon name="chevron" size={16} /> Back
          </button>
          <div>
            <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Writing · {entry.label}</p>
            <h1 className="sp-h1" style={{ fontSize: "clamp(20px, 3vw, 28px)" }}>Writing entry</h1>
          </div>
        </div>
        <button className="sp-btn sp-btn-soft" onClick={onExit}>New entry</button>
      </div>

      <div className="fc-layout">
        <div className="fc-main">
          <div className="sp-card wr-entry-card">
            <textarea
              autoFocus
              className="wr-editor wr-textarea wr-entry-editor"
              style={{ minHeight: 220 }}
              placeholder="Escribe aquí…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="wr-entry-submit-row">
            <button className="sp-btn sp-btn-primary wr-entry-submit" disabled={busy || !text.trim()} onClick={check}>
              <Icon name="check" size={16} /> {busy ? "Checking…" : "Get feedback"}
            </button>
          </div>
          {error && <p className="gr-fix" style={{ color: "var(--negative)" }}>{error}</p>}
          {fb && <WritingFeedbackPanel fb={fb} />}

          {fb && allMet && fb.score >= 70 && (
            <div className="fc-done">
              <div className="fc-done-badge"><Icon name="check" size={18} /></div>
              <div className="fc-done-txt">
                <b>Entry complete</b>
                <span>You hit every goal for this entry.</span>
              </div>
              <button className="sp-btn sp-btn-soft" onClick={onExit}>New entry</button>
            </div>
          )}
        </div>

        <GoalsPanel objectives={entry.objectives} met={met} grammar={entry.grammar} />
      </div>
    </div>
  );
}
