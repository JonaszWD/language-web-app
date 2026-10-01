"use client";

import { useEffect, useState } from "react";
import { listeningApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import ListeningLesson, { LISTENING_LESSONS as MISSION_LISTENING_LESSONS } from "@/components/ListeningLesson";
import ListeningSession from "@/components/ListeningSession";
import PodcastPlayer from "@/components/PodcastPlayer";

/* ════════════════════════ LISTENING ════════════════════════
   Story picker — one section per CEFR level (like the Grammar tab's topic
   picker), but every level A1-C2 is shown open — no level-locking here.
   Only one story (the café dialogue) is built out; the rest render as
   locked/"coming soon" cards until their generated item is seeded. The
   Podcast card opens the real-audio player (YouTube import + transcript). */

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
type CefrLevel = (typeof CEFR_LEVELS)[number];
const CEFR_LEVEL_NAMES: Record<CefrLevel, string> = {
  A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper Intermediate", C1: "Advanced", C2: "Mastery",
};

type ListeningDialogueMeta = { id: string; title: string; blurb: string; level: CefrLevel };

// One rudimentary story (backed by the mission café script); the rest are
// talking points with no script behind them yet — they render as locked/
// "coming soon" cards until built out.
const LISTENING_DIALOGUES: ListeningDialogueMeta[] = [
  { id: "m001-coffee-shop", title: "At a café", blurb: "Order a coffee and understand the waiter.", level: "A1" },
  { id: "a2-market", title: "At the market", blurb: "Follow a conversation buying fruit and vegetables.", level: "A2" },
  { id: "a2-directions", title: "Asking directions", blurb: "Understand someone giving directions in town.", level: "A2" },
  { id: "b1-doctor", title: "At the doctor", blurb: "Follow a check-up conversation about symptoms.", level: "B1" },
  { id: "b1-hotel", title: "Checking into a hotel", blurb: "Understand a reservation and check-in exchange.", level: "B1" },
  { id: "b1-reencuentro", title: "Un reencuentro en Madrid", blurb: "A long, uninterrupted ~10-minute conversation between two old friends.", level: "B1" },
  { id: "b2-job-interview", title: "A job interview", blurb: "Follow a conversation about experience and skills.", level: "B2" },
  { id: "b2-renting", title: "Renting an apartment", blurb: "Understand a landlord discussing a lease.", level: "B2" },
  { id: "c1-debate", title: "A radio debate", blurb: "Follow a fast-paced discussion between two speakers.", level: "C1" },
  { id: "c1-news", title: "A news report", blurb: "Understand a full news segment at natural speed.", level: "C1" },
];

// Which stories the learner has already completed — no backend field for
// this yet, so kept in localStorage (same pattern as FreeChat's
// sp-completed-scenarios) and shown as a checkmark on the card.
const COMPLETED_STORIES_KEY = "sp-completed-listening-dialogues";
function loadCompletedStories(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COMPLETED_STORIES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveCompletedStories(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPLETED_STORIES_KEY, JSON.stringify([...ids]));
}

function ListeningDialogueCard({ meta, hasContent, completed, onPick }: {
  meta: ListeningDialogueMeta;
  hasContent: boolean;
  completed: boolean;
  onPick: () => void;
}) {
  return (
    <button
      className={"sp-card quick sp-mode" + (hasContent ? "" : " is-locked")}
      onClick={hasContent ? onPick : undefined}
      disabled={!hasContent}
      style={{ textAlign: "left", cursor: hasContent ? "pointer" : "default" }}
    >
      <div className="q-ico"><Icon name="podcast" size={22} /></div>
      <div>
        <div className="q-name">{meta.title}</div>
        <div className="q-sub">{meta.blurb}</div>
        {!hasContent && <div className="q-sub">Coming soon</div>}
      </div>
      {hasContent && (completed ? <span className="sp-tag"><Icon name="check" size={14} /></span> : <span className="sp-tag"><Icon name="chevron" size={14} /></span>)}
    </button>
  );
}

// Real, unscripted audio from an imported YouTube playlist — see PodcastPlayer.
function PodcastDialogueCard({ onPick }: { onPick: () => void }) {
  return (
    <button className="sp-card quick sp-mode" onClick={onPick} style={{ textAlign: "left", cursor: "pointer" }}>
      <div className="q-ico"><Icon name="headphones" size={22} /></div>
      <div>
        <div className="q-name">Podcast</div>
        <div className="q-sub">Listen to a real, unscripted episode from a podcast you import.</div>
      </div>
      <span className="sp-tag"><Icon name="chevron" size={14} /></span>
    </button>
  );
}

function ListeningDialoguePicker({ completedIds, backendItemIds, onPickDialogue }: {
  completedIds: Set<string>;
  backendItemIds: Set<string>;
  onPickDialogue: (id: string) => void;
}) {
  // A card has content once either engine has something for its id: a
  // generated ListeningItem (services.mission_gen --story, preferred — see
  // ListeningScreen) or the older hand-authored ListeningLesson script.
  const hasContent = (id: string) => backendItemIds.has(id) || !!MISSION_LISTENING_LESSONS[id];

  return (
    <div className="ls-padded">
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Listening</p>
        <h1 className="sp-h1">Pick a story</h1>
      </div>

      <div className="sp-mode-section">
        <div className="quick-row sp-modes">
          <PodcastDialogueCard onPick={() => onPickDialogue(PODCAST_VIEW)} />
        </div>
      </div>

      {CEFR_LEVELS.map((level) => {
        const stories = LISTENING_DIALOGUES.filter((s) => s.level === level);
        if (stories.length === 0) return null;
        return (
          <div key={level} className="sp-mode-section">
            <p className="sp-section-label">{level} ({CEFR_LEVEL_NAMES[level]})</p>
            <div className="quick-row sp-modes">
              {stories.map((meta) => (
                <ListeningDialogueCard
                  key={meta.id}
                  meta={meta}
                  hasContent={hasContent(meta.id)}
                  completed={completedIds.has(meta.id)}
                  onPick={() => onPickDialogue(meta.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListeningDialogueComingSoon({ title, onExit }: { title: string; onExit: () => void }) {
  return (
    <div className="ls-padded" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="sp-pagehead" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", margin: "0 0 16px" }}>
        <button
          type="button"
          className="sp-btn"
          onClick={onExit}
          aria-label="Back to stories"
          title="Back to stories"
        >
          <Icon name="chevron" size={16} /> Back
        </button>
        <div>
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Listening</p>
          <h1 className="sp-h1">{title}</h1>
        </div>
      </div>
      <div className="sp-card" style={{ padding: "clamp(24px, 4vw, 40px)", textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <h2 className="sp-h1" style={{ fontSize: 20 }}>This story is still being built</h2>
        <p className="sp-sub" style={{ maxWidth: "48ch" }}>Check back soon — this listening practice is on the way.</p>
      </div>
    </div>
  );
}

const PODCAST_VIEW = "podcast";
type ListeningView = "picker" | (string & {});

export default function ListeningScreen() {
  const [view, setView] = useState<ListeningView>("picker");
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => loadCompletedStories());
  // Checkpointed narrative listening items (services.mission_gen --story) —
  // the primary listening mechanic; unscoped (scenario_tag=null) for this
  // standalone tab's picker, same engine the Mission Listening step uses.
  // Generated with the same id as its matching LISTENING_DIALOGUES entry
  // (see backend/scripts/generate_mission.py --story --id <dialogue id>), so
  // a card's own id is enough to look up whether it has a real story yet.
  const [backendItemIds, setBackendItemIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    listeningApi
      .items()
      .then((items) => setBackendItemIds(new Set(items.map((i) => i.id))))
      .catch(() => {});
  }, []);
  const toPicker = () => setView("picker");
  const markCompleted = (id: string) => {
    setCompletedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveCompletedStories(next);
      return next;
    });
  };

  if (view === PODCAST_VIEW) return <PodcastPlayer onExit={toPicker} />;

  if (view !== "picker") {
    if (backendItemIds.has(view)) {
      return (
        <ListeningSession
          itemId={view}
          onExit={toPicker}
          onDone={() => { markCompleted(view); toPicker(); }}
          backLabel="Stories"
        />
      );
    }
    const script = MISSION_LISTENING_LESSONS[view];
    const meta = LISTENING_DIALOGUES.find((m) => m.id === view);
    if (!script) return <ListeningDialogueComingSoon title={meta?.title ?? "Story"} onExit={toPicker} />;
    return (
      <ListeningLesson
        script={script}
        onExit={toPicker}
        onDone={() => { markCompleted(view); toPicker(); }}
        backLabel="Stories"
      />
    );
  }

  return (
    <ListeningDialoguePicker
      completedIds={completedIds}
      backendItemIds={backendItemIds}
      onPickDialogue={(id) => setView(id)}
    />
  );
}
