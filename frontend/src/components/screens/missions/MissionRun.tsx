"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import VocabTrainer from "@/components/VocabTrainer";
import { MISSION_ADVANCE_LEVEL, type Mission } from "./missionData";

function MissionRun({
  mission, onExit, isReview,
}: { mission: Mission; onExit: () => void; isReview?: boolean }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div style={{ width: "100%", display: "grid", placeItems: "center", paddingTop: 40 }}>
        <div className="sp-card gr-stage-card" style={{ textAlign: "center", maxWidth: 460 }}>
          <div className="mi-complete-emoji"><Icon name={mission.icon} size={64} /></div>
          <div className="gr-done-ico" style={{ margin: "0 auto 12px" }}><Icon name="check" size={26} /></div>
          <h2 className="sp-h2" style={{ marginBottom: 6 }}>{isReview ? "Review complete" : "Vocabulary complete"}</h2>
          <p className="sp-sub" style={{ marginBottom: 20 }}>
            {isReview
              ? "All the mission's words, refreshed and ready for the real conversation."
              : "Every word is off to a solid start. They’ll keep coming back in Review to build toward full mastery."}
          </p>
          <button className="sp-btn sp-btn-primary" onClick={onExit}>Back to missions <Icon name="chevron" size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <VocabTrainer
        missionId={mission.id}
        advanceThreshold={MISSION_ADVANCE_LEVEL}
        missionVocabLevels={mission.vocab}
        onBack={onExit}
        onDone={() => setDone(true)}
        hideBack
        emptyTitle={isReview ? "Review ready!" : "Vocabulary done!"}
      />
    </div>
  );
}

export default MissionRun;
