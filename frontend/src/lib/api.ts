import type {
  DashboardStats,
  Rating,
  StudySession,
  User,
  UserCard,
  Word,
  WordsPage,
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

// Stats
export const statsApi = {
  dashboard: () => request<DashboardStats>("/stats/dashboard"),
};

export { ApiError };
