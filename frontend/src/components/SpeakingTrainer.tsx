"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MissionSpeaking,
  SpeakingStage,
  SpeakingTurnResult,
} from "@/types";
import { missionsApi } from "@/lib/api";

/* ── Speech helpers ─────────────────────────────────────────────────────── */

// Pronounce a Spanish line via the browser SpeechSynthesis API (no backend).
function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.9;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith("es"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

// Minimal wrapper over the Web Speech API SpeechRecognition (Chrome/Edge/Safari).
// Falls back to `supported: false` so the caller can show a text box instead.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function useSpeechInput() {
  const Ctor = useMemo(() => getRecognitionCtor(), []);
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  // Browser ASR's own confidence (0-1) for the last result chunk — a rough,
  // free proxy for pronunciation clarity (no phonetic scoring exists in the
  // stack). Not all browsers report it; null when absent.
  const [confidence, setConfidence] = useState<number | null>(null);
  const recRef = useRef<Recognition | null>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    window.speechSynthesis?.cancel();
    const rec = new Ctor();
    rec.lang = "es-ES";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setTranscript(t);
      const last = e.results[e.results.length - 1]?.[0]?.confidence;
      if (typeof last === "number" && !Number.isNaN(last)) setConfidence(last);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setTranscript("");
    setConfidence(null);
    setListening(true);
    rec.start();
  }, [Ctor]);

  const reset = useCallback(() => { setTranscript(""); setConfidence(null); }, []);

  return { supported, listening, transcript, confidence, start, stop, reset, setTranscript };
}

/* ── Fuzzy matching for the guided (deterministic) stages ───────────────── */

// Accent/case/punctuation-insensitive normaliser, mirroring the backend's
// forgiving comparison used elsewhere in the trainer.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Token-overlap ratio of `said` against `target` (0..1). Repetition/recall are
// graded loosely so a dropped article or accent still passes.
function overlap(said: string, target: string): number {
  const a = norm(said).split(" ").filter(Boolean);
  const b = norm(target).split(" ").filter(Boolean);
  if (!b.length) return 0;
  const bag = new Map<string, number>();
  b.forEach((w) => bag.set(w, (bag.get(w) ?? 0) + 1));
  let hit = 0;
  a.forEach((w) => {
    const n = bag.get(w) ?? 0;
    if (n > 0) { hit++; bag.set(w, n - 1); }
  });
  return hit / b.length;
}

const PASS = 0.6;

/* ── Shared bits ────────────────────────────────────────────────────────── */

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0h-2a4 4 0 0 1-8 0H6Z" />
      <rect x="11" y="18" width="2" height="3" /><rect x="8" y="21" width="8" height="1.6" rx="0.8" />
    </svg>
  );
}

function StageDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="spk-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={"spk-dot" + (i < current ? " done" : i === current ? " on" : "")} />
      ))}
    </div>
  );
}

// The waiter/NPC line, auto-spoken on mount, with a replay button.
function NpcLine({ es, en, autoplay = true }: { es: string; en?: string; autoplay?: boolean }) {
  useEffect(() => {
    if (autoplay && es) speak(es);
  }, [es, autoplay]);
  if (!es) return null;
  return (
    <div className="spk-npc">
      <button type="button" className="spk-replay" onClick={() => speak(es)} aria-label="Replay">▶</button>
      <div>
        <div className="spk-npc-es">{es}</div>
        {en && <div className="spk-npc-en">{en}</div>}
      </div>
    </div>
  );
}

