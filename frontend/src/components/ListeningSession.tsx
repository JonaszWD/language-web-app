"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listeningApi, ttsApi, vocabApi } from "@/lib/api";
import type { ListeningCheckpointData, ListeningItemData, ListeningSentence } from "@/types";

/* ─────────────────────────────────────────────────────────────────────────
   Checkpointed narrative listening — the primary Listening-tab mechanic.
   Full-screen text-message chat between the story's two characters: each
   sentence lands as a bubble on its speaker's side (first speaker left,
   second right — narrator lines render as centered system captions instead
   of a bubble), and the words type themselves into the bubble in step with
   the TTS audio, like a live caption, rather than popping in once playback
   ends. Comprehension checkpoints dock at the bottom of the thread —
   answering (right or wrong) is what lets the chat continue; correctness is
   never what gates it (pacing stays conversational, not a gated quiz).

     predict           — docks BEFORE its sentence arrives; answer, then the
                          bubble types out and reveals whether the guess held.
     comprehension /
     inference /
     vocab_in_context /
     delayed_recall     — docks AFTER the sentence(s) they concern.

   No millisecond timeline exists (or is needed) — each sentence is its own
   TTS clip. The caption reveal is paced to that clip's real (loaded) audio
   duration — text and voice finish together — and is force-completed the
   instant the clip actually ends, as a safety net against any drift. Every
   clip is synthesized once on the backend (disk-cached by text hash, see
   services/tts.py) and prewarmed in bulk the moment a story loads, so
   opening the same story again — or replaying a line — never re-hits the
   LLM/TTS provider. Used unscoped by the standalone Listening tab and scoped
   (scenarioTag = a mission id) by that mission's Listening step — one
   engine, two entry points; scenarioTag is threaded through to the item
   fetch only.
   ──────────────────────────────────────────────────────────────────────── */

// ── Sentence-level TTS playback, mirroring ListeningLesson's speakLines/getAudio
// (same cache-by-text backend endpoint, same browser-voice fallback) — copied
// rather than imported since those helpers are module-private there. ──
const _audioCache = new Map<string, HTMLAudioElement>();
let _current: HTMLAudioElement | null = null;
let _playToken = 0;

function stopAudio(): void {
  _playToken++;
  if (_current) { _current.pause(); _current = null; }
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

function getAudio(text: string, cefrLevel?: string): Promise<HTMLAudioElement> {
  const cached = _audioCache.get(text);
  if (cached) return Promise.resolve(cached);
  const qs = new URLSearchParams({ text });
  if (cefrLevel) qs.set("cefr_level", cefrLevel);
  return fetch(`/api/tts/speak?${qs.toString()}`)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((blob) => {
      const audio = new Audio(URL.createObjectURL(blob));
      _audioCache.set(text, audio);
      return audio;
    });
}

function speakBrowser(text: string, onDone?: () => void): void {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) { onDone?.(); return; }
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.onend = () => onDone?.();
  u.onerror = () => onDone?.();
  synth.speak(u);
}

function speakOne(text: string, onDone?: () => void, cefrLevel?: string): void {
  if (!text.trim()) { onDone?.(); return; }
  stopAudio();
  const token = _playToken;
  getAudio(text, cefrLevel)
    .then((audio) => {
      if (token !== _playToken) return;
      _current = audio;
      audio.currentTime = 0;
      audio.onended = () => { if (token === _playToken) onDone?.(); };
      audio.play().catch(() => speakBrowser(text, onDone));
    })
    .catch(() => speakBrowser(text, onDone));
}

// Resolves the clip's real duration (seconds) — already available
// synchronously once an element has loaded before (cache hit), otherwise
// waits for the browser to read the audio's header. A short timeout guards
// against a browser that never fires the event, since this only feeds a
// pacing estimate, not something worth hanging playback over.
function getAudioDuration(audio: HTMLAudioElement): Promise<number> {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return Promise.resolve(audio.duration);
  return new Promise((resolve) => {
    const done = () => { audio.removeEventListener("loadedmetadata", done); resolve(Number.isFinite(audio.duration) ? audio.duration : 0); };
    audio.addEventListener("loadedmetadata", done);
    setTimeout(done, 2500);
  });
}

