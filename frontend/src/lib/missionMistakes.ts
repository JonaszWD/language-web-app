// A same-session, client-side round-up of wrong answers made during the
// current mission run — feeds the Feedback/Correction step. Not persisted:
// gone on reload, and cleared each time a fresh playthrough starts (see
// clearMistakes call at Context Preview, the ladder's first step).

export type MissionMistakeStep = "Grammar" | "Speaking" | "Writing";

export interface MissionMistake {
  step: MissionMistakeStep;
  es: string;      // the correct target the learner got wrong
  en?: string;
  note?: string;   // optional extra context (e.g. what they said instead)
}

const store = new Map<string, MissionMistake[]>();

export function recordMistake(missionId: string, mistake: MissionMistake): void {
  const list = store.get(missionId) ?? [];
  list.push(mistake);
  store.set(missionId, list);
}

export function getMistakes(missionId: string): MissionMistake[] {
  return store.get(missionId) ?? [];
}

export function clearMistakes(missionId: string): void {
  store.delete(missionId);
}
