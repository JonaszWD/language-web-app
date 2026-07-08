import type {
  ApiMission,
  ApiMissionSummary,
  MissionEnrichStatus,
  SpeakingScene,
  SpeakingTurnResult,
  DashboardStats,
  GrammarReviewCard,
  GrammarReviewResult,
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

  // meta carries background performance telemetry (answer time / hints revealed);
  // all optional — the backend derives confidence from the rating.
  review: (card_id: string, rating: Rating, meta?: { response_ms?: number; hints?: number }) =>
    request<UserCard>("/study/review", {
      method: "POST",
      body: JSON.stringify({ card_id, rating, ...meta }),
    }),

  startSession: () =>
    request<StudySession>("/study/session", { method: "POST" }),

  endSession: (id: string, cards_reviewed: number, cards_correct: number) =>
    request<StudySession>(`/study/session/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ cards_reviewed, cards_correct }),
    }),

  // Grammar-pattern spaced review — same due-queue idea as words, for patterns.
  dueGrammar: () => request<GrammarReviewCard[]>("/study/due-grammar"),

  reviewGrammar: (pattern_id: string, answer: string) =>
    request<GrammarReviewResult>("/study/review-grammar", {
      method: "POST",
      body: JSON.stringify({ pattern_id, answer }),
    }),

  // Logs one listening-comprehension outcome for the skills dashboard.
  // Listening isn't FSRS-scheduled, so this is a bare rollup counter — no card.
  listeningResult: (correct: boolean) =>
    request<void>("/study/listening-result", {
      method: "POST",
      body: JSON.stringify({ correct }),
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

  // Next training item (null when nothing is due). Pass a missionId to restrict
  // the pool to that mission's words (mission Vocabulary step); pass `words` to
  // narrow further to an explicit subset (one burst of a mission's vocab).
  next: (missionId?: string, words?: string[]) => {
    const params = new URLSearchParams();
    if (missionId) params.set("mission_id", missionId);
    if (words && words.length) params.set("words", words.join(","));
    const qs = params.toString();
    return request<VocabCard | null>(`/vocab/next${qs ? `?${qs}` : ""}`);
  },

  // response_ms / hints are background telemetry (silent); confidence is derived
  // server-side from correctness, so it isn't sent here. `answer` is the typed
  // Spanish word (levels 2-5) or the picked MCQ option text (level 1).
  answer: (
    card_id: string,
    payload: { answer?: string; response_ms?: number; hints?: number },
  ) =>
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

// Missions
export const missionsApi = {
  list: () => request<ApiMissionSummary[]>("/missions"),
  get: (id: string) => request<ApiMission>(`/missions/${id}`),
  // Enrichment progress for the 'preparing mission' window. No side effects.
  status: (id: string) => request<MissionEnrichStatus>(`/missions/${id}/status`),
  // Make a mission available for the user and push its vocab into the deck.
  start: (id: string) =>
    request<{ mission_id: string; status: string; vocab_added: number }>(
      `/missions/${id}/start`,
      { method: "POST" },
    ),
  // Mark a mission completed (Final Challenge finished). Idempotent.
  complete: (id: string) =>
    request<{ mission_id: string; status: string; completed_at: string | null }>(
      `/missions/${id}/complete`,
      { method: "POST" },
    ),
  // Final Challenge scene — role/setting/goal + the NPC's cold-open line.
  speakingScene: (id: string) =>
    request<SpeakingScene>(`/missions/${id}/speaking/scene`),
  // Evaluate one learner utterance in a free-conversation speaking stage (5-7).
  speakingTurn: (
    id: string,
    body: {
      role: string;
      setting: string;
      goal: string;
      history: { speaker: string; text: string }[];
      utterance: string;
      // Browser ASR's own confidence (0-1) for this utterance, when available —
      // a rough proxy for pronunciation clarity, fed into the skills dashboard.
      confidence?: number;
    },
  ) =>
    request<SpeakingTurnResult>(`/missions/${id}/speaking/turn`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// Text-to-speech (listening step). prewarm generates + caches a mission's audio
// on the backend ahead of time so playback is instant.
export const ttsApi = {
  prewarm: (texts: string[]) =>
    request<{ queued: number }>("/tts/prewarm", {
      method: "POST",
      body: JSON.stringify({ texts }),
    }),
};

export { ApiError };
