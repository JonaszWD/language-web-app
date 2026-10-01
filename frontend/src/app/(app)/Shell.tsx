"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Icon } from "@/components/icons";
import { authApi } from "@/lib/api";
import type { User } from "@/types";
import TopDock from "./TopDock";
import "./spanishup-app.css";

// The old tab-driven `.screen.podcast` / `.screen.speaking` CSS hooks (full-
// bleed listening player, flex-column speaking chat) are keyed off route
// prefix now instead of a TabKey — every other route keeps the plain
// `.screen` base styling it always had.
function screenClassFor(pathname: string): string {
  if (pathname.startsWith("/listening")) return "screen podcast";
  if (pathname.startsWith("/speaking")) return "screen speaking";
  return "screen";
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Shared chrome for every /(app) route: background blobs, top dock/nav,
// dark-mode toggle, and the per-route "drift in" object build-in animation
// that used to fire on tab change and now fires on pathname change.
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    setProfileOpen(false);
    await authApi.logout().catch(() => {});
    router.push("/login");
  };

  // Same reasoning as the old `tab` state: default false on server + first
  // client render, then resolve the stored/system theme after mount.
  const [dark, setDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("sp-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate client-only theme after mount
    if (stored) setDark(stored === "dark");
    else setDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    setThemeReady(true);
  }, []);
  const bgRef = useRef<HTMLDivElement>(null);

  // Dark mode persists to localStorage so the shell stays consistent across screens.
  // Skip the first pass so we don't overwrite storage before it's read in.
  useEffect(() => {
    if (!themeReady) return;
    localStorage.setItem("sp-theme", dark ? "dark" : "light");
  }, [dark, themeReady]);

  // Object build-in: drift + fade each screen's top-level blocks on route change.
  const screenRef = useRef<HTMLDivElement>(null);
  const firstRoute = useRef(true);
  useEffect(() => {
    // Skip the initial load: suspended children may still be hydrating, and
    // mutating their classes now causes a hydration mismatch.
    if (firstRoute.current) { firstRoute.current = false; return; }
    const node = screenRef.current;
    if (!node) return;
    // Fragment screens render multiple top-level nodes; single-div screens wrap
    // their blocks one level deeper. Pick whichever holds the real blocks.
    const container = node.childElementCount > 1 ? node : node.firstElementChild;
    if (!container) return;
    const kids = Array.from(container.children) as HTMLElement[];
    kids.forEach((el, i) => {
      el.classList.remove("obj-in");
      el.classList.add("obj-anim", "m-drift");
      el.style.setProperty("--od", `${Math.min(i * 70, 480)}ms`);
    });
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      kids.forEach((el) => el.classList.add("obj-in"));
    }));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (bgRef.current) {
        bgRef.current.style.setProperty("--cgx", e.clientX + "px");
        bgRef.current.style.setProperty("--cgy", e.clientY + "px");
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className={"sp-root" + (dark ? " dark" : "")}>
      <div ref={bgRef} className="sp-bg" aria-hidden="true">
        <div className="sp-cursor-glow" />
        <div className="sp-blob b1" />
        <div className="sp-blob b2" />
        <div className="sp-blob b3" />
      </div>

      <div className="sp-app">
        <header className="sp-dock">
          <div className="dock-side dock-side-left">
            <Image src="/logo/plauda-fox.png" alt="" width={28} height={28} className="sp-dock-logo" priority />
            <span className="sp-dock-brand">Plauda</span>
          </div>

          <TopDock />

          <div className="dock-side dock-side-right">
            <div className="dock-chip dock-streak" title="Daily streak"><Flame size={16} /> 0</div>
            <button
              className="dock-chip"
              title="Profile"
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((o) => !o)}
            >
              <Icon name="user" size={15} />
            </button>
            <button className="dock-chip" title={dark ? "Light mode" : "Dark mode"} aria-label="Toggle dark and light mode" onClick={() => setDark((d) => !d)}>
              {dark ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="2" x2="12" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="4" y2="12" />
                    <line x1="20" y1="12" x2="22" y2="12" />
                    <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
                    <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
                    <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
                    <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
                  </g>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <main className="sp-main">
          <div className={screenClassFor(pathname)} key={pathname} ref={screenRef}>
            {children}
          </div>
        </main>
      </div>

      {profileOpen && (
        <div className="profile-overlay" onClick={() => setProfileOpen(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-header">
              <div className="profile-avatar"><Icon name="user" size={20} /></div>
              <div>
                <div className="profile-dd-email">{user?.email ?? "—"}</div>
                {user && <div className="profile-since">Member since {formatMemberSince(user.created_at)}</div>}
              </div>
            </div>

            {user && (
              <>
                <div className="profile-section-title">Learning</div>
                <div className="profile-row">
                  <span>Level</span>
                  <span className="profile-row-val">{user.cefr_level}</span>
                </div>
                <div className="profile-row">
                  <span>Streak</span>
                  <span className="profile-row-val">{user.streak_count} days</span>
                </div>

                <div className="profile-section-title">Preferences</div>
                <div className="profile-row">
                  <span>Focus skill</span>
                  <span className="profile-row-val">{user.skill_priority ?? "—"}</span>
                </div>
                <div className="profile-row">
                  <span>Motivation</span>
                  <span className="profile-row-val">{user.motivation ?? "—"}</span>
                </div>
              </>
            )}

            <div className="profile-section-title">Account</div>
            <button className="profile-dd-logout" onClick={handleLogout}>
              <Icon name="logout" size={14} />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