// Mic + typed-fallback input row. Reports the captured/typed utterance up.
function SpeakInput({
  onSubmit, disabled, placeholder = "Say it…",
}: {
  onSubmit: (text: string, confidence?: number | null) => void; disabled?: boolean; placeholder?: string;
}) {
  const { supported, listening, transcript, confidence, start, stop, reset, setTranscript } = useSpeechInput();
  const [typed, setTyped] = useState("");
  const value = supported ? transcript : typed;

  const send = () => {
    const t = (supported ? transcript : typed).trim();
    if (!t) return;
    onSubmit(t, supported ? confidence : null);
    reset(); setTyped("");
  };

  return (
    <div className="spk-input">
      {supported ? (
        <>
          <button
            type="button"
            className={"spk-mic" + (listening ? " live" : "")}
            onClick={listening ? stop : start}
            disabled={disabled}
            aria-label={listening ? "Stop" : "Speak"}
          >
            {listening ? "◼" : <MicIcon />}
          </button>
          <input
            className="spk-heard"
            value={value}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={listening ? "Listening…" : placeholder}
          />
        </>
      ) : (
        <input
          className="spk-heard"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
      )}
      <button type="button" className="sp-btn sp-btn-primary" onClick={send} disabled={disabled || !value.trim()}>
        Check
      </button>
    </div>
  );
}

/* ── Deterministic stages (1-4) ─────────────────────────────────────────── */

// Repeat (1) and Prompt (4) share the "say the target, grade by overlap" flow.
// Repeat shows the full sentence as a crutch; Prompt shows only a cue + first
// word on request.
function SayTargetStage({ stage, onPass }: { stage: SpeakingStage; onPass: () => void }) {
  const [heard, setHeard] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(stage.type === "repeat");
  const isPrompt = stage.type === "prompt";
  // Prompt stages accept ANY correct phrasing (communicate, not recite): grade
  // against every valid answer, pass if the learner matches any one.
  const accepted = stage.valid && stage.valid.length ? stage.valid : [stage.target];

  const check = (text: string) => {
    setHeard(text);
    const threshold = isPrompt ? PASS + 0.05 : PASS;
    const pass = accepted.some((a) => overlap(text, a) >= threshold);
    setOk(pass);
    if (!pass && isPrompt) setShowHint(true);
  };

  // For an open prompt, the hint is a set of example answers (not one sentence),
  // so the learner sees the meaning has several valid ways to be said.
  const hintText = isPrompt && accepted.length > 1
    ? `e.g. ${accepted.slice(0, 3).join("  ·  ")}`
    : stage.hint;

  return (
    <div className="spk-stage">
      {stage.npc && <NpcLine es={stage.npc} en={stage.npc_en} />}
      {isPrompt ? (
        <div className="spk-cue">{stage.cue_en}</div>
      ) : (
        <p className="spk-instr">{stage.instruction}</p>
      )}
      {showHint && hintText && <div className="spk-hint">{hintText}</div>}
      {isPrompt && !showHint && (
        <button type="button" className="sp-btn sp-btn-soft spk-hintbtn" onClick={() => setShowHint(true)}>
          Need a hint?
        </button>
      )}
      <SpeakInput onSubmit={check} />
      {heard && (
        <div className={"spk-result " + (ok ? "good" : "bad")}>
          <div className="spk-heard-back">“{heard}”</div>
          {ok ? (
            <>
              <div className="spk-verdict">¡Bien! Nailed it.</div>
              <button className="sp-btn sp-btn-primary" onClick={onPass}>Continue</button>
            </>
          ) : (
            <div className="spk-verdict">Not quite — try saying: <b>{stage.target}</b></div>
          )}
        </div>
      )}
    </div>
  );
}

