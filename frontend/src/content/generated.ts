// Generated missions produced offline by backend/scripts/generate_mission.py.
// The script merges each mission's overlay + lesson decks into
// generated-missions.json (git-committed, reviewable). This module exposes typed
// slices the mission UI merges over its hand-authored maps, so a generated
// mission becomes fully playable with no further code changes.
//
// Type-only imports of the lesson script shapes keep this module free of any
// runtime dependency on the (client) lesson components — no import cycle.
import raw from "./generated-missions.json";
import type { GrammarLessonScript } from "@/components/GrammarLesson";
import type { ListeningLessonScript } from "@/components/ListeningLesson";
import type { WritingLessonScript } from "@/components/WritingLesson";

export interface GeneratedOverlay {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  tag: string;
  lat: number;
  lon: number;
  levels: { name: string; learn: string; minutes: number }[];
}

interface GeneratedMission {
  // overlay is absent for "lessons-only" entries (a hand-authored overlay in
  // AppShell supplies icon/coords/levels); decks are absent only if generation
  // was skipped. Every field is therefore optional here.
  overlay?: GeneratedOverlay;
  grammar?: GrammarLessonScript;
  listening?: ListeningLessonScript;
  writing?: WritingLessonScript;
}

// The JSON is authored by the generator against the same schemas; trust its
// shape here (a bad deck would surface as a runtime render issue, not a type
// error, since JSON carries no type).
const generated = raw as unknown as Record<string, GeneratedMission>;

// Drop entries missing this slice, so lessons-only missions don't inject an
// undefined overlay (and vice-versa).
function slice<K extends keyof GeneratedMission>(key: K): Record<string, NonNullable<GeneratedMission[K]>> {
  return Object.fromEntries(
    Object.entries(generated)
      .filter(([, m]) => m[key] != null)
      .map(([id, m]) => [id, m[key] as NonNullable<GeneratedMission[K]>]),
  );
}

export const generatedGrammar = slice("grammar");
export const generatedListening = slice("listening");
export const generatedWriting = slice("writing");
export const generatedOverlays = slice("overlay");
