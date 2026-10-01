import { requireAuth } from "@/lib/auth";
import Shell from "./Shell";

// Single auth gate for every top-level app route (/home, /missions,
// /vocabulary, /grammar, /listening, /speaking, /writing) — replaces the
// per-page inline cookie check the old dashboard/page.tsx duplicated.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <Shell>{children}</Shell>;
}
