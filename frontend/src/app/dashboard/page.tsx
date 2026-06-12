import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DashboardStats, User } from "@/types";
import StreakBadge from "@/components/StreakBadge";
import ProgressBar from "@/components/ProgressBar";

const BACKEND = process.env.BACKEND_URL ?? "http://backend:8000";
const WEEKLY_XP_TARGET = 700;

async function fetchWithCookie<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND}${path}`, {
      headers: { Cookie: `access_token=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const user = await fetchWithCookie<User>("/auth/me");
  if (!user) redirect("/login");

  const stats = await fetchWithCookie<DashboardStats>("/stats/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-brand-pink-text text-lg">SpanishUp</span>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/words" className="text-gray-600 hover:text-brand-pink-text transition-colors">
            Vocabulary
          </Link>
          <Link
            href="/study"
            className="bg-brand-pink text-gray-900 px-3 py-1.5 rounded-lg hover:bg-brand-pink-hover transition-colors font-medium"
          >
            Study
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">
          Welcome back, {user.email.split("@")[0]}!
        </h1>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StreakBadge streak={stats?.streak ?? user.streak_count} />

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-col">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-aqua-text mb-1">
              Due Today
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.due_today ?? "—"}</div>
            <div className="text-xs text-gray-400">cards to review</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-col">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-pink-text mb-1">
              Mastered
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats?.total_learned ?? "—"}</div>
            <div className="text-xs text-gray-400">words learned</div>
          </div>
        </div>

        {/* Weekly XP */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-8">
          <h2 className="font-semibold mb-3">Weekly Progress</h2>
          <ProgressBar
            value={stats?.weekly_xp ?? 0}
            max={WEEKLY_XP_TARGET}
            label={`${stats?.weekly_xp ?? 0} / ${WEEKLY_XP_TARGET} XP this week`}
          />
        </div>

        {/* CTA */}
        <Link
          href="/study"
          className="block w-full sm:w-auto sm:inline-block text-center bg-brand-pink hover:bg-brand-pink-hover text-gray-900 font-semibold rounded-xl py-4 px-10 text-lg transition-colors shadow-sm"
        >
          Start Studying →
        </Link>
      </main>
    </div>
  );
}