// A rough chars/sec fallback for when no real duration is available (backend
// TTS unreachable, browser-voice fallback) — same estimate speakBrowser's
// own safety timeout elsewhere in the app already assumes for Spanish speech.
function estimateMs(text: string): number {
  return Math.max(900, text.length * 70);
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function isNarrator(speaker: string): boolean {
  const s = speaker.trim().toLowerCase();
  return !s || s.startsWith("narrad") || s.startsWith("narrat");
}

// Bottom-dock state: idle (auto-advancing/playing, nothing to answer) or a
// checkpoint blocking further messages until answered. "before" docks ahead
// of its target sentence (predict); "after" docks once that sentence's
// bubble has already landed in the thread.
type Dock =
  | { kind: "idle" }
  | { kind: "checkpoint"; checkpoint: ListeningCheckpointData; position: "before" | "after" };

export default function ListeningSession({
  itemId,
  scenarioTag,
  onExit,
  onDone,
  backLabel = "Stories",
  hideBack = false,
}: {
  itemId: string;
  scenarioTag?: string;
  onExit: () => void;
  onDone?: () => void;
  backLabel?: string;
  /** Set when a caller already renders its own persistent back button (e.g. the mission hub). */
  hideBack?: boolean;
}) {
  const [item, setItem] = useState<ListeningItemData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ListeningSentence[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [dock, setDock] = useState<Dock>({ kind: "idle" });
  const [done, setDone] = useState(false);
  const [popover, setPopover] = useState<{ word: string; en: string | null; sentenceId: number } | null>(null);
  const [scoreDisplay, setScoreDisplay] = useState({ correct: 0, total: 0 });
  // Transcript text is blurred by default (listening-first practice) — tapping
  // the eye button on a bubble reveals that sentence's text permanently.
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  // How much support the learner needed — sent to /listening/items/{id}/complete
  // alongside the score, for the Home tab's Data section.
  const replaysUsedRef = useRef(0);
  const transcriptRevealsRef = useRef(0);
  const toggleReveal = (id: number) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); transcriptRevealsRef.current += 1; }
      return next;
    });
  };
  // Mirrors scoreDisplay but read synchronously mid-handler (finish() needs
  // the true total before React would flush a state update).
  const scoredRef = useRef({ correct: 0, total: 0 });
  const threadRef = useRef<HTMLDivElement>(null);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Long-form stories play one continuous, pre-synthesized two-voice audio
  // file (see services.story_audio) instead of per-sentence clips — this ref
  // holds that single <audio> element for the whole session.
  const longFormAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void listeningApi
      .get(itemId)
      .then((data) => {
        setItem(data);
        if (data.long_form) {
          // Kicks off (idempotent) background generation of the story's one
          // combined audio file so it's ready by the time playback needs it.
          void listeningApi.prewarmAudio(itemId).catch(() => {});
        } else {
          // Synthesize every line on the backend up front (disk-cached by text
          // hash — see services/tts.py) so playback never waits on the LLM/TTS
          // provider, whether this is the first open or a replay. Best-effort:
          // a failure here just means the first getAudio() call synthesizes on
          // demand instead, same as before this existed.
          void ttsApi.prewarm(data.sentences.map((s) => s.text_es), data.cefr_level).catch(() => {});
        }
      })
      .catch(() => setLoadError(true));
    return () => {
      stopAudio();
      if (revealTimer.current) clearInterval(revealTimer.current);
      longFormAudioRef.current?.pause();
    };
  }, [itemId]);

  // Each sentence's estimated share of the long-form audio's total duration,
  // weighted by its character length (no per-sentence timestamps come back
  // from ElevenLabs' dialogue endpoint — see services.story_audio) — good
  // enough to pace captions against the one real, continuous clip.
  const sentenceCharWeights = useMemo(() => {
    if (!item) return [] as number[];
    const lens = item.sentences.map((s) => Math.max(1, s.text_es.length));
    const total = lens.reduce((a, b) => a + b, 0) || 1;
    return lens.map((l) => l / total);
  }, [item]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, dock]);

  const bySentence = useMemo(() => {
    const m = new Map<number, ListeningCheckpointData[]>();
    if (!item) return m;
    for (const c of item.checkpoints) {
      const arr = m.get(c.after_sentence_id) ?? [];
      arr.push(c);
      m.set(c.after_sentence_id, arr);
    }
    return m;
  }, [item]);

  const predictBefore = (idx: number): ListeningCheckpointData | null => {
    for (const c of bySentence.get(idx - 1) ?? []) {
      if (c.type === "predict") return c;
    }
    return null;
  };
  const afterSentence = (idx: number): ListeningCheckpointData[] =>
    (bySentence.get(idx) ?? []).filter((c) => c.type !== "predict");

  const finish = () => {
    longFormAudioRef.current?.pause();
    const s = scoredRef.current;
    const score = s.total ? s.correct / s.total : 1;
    void listeningApi.complete(itemId, score, s.correct, s.total, {
      replaysUsed: replaysUsedRef.current,
      transcriptReveals: transcriptRevealsRef.current,
    }).catch(() => {});
    setDone(true);
    setDock({ kind: "idle" });
  };

  // Pending after-checkpoints for the sentence just delivered, drained one at
  // a time before the thread is allowed to move on.
  const pendingAfter = useRef<ListeningCheckpointData[]>([]);

  const clearReveal = () => {
    if (revealTimer.current) { clearInterval(revealTimer.current); revealTimer.current = null; }
  };

  const setLastMessageText = (text: string) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], text_es: text };
      return copy;
    });
  };

  // Paced so the last character lands right as `totalMs` (the clip's real
  // audio duration) elapses — text and voice finish together.
  const startReveal = (fullText: string, totalMs: number) => {
    clearReveal();
    setRevealing(true);
    let shown = 0;
    const perCharMs = Math.max(12, totalMs / Math.max(1, fullText.length));
    revealTimer.current = setInterval(() => {
      shown = Math.min(fullText.length, shown + 1);
      setLastMessageText(fullText.slice(0, shown));
      if (shown >= fullText.length) { clearReveal(); setRevealing(false); }
    }, perCharMs);
  };

  const finishReveal = (fullText: string) => {
    clearReveal();
    setRevealing(false);
    setLastMessageText(fullText);
  };

  // For long-form items, the whole story is already playing continuously on
  // longFormAudioRef (started once in start()) — this just paces the current
  // sentence's caption reveal to its estimated share (sentenceCharWeights) of
  // that clip's real total duration, no separate per-sentence fetch/play.
  const playCaptionedLongForm = (text: string, idx: number, onDone: () => void) => {
    const audio = longFormAudioRef.current;
    const weight = sentenceCharWeights[idx] ?? 1 / Math.max(1, item?.sentences.length ?? 1);
    const totalMs = audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : estimateMs(text) / weight;
    const sentenceMs = Math.max(400, totalMs * weight);
    const token = _playToken;
    startReveal(text, sentenceMs);
    window.setTimeout(() => {
      if (token !== _playToken) return;
      finishReveal(text);
      onDone();
    }, sentenceMs);
  };

  // Plays one sentence's clip and paces the live-caption reveal to its real
  // duration (falling back to a fixed estimate if the backend clip or its
  // duration is unavailable) — text and voice finish together, and
  // finishReveal() force-completes on the actual audio end as a safety net
  // against any drift between the two.
  const playCaptioned = (text: string, idx: number, onDone: () => void) => {
    if (!text.trim()) { onDone(); return; }
    if (item?.long_form) { playCaptionedLongForm(text, idx, onDone); return; }
    stopAudio();
    const token = _playToken;
    const fallback = () => {
      startReveal(text, estimateMs(text));
      speakBrowser(text, () => { if (token === _playToken) { finishReveal(text); onDone(); } });
    };
    getAudio(text, item?.cefr_level)
      .then((audio) => {
        if (token !== _playToken) return;
        _current = audio;
        audio.currentTime = 0;
        void getAudioDuration(audio).then((durationSec) => {
          if (token !== _playToken) return;
          startReveal(text, durationSec > 0 ? durationSec * 1000 : estimateMs(text));
          audio.onended = () => { if (token === _playToken) { finishReveal(text); onDone(); } };
          audio.play().catch(fallback);
        });
      })
      .catch(fallback);
  };

  const advance = (idx: number) => {
    if (!item) return;
    if (idx >= item.sentences.length) { finish(); return; }
    const predict = predictBefore(idx);
    if (predict) { setDock({ kind: "checkpoint", checkpoint: predict, position: "before" }); return; }
    deliver(idx);
  };

  const deliver = (idx: number) => {
    if (!item) return;
    const sentence = item.sentences[idx];
    setMessages((prev) => [...prev, { ...sentence, text_es: "" }]);
    playCaptioned(sentence.text_es, idx, () => {
      pendingAfter.current = afterSentence(idx);
      drainAfter(idx);
    });
  };

  const drainAfter = (idx: number) => {
    const next = pendingAfter.current[0];
    if (next) {
      setDock({ kind: "checkpoint", checkpoint: next, position: "after" });
      return;
    }
    setDock({ kind: "idle" });
    window.setTimeout(() => advance(idx + 1), 350);
  };

  const start = () => {
    if (!item || started) return;
    setStarted(true);
    if (item.long_form) {
      const audio = new Audio(listeningApi.audioUrl(itemId));
      longFormAudioRef.current = audio;
      const begin = () => { void audio.play().catch(() => {}); advance(0); };
      if (Number.isFinite(audio.duration) && audio.duration > 0) begin();
      else audio.addEventListener("loadedmetadata", begin, { once: true });
      return;
    }
    advance(0);
  };

  const onCheckpointAnswered = (checkpoint: ListeningCheckpointData, answer: string, correct: boolean, sentenceIdx: number) => {
    scoredRef.current.total += 1;
    if (correct) scoredRef.current.correct += 1;
    setScoreDisplay({ ...scoredRef.current });
    void listeningApi.checkpointResult(itemId, checkpoint.id, answer, correct).catch(() => {});

    if (dock.kind === "checkpoint" && dock.position === "before") {
      deliver(sentenceIdx);
    } else {
      pendingAfter.current = pendingAfter.current.slice(1);
      drainAfter(sentenceIdx);
    }
  };

  const replayMissed = (sentenceIdx: number) => {
    if (!item) return;
    const from = Math.max(0, sentenceIdx - 1);
    const text = item.sentences.slice(from, sentenceIdx + 1).map((s) => s.text_es).join(" ");
    replaysUsedRef.current += 1;
    speakOne(text, undefined, item.cefr_level);
  };

  const onWordClick = (word: string, sentenceEn: string, sentenceId: number) => {
    const clean = word.replace(/[¿?¡!.,;:"'()…]/g, "");
    if (!clean) return;
    setPopover({ word: clean, en: null, sentenceId });
    void vocabApi
      .translate(clean, sentenceEn)
      .then((r) => setPopover({ word: clean, en: r.english, sentenceId }))
      .catch(() => setPopover({ word: clean, en: null, sentenceId }));
  };

  // First speaker to appear in the story sits left, the second sits right —
  // stable for the whole story, derived once from its full sentence list
  // (not built up incrementally as bubbles arrive, so it never reshuffles).
  const speakerSideMap = useMemo(() => {
    const map = new Map<string, "left" | "right">();
    if (!item) return map;
    for (const s of item.sentences) {
      if (isNarrator(s.speaker) || map.has(s.speaker)) continue;
      map.set(s.speaker, map.size % 2 === 0 ? "left" : "right");
    }
    return map;
  }, [item]);
  const sideFor = (speaker: string): "left" | "right" => speakerSideMap.get(speaker) ?? "left";

  const renderWords = (text: string, en: string, sentenceId: number) =>
    text.split(/(\s+)/).map((tok, ti) =>
      tok.trim() ? (
        <span key={ti} className="ls-word" onClick={() => onWordClick(tok, en, sentenceId)}>{tok}</span>
      ) : (
        <span key={ti}>{tok}</span>
      )
    );

  if (loadError) {
    return (
      <div className="ls-fullscreen">
        <div className="ls-fs-header">
          {!hideBack && <button className="vt-back" onClick={onExit}><ChevronIcon /> {backLabel}</button>}
        </div>
        <p className="sp-sub">Couldn&apos;t load this story. Try again later.</p>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="ls-fullscreen">
        <div className="ls-fs-header">
          {!hideBack && <button className="vt-back" onClick={onExit}><ChevronIcon /> {backLabel}</button>}
        </div>
        <p className="sp-sub">Loading story…</p>
      </div>
    );
  }

  // The sentence a currently-docked checkpoint concerns — "before" is the one
  // about to be delivered, "after" is the one that just landed.
  const dockSentenceIdx = dock.kind === "checkpoint"
    ? (dock.position === "before" ? messages.length : messages.length - 1)
    : -1;

  return (
    <div className="ls-fullscreen">
      <div className="ls-fs-header">
        {!hideBack && <button className="vt-back" onClick={onExit}><ChevronIcon /> {backLabel}</button>}
        {!hideBack && <span className="vt-level">{item.title} · {item.cefr_level}</span>}
      </div>

      {!started ? (
        <div className="ls-fs-start">
          <p className="sp-eyebrow" style={{ marginBottom: 8 }}>Listen for the story</p>
          <p className="vt-es" style={{ marginBottom: 14 }}>{item.title}</p>
          <p className="sp-sub" style={{ marginBottom: 14 }}>
            {item.long_form
              ? "A long, uninterrupted conversation between two people — no questions along the way. Five questions wait for you at the end."
              : "It plays out like a real conversation between two people — a few questions pop up along the way. Answer to keep it going; they're here to help, not to trip you up."}
          </p>
          <button className="sp-btn sp-btn-primary" onClick={start}>Start listening</button>
        </div>
      ) : (
        <div className="ls-fs-body fc-layout">
        <div className="fc-main">
          <div className="ls-msg-thread" ref={threadRef}>
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const isRevealed = revealedIds.has(m.sentence_id);
              if (isNarrator(m.speaker)) {
                return (
                  <div className="ls-narration ls-transcript-wrap" key={m.sentence_id}>
                    <span className={isRevealed ? "" : "ls-transcript-blur"}>
                      {renderWords(m.text_es, m.text_en, m.sentence_id)}
                      {isLast && revealing && <span className="ls-cursor" />}
                    </span>
                    {!isRevealed && (
                      <button type="button" className="ls-reveal-btn" onClick={() => toggleReveal(m.sentence_id)}>
                        <EyeIcon /> Show
                      </button>
                    )}
                  </div>
                );
              }
              const side = sideFor(m.speaker);
              return (
                <div className={"ls-msg-row " + side + " ls-transcript-wrap"} key={m.sentence_id}>
                  <span className="ls-msg-who">{m.speaker}</span>
                  <span className="ls-msg-bubble">
                    <span className={isRevealed ? "" : "ls-transcript-blur"}>
                      {renderWords(m.text_es, m.text_en, m.sentence_id)}
                      {isLast && revealing && <span className="ls-cursor" />}
                    </span>
                    {!isRevealed && (
                      <button type="button" className="ls-reveal-btn" onClick={() => toggleReveal(m.sentence_id)}>
                        <EyeIcon /> Show
                      </button>
                    )}
                    {popover && popover.sentenceId === m.sentence_id && (
                      <span className="ls-popover"><b>{popover.word}</b> — {popover.en ?? "…"}</span>
                    )}
                  </span>
                </div>
              );
            })}
            {done && (
              <div className="ls-summary-inline">
                <p className="sp-h2" style={{ marginBottom: 6 }}>Story complete</p>
                <p className="sp-sub" style={{ marginBottom: 14 }}>
                  {scoreDisplay.total
                    ? `${scoreDisplay.correct} of ${scoreDisplay.total} checkpoints correct.`
                    : "No checkpoints in this story."}
                </p>
                <button className="sp-btn sp-btn-primary" onClick={onDone ?? onExit}>Done</button>
              </div>
            )}
          </div>

          {dock.kind === "checkpoint" && (
            <ChatCheckpoint
              key={dock.checkpoint.id}
              checkpoint={dock.checkpoint}
              position={dock.position}
              onAnswered={(answer, correct) => onCheckpointAnswered(dock.checkpoint, answer, correct, dockSentenceIdx)}
              onMissedReplay={() => replayMissed(dockSentenceIdx)}
            />
          )}
        </div>

        <StoryInfoPanel item={item} messagesShown={messages.length} score={scoreDisplay} />
        </div>
      )}
    </div>
  );
}

