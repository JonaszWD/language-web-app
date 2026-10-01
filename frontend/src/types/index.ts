export interface User {
  id: string;
  email: string;
  streak_count: number;
  created_at: string;
  cefr_level: string;
  skill_priority: string | null;
  motivation: string | null;
}

export interface Word {
  id: string;
  spanish: string;
  english: string;
  example_sentence: string | null;
  category: string;
  cefr_level: string;
  audio_url: string | null;
}

export interface UserCard {
  id: string;
  user_id: string;
  word_id: string;
  due_date: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: string;
  word?: Word;
  // The mission this word came from, if any — shown as a tag in the Review tab.
  mission_title?: string | null;
}

export interface WordsPage {
  items: Word[];
  total: number;
  page: number;
  size: number;
}

export interface SkillSummary {
  attempts: number;
  accuracy: number;
  avg_score: number | null;
  last_practiced_at: string | null;
  avg_response_ms: number | null;
  max_stage_reached: number | null;
  replays_total: number;
  transcript_reveals_total: number;
  last_speed_reached: number | null;
  retries_total: number;
  recordings_total: number;
}

export interface VocabExtra {
  due_tomorrow: number;
  new_count: number;
  learning_count: number;
  reviewing_count: number;
  mature_count: number;
  avg_stability: number | null;
  lapse_rate: number | null;
  hardest_words: string[];
  avg_response_ms: number | null;
}

export interface GrammarExtra {
  mastered_count: number;
  weakest_structure: string | null;
}

export interface ProgressExtra {
  retention_rate: number | null;
  active_days_30: number;
  xp_by_week: number[];
  typical_study_hour_utc: number | null;
  days_since_last_session: number | null;
  lapses_total: number;
  relearning_count: number;
  grammar_reps_by_structure: { structure: string; reps: number }[];
}

export interface CurrentMission {
  id: string;
  title: string;
}

export interface DashboardStats {
  streak: number;
  longest_streak: number;
  total_learned: number;
  due_today: number;
  weekly_xp: number;
  cefr_level: string;
  missions_completed: number;
  current_mission: CurrentMission | null;
  total_study_seconds: number;
  study_sessions_count: number;
  skills: Record<string, SkillSummary>;
  vocab_extra: VocabExtra;
  grammar_extra: GrammarExtra;
  progress_extra?: ProgressExtra;
}

export interface StudySession {
  id: string;
  started_at: string;
}

export type Rating = 1 | 2 | 3 | 4;

export interface SavedWord {
  word_id: string;
  spanish: string;
  english: string;
  added: boolean;
}

// Read-only Spanish->English lookup (GET /vocab/translate) — doesn't touch
// the caller's deck, used to gloss unknown words on hover.
export interface TranslateResponse {
  spanish: string;
  english: string;
}

export interface Chunk {
  es: string;
  en: string;
}

// Trimmed enrichment surfaced as the "teach chunks, not words" tip strip.
export interface VocabTips {
  gender?: string;
  pronunciation?: string;
  frequency?: string;
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  chunks?: Chunk[];
  common_mistakes?: string[];
  example_sentences?: Chunk[];
}

// Per-level exercise payload (fields present depend on level).
export interface VocabExercise {
  level: number;
  spanish?: string;
  english?: string;
  // Level 1: 4-option MCQ — the correct English gloss shuffled among
  // distractors. The correct answer is NOT sent separately as `english`.
  options?: string[];
  image_url?: string | null;
  letters?: string[];
  length?: number;
  sentence?: string;
  // Level 4: Spanish definition of the word (not containing it) + English gloss.
  description_es?: string;
  description_en?: string;
}

export interface VocabCard {
  card_id: string;
  word_id: string;
  level: number;
  exercise: VocabExercise;
  tips: VocabTips;
}

export interface VocabListItem {
  card_id: string;
  word_id: string;
  spanish: string;
  english: string;
  cefr_level: string;
  level: number;
  due: boolean;
}

export interface VocabDetail {
  card_id: string;
  word_id: string;
  spanish: string;
  english: string;
  cefr_level: string;
  level: number;
  tips: VocabTips;
}

export interface VocabFeedback {
  score: number;
  correct_usage: boolean;
  feedback: string;
  correction: string;
}

export interface VocabAnswer {
  correct: boolean;
  level: number;
  mastered: boolean;
  spanish: string;
  feedback: VocabFeedback | null;
}

export interface GrammarCorrection {
  wrong: string;
  correct: string;
  note: string;
}

export interface GrammarCheck {
  score: number;
  meets_requirement: boolean;
  feedback: string;
  verbs_used: string[];
  corrections: GrammarCorrection[];
}

export interface WritingFeedback {
  score: number;
  feedback: string;
  corrections: { wrong: string; correct: string; note: string }[];
  natural: { original: string; better: string; why: string }[];
  vocab_upgrades: { from_word: string; to_word: string; why: string }[];
}

export interface WritingRewrite {
  rewritten: string;
  note: string;
}

export interface WritingCoach {
  correct: boolean;
  natural: string;
  why: string;
  think: string;
}

export type RewriteStyle = "natural" | "formal" | "shorter" | "mexican" | "spain";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface PodcastSettings {
  auto_transcribe: boolean;
}

export interface PodcastEpisode {
  id: string;
  guid: string | null;
  title: string;
  audio_url: string | null;
  image_url: string | null;
  duration: string | null;
  published_at: string | null;
  transcript: string;
  segments: TranscriptSegment[] | null;
  transcript_url: string | null;
  transcript_status: "ready" | "none" | "pending" | "failed";
  transcript_progress: number;
  download_status: "none" | "pending" | "ready" | "failed";
  position: number;
}

