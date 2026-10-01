"use client";

import { useEffect } from "react";
import SpeakButton from "@/components/SpeakButton";
import { clearMistakes } from "@/lib/missionMistakes";
import type { Mission } from "./missionData";

/* The mission's opening stage: a short scene-setting blurb + a handful of key
   phrases the learner is about to meet, before any drilling starts. Content
   is LLM-generated during mission enrichment (see backend
   services.missions._generate_context_preview) and cached on the mission —
   null here just means it hasn't finished generating yet. */
function ContextPreview({ mission, onDone }: { mission: Mission; onDone: () => void }) {
  const preview = mission.contextPreview;
  // Being the ladder's first step, this is a fresh playthrough — clear any
  // mistakes left over from a previous run so Feedback/Correction starts clean.
  useEffect(() => { clearMistakes(mission.id); }, [mission.id]);

  if (!preview) {
    return (
      <div className="sp-card vt-card" style={{ textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
        <p className="sp-sub" style={{ marginBottom: 20 }}>
          Setting the scene for this mission — check back in a moment.
        </p>
        <button className="sp-btn sp-btn-primary" onClick={onDone}>Continue</button>
      </div>
    );
  }

  return (
    <div className="sp-card vt-card" style={{ maxWidth: 460, margin: "0 auto" }}>
      <p className="vt-es">{preview.situation}</p>
      <p className="sp-sub">{preview.situation_en}</p>
      {preview.key_phrases.length > 0 && (
        <div className="gl-examples" style={{ marginTop: 16 }}>
          {preview.key_phrases.map((p, i) => (
            <div key={i} className="gl-example">
              <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                <span className="gl-example-es">{p.es}</span>
                <span className="gl-example-en">{p.en}</span>
              </div>
              <SpeakButton text={p.es} label="Listen" />
            </div>
          ))}
        </div>
      )}
      <button className="sp-btn sp-btn-primary" style={{ marginTop: 20 }} onClick={onDone}>Continue</button>
    </div>
  );
}

export default ContextPreview;
