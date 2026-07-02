export interface User {
  id: string;
  email: string;
  streak_count: number;
  created_at: string;
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
}

export interface WordsPage {
  items: Word[];
  total: number;
  page: number;
  size: number;
}

export interface DashboardStats {
  streak: number;
  total_learned: number;
  due_today: number;
  weekly_xp: number;
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
  image_url?: string | null;
  letters?: string[];
  length?: number;
  sentence?: string;
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

export type VocabRating = "know" | "shaky" | "no_idea";

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
