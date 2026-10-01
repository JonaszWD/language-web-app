import type {
  ApiMission,
  ApiMissionSummary,
  MissionEnrichStatus,
  SpeakingScene,
  SpeakingTurnResult,
  DashboardStats,
  GrammarReviewResult,
  WeakReviewResponse,
  ListeningItemData,
  ListeningItemSummary,
  PodcastEpisode,
  PodcastFeed,
  PodcastSettings,
  Rating,
  SavedWord,
  GrammarCheck,
  RewriteStyle,
  TranslateResponse,
  User,
  UserCard,
  VocabAnswer,
  VocabCard,
  VocabDetail,
  VocabListItem,
  Word,
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

  setCefrLevel: (cefr_level: string) =>
    request<User>("/auth/me/cefr-level", {
      method: "PATCH",
      body: JSON.stringify({ cefr_level }),
    }),

  setOnboardingPreferences: (prefs: { skill_priority?: string; motivation?: string }) =>
    request<User>("/auth/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify(prefs),
    }),
};

// Study
export const studyApi = {
  // meta carries background performance telemetry (answer time / hints revealed);
  // all optional — the backend derives confidence from the rating.
  review: (card_id: string, rating: Rating, meta?: { response_ms?: number; hints?: number }) =>
    request<UserCard>("/study/review", {
      method: "POST",
      body: JSON.stringify({ card_id, rating, ...meta }),
    }),

  reviewGrammar: (pattern_id: string, answer: string, response_ms?: number) =>
    request<GrammarReviewResult>("/study/review-grammar", {
      method: "POST",
      body: JSON.stringify({ pattern_id, answer, response_ms }),
    }),

  // Logs one listening-comprehension outcome for the skills dashboard.
  // Listening isn't FSRS-scheduled, so this is a bare rollup counter — no card.
  listeningResult: (correct: boolean) =>
    request<void>("/study/listening-result", {
      method: "POST",
      body: JSON.stringify({ correct }),
    }),

  // Engagement ping from a scripted lesson deck (Grammar/Listening/Writing's
  // hand-authored 7-stage cards) — stage reached, replays, transcript
  // reveals, playback speed. Fire-and-forget: swallows its own errors so a
  // dropped tracking call never interrupts the lesson.
  lessonProgress: (payload: {
    skill: "grammar" | "listening" | "writing";
    stage?: number;
    replay?: boolean;
    transcript_reveal?: boolean;
    speed?: number;
  }) =>
    request<void>("/study/lesson-progress", {
      method: "POST",
      body: JSON.stringify(payload),
    }).catch(() => {}),

  // The Review lesson's question set — this user's actual worst-performing
  // words + shakiest grammar pattern, not a fixed daily mix. Each item grades
  // through the normal review()/reviewGrammar() calls above.
  weakReview: () => request<WeakReviewResponse>("/study/weak-review"),
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

  // Read-only Spanish->English lookup — doesn't touch the deck. Used to gloss
  // unknown words in AI replies (Speaking tab) on hover.
  translate: (word: string, context?: string) => {
    const params = new URLSearchParams({ word });
    if (context) params.set("context", context);
    return request<TranslateResponse>(`/vocab/translate?${params}`);
  },

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
      // How many times the learner re-recorded/retyped this turn, and whether
      // it came from a mic recording — Speaking dashboard metrics only.
      retry_count?: number;
      recorded?: boolean;
    },
  ) =>
    request<SpeakingTurnResult>(`/missions/${id}/speaking/turn`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// Free conversation (Speaking tab) — talk with the AI outside any mission.
// Reuses the mission turn engine; the client supplies the scene each turn.
// The NPC reply streams token-by-token over SSE (Claude Haiku), so this isn't
// a plain request<T> call: it feeds deltas to onDelta as they arrive and
// resolves with the full result once the closing event lands.
export const speakingApi = {
  // Log one Pronunciation-practice attempt (score = % of words heard clearly).
  pronunciation: (score: number) =>
    request<void>("/speaking/pronunciation", { method: "POST", body: JSON.stringify({ score }) }),

  turn: async (
    body: {
      role: string;
      setting: string;
      goal: string;
      history: { speaker: string; text: string }[];
      utterance: string;
      confidence?: number;
      // Talking points to track — echoed back per-turn as objectives_met.
      objectives?: string[];
      retry_count?: number;
      recorded?: boolean;
    },
    onDelta?: (text: string) => void
  ): Promise<SpeakingTurnResult> => {
    const res = await fetch(`${BASE}/speaking/turn`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      let message = text;
      try {
        message = JSON.parse(text)?.detail ?? text;
      } catch {}
      throw new ApiError(res.status, message);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let result: SpeakingTurnResult | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === "delta") onDelta?.(event.text);
        else if (event.type === "final") result = event;
        else if (event.type === "error") throw new ApiError(502, event.detail);
      }
    }
    if (!result) throw new ApiError(502, "Conversation stream ended unexpectedly.");
    return result;
  },

  // ElevenLabs text-to-speech for the NPC's reply (see backend speech_engine).
  // The learner's own speech is captured client-side via the Web Speech API.
  speak: async (text: string): Promise<Blob> => {
    const res = await fetch(`${BASE}/speaking/speak`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      let message = errText;
      try {
        message = JSON.parse(errText)?.detail ?? errText;
      } catch {}
      throw new ApiError(res.status, message);
    }
    return res.blob();
  },
};