// Side panel — same slot FreeChat's GoalsPanel fills: the conversation stays
// the main focus, this is reference material alongside it, not another task.
// Vocabulary reused in the story so the learner can see what's fair game
// while they listen, plus a running checkpoint tally.
function StoryInfoPanel({
  item,
  messagesShown,
  score,
}: {
  item: ListeningItemData;
  messagesShown: number;
  score: { correct: number; total: number };
}) {
  return (
    <aside className="fc-goals sp-card">
      <p className="sp-eyebrow" style={{ marginBottom: 8 }}>
        Story progress <span className="fc-goal-count">{messagesShown}/{item.sentences.length}</span>
      </p>
      {score.total > 0 && (
        <p className="sp-sub" style={{ marginBottom: 12 }}>
          {score.correct}/{score.total} checkpoints correct so far.
        </p>
      )}
      {item.vocab_reused.length > 0 && (
        <>
          <p className="sp-eyebrow" style={{ margin: "10px 0 8px" }}>Words in this story</p>
          <div className="fc-word-chips">
            {item.vocab_reused.map((w) => (
              <span key={w} className="fc-word-chip">{w}</span>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

function ChatCheckpoint({
  checkpoint,
  position,
  onAnswered,
  onMissedReplay,
}: {
  checkpoint: ListeningCheckpointData;
  position: "before" | "after";
  onAnswered: (answer: string, correct: boolean) => void;
  onMissedReplay: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const options = checkpoint.options;
  const freeText = !options || options.length === 0;

  const correct = freeText
    ? typed.trim().toLowerCase() === checkpoint.correct_answer.trim().toLowerCase()
    : picked !== null && options![picked] === checkpoint.correct_answer;
  const answerText = freeText ? typed : (picked !== null ? options![picked] : "");

  const submitChoice = (i: number) => { setPicked(i); setSubmitted(true); };
  const submitTyped = () => { if (typed.trim()) setSubmitted(true); };

  return (
    <div className="ls-dock">
      <p className="ls-dock-label">{position === "before" ? "Before you hear it…" : "Quick check"}</p>
      <p className="vt-prompt" style={{ marginBottom: 10 }}>{checkpoint.prompt}</p>

      {!submitted && !freeText && (
        <div className="gl-options">
          {options!.map((opt, i) => (
            <button key={i} type="button" className="gl-option" onClick={() => submitChoice(i)}>{opt}</button>
          ))}
        </div>
      )}
      {!submitted && freeText && (
        <form onSubmit={(e) => { e.preventDefault(); submitTyped(); }} className="ls-dock-form">
          <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your answer…" className="gr-input" />
          <button type="submit" className="sp-btn sp-btn-primary" disabled={!typed.trim()}>Send</button>
        </form>
      )}
      {submitted && (
        <div className="ls-dock-result">
          <p className="sp-h2" style={{ marginBottom: 6 }}>
            {position === "before"
              ? (correct ? "You predicted it!" : "Let's see…")
              : (correct ? "Got it." : "Not quite.")}
          </p>
          {!correct && (
            <p className="sp-sub" style={{ marginBottom: 8 }}>
              {position === "before" ? "You actually heard: " : "The answer was: "}
              <b style={{ color: "var(--ink)" }}>{checkpoint.correct_answer}</b>
            </p>
          )}
          <div className="ls-dock-actions">
            {!correct && position === "after" && (
              <button type="button" className="sp-btn sp-btn-soft" onClick={onMissedReplay}>Play what you missed</button>
            )}
            <button type="button" className="sp-btn sp-btn-primary" onClick={() => onAnswered(answerText, correct)}>
              {position === "before" ? "Listen and continue" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
