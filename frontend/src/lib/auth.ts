import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/types";

const BACKEND_INTERNAL = process.env.BACKEND_URL ?? "http://backend:8000";

export async function getMe(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${BACKEND_INTERNAL}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<User>;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getMe();
  if (!user) redirect("/login");
  return user;
}
