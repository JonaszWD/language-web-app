import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/types";
import AppShell from "./AppShell";

const BACKEND = process.env.BACKEND_URL ?? "http://backend:8000";

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

  const avatarLetter = (user.email?.[0] ?? "M").toUpperCase();

  return <AppShell avatarLetter={avatarLetter} />;
}
