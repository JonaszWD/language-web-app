"use client";

import SpeakButton from "@/components/SpeakButton";
import { getMistakes } from "@/lib/missionMistakes";

/* A mistake round-up covering everything just practised in this playthrough
   (Grammar/Speaking/Writing — see missionMistakes.ts), shown once before the
   final Vocabulary Recap + Final Challenge. Session-only: nothing here is
   persisted server-side. */
function FeedbackCorrection({ missionId, onDone }: { missionId: string; onDone: () => void }) {
  const mistakes = getMistakes(missionId);

  if (mistakes.length === 0) {
    return (
      <div className="sp-card vt-card" style={{ textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
        <p className="sp-h2" style={{ marginBottom: 6 }}>Nothing to fix</p>
        <p className="sp-sub" style={{ marginBottom: 20 }}>Straight to the recap.</p>
        <button className="sp-btn sp-btn-primary" onClick={onDone}>Continue</button>
      </div>
    );
  }

  return (
    <div className="sp-card vt-card" style={{ maxWidth: 460, margin: "0 auto" }}>
      <p className="sp-h2" style={{ marginBottom: 6 }}>A few things to fix</p>
      <p className="sp-sub" style={{ marginBottom: 16 }}>From Grammar, Speaking and Writing this round.</p>
      <div className="gl-examples">
        {mistakes.map((m, i) => (
          <div key={i} className="gl-example">
            <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
              <span className="sp-eyebrow">{m.step}</span>
              <span className="gl-example-es">{m.es}</span>
              {m.en && <span className="gl-example-en">{m.en}</span>}
              {m.note && <span className="wr-hint">{m.note}</span>}
            </div>
            <SpeakButton text={m.es} label="Listen" />
          </div>
        ))}
      </div>
      <button className="sp-btn sp-btn-primary" style={{ marginTop: 20 }} onClick={onDone}>Continue</button>
    </div>
  );
}

export default FeedbackCorrection;
