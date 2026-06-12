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
