import type {
  DashboardStats,
  PodcastEpisode,
  PodcastFeed,
  PodcastSettings,
  Rating,
  SavedWord,
  GrammarCheck,
  RewriteStyle,
  StudySession,
  User,
  UserCard,
  VocabAnswer,
  VocabCard,
  VocabDetail,
  VocabListItem,
  VocabRating,
  Word,
  WordsPage,
  WritingCoach,
  WritingFeedback,
  WritingRewrite,
} from "@/types";

const BASE = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let message = text;
    try {
      message = JSON.parse(text)?.detail ?? text;
    } catch {}
    throw new ApiError(res.status, message);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return null as T;
}

// Auth
export const authApi = {
  register: (email: string, password: string) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<void>("/auth/logout", { method: "POST" }),

  me: () => request<User>("/auth/me"),
};

// Words
export const wordsApi = {
  list: (params: { category?: string; cefr_level?: string; page?: number; size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.cefr_level) qs.set("cefr_level", params.cefr_level);
    if (params.page) qs.set("page", String(params.page));
    if (params.size) qs.set("size", String(params.size));
    return request<WordsPage>(`/words?${qs}`);
  },
};

// Study
export const studyApi = {
  due: () => request<UserCard[]>("/study/due"),

  review: (card_id: string, rating: Rating) =>
    request<UserCard>("/study/review", {
      method: "POST",
      body: JSON.stringify({ card_id, rating }),
    }),

  startSession: () =>
    request<StudySession>("/study/session", { method: "POST" }),

  endSession: (id: string, cards_reviewed: number, cards_correct: number) =>
    request<StudySession>(`/study/session/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ cards_reviewed, cards_correct }),
    }),
};

// Vocabulary — translate/save + the 5-level training flow
export const vocabApi = {
  save: (spanish: string, context?: string) =>
    request<SavedWord>("/vocab/save", {
      method: "POST",
      body: JSON.stringify({ spanish, context }),
    }),

  // The saved-word collection with each card's training level.
  cards: () => request<VocabListItem[]>("/vocab/cards"),

  // Read-only detail (full enrichment) for one saved word.
  cardDetail: (cardId: string) => request<VocabDetail>(`/vocab/cards/${cardId}`),

  // Next training item (null when nothing is due).
  next: () => request<VocabCard | null>("/vocab/next"),

  answer: (card_id: string, payload: { rating?: VocabRating; answer?: string }) =>
    request<VocabAnswer>("/vocab/answer", {
      method: "POST",
      body: JSON.stringify({ card_id, ...payload }),
    }),
};

// Grammar — AI check for the "Produce" stage
export const grammarApi = {
  check: (topic: string, instructions: string, text: string) =>
    request<GrammarCheck>("/grammar/check", {
      method: "POST",
      body: JSON.stringify({ topic, instructions, text }),
    }),
};

// Writing — AI feedback + style rewrites
export const writingApi = {
  feedback: (mode: string, instructions: string, text: string) =>
    request<WritingFeedback>("/writing/feedback", {
      method: "POST",
      body: JSON.stringify({ mode, instructions, text }),
    }),
  rewrite: (text: string, style: RewriteStyle) =>
    request<WritingRewrite>("/writing/rewrite", {
      method: "POST",
      body: JSON.stringify({ text, style }),
    }),
  coach: (prompt_en: string, target_es: string, answer: string) =>
    request<WritingCoach>("/writing/coach", {
      method: "POST",
      body: JSON.stringify({ prompt_en, target_es, answer }),
    }),
};

// Stats
export const statsApi = {
  dashboard: () => request<DashboardStats>("/stats/dashboard"),
};

// Podcasts
export const podcastsApi = {
  feeds: () => request<PodcastFeed[]>("/podcasts/feeds"),

  addFeed: (feed_url: string) =>
    request<PodcastFeed>("/podcasts/feed", {
      method: "POST",
      body: JSON.stringify({ feed_url }),
    }),

  removeFeed: (id: string) =>
    request<void>(`/podcasts/feed/${id}`, { method: "DELETE" }),

  refresh: () => request<PodcastFeed[]>("/podcasts/refresh", { method: "POST" }),

  episode: (id: string) => request<PodcastEpisode>(`/podcasts/episodes/${id}`),

  transcribe: (id: string) =>
    request<PodcastEpisode>(`/podcasts/episodes/${id}/transcribe`, { method: "POST" }),

  redownload: (id: string) =>
    request<PodcastEpisode>(`/podcasts/episodes/${id}/download`, { method: "POST" }),

  getSettings: () => request<PodcastSettings>("/podcasts/settings"),

  setSettings: (auto_transcribe: boolean) =>
    request<PodcastSettings>("/podcasts/settings", {
      method: "PUT",
      body: JSON.stringify({ auto_transcribe }),
    }),
};

export { ApiError };