// Checkpointed narrative listening (ListeningSession) — one engine, two entry
// points: pass scenarioTag to scope to a mission's Listening step, omit it for
// the standalone Listening tab's unscoped picker.
export const listeningApi = {
  items: (scenarioTag?: string, cefrLevel?: string) => {
    const qs = new URLSearchParams();
    if (scenarioTag) qs.set("scenario_tag", scenarioTag);
    if (cefrLevel) qs.set("cefr_level", cefrLevel);
    const s = qs.toString();
    return request<ListeningItemSummary[]>(`/listening/items${s ? `?${s}` : ""}`);
  },
  get: (itemId: string) => request<ListeningItemData>(`/listening/items/${itemId}`),
  // Long-form (long_form=true) stories only — single continuous two-voice
  // audio file (see backend services.story_audio), not per-sentence clips.
  audioUrl: (itemId: string) => `/api/listening/items/${itemId}/audio`,
  prewarmAudio: (itemId: string) =>
    request<void>(`/listening/items/${itemId}/audio/prewarm`, { method: "POST" }),
  checkpointResult: (itemId: string, checkpointId: string, answer: string, correct: boolean) =>
    request<{ correct: boolean; pushed_to_review: boolean }>(
      `/listening/items/${itemId}/checkpoint-result`,
      { method: "POST", body: JSON.stringify({ checkpoint_id: checkpointId, answer, correct }) },
    ),
  complete: (
    itemId: string,
    comprehensionScore: number,
    checkpointsCorrect: number,
    checkpointsTotal: number,
    engagement?: { replaysUsed?: number; transcriptReveals?: number; speedReached?: number },
  ) =>
    request<void>(`/listening/items/${itemId}/complete`, {
      method: "POST",
      body: JSON.stringify({
        comprehension_score: comprehensionScore,
        checkpoints_correct: checkpointsCorrect,
        checkpoints_total: checkpointsTotal,
        replays_used: engagement?.replaysUsed ?? 0,
        transcript_reveals: engagement?.transcriptReveals ?? 0,
        speed_reached: engagement?.speedReached ?? null,
      }),
    }),
};

// Text-to-speech (listening step). prewarm generates + caches a mission's audio
// on the backend ahead of time so playback is instant.
export const ttsApi = {
  prewarm: (texts: string[], cefrLevel?: string) =>
    request<{ queued: number }>("/tts/prewarm", {
      method: "POST",
      body: JSON.stringify({ texts, cefr_level: cefrLevel ?? null }),
    }),
};

export { ApiError };