// Choice (2): pick a correct phrase, then say it aloud.
function ChoiceStage({ stage, onPass }: { stage: SpeakingStage; onPass: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [said, setSaid] = useState(false);

  const chosen = picked != null ? stage.options[picked] : null;

  return (
    <div className="spk-stage">
      <NpcLine es={stage.npc} en={stage.npc_en} />
      <p className="spk-instr">{stage.instruction || "Choose a correct phrase, then say it aloud."}</p>
      <div className="spk-choices">
        {stage.options.map((o, i) => {
          const state = picked === i ? (o.ok ? " good" : " bad") : "";
          return (
            <button
              key={i}
              type="button"
              className={"spk-choice" + state}
              onClick={() => { setPicked(i); setSaid(false); if (o.ok) speak(o.es); }}
            >
              {o.es}
            </button>
          );
        })}
      </div>
      {chosen && !chosen.ok && (
        <div className="spk-verdict bad">That one sounds off — pick another.</div>
      )}
      {chosen && chosen.ok && !said && (
        <>
          <p className="spk-instr">Now say it aloud:</p>
          <SpeakInput
            placeholder={chosen.es}
            onSubmit={(t) => { if (overlap(t, chosen.es) >= PASS) setSaid(true); }}
          />
        </>
      )}
      {said && (
        <div className="spk-result good">
          <div className="spk-verdict">¡Perfecto!</div>
          <button className="sp-btn sp-btn-primary" onClick={onPass}>Continue</button>
        </div>
      )}
    </div>
  );
}

// Fill (3): choose the missing words, assemble the sentence, then say it.
function FillStage({ stage, onPass }: { stage: SpeakingStage; onPass: () => void }) {
  // Track a chosen word per blank (by segment index).
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [said, setSaid] = useState(false);

  const blankIdxs = stage.segments.map((s, i) => (s.blank ? i : -1)).filter((i) => i >= 0);
  const allFilled = blankIdxs.every((i) => chosen[i] != null);
  const allCorrect = blankIdxs.every((i) => norm(chosen[i] ?? "") === norm(stage.segments[i].answer));

  const assembled = stage.segments
    .map((s, i) => (s.blank ? (chosen[i] ?? "___") : s.text))
    .join("");

  return (
    <div className="spk-stage">
      <NpcLine es={stage.npc} en={stage.npc_en} />
      <p className="spk-instr">{stage.instruction || "Complete the sentence, then say it aloud."}</p>
      <div className="spk-fill">
        {stage.segments.map((s, i) =>
          s.blank ? (
            <span key={i} className={"spk-blank" + (chosen[i] ? (norm(chosen[i]) === norm(s.answer) ? " good" : " bad") : "")}>
              {chosen[i] ?? "____"}
              <span className="spk-blank-opts">
                {s.options.map((o) => (
                  <button key={o} type="button" className="spk-opt" onClick={() => setChosen((c) => ({ ...c, [i]: o }))}>{o}</button>
                ))}
              </span>
            </span>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </div>
      {allFilled && allCorrect && !said && (
        <>
          <div className="spk-hint">{stage.target || assembled}</div>
          <p className="spk-instr">Now say the whole sentence:</p>
          <SpeakInput
            placeholder={stage.target}
            onSubmit={(t) => { if (overlap(t, stage.target || assembled) >= PASS) setSaid(true); }}
          />
        </>
      )}
      {allFilled && !allCorrect && (
        <div className="spk-verdict bad">Check the highlighted word.</div>
      )}
      {said && (
        <div className="spk-result good">
          <div className="spk-verdict">¡Muy bien!</div>
          <button className="sp-btn sp-btn-primary" onClick={onPass}>Continue</button>
        </div>
      )}
    </div>
  );
}

/* ── Free conversation stages (5-7) — LLM-driven ────────────────────────── */

type ChatLine = { speaker: "npc" | "learner"; text: string; en?: string; correction?: string };

function ConversationStage({
  stage, missionId, role, setting, onPass,
}: {
  stage: SpeakingStage; missionId: string; role: string; setting: string; onPass: () => void;
}) {
  const [history, setHistory] = useState<ChatLine[]>(
    stage.npc ? [{ speaker: "npc", text: stage.npc, en: stage.npc_en }] : [],
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const turns = history.filter((l) => l.speaker === "learner").length;
  const maxTurns = stage.max_turns || 6;

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [history]);
  // Speak the NPC's cold-open line once, so the scene feels like walking in.
  useEffect(() => { if (stage.npc) speak(stage.npc); }, [stage.npc]);

  const send = async (utterance: string, confidence?: number | null) => {
    if (busy || done) return;
    setBusy(true); setError("");
    const priorHistory = history.map((l) => ({ speaker: l.speaker, text: l.text }));
    setHistory((h) => [...h, { speaker: "learner", text: utterance }]);
    try {
      const res: SpeakingTurnResult = await missionsApi.speakingTurn(missionId, {
        role, setting, goal: stage.goal,
        history: priorHistory,
        utterance,
        confidence: confidence ?? undefined,
      });
      setHistory((h) => {
        const copy = [...h];
        // attach any correction to the learner line we just added
        const lastLearner = [...copy].reverse().find((l) => l.speaker === "learner");
        if (lastLearner && res.correction) lastLearner.correction = res.correction;
        copy.push({ speaker: "npc", text: res.npc_reply, en: res.npc_reply_en });
        return copy;
      });
      speak(res.npc_reply);
      if (res.done || turns + 1 >= maxTurns) setDone(true);
    } catch {
      setError("The conversation service is unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="spk-stage">
      <div className="spk-goal">Goal: {stage.goal}</div>
      <div className="spk-chat" ref={scroller}>
        {history.map((l, i) => (
          <div key={i} className={"spk-bubble " + l.speaker}>
            {l.speaker === "npc" && (
              <button type="button" className="spk-replay sm" onClick={() => speak(l.text)} aria-label="Replay">▶</button>
            )}
            <div>
              <div>{l.text}</div>
              {l.en && <div className="spk-npc-en">{l.en}</div>}
              {l.correction && <div className="spk-corr">Better: {l.correction}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="spk-bubble npc"><div className="spk-typing">…</div></div>}
      </div>
      {error && <div className="spk-verdict bad">{error}</div>}
      {done ? (
        <div className="spk-result good">
          <div className="spk-verdict">Scene complete. ¡Bien hecho!</div>
          <button className="sp-btn sp-btn-primary" onClick={onPass}>Continue</button>
        </div>
      ) : (
        <SpeakInput onSubmit={send} disabled={busy} placeholder="Respond in Spanish…" />
      )}
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────────────────── */

export default function SpeakingTrainer({
  speaking, missionId, onExit, onDone,
}: {
  speaking: MissionSpeaking; missionId: string; onExit: () => void;
  /** Called instead of onExit once every stage is genuinely complete. */
  onDone?: () => void;
}) {
  const stages = [...speaking.stages].sort((a, b) => a.n - b.n);
  const [idx, setIdx] = useState(0);
  const [complete, setComplete] = useState(false);
  const stage = stages[idx];

  const next = () => {
    if (idx + 1 >= stages.length) setComplete(true);
    else setIdx((i) => i + 1);
  };

  if (!stages.length) {
    return (
      <div className="spk-wrap">
        <button className="vt-back" onClick={onExit}>‹ Back</button>
        <div className="sp-card vt-card"><p className="sp-sub">Speaking practice isn’t ready for this mission yet.</p></div>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="spk-wrap">
        <div className="sp-card vt-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✦</div>
          <h2 className="sp-h2" style={{ marginBottom: 8 }}>Speaking complete</h2>
          <p className="sp-sub" style={{ marginBottom: 20 }}>
            You worked all the way from repeating a line to a free conversation with the {speaking.role_en}.
          </p>
          <button className="sp-btn sp-btn-primary" onClick={onDone ?? onExit}>Back to mission ›</button>
        </div>
      </div>
    );
  }

  return (
    <div className="spk-wrap">
      <div className="vt-topbar" style={{ width: "100%" }}>
        <button className="vt-back" onClick={onExit}>‹ Back</button>
        <span className="vt-level">Stage {stage.n} · {stage.title}</span>
      </div>
      <StageDots total={stages.length} current={idx} />
      <div className="spk-scene">You are talking to the {speaking.role_en} — {speaking.setting}.</div>

      {(stage.type === "repeat" || stage.type === "prompt") && <SayTargetStage stage={stage} onPass={next} />}
      {stage.type === "choice" && <ChoiceStage stage={stage} onPass={next} />}
      {stage.type === "fill" && <FillStage stage={stage} onPass={next} />}
      {(stage.type === "dynamic" || stage.type === "branch" || stage.type === "free") && (
        <ConversationStage
          stage={stage}
          missionId={missionId}
          role={speaking.role}
          setting={speaking.setting}
          onPass={next}
        />
      )}

      <button className="spk-skip" onClick={next}>Skip stage ›</button>
    </div>
  );
}
