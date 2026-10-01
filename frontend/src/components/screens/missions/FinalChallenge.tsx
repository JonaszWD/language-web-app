"use client";

import { useEffect, useRef, useState } from "react";
import { missionsApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import { speakEs } from "@/lib/speak";
import type { Mission } from "./missionData";
import type { SpeakingScene } from "@/types";

/* ════════════════════════ FINAL CHALLENGE ════════════════════════
   The mission finale: one continuous, unscaffolded real-world conversation.
   Cold open (NPC speaks first, no test framing), free text input, native-speed
   in-character replies. Meaning over form — the backend LLM judges intent and
   repairs misunderstandings IN ROLE rather than failing the learner. The scene
   ends only when the interaction genuinely completes (done=true). */
type FcTurn = { who: "npc" | "learner"; es: string; en?: string; correction?: string };

function FinalChallenge({ mission, onExit }: { mission: Mission; onExit: () => void }) {
  const [scene, setScene] = useState<SpeakingScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<FcTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Cold open: fetch the scene, drop the learner straight into the NPC's first
  // line — no "Final Challenge: order a coffee" setup screen. Speak it aloud so
  // it feels like walking into the café, not reading a quiz.
  useEffect(() => {
    let alive = true;
    missionsApi
      .speakingScene(mission.id)
      .then((s) => {
        if (!alive) return;
        setScene(s);
        setTurns([{ who: "npc", es: s.opening, en: s.opening_en }]);
        speakEs(s.opening);
      })
      .catch(() => { if (alive) setError("Could not start the challenge. Try again in a moment."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mission.id]);

  // Keep the newest line in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const send = async () => {
    const utterance = input.trim();
    if (!utterance || busy || !scene || done) return;
    // History the backend sees is everything BEFORE this utterance.
    const history = turns.map((t) => ({ speaker: t.who, text: t.es }));
    setTurns((t) => [...t, { who: "learner", es: utterance }]);
    setInput("");
    setBusy(true);
    try {
      const r = await missionsApi.speakingTurn(mission.id, {
        role: scene.role,
        setting: scene.setting,
        goal: scene.goal,
        history,
        utterance,
      });
      setTurns((t) => {
        const next = [...t];
        // Attach any gentle correction to the learner's line we just added.
        if (r.correction) {
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].who === "learner") { next[i] = { ...next[i], correction: r.correction }; break; }
          }
        }
        next.push({ who: "npc", es: r.npc_reply, en: r.npc_reply_en });
        return next;
      });
      speakEs(r.npc_reply);
      if (r.done) {
        setDone(true);
        // The interaction succeeded — record the mission as completed. Fire-and-
        // forget: a failed write must not block the celebratory finish.
        void missionsApi.complete(mission.id).catch(() => {});
      }
    } catch {
      // Stay in-scene on failure rather than throwing a test-style error.
      setTurns((t) => [...t, { who: "npc", es: "Perdone, no le oí bien. ¿Puede repetir?", en: "Sorry, I didn't catch that. Can you repeat?" }]);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ width: "100%", display: "grid", placeItems: "center", paddingTop: 60 }}>
        <div className="mi-prep-spinner" aria-hidden />
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ width: "100%", display: "grid", placeItems: "center", paddingTop: 40 }}>
        <div className="sp-card gr-stage-card" style={{ textAlign: "center", maxWidth: 460 }}>
          <p className="sp-sub" style={{ marginBottom: 18 }}>{error}</p>
          <button className="sp-btn sp-btn-primary" onClick={onExit}>Back to missions</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-wrap">
      <div className="fc-head">
        <span className="sp-tag pink"><Icon name="spark" size={15} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Final Challenge</span>
        {scene && <span className="fc-scene">{scene.setting}</span>}
      </div>

      <div className="fc-thread" ref={scrollRef}>
        {turns.map((t, i) => (
          <div key={i} className={"fc-turn " + t.who}>
            <div className="fc-bubble">
              <span className="fc-es">{t.es}</span>
              {t.who === "npc" && (
                <span className="fc-tools">
                  <button className="fc-icon" title="Hear it again" onClick={() => speakEs(t.es)}><Icon name="speaker" size={14} /></button>
                  <FcReveal en={t.en} />
                </span>
              )}
            </div>
            {t.correction && (
              <div className="fc-correction" title="A more natural way to say it">
                <Icon name="spark" size={12} /> {t.correction}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="fc-turn npc">
            <div className="fc-bubble fc-typing"><i /><i /><i /></div>
          </div>
        )}
      </div>

      {done ? (
        <div className="fc-done">
          <div className="fc-done-badge"><Icon name="check" size={22} /></div>
          <div className="fc-done-txt">
            <b>Mission complete</b>
            <span>You handled the whole conversation in Spanish.</span>
          </div>
          <button className="sp-btn sp-btn-primary" style={{ minHeight: 46 }} onClick={onExit}>
            Back to missions <Icon name="chevron" size={16} />
          </button>
        </div>
      ) : (
        <div className="fc-inputbar">
          <input
            className="fc-input"
            value={input}
            placeholder="Responde en español…"
            autoFocus
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          <button className="fc-send sp-btn sp-btn-primary" disabled={busy || !input.trim()} onClick={send} title="Send">
            <Icon name="chevron" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// English is hidden by default (immersion first). The learner can uncover it for
// one line if they're stuck — a repair aid, not an always-on translation.
function FcReveal({ en }: { en?: string }) {
  const [open, setOpen] = useState(false);
  if (!en) return null;
  return open ? (
    <span className="fc-en">{en}</span>
  ) : (
    <button className="fc-icon" title="What did that mean?" onClick={() => setOpen(true)}>?</button>
  );
}

export default FinalChallenge;
export { FcReveal };