export interface PodcastFeed {
  id: string;
  feed_url: string;
  title: string;
  author: string | null;
  image_url: string | null;
  last_checked_at: string | null;
  episodes: PodcastEpisode[];
}

export interface MissionVocabItem {
  id: string;
  order_index: number;
  spanish: string;
  english: string;
  example_sentence: string | null;
  part_of_speech: string | null;
  enrichment: Record<string, unknown> | null;
  image_url: string | null;
  // The current user's 1-5 training level for this word; null when not in deck yet.
  level: number | null;
}

export interface ApiMissionSummary {
  id: string;
  order_index: number;
  title: string;
  description: string | null;
  level: string | null;
  vocab_count: number;
  recommended: boolean;
}

export type MissionEnrichmentStatus = "pending" | "processing" | "ready";

// One of the mission's ~3 grammar structures — lets the client match a
// hardcoded GrammarLesson review card to its backend pattern_id and post an
// FSRS review for it, so patterns get spaced review same as vocabulary.
export interface MissionGrammarPattern {
  id: string;
  order_index: number;
  pattern: string;
  gloss: string;
  example_es: string;
  cloze_template: string;
  cloze_answer: string;
}

export interface ApiMission {
  id: string;
  order_index: number;
  title: string;
  description: string | null;
  level: string | null;
  enrichment_status: MissionEnrichmentStatus;
  speaking: MissionSpeaking | null;
  context_preview: ContextPreview | null;
  vocab: MissionVocabItem[];
  grammar: MissionGrammarPattern[];
  // The current user's progress: null if never started, else "available" or
  // "completed".
  status: string | null;
  completed_at: string | null;
}

// A due grammar-pattern cloze — the review-tab counterpart of UserCard, for
// patterns instead of words.
export interface GrammarReviewCard {
  id: string;
  pattern_id: string;
  pattern: string;
  gloss: string;
  cloze_template: string;
  due_date: string;
  mission_title?: string | null;
}

export interface GrammarReviewResult {
  correct: boolean;
  cloze_answer: string;
  due_date: string;
}

// One question in the weakness-targeted Review lesson — sourced from the
// user's actual worst words/patterns, not a fixed daily mix. Vocab-sourced
// skills carry card_id (grade via studyApi.review); the Grammar skill
// carries pattern_id + cloze_template (grade via studyApi.reviewGrammar).
export type WeakReviewSkill = "Translate" | "Listening" | "Grammar" | "Speaking" | "Vocabulary";
export interface WeakReviewItem {
  skill: WeakReviewSkill;
  es: string;
  en: string;
  card_id?: string | null;
  pattern_id?: string | null;
  cloze_template?: string | null;
}
export interface WeakReviewResponse {
  items: WeakReviewItem[];
  weakest_skill?: string | null;
}

// The LLM-generated progressive speaking role-play attached to a mission.
export type SpeakingStageType =
  | "repeat" | "choice" | "fill" | "prompt" | "dynamic" | "branch" | "free";

export interface SpeakingOption { es: string; ok: boolean }
export interface SpeakingSegment {
  text: string; blank: boolean; answer: string; options: string[];
}
export interface SpeakingStage {
  n: number;
  type: SpeakingStageType;
  title: string;
  npc: string;
  npc_en: string;
  instruction: string;
  target: string;
  target_en: string;
  hint: string;
  cue_en: string;
  // Every acceptable spoken answer for open stages (prompt) — any one passes, so
  // the learner communicates a meaning rather than reciting one exact sentence.
  valid: string[];
  goal: string;
  max_turns: number;
  options: SpeakingOption[];
  segments: SpeakingSegment[];
}
// The Context Preview stage — a short scene-setting blurb + key phrases shown
// before Listening, so the learner knows the situation before drilling it.
export interface ContextPreviewPhrase { es: string; en: string }
export interface ContextPreview {
  situation: string;
  situation_en: string;
  key_phrases: ContextPreviewPhrase[];
}

export interface MissionSpeaking {
  role: string;
  role_en: string;
  setting: string;
  stages: SpeakingStage[];
}

// The Final Challenge scene — the cold-open config for the free café-style
// conversation. role/setting/goal drive the NPC; opening is shown immediately.
export interface SpeakingScene {
  role: string;
  role_en: string;
  setting: string;
  goal: string;
  opening: string;
  opening_en: string;
}

// One turn in a free-conversation stage (5-7), evaluated by the backend LLM.
export interface SpeakingTurnResult {
  understood: boolean;
  npc_reply: string;
  npc_reply_en: string;
  correction: string;
  done: boolean;
  // Present only when the request included `objectives` — parallel booleans,
  // one per requested objective, true once satisfied at any point so far.
  objectives_met?: boolean[];
}

export interface MissionEnrichStatus {
  mission_id: string;
  status: MissionEnrichmentStatus;
  enriched: number;
  total: number;
}

// Checkpointed narrative listening (the ListeningSession engine) — see
// backend/app/models/listening_item.py.
export interface ListeningSentence {
  sentence_id: number;
  speaker: string;
  text_es: string;
  text_en: string;
}

export type CheckpointType = "predict" | "comprehension" | "inference" | "vocab_in_context" | "delayed_recall";

export interface ListeningCheckpointData {
  id: string;
  after_sentence_id: number;
  type: CheckpointType;
  prompt: string;
  options: string[] | null;
  correct_answer: string;
  linked_concept_type: "vocab" | "grammar_pattern" | null;
  linked_concept_id: string | null;
  difficulty_tag: string | null;
}

export interface ListeningItemSummary {
  id: string;
  scenario_tag: string | null;
  cefr_level: string;
  title: string;
  long_form: boolean;
}

export interface ListeningItemData extends ListeningItemSummary {
  sentences: ListeningSentence[];
  vocab_reused: string[];
  checkpoints: ListeningCheckpointData[];
}
