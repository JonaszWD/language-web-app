"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

// The little building-covered planet — WebGL, browser-only.
const PlanetScene = dynamic(() => import("../planet/PlanetScene"), { ssr: false });
import { grammarApi, missionsApi, statsApi, studyApi, ttsApi, vocabApi, writingApi } from "@/lib/api";
import MissionGlobe from "./MissionGlobe";
import VocabTrainer from "@/components/VocabTrainer";
import GrammarLesson, { GRAMMAR_LESSONS as MISSION_GRAMMAR_LESSONS } from "@/components/GrammarLesson";
import ListeningLesson, { LISTENING_LESSONS as MISSION_LISTENING_LESSONS, audioTextsForScript } from "@/components/ListeningLesson";
import WritingLesson, { WRITING_LESSONS as MISSION_WRITING_LESSONS } from "@/components/WritingLesson";
import SpeakingTrainer from "@/components/SpeakingTrainer";
import type { ApiMission, DashboardStats, MissionSpeaking, RewriteStyle, SpeakingScene, VocabDetail, VocabListItem, WritingFeedback } from "@/types";
import "./spanishup-app.css";

/* ════════════════════════ Icons ════════════════════════ */
function Icon({ name, size = 24, style }: { name: string; size?: number; style?: CSSProperties }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    style,
    xmlns: "http://www.w3.org/2000/svg",
  };
  switch (name) {
    case "podcast":
      return (
        <svg {...p}>
          <rect x="9" y="2" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0h-2a4 4 0 0 1-8 0H6Z" />
          <path d="M11 18.9V22h2v-3.1a7 7 0 0 0 0 0Z" />
          <rect x="8" y="21" width="8" height="2" rx="1" />
        </svg>
      );
    case "grammar":
      return (
        <svg {...p}>
          <path d="M11 5.5C9.5 4.4 7.6 4 5.5 4 4.4 4 3.3 4.2 2.5 4.5 2.2 4.6 2 4.9 2 5.2v12.3c0 .5.5.9 1 .7.7-.2 1.6-.4 2.5-.4 2.1 0 4 .5 5.5 1.6V5.5Z" />
          <path d="M13 5.5C14.5 4.4 16.4 4 18.5 4c1.1 0 2.2.2 3 .5.3.1.5.4.5.7v12.3c0 .5-.5.9-1 .7-.7-.2-1.6-.4-2.5-.4-2.1 0-4 .5-5.5 1.6V5.5Z" />
        </svg>
      );
    case "home":
      return (
        <svg {...p}>
          <path d="M11.3 2.7a1 1 0 0 1 1.4 0l8 7.4c.2.2.3.5.3.8V20a2 2 0 0 1-2 2h-3.5v-5.5a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1V22H6a2 2 0 0 1-2-2v-9.1c0-.3.1-.6.3-.8l7-6.4Z" />
        </svg>
      );
    case "vocabulary":
      return (
        <svg {...p}>
          <rect x="6" y="3" width="13" height="15" rx="3" opacity=".4" />
          <rect x="3" y="6" width="13" height="15" rx="3" />
        </svg>
      );
    case "writing":
      return (
        <svg {...p}>
          <path d="M14.8 4.2 19.8 9.2 9 20H4v-5L14.8 4.2Z" />
          <path d="M16.2 2.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8l-1 1-5-5 1-1Z" />
        </svg>
      );
    case "play":
      return <svg {...p}><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.7L8.5 3.6A1 1 0 0 0 7 4.5Z" /></svg>;
    case "pause":
      return <svg {...p}><rect x="6" y="4" width="4.5" height="16" rx="1.5" /><rect x="13.5" y="4" width="4.5" height="16" rx="1.5" /></svg>;
    case "back15":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9a8 8 0 1 1-1 4" /><path d="M4 4v5h5" /></svg>;
    case "fwd15":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9a8 8 0 1 0 1 4" /><path d="M20 4v5h-5" /></svg>;
    case "bookmark":
      return <svg {...p}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" /></svg>;
    case "bookmark-o":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" /></svg>;
    case "speaker":
      return <svg {...p}><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 8.5a4 4 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
    case "plus":
      return <svg {...p}><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z" /></svg>;
    case "search":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>;
    case "spark":
      return <svg {...p}><path d="M12 2c.5 3.8 1.7 5 5.5 5.5-3.8.5-5 1.7-5.5 5.5-.5-3.8-1.7-5-5.5-5.5C10.3 7 11.5 5.8 12 2Z" /><path d="M18.5 13c.3 2 .9 2.6 3 3-2.1.4-2.7 1-3 3-.3-2-.9-2.6-3-3 2.1-.4 2.7-1 3-3Z" /></svg>;
    case "bolt":
      return <svg {...p}><path d="M13 2 4 13h6l-1 9 9-12h-6l1-8Z" /></svg>;
    case "check":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 6" /></svg>;
    case "chevron":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;
    case "filter":
      return <svg {...p}><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" /></svg>;
    case "list":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>;
    case "headphones":
      return <svg {...p}><path d="M4 13a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-7h2v-0a6 6 0 1 0-12 0v0h2v7H6a2 2 0 0 1-2-2v-5Z" /></svg>;
    case "apple":
      return <svg {...p}><path d="M16 2c.1 1.2-.4 2.3-1.1 3-.7.8-1.9 1.4-3 1.3-.1-1.1.4-2.3 1.1-3C13.7 2.5 15 1.9 16 2Zm3.5 16c-.5 1.2-.8 1.7-1.5 2.8-1 1.5-2.4 3.3-4 3.3-1.5 0-1.8-.9-3.8-.9s-2.4.9-3.8.9c-1.7 0-2.9-1.7-3.9-3.1C-.2 17.5-.6 12 1.6 9.2 2.7 7.8 4.4 7 6 7c1.6 0 2.7 1 3.8 1 1.1 0 1.9-1 3.9-1 1.4 0 3 .8 4 2.1-3.5 1.9-3 6.9.8 8.9Z" /></svg>;
    case "doc":
      return <svg {...p}><path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" opacity=".9" /><path d="M13 2v5h5" fill="rgba(255,255,255,.45)" /></svg>;
    case "target":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>;
    case "moon":
      return <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>;
    case "sun":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "coffee":
      return <svg {...p}><path d="M4 8h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="4" y="19" width="12" height="1.8" rx="0.9" /></svg>;
    case "plane":
      return <svg {...p}><path d="M21 14.5 13 12V5.5a1.5 1.5 0 0 0-3 0V12l-8 2.5v2l8-2v3.5l-2 1.3V21l3.5-1 3.5 1v-1.7l-2-1.3V14.5l8 2v-2Z" /></svg>;
    case "people":
      return <svg {...p}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.4" /><path d="M3 19a6 6 0 0 1 12 0v1H3v-1Z" /><path d="M15 20v-1a7 7 0 0 0-1.2-3.9A4.5 4.5 0 0 1 21 19v1h-6Z" /></svg>;
    case "globe":
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

/* Hand-drawn flame — navy body + teal droplet + spark */
function Flame({ size = 40, style }: { size?: number; style?: CSSProperties }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 56 64" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={"fo" + uid} x1="28" y1="5" x2="28" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2E4A77" />
          <stop offset="1" stopColor="#162A4D" />
        </linearGradient>
        <linearGradient id={"fi" + uid} x1="28" y1="30" x2="28" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#73F0D9" />
          <stop offset="1" stopColor="#33C8B3" />
        </linearGradient>
      </defs>
      <ellipse cx="28" cy="59" rx="15" ry="3.4" fill="#4DDFC4" opacity=".35" />
      <circle cx="13.5" cy="9" r="2.6" fill="#4DDFC4" />
      <path d="M28 57 C 15 57, 7 49, 7 38 C 7 29, 13 24, 17 18 C 19 15, 20 11, 19 6 C 24 9, 28 13, 28 19 C 31 13, 35 11, 39 14 C 47 20, 49 29, 49 38 C 49 49, 41 57, 28 57 Z" fill={"url(#fo" + uid + ")"} />
      <path d="M28 30 C 30 36, 36 39, 36 45 C 36 51, 32 54, 28 54 C 24 54, 20 51, 20 45 C 20 39, 26 36, 28 30 Z" fill={"url(#fi" + uid + ")"} />
    </svg>
  );
}

/* ════════════════════════ Types & nav ════════════════════════ */
type TabKey = "home" | "review" | "mission" | "podcast" | "speaking" | "grammar" | "vocabulary" | "writing";

const MAIN_TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "review", label: "Review" },
  { key: "mission", label: "Mission" },
];
const STUDY_TABS: { key: TabKey; label: string }[] = [
  { key: "podcast", label: "Listening" },
  { key: "speaking", label: "Speaking" },
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "writing", label: "Writing" },
];

// Tab is mirrored into the URL (?tab=) so browser Back from a real route
// (/vocab, /study) restores the tab the user left, not the default Home.
const ALL_TAB_KEYS: TabKey[] = [...MAIN_TABS, ...STUDY_TABS].map((t) => t.key);
function readTabFromUrl(): TabKey {
  if (typeof window === "undefined") return "home";
  const v = new URLSearchParams(window.location.search).get("tab") as TabKey | null;
  return v && ALL_TAB_KEYS.includes(v) ? v : "home";
}

function WordNav({ tab, setTab }: { tab: TabKey; setTab: (k: TabKey) => void }) {
  const inStudy = STUDY_TABS.some((t) => t.key === tab);
  const [open, setOpen] = useState(inStudy);
  const current = STUDY_TABS.find((t) => t.key === tab);
  return (
    <nav className="word-nav" onMouseLeave={() => setOpen(false)}>
      <span className="wn-handle" aria-hidden="true" />
      <div className="wn-body">
        {MAIN_TABS.map((tb) => (
          <button key={tb.key} className={"wn-item" + (tab === tb.key ? " is-active" : "")} onClick={() => { setTab(tb.key); setOpen(false); }}>
            {tb.label}
          </button>
        ))}
        <button className={"wn-item wn-group" + (inStudy ? " is-active" : "")} onClick={() => setOpen((o) => !o)}>
          Studying{inStudy && current ? <span className="wn-sub-current"> · {current.label}</span> : ""}
          <span className={"wn-caret" + (open ? " up" : "")}><Icon name="chevron" size={14} /></span>
        </button>
        {open && (
          <div className="wn-submenu">
            {STUDY_TABS.map((tb) => (
              <button key={tb.key} className={"wn-subitem" + (tab === tb.key ? " is-active" : "")} onClick={() => setTab(tb.key)}>
                {tb.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

/* ════════════════════════ HOME ════════════════════════
   Not navigation — a coach. Answers "what should I practice now?":
   headline metrics, due-by-skill, and a ready-made timed session. */
// The 7 tracked skill dimensions, in the order they're shown on the home
// screen's breakdown card. Keys must match the backend's UserSkillStats.skill.
const SKILL_ROWS: { key: string; label: string; ic: string }[] = [
  { key: "recognition", label: "Recognition", ic: "target" },
  { key: "recall", label: "Recall", ic: "vocabulary" },
  { key: "pronunciation", label: "Pronunciation", ic: "speaker" },
  { key: "listening", label: "Listening", ic: "headphones" },
  { key: "grammar", label: "Grammar", ic: "grammar" },
  { key: "writing", label: "Writing", ic: "writing" },
  { key: "conversation", label: "Conversation", ic: "people" },
];

function SkillsBreakdown({ stats }: { stats: DashboardStats | null }) {
  return (
    <div className="sp-card hm-skills">
      <div className="sp-section-label" style={{ margin: "0 0 6px" }}><h2 className="sp-h2">Skills breakdown</h2></div>
      {SKILL_ROWS.map((s) => {
        const row = stats?.skills?.[s.key];
        const attempts = row?.attempts ?? 0;
        const pct = attempts ? Math.round(row!.accuracy * 100) : 0;
        return (
          <div className="hm-skill-row" key={s.key}>
            <span className="hm-due-ico"><Icon name={s.ic} size={18} /></span>
            <span className="hm-due-lbl">{s.label}</span>
            <div className="hm-skill-bar sp-progress"><i style={{ width: `${pct}%` }} /></div>
            <span className={"hm-skill-pct" + (attempts === 0 ? " zero" : "")}>
              {attempts ? `${pct}%` : "—"}
            </span>
            <span className="hm-skill-attempts">{attempts} {attempts === 1 ? "attempt" : "attempts"}</span>
          </div>
        );
      })}
    </div>
  );
}

function HomeScreen({ go, onReview }: { go: (k: TabKey) => void; onReview: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => { statsApi.dashboard().then(setStats).catch(() => {}); }, []);

  // Fresh account — everything starts at zero until the first session.
  const due: { label: string; count: number; ic: string; act: () => void }[] = [
    { label: "Words", count: 0, ic: "vocabulary", act: onReview },
    { label: "Grammar", count: 0, ic: "grammar", act: () => go("grammar") },
    { label: "Listening", count: 0, ic: "podcast", act: () => go("podcast") },
    { label: "Speaking", count: 0, ic: "speaker", act: () => go("speaking") },
    { label: "Writing", count: 0, ic: "writing", act: () => go("writing") },
  ];
  const totalDue = due.reduce((s, d) => s + d.count, 0);

  // Today's auto-built session — the user never has to decide.
  const session: { mins: number; name: string; ic: string; act: () => void }[] = [
    { mins: 5, name: "Vocabulary Review", ic: "vocabulary", act: onReview },
    { mins: 8, name: "Listening", ic: "podcast", act: () => go("podcast") },
    { mins: 5, name: "Speaking", ic: "speaker", act: () => go("speaking") },
    { mins: 5, name: "Grammar", ic: "grammar", act: () => go("grammar") },
    { mins: 2, name: "Writing", ic: "writing", act: () => go("writing") },
  ];
  const totalMin = session.reduce((s, b) => s + b.mins, 0);

  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>¡Bienvenida! · Day one</p>
        <h1 className="sp-h1">Here&apos;s your first {totalMin} minutes.</h1>
      </div>

      {/* headline metrics — fresh account: all zero */}
      <div className="hm-metrics">
        <div className="sp-card hm-metric xp">
          <div className="hm-m-ico"><Icon name="bolt" size={20} /></div>
          <div className="hm-m-num">0<small> / 50</small></div>
          <div className="hm-m-lbl">Daily XP</div>
          <div className="sp-progress"><i style={{ width: "0%" }} /></div>
        </div>
        <div className="sp-card hm-metric streak">
          <div className="hm-m-flame"><Flame size={34} /></div>
          <div className="hm-m-num">0<small> days</small></div>
          <div className="hm-m-lbl">Streak</div>
          <div className="hm-m-meta">Start your streak today</div>
        </div>
        <div className="sp-card hm-metric ret">
          <div className="hm-m-ico"><Icon name="target" size={20} /></div>
          <div className="hm-m-num"><span className="hm-m-empty">Not yet</span></div>
          <div className="hm-m-lbl">Retention</div>
          <div className="hm-m-meta">No reviews yet</div>
        </div>
        <div className="sp-card hm-metric due" onClick={onReview}>
          <div className="hm-m-ico"><Icon name="vocabulary" size={20} /></div>
          <div className="hm-m-num">{totalDue}</div>
          <div className="hm-m-lbl">Items due today</div>
          <div className="hm-m-meta">Nothing due yet</div>
        </div>
      </div>

      <div className="hm-cols">
        {/* due by skill */}
        <div className="sp-card hm-due">
          <div className="sp-section-label" style={{ margin: "0 0 6px" }}><h2 className="sp-h2">Due by skill</h2></div>
          {due.map((d) => (
            <button className="hm-due-row" key={d.label} onClick={d.act}>
              <span className="hm-due-ico"><Icon name={d.ic} size={18} /></span>
              <span className="hm-due-lbl">{d.label}</span>
              <span className={"hm-due-count" + (d.count === 0 ? " zero" : "")}>{d.count}</span>
              <span className="hm-due-chev"><Icon name="chevron" size={16} /></span>
            </button>
          ))}
        </div>

        {/* today's session — the plan */}
        <div className="sp-card hm-session">
          <div className="hm-session-head">
            <div>
              <div className="sp-eyebrow">Today&apos;s session</div>
              <div className="hm-session-time">{totalMin} min · {session.length} blocks</div>
            </div>
            <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => session[0].act()}>
              <Icon name="play" size={16} /> Start
            </button>
          </div>
          <div className="hm-blocks">
            {session.map((b, i) => (
              <button className="hm-block" key={i} onClick={b.act}>
                <span className="hm-block-min">{b.mins}<small>min</small></span>
                <span className="hm-block-ico"><Icon name={b.ic} size={18} /></span>
                <span className="hm-block-name">{b.name}</span>
                <span className="hm-block-chev"><Icon name="chevron" size={16} /></span>
              </button>
            ))}
          </div>
          <p className="hm-session-foot">Auto-built from what&apos;s due. You never have to decide.</p>
        </div>
      </div>

      <SkillsBreakdown stats={stats} />
    </div>
  );
}

/* ════════════════════════ PODCAST ════════════════════════ */
type Episode = { id: string; title: string; dur: string; level: string; date: string };
type Pod = { id: string; title: string; author: string; letter: string; color: string; episodes: Episode[] };

const POD_LIST: Pod[] = [
  { id: "ra", title: "Radio Ambulante", author: "NPR · Daniel Alarcón", letter: "R", color: "linear-gradient(150deg,#1C3050,#3A6098)",
    episodes: [
      { id: "ra142", title: "El viaje de los abuelos", dur: "29:50", level: "B1", date: "Jun 12" },
      { id: "ra141", title: "La carta que nunca llegó", dur: "24:18", level: "B1", date: "Jun 5" },
      { id: "ra140", title: "Voces del mar", dur: "31:02", level: "B2", date: "May 29" },
    ] },
  { id: "nm", title: "Notes in Spanish", author: "Ben & Marina", letter: "N", color: "linear-gradient(150deg,#18B89D,#4DDFC4)",
    episodes: [
      { id: "nm-a", title: "En el mercado", dur: "21:10", level: "A2", date: "Jun 10" },
      { id: "nm-b", title: "Planes para el verano", dur: "19:40", level: "A2", date: "Jun 3" },
    ] },
  { id: "esp", title: "Españolistos", author: "Andrea & Nate", letter: "E", color: "linear-gradient(150deg,#3A6098,#4DDFC4)",
    episodes: [
      { id: "esp388", title: "La cultura del café", dur: "34:02", level: "B1", date: "Jun 8" },
      { id: "esp387", title: "Modismos muy comunes", dur: "28:55", level: "B2", date: "Jun 1" },
    ] },
  { id: "hoy", title: "Hoy Hablamos", author: "Roi Marqués", letter: "H", color: "linear-gradient(150deg,#243B63,#18B89D)",
    episodes: [{ id: "hoy1450", title: "El tiempo libre", dur: "12:45", level: "A2", date: "Jun 11" }] },
  { id: "cf", title: "Coffee Break Spanish", author: "Mark Pentleton", letter: "C", color: "linear-gradient(150deg,#16223C,#3A6098)",
    episodes: [{ id: "cf-s4", title: "En el restaurante", dur: "25:30", level: "A2", date: "Jun 7" }] },
];

const DICT: Record<string, [string, string, string]> = {
  viaje: ["el viaje", "the journey / trip", "noun"], abuelos: ["los abuelos", "the grandparents", "noun"],
  historia: ["la historia", "the story / history", "noun"], empieza: ["empezar", "to begin", "verb"],
  pueblo: ["el pueblo", "the town / village", "noun"], "pequeño": ["pequeño", "small", "adj"],
  "montañas": ["las montañas", "the mountains", "noun"], recuerda: ["recordar", "to remember", "verb"],
  siempre: ["siempre", "always", "adverb"], primera: ["primero", "first", "adj"],
  vez: ["la vez", "the time / occasion", "noun"], "cruzó": ["cruzar", "to cross", "verb"],
  frontera: ["la frontera", "the border", "noun"], joven: ["joven", "young", "adj"],
  trabajo: ["el trabajo", "the work / job", "noun"], familia: ["la familia", "the family", "noun"],
  "dejó": ["dejar", "to leave (behind)", "verb"], "atrás": ["atrás", "behind", "adverb"],
  esperanza: ["la esperanza", "the hope", "noun"], futuro: ["el futuro", "the future", "noun"],
  mejor: ["mejor", "better / best", "adj"], noche: ["la noche", "the night", "noun"],
  estrellas: ["las estrellas", "the stars", "noun"], camino: ["el camino", "the path / road", "noun"],
  largo: ["largo", "long", "adj"],
};

const TRANSCRIPT = [
  { time: "00:00", speaker: "Narrador", text: "Esta es la historia de un viaje que empieza en un pueblo pequeño entre las montañas." },
  { time: "00:11", speaker: "Narrador", text: "Mi abuela siempre recuerda la primera vez que cruzó la frontera, muy joven, en busca de trabajo." },
  { time: "00:24", speaker: "Elena", text: "Dejó a su familia atrás, pero llevaba consigo una esperanza enorme por un futuro mejor." },
  { time: "00:37", speaker: "Narrador", text: "Cada noche, bajo las estrellas, pensaba en el largo camino que todavía le faltaba por recorrer." },
  { time: "00:52", speaker: "Elena", text: "Aquel pueblo pequeño quedó atrás, pero nunca dejó de vivir en su memoria y en cada historia que contaba." },
  { time: "01:08", speaker: "Narrador", text: "Hoy, esa misma esperanza cruza las montañas con nosotros, recordando de dónde venimos." },
];

// Interactive comprehension checkpoints — the player pauses at these transcript
// lines and asks prediction/meaning questions (prediction boosts comprehension).
const CHECKPOINTS: Record<number, { happened: string; word: string; meaning: string; predict: string }> = {
  1: {
    happened: "The grandmother crossed the border when she was young, looking for work.",
    word: "frontera", meaning: "border",
    predict: "Will she find what she's looking for? What does she leave behind?",
  },
  3: {
    happened: "Every night under the stars she thought about the long road still ahead.",
    word: "camino", meaning: "path / road",
    predict: "How does the journey end? Does the small town stay with her?",
  },
};

function PodcastScreen({ saved, onSave }: { saved: string[]; onSave: (w: string) => void }) {
  const [checkpoint, setCheckpoint] = useState<number | null>(null);
  const asked = useRef<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ ra: true });
  const [sel, setSel] = useState({ podId: "ra", epId: "ra142" });
  const [playing, setPlaying] = useState(false);
  const [popId, setPopId] = useState<string | null>(null);
  const [karaoke, setKaraoke] = useState(-1);
  const [connOpen, setConnOpen] = useState(false);

  const lines = TRANSCRIPT.map((ln) => ({
    ...ln,
    tokens: ln.text.split(/(\s+)/).map((tok) => {
      if (/^\s+$/.test(tok)) return { space: true, raw: tok, clean: "", hasDef: false };
      const clean = tok.toLowerCase().replace(/[.,;:¿?¡!"']/g, "");
      return { space: false, raw: tok, clean, hasDef: !!DICT[clean] };
    }),
  }));

  const flat = lines.reduce<string[]>((acc, ln, li) => {
    ln.tokens.forEach((tk, ti) => {
      if (!tk.space) acc.push(`${li}-${ti}`);
    });
    return acc;
  }, []);

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => setKaraoke((k) => (k + 1 >= flat.length ? 0 : k + 1)), 360);
    return () => clearInterval(iv);
  }, [playing, flat.length]);

  useEffect(() => {
    const h = () => { setPopId(null); setConnOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const currentLine = karaoke >= 0 && playing ? Number(flat[karaoke]?.split("-")[0]) : -1;

  // Pause-and-ask: when playback reaches a checkpoint line, stop and prompt.
  useEffect(() => {
    if (currentLine >= 0 && CHECKPOINTS[currentLine] && !asked.current.has(currentLine)) {
      asked.current.add(currentLine);
      setPlaying(false);
      setCheckpoint(currentLine);
    }
  }, [currentLine]);

  const resume = () => { setCheckpoint(null); setPlaying(true); };

  const pod = POD_LIST.find((p) => p.id === sel.podId) || POD_LIST[0];
  const ep = pod.episodes.find((e) => e.id === sel.epId) || pod.episodes[0];

  const onPodHead = (pid: string) => {
    if (collapsed) { setCollapsed(false); setOpen((o) => ({ ...o, [pid]: true })); return; }
    setOpen((o) => ({ ...o, [pid]: !o[pid] }));
  };
  const pickEp = (pid: string, eid: string) => { setSel({ podId: pid, epId: eid }); setOpen((o) => ({ ...o, [pid]: true })); };

  return (
    <div className="pod-page">
      <div className="pod-player">
        <div className="pp-cover" style={{ background: pod.color }}>{pod.letter}</div>
        <div className="pp-now">
          <div className="pp-eyebrow">
            {playing ? <span className="pp-eq"><i /><i /><i /></span> : <span className="pp-pausedot" />}
            {playing ? "Now playing" : "Paused"}
          </div>
          <div className="pp-track-title">{ep.title}</div>
          <div className="pp-track-show">{pod.title}</div>
        </div>

        <div className="pp-transport">
          <button className="pp-ctrl" title="Back 15s"><Icon name="back15" size={20} /></button>
          <button className="pp-ctrl pp-play" onClick={() => setPlaying((p) => !p)}>
            <Icon name={playing ? "pause" : "play"} size={20} />
          </button>
          <button className="pp-ctrl" title="Forward 15s"><Icon name="fwd15" size={20} /></button>
        </div>

        <div className="pp-scrub">
          <span className="pp-time">18:24</span>
          <div className="sp-progress" style={{ flex: 1 }}><i style={{ width: "62%" }} /></div>
          <span className="pp-time">{ep.dur}</span>
        </div>

        <button className="pp-speed">1.0×</button>

        <div className="conn-wrap">
          <button className={"conn-btn" + (connOpen ? " is-open" : "")} onClick={(e) => { e.stopPropagation(); setConnOpen((o) => !o); }}>
            <span className="ap-mini"><Icon name="apple" size={16} /></span>
            <span className="conn-btn-label">Apple Podcasts</span>
            <span className="conn-dot" />
            <span className={"conn-chev" + (connOpen ? " up" : "")}><Icon name="chevron" size={15} /></span>
          </button>
          {connOpen && (
            <div className="pod-conn-dd" onClick={(e) => e.stopPropagation()}>
              <div className="dd-head">
                <div className="ap-mark"><Icon name="apple" size={20} /></div>
                <div>
                  <div className="dd-title">Apple Podcasts</div>
                  <div className="dd-status"><span className="conn-dot" /> Connected</div>
                </div>
              </div>
              <div className="dd-rows">
                <div className="dd-row"><span>Last synced</span><b>4 min ago</b></div>
                <div className="dd-row"><span>Shows imported</span><b>5</b></div>
                <div className="dd-row"><span>Auto-transcribe</span><b className="on">On</b></div>
              </div>
              <div className="dd-actions">
                <button className="sp-btn sp-btn-ghost" style={{ flex: 1, minHeight: 40, fontSize: 13 }}><Icon name="headphones" size={15} /> Manage</button>
                <button className="dd-disconnect">Disconnect</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={"pod-body" + (collapsed ? " rail-collapsed" : "")}>
        <aside className="pod-rail">
          <div className="rail-head">
            <span className="rail-head-txt">Your library <span className="rail-count">{POD_LIST.length}</span></span>
            <button className="rail-collapse" onClick={() => setCollapsed((c) => !c)} title={collapsed ? "Expand" : "Collapse"}>
              <Icon name="chevron" size={16} />
            </button>
          </div>
          <div className="rail-scroll">
            {POD_LIST.map((p) => (
              <div className={"rail-pod" + (open[p.id] ? " is-open" : "")} key={p.id}>
                <button className="rail-pod-head" onClick={() => onPodHead(p.id)} title={p.title}>
                  <span className="rp-cover" style={{ background: p.color }}>
                    {p.letter}
                    {p.id === "ra" && <span className="rp-badge" />}
                  </span>
                  <span className="rp-txt">
                    <span className="rp-title">{p.title}</span>
                    <span className="rp-author">{p.author}</span>
                  </span>
                  <span className="rp-chev"><Icon name="chevron" size={16} /></span>
                </button>
                {open[p.id] && !collapsed && (
                  <div className="rail-eps">
                    {p.episodes.map((e) => (
                      <button
                        key={e.id}
                        className={"rail-ep" + (sel.podId === p.id && sel.epId === e.id ? " is-active" : "")}
                        onClick={() => pickEp(p.id, e.id)}
                      >
                        <span className="rail-ep-ico">
                          <Icon name={sel.podId === p.id && sel.epId === e.id && playing ? "pause" : "play"} size={12} />
                        </span>
                        <span className="rail-ep-body">
                          <span className="rail-ep-title">{e.title}</span>
                          <span className="rail-ep-meta">{e.date} · {e.dur} · <b>{e.level}</b></span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button className="rail-add"><Icon name="plus" size={15} /> <span>Import a podcast</span></button>
          </div>
        </aside>

        <section className="pod-stage">
          <div className="stage-head">
            <div className="stage-cover" style={{ background: pod.color }}>{pod.letter}</div>
            <div className="stage-info">
              <div className="stage-show">{pod.title}</div>
              <div className="stage-title">{ep.title}</div>
              <div className="stage-sub">
                <span>{ep.dur}</span><span>·</span><span>1,240 words</span><span>·</span><span className="lvl">{ep.level} level</span>
              </div>
            </div>
            <div className="stage-tools">
              <button className="stage-tool" title="Reflect now" onClick={() => { setPlaying(false); setCheckpoint(currentLine >= 0 && CHECKPOINTS[currentLine] ? currentLine : 1); }}><Icon name="spark" size={18} /></button>
              <button className="stage-tool" title="Transcript settings"><Icon name="list" size={18} /></button>
              <button className="stage-tool" title="Bookmark episode"><Icon name="bookmark-o" size={18} /></button>
            </div>
          </div>

          {checkpoint !== null && CHECKPOINTS[checkpoint] && (
            <div className="ls-checkpoint">
              <div className="ls-cp-head"><Icon name="spark" size={16} /> Comprehension checkpoint</div>
              <ReflectQ q="What happened?" reveal={CHECKPOINTS[checkpoint].happened} />
              <ReflectQ q={`What does “${CHECKPOINTS[checkpoint].word}” mean?`} reveal={CHECKPOINTS[checkpoint].meaning} />
              <ReflectQ q="What will happen next?" reveal={CHECKPOINTS[checkpoint].predict} predict />
              <div className="ls-cp-foot">
                <span className="sp-sub" style={{ fontSize: 13 }}>Predicting before you hear it boosts comprehension.</span>
                <button className="sp-btn sp-btn-primary" style={{ minHeight: 42 }} onClick={resume}><Icon name="play" size={16} /> Continue</button>
              </div>
            </div>
          )}

          <div className="stage-scroll">
            <div className="transcript">
              {lines.map((ln, li) => (
                <div className={"tr-line" + (li === currentLine ? " is-current" : "")} key={li}>
                  <span className="tr-time">{ln.time}</span>
                  <div className="tr-text">
                    <span className="tr-speaker">{ln.speaker}</span>
                    {ln.tokens.map((tk, ti) => {
                      if (tk.space) return <span key={ti}>{tk.raw}</span>;
                      const id = `${li}-${ti}`;
                        const isPlay = playing && flat[karaoke] === id;
                      const isSaved = saved.includes(tk.clean);
                      const def = DICT[tk.clean];
                      return (
                        <span
                          key={ti}
                          className={"w" + (isPlay ? " is-playing" : "") + (isSaved ? " is-saved" : "") + (popId === id ? " is-pop" : "")}
                          onClick={(e) => { e.stopPropagation(); setPopId(popId === id ? null : id); }}
                        >
                          {tk.raw}
                          {popId === id && (
                            <span className="w-pop" onClick={(e) => e.stopPropagation()}>
                              <span className="wp-es">{def ? def[0] : tk.raw}
                                {def && <span className="wp-pos">{def[2]}</span>}
                              </span>
                              <span className="wp-en">{def ? def[1] : "Tap to translate · add to vocabulary"}</span>
                              <span className="wp-actions">
                                <button className="wp-btn listen"><Icon name="speaker" size={14} /> Listen</button>
                                <button className="wp-btn save" onClick={() => { onSave(tk.clean); setPopId(null); }}>
                                  <Icon name={isSaved ? "check" : "bookmark"} size={14} /> {isSaved ? "Saved" : "Save"}
                                </button>
                              </span>
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="transcript-foot">Tap any word to translate it · {saved.length} saved to vocabulary</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ReflectQ({ q, reveal, predict }: { q: string; reveal: string; predict?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ls-reflectq">
      <button className="ls-rq-q" onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <span className={"conn-chev" + (open ? " up" : "")}><Icon name="chevron" size={14} /></span>
      </button>
      {open && <div className={"ls-rq-a" + (predict ? " predict" : "")}>{reveal}</div>}
    </div>
  );
}

/* ════════════════════════ GRAMMAR ════════════════════════
   Acquisition flow, not a textbook:  Notice → Understand → Practice → Produce
   (+ error correction inside Practice). */
type GrNotice = { es: string; en: string; hl: string };
type GrEnding = { pron: string; stem: string; end: string };
type GrItem =
  | { kind: "mc"; before: string; after: string; en: string; options: string[]; answer: number }
  | { kind: "blank"; before: string; after: string; en: string; answer: string }
  | { kind: "transform"; instruction: string; source: string; en: string; answer: string }
  | { kind: "error"; sentence: string; bad: string; correct: string; why: string };
type GrLesson = {
  id: string; chip: string; verb: string; gloss: string; focus: string;
  notice: GrNotice[]; explain: string; endings: GrEnding[];
  items: GrItem[]; produce: { prompt: string; en: string; instruction: string };
};

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,!?¡¿]/g, "");

const GRAMMAR_LESSONS: GrLesson[] = [
  {
    id: "ar", chip: "Present · -AR", verb: "hablar", gloss: "to speak", focus: "Present tense, regular -AR verbs",
    notice: [
      { es: "Yo hablo español.", en: "I speak Spanish.", hl: "hablo" },
      { es: "Ella habla rápido.", en: "She speaks fast.", hl: "habla" },
      { es: "Nosotros hablamos mucho.", en: "We talk a lot.", hl: "hablamos" },
    ],
    explain: "Drop -ar from the infinitive, add the ending for the person. The stem (habl-) stays put.",
    endings: [
      { pron: "yo", stem: "habl", end: "o" }, { pron: "tú", stem: "habl", end: "as" },
      { pron: "él / ella", stem: "habl", end: "a" }, { pron: "nosotros", stem: "habl", end: "amos" },
      { pron: "vosotros", stem: "habl", end: "áis" }, { pron: "ellos", stem: "habl", end: "an" },
    ],
    items: [
      { kind: "mc", before: "Cada mañana, tú ", after: " con tus amigos.", en: "Every morning, you ___ with your friends.", options: ["hablo", "hablas", "habla", "hablamos"], answer: 1 },
      { kind: "blank", before: "Nosotros ", after: " inglés en clase.", en: "We ___ English in class.", answer: "hablamos" },
      { kind: "transform", instruction: "Rewrite for «ella»:", source: "Yo trabajo aquí.", en: "I work here. → She works here.", answer: "ella trabaja aqui" },
      { kind: "error", sentence: "Yo habla español.", bad: "habla", correct: "hablo", why: "«yo» takes -o, not -a." },
    ],
    produce: { prompt: "Describe tu mañana.", en: "Describe your morning.", instruction: "Use at least five present-tense verbs." },
  },
  {
    id: "er", chip: "Present · -ER", verb: "comer", gloss: "to eat", focus: "Present tense, regular -ER verbs",
    notice: [
      { es: "Yo como a las dos.", en: "I eat at two.", hl: "como" },
      { es: "Él come pan.", en: "He eats bread.", hl: "come" },
      { es: "Nosotros comemos juntos.", en: "We eat together.", hl: "comemos" },
    ],
    explain: "Same idea as -ar, but the endings use e: -o, -es, -e, -emos, -éis, -en.",
    endings: [
      { pron: "yo", stem: "com", end: "o" }, { pron: "tú", stem: "com", end: "es" },
      { pron: "él / ella", stem: "com", end: "e" }, { pron: "nosotros", stem: "com", end: "emos" },
      { pron: "vosotros", stem: "com", end: "éis" }, { pron: "ellos", stem: "com", end: "en" },
    ],
    items: [
      { kind: "mc", before: "¿Tú ", after: " carne?", en: "Do you eat meat?", options: ["como", "comes", "come", "comen"], answer: 1 },
      { kind: "blank", before: "Ellos ", after: " en el parque.", en: "They eat in the park.", answer: "comen" },
      { kind: "error", sentence: "Nosotros comen pizza.", bad: "comen", correct: "comemos", why: "«nosotros» takes -emos." },
    ],
    produce: { prompt: "¿Qué comes en un día normal?", en: "What do you eat in a normal day?", instruction: "Use at least four -er or -ir verbs." },
  },
  {
    id: "ir", chip: "Present · -IR", verb: "vivir", gloss: "to live", focus: "Present tense, regular -IR verbs",
    notice: [
      { es: "Yo vivo en Madrid.", en: "I live in Madrid.", hl: "vivo" },
      { es: "Ella vive sola.", en: "She lives alone.", hl: "vive" },
      { es: "Vosotros vivís cerca.", en: "You all live nearby.", hl: "vivís" },
    ],
    explain: "Almost identical to -er. Only nosotros (-imos) and vosotros (-ís) differ.",
    endings: [
      { pron: "yo", stem: "viv", end: "o" }, { pron: "tú", stem: "viv", end: "es" },
      { pron: "él / ella", stem: "viv", end: "e" }, { pron: "nosotros", stem: "viv", end: "imos" },
      { pron: "vosotros", stem: "viv", end: "ís" }, { pron: "ellos", stem: "viv", end: "en" },
    ],
    items: [
      { kind: "mc", before: "Nosotros ", after: " en España.", en: "We live in Spain.", options: ["vivo", "vives", "vivimos", "viven"], answer: 2 },
      { kind: "blank", before: "¿Dónde ", after: " tú?", en: "Where do you live?", answer: "vives" },
      { kind: "error", sentence: "Yo vives aquí.", bad: "vives", correct: "vivo", why: "«yo» takes -o." },
    ],
    produce: { prompt: "Describe dónde vives.", en: "Describe where you live.", instruction: "Use at least four present-tense verbs." },
  },
];

type GrStage = "notice" | "understand" | "practice" | "produce";
const GR_STAGES: { key: GrStage; label: string }[] = [
  { key: "notice", label: "Notice" }, { key: "understand", label: "Understand" },
  { key: "practice", label: "Practice" }, { key: "produce", label: "Produce" },
];

function GrammarScreen() {
  const [lessonId, setLessonId] = useState(GRAMMAR_LESSONS[0].id);
  const [stage, setStage] = useState<GrStage>("notice");
  const lesson = GRAMMAR_LESSONS.find((l) => l.id === lessonId) || GRAMMAR_LESSONS[0];

  const pickLesson = (id: string) => { setLessonId(id); setStage("notice"); };

  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Grammar · {lesson.focus}</p>
        <h1 className="sp-h1">{lesson.verb} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {lesson.gloss}</span></h1>
      </div>

      <div className="gr-tools">
        {GRAMMAR_LESSONS.map((l) => (
          <span key={l.id} className={"sp-chip" + (l.id === lessonId ? " is-active" : "")} onClick={() => pickLesson(l.id)}>{l.chip}</span>
        ))}
      </div>

      <div className="gr-stepper">
        {GR_STAGES.map((s, i) => (
          <button key={s.key} className={"gr-step" + (s.key === stage ? " is-active" : "")} onClick={() => setStage(s.key)}>
            <span className="gr-step-n">{i + 1}</span>{s.label}
          </button>
        ))}
      </div>

      {stage === "notice" && <GrNoticeStage lesson={lesson} onNext={() => setStage("understand")} />}
      {stage === "understand" && <GrUnderstandStage lesson={lesson} onNext={() => setStage("practice")} />}
      {stage === "practice" && <GrPracticeStage lesson={lesson} onNext={() => setStage("produce")} />}
      {stage === "produce" && <GrProduceStage lesson={lesson} />}
    </div>
  );
}

function GrNoticeStage({ lesson, onNext }: { lesson: GrLesson; onNext: () => void }) {
  // Split each sentence so the highlighted ending stands out.
  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Read these. What changes? Notice the verb endings.</p>
      <div className="gr-notice-list">
        {lesson.notice.map((n, i) => {
          const idx = n.es.toLowerCase().indexOf(n.hl.toLowerCase());
          const pre = n.es.slice(0, idx);
          const post = n.es.slice(idx + n.hl.length);
          return (
            <div className="gr-notice" key={i}>
              <div className="gr-notice-es">
                {pre}<mark>{n.hl}</mark>{post}
                <button className="vo-speak" onClick={() => speakEs(n.es)} title="Listen"><Icon name="speaker" size={16} /></button>
              </div>
              <div className="gr-notice-en">{n.en}</div>
            </div>
          );
        })}
      </div>
      <button className="sp-btn sp-btn-primary" onClick={onNext}>Got it — why? <Icon name="chevron" size={16} /></button>
    </div>
  );
}

function GrUnderstandStage({ lesson, onNext }: { lesson: GrLesson; onNext: () => void }) {
  return (
    <div className="gr-grid">
      <div className="sp-card gr-stage-card">
        <p className="gr-stage-hint">The rule, in one breath:</p>
        <p className="gr-explain">{lesson.explain}</p>
        <button className="sp-btn sp-btn-primary" onClick={onNext}>Practice it <Icon name="chevron" size={16} /></button>
      </div>
      <div className="sp-card gr-table">
        <h4>{lesson.verb} · endings</h4>
        {lesson.endings.map((e, i) => (
          <div className="conj-row" key={i}>
            <span className="conj-pron">{e.pron}</span>
            <span className="conj-form">{e.stem}<b>{e.end}</b></span>
          </div>
        ))}
        <button className="sp-btn sp-btn-soft" style={{ width: "100%", marginTop: 14, minHeight: 42 }} onClick={() => speakEs(lesson.endings.map((e) => e.stem + e.end).join(", "))}>
          <Icon name="speaker" size={16} /> Hear all forms
        </button>
      </div>
    </div>
  );
}

function GrPracticeStage({ lesson, onNext }: { lesson: GrLesson; onNext: () => void }) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const item = lesson.items[idx];
  const last = idx === lesson.items.length - 1;
  const advance = () => { if (last) setDone(true); else setIdx(idx + 1); };

  return (
    <div className="sp-card gr-stage-card">
      <div className="gr-prog">
        <div className="sp-progress aqua" style={{ width: 140 }}>
          <i style={{ width: `${((idx + (done ? 1 : 0)) / lesson.items.length) * 100}%` }} />
        </div>
        <span className="gr-prog-txt">{Math.min(idx + 1, lesson.items.length)} / {lesson.items.length}</span>
      </div>

      {done ? (
        <div className="gr-done">
          <div className="gr-done-ico"><Icon name="check" size={26} /></div>
          <p className="gr-stage-hint" style={{ marginBottom: 14 }}>Controlled practice complete. Now make it yours.</p>
          <button className="sp-btn sp-btn-primary" onClick={onNext}>Produce <Icon name="chevron" size={16} /></button>
        </div>
      ) : (
        <GrItemView key={idx} item={item} onNext={advance} lastLabel={last ? "Finish" : "Next"} />
      )}
    </div>
  );
}

function GrItemView({ item, onNext, lastLabel }: { item: GrItem; onNext: () => void; lastLabel: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [clicked, setClicked] = useState<string | null>(null);

  const kindTag: Record<GrItem["kind"], string> = {
    mc: "Multiple choice", blank: "Fill the blank", transform: "Transform", error: "Find the mistake",
  };

  let correct = false;
  if (item.kind === "mc") correct = picked === item.answer;
  else if (item.kind === "blank" || item.kind === "transform") correct = norm(typed) === norm(item.answer);
  else if (item.kind === "error") correct = clicked === item.bad;

  const checked = item.kind === "error" ? clicked !== null : revealed;

  return (
    <div className="gr-item">
      <span className="sp-tag ghost gr-kind">{kindTag[item.kind]}</span>

      {item.kind === "mc" && (
        <>
          <div className="gr-prompt">
            {item.before}<span className="blank">{picked !== null ? item.options[picked] : "_____"}</span>{item.after}
            <span className="en">{item.en}</span>
          </div>
          <div className="gr-answers">
            {item.options.map((o, i) => (
              <button
                key={i}
                className={"gr-answer" + (checked && i === item.answer ? " correct" : "") + (checked && picked === i && i !== item.answer ? " wrong" : "")}
                onClick={() => { if (!checked) { setPicked(i); setRevealed(true); } }}
              >
                <span className="key">{String.fromCharCode(65 + i)}</span>{o}
                {checked && i === item.answer && <span style={{ marginLeft: "auto" }}><Icon name="check" size={18} /></span>}
              </button>
            ))}
          </div>
        </>
      )}

      {(item.kind === "blank" || item.kind === "transform") && (
        <>
          <div className="gr-prompt">
            {item.kind === "blank"
              ? <>{item.before}<span className="blank">{typed || "_____"}</span>{item.after}</>
              : <><b>{item.instruction}</b> <span style={{ display: "block", marginTop: 6 }}>{item.source}</span></>}
            <span className="en">{item.en}</span>
          </div>
          <input
            className="gr-input"
            value={typed}
            placeholder="Type in Spanish…"
            disabled={revealed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) setRevealed(true); }}
          />
          {revealed && !correct && <p className="gr-fix">Answer: <b>{item.answer}</b></p>}
        </>
      )}

      {item.kind === "error" && (
        <>
          <p className="gr-stage-hint">Tap the word that&apos;s wrong.</p>
          <div className="gr-errsent">
            {item.sentence.split(/(\s+)/).map((tok, i) => {
              if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
              const clean = tok.replace(/[.,!?¡¿]/g, "");
              const isBad = clean === item.bad;
              const sel = clicked === clean;
              return (
                <span
                  key={i}
                  className={"gr-tok" + (checked && isBad ? " good" : "") + (checked && sel && !isBad ? " bad" : "")}
                  onClick={() => { if (!checked) setClicked(clean); }}
                >
                  {tok}
                </span>
              );
            })}
          </div>
          {checked && <p className="gr-fix">{item.bad} → <b>{item.correct}</b> · {item.why}</p>}
        </>
      )}

      <div className="gr-foot">
        <span className={"gr-verdict" + (checked ? (correct ? " ok" : " no") : "")}>
          {checked ? (correct ? "Correct" : "Not quite") : ""}
        </span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={!checked} onClick={onNext}>
          {lastLabel} <Icon name="chevron" size={16} />
        </button>
      </div>
    </div>
  );
}

function GrProduceStage({ lesson }: { lesson: GrLesson }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<import("@/types").GrammarCheck | null>(null);
  const [err, setErr] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const check = async () => {
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await grammarApi.check(lesson.focus, lesson.produce.instruction, text);
      setRes(r);
    } catch {
      setErr("Could not grade right now — check that Gemini is configured.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-card gr-stage-card">
      <div className="wr-sheet-head" style={{ marginBottom: 16 }}>
        <div className="wr-sheet-prompt">
          <span className="sp-tag pink"><Icon name="spark" size={13} /> Produce</span>
          <div className="wr-prompt-text">{lesson.produce.prompt}</div>
          <div className="wr-prompt-en">{lesson.produce.en}</div>
        </div>
        <span className="sp-tag ghost">{lesson.produce.instruction}</span>
      </div>

      <textarea
        className="wr-editor"
        style={{ minHeight: 160 }}
        placeholder="Escribe aquí…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="wr-editbar">
        <span className="wr-count">{words} words</span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={busy || !text.trim()} onClick={check}>
          <Icon name="check" size={16} /> {busy ? "Checking…" : "Check with AI"}
        </button>
      </div>

      {err && <p className="gr-fix" style={{ color: "var(--negative)" }}>{err}</p>}

      {res && (
        <div className="gr-result">
          <div className="gr-result-head">
            <div className={"gr-score" + (res.meets_requirement ? " ok" : "")}>{res.score}<small>/100</small></div>
            <div>
              <div className="gr-result-req">{res.meets_requirement ? "✓ Instruction met" : "Instruction not met yet"}</div>
              <p className="sp-sub">{res.feedback}</p>
            </div>
          </div>
          {res.verbs_used.length > 0 && (
            <div className="gr-verbs">
              {res.verbs_used.map((v, i) => <span key={i} className="sp-chip aqua is-active" style={{ cursor: "default" }}>{v}</span>)}
            </div>
          )}
          {res.corrections.length > 0 && (
            <div className="gr-corrections">
              <h4>Error correction</h4>
              {res.corrections.map((c, i) => (
                <div className="gr-corr" key={i}>
                  <span className="gr-corr-bad">{c.wrong}</span>
                  <Icon name="chevron" size={14} />
                  <span className="gr-corr-good">{c.correct}</span>
                  <span className="gr-corr-why">{c.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════ VOCABULARY ════════════════════════
   The v2 word-collection grid wired to the real 5-level trainer:
   each saved word shows its training level (1-5), and reviewing
   launches the level exercises at /vocab. */
const LEVEL_LABEL = ["", "Recognise", "Build", "Recall", "Context", "Produce", "Mastered"];

function speakEs(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

function VocabularyScreen({ onReview }: { onReview: () => void }) {
  const [cards, setCards] = useState<VocabListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<VocabDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    vocabApi.cards().then((c) => { setCards(c); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const openDetail = (cardId: string) => {
    setDetail(null); setDetailLoading(true);
    vocabApi.cardDetail(cardId).then(setDetail).catch(() => {}).finally(() => setDetailLoading(false));
  };

  const filters = ["All", "Due today", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Mastered"];
  const dueCount = cards.filter((c) => c.due).length;

  const shown = cards.filter((c) => {
    if (query && !`${c.spanish} ${c.english}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "All") return true;
    if (filter === "Due today") return c.due;
    if (filter === "Mastered") return c.level >= 5;
    if (filter.startsWith("Level ")) return c.level === Number(filter.slice(6));
    return true;
  });

  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Vocabulary · 5-level training</p>
        <h1 className="sp-h1">Your word collection</h1>
      </div>

      <div className="vo-toolbar">
        <div className="vo-search">
          <Icon name="search" size={18} />
          <input placeholder="Search your words…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 46 }} onClick={onReview}>
          <Icon name="bolt" size={16} /> Train {dueCount > 0 ? `(${dueCount} due)` : ""}
        </button>
      </div>

      <div className="vo-filters">
        {filters.map((c) => (
          <span key={c} className={"sp-chip" + (c === filter ? " is-active" : "")} onClick={() => setFilter(c)}>{c}</span>
        ))}
      </div>

      {loading ? (
        <p className="sp-sub">Loading your words…</p>
      ) : shown.length === 0 ? (
        <p className="sp-sub">
          {cards.length === 0
            ? "No saved words yet — tap words in a podcast transcript to add them."
            : "No words match this filter."}
        </p>
      ) : (
        <div className="vo-grid">
          {shown.map((w) => (
            <div className="sp-card vo-card" key={w.card_id} onClick={() => openDetail(w.card_id)}>
              <div className="vo-card-top">
                <span className="sp-tag ghost">{w.cefr_level && w.cefr_level !== "?" ? w.cefr_level : "—"}</span>
                <button
                  className="vo-speak"
                  onClick={(e) => { e.stopPropagation(); speakEs(w.spanish); }}
                  title="Pronounce"
                >
                  <Icon name="speaker" size={16} />
                </button>
              </div>
              <div className="vo-es">{w.spanish}</div>
              <div className="vo-en">{w.english}</div>
              <div className="vo-level-row">
                <span className="vo-level-label">{w.level >= 5 ? "Mastered" : `Lvl ${w.level} · ${LEVEL_LABEL[w.level]}`}</span>
                {w.due && <span className="vo-due-dot" title="Due today" />}
              </div>
              <div className="vo-strength">
                {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= w.level ? "on" : ""} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {(detail || detailLoading) && (
        <VocabDetailModal detail={detail} loading={detailLoading} onClose={() => { setDetail(null); setDetailLoading(false); }} />
      )}
    </div>
  );
}

// Read-only word detail — all enrichment, no studying.
function VocabDetailModal({ detail, loading, onClose }: { detail: VocabDetail | null; loading: boolean; onClose: () => void }) {
  const t = detail?.tips;
  return (
    <div className="vd-overlay" onClick={onClose}>
      <div className="sp-card vd-modal" onClick={(e) => e.stopPropagation()}>
        <button className="vd-close" onClick={onClose} title="Close"><Icon name="chevron" size={18} /></button>
        {loading || !detail || !t ? (
          <p className="sp-sub" style={{ padding: 30, textAlign: "center" }}>Loading…</p>
        ) : (
          <>
            <div className="vd-head">
              <div className="vd-es">{detail.spanish}
                <button className="vo-speak" onClick={() => speakEs(detail.spanish)} title="Pronounce"><Icon name="speaker" size={16} /></button>
              </div>
              <div className="vd-badges">
                {t.gender && <span className="sp-tag aqua">{t.gender}</span>}
                {t.frequency && <span className="sp-tag ghost">{t.frequency}</span>}
                {t.pronunciation && <span className="sp-tag ghost">/{t.pronunciation}/</span>}
                <span className="sp-tag ghost">{detail.level >= 5 ? "Mastered" : `Lvl ${detail.level}`}</span>
              </div>
              <div className="vd-en">{detail.english}</div>
              <p className="vd-note">Reference only — study from the Train button.</p>
            </div>
            <div className="vd-body">
              {t.collocations && t.collocations.length > 0 && (
                <div className="vt-section"><p className="vt-section-title">Collocations</p><p>{t.collocations.join(" · ")}</p></div>
              )}
              {t.chunks && t.chunks.length > 0 && (
                <div className="vt-section"><p className="vt-section-title">Chunks</p>
                  <ul className="vt-list">{t.chunks.map((c, i) => <li key={i}><b>{c.es}</b><span className="vt-dim"> — {c.en}</span></li>)}</ul>
                </div>
              )}
              {t.synonyms && t.synonyms.length > 0 && (
                <div className="vt-section"><p className="vt-section-title">Synonyms</p><p>{t.synonyms.join(", ")}</p></div>
              )}
              {t.antonyms && t.antonyms.length > 0 && (
                <div className="vt-section"><p className="vt-section-title">Antonyms</p><p>{t.antonyms.join(", ")}</p></div>
              )}
              {t.common_mistakes && t.common_mistakes.length > 0 && (
                <div className="vt-section"><p className="vt-section-title">Watch out</p>
                  <ul className="vt-bullets">{t.common_mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              )}
              {t.example_sentences && t.example_sentences.length > 0 && (
                <div className="vt-section"><p className="vt-section-title">Examples</p>
                  <ul className="vt-list">{t.example_sentences.map((s, i) => <li key={i}><i>{s.es}</i><span className="vt-dim"> — {s.en}</span></li>)}</ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════ WRITING ════════════════════════
   Progressive:  Copy → Dictation → Translation → Guided → Journal → Rewrite. */
type WrStage = "copy" | "dictation" | "translation" | "guided" | "journal" | "rewrite";
const WR_STEPS: { key: WrStage; n: string; label: string }[] = [
  { key: "copy", n: "1", label: "Copy" },
  { key: "dictation", n: "2", label: "Dictation" },
  { key: "translation", n: "3", label: "Translation" },
  { key: "guided", n: "4", label: "Guided" },
  { key: "journal", n: "5", label: "Journal" },
  { key: "rewrite", n: "★", label: "Rewrite" },
];

function WritingFeedbackPanel({ fb }: { fb: WritingFeedback }) {
  return (
    <div className="gr-result">
      <div className="gr-result-head">
        <div className={"gr-score" + (fb.score >= 70 ? " ok" : "")}>{fb.score}<small>/100</small></div>
        <p className="sp-sub">{fb.feedback}</p>
      </div>
      {fb.corrections.length > 0 && (
        <div className="gr-corrections">
          <h4>Grammar corrections</h4>
          {fb.corrections.map((c, i) => (
            <div className="gr-corr" key={i}>
              <span className="gr-corr-bad">{c.wrong}</span><Icon name="chevron" size={14} />
              <span className="gr-corr-good">{c.correct}</span><span className="gr-corr-why">{c.note}</span>
            </div>
          ))}
        </div>
      )}
      {fb.natural.length > 0 && (
        <div className="gr-corrections">
          <h4>Natural phrasing</h4>
          {fb.natural.map((c, i) => (
            <div className="gr-corr" key={i}>
              <span className="gr-corr-bad">{c.original}</span><Icon name="chevron" size={14} />
              <span className="gr-corr-good">{c.better}</span><span className="gr-corr-why">{c.why}</span>
            </div>
          ))}
        </div>
      )}
      {fb.vocab_upgrades.length > 0 && (
        <div className="gr-corrections">
          <h4>Vocabulary upgrades</h4>
          {fb.vocab_upgrades.map((c, i) => (
            <div className="gr-corr" key={i}>
              <span className="gr-corr-bad">{c.from_word}</span><Icon name="chevron" size={14} />
              <span className="gr-corr-good">{c.to_word}</span><span className="gr-corr-why">{c.why}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Stages 3-5 share the same write → AI feedback shape.
function WrFeedbackStage({ mode, instructions, prompt, en, tag, placeholder, connectors }: {
  mode: string; instructions: string; prompt: string; en: string; tag: string; placeholder: string; connectors?: string[];
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<WritingFeedback | null>(null);
  const [err, setErr] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const used = (c: string) => normSent(text).includes(normSent(c));

  const run = async () => {
    setBusy(true); setErr(""); setFb(null);
    try { setFb(await writingApi.feedback(mode, instructions, text)); }
    catch { setErr("Could not grade right now — check that Gemini is configured."); }
    finally { setBusy(false); }
  };

  return (
    <div className="sp-card gr-stage-card">
      <div className="wr-sheet-head" style={{ marginBottom: 16 }}>
        <div className="wr-sheet-prompt">
          <span className="sp-tag pink"><Icon name="spark" size={13} /> {tag}</span>
          <div className="wr-prompt-text">{prompt}</div>
          <div className="wr-prompt-en">{en}</div>
        </div>
        <span className="sp-tag ghost">{instructions}</span>
      </div>

      {connectors && (
        <div className="wr-connectors">
          {connectors.map((c) => (
            <span key={c} className={"sp-chip" + (used(c) ? " aqua is-active" : "")} style={{ cursor: "default" }}>
              {used(c) && <Icon name="check" size={13} />}{c}
            </span>
          ))}
        </div>
      )}

      <textarea className="wr-editor" style={{ minHeight: 150 }} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="wr-editbar">
        <span className="wr-count">{words} words</span>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} disabled={busy || !text.trim()} onClick={run}>
          <Icon name="check" size={16} /> {busy ? "Checking…" : "Get feedback"}
        </button>
      </div>
      {err && <p className="gr-fix" style={{ color: "var(--negative)" }}>{err}</p>}
      {fb && <WritingFeedbackPanel fb={fb} />}
    </div>
  );
}

// Stages 1-2: copy / dictation — local exact-match practice.
const WR_COPY = [
  { es: "La biblioteca está cerca de la plaza.", en: "The library is near the square." },
  { es: "Mi hermana estudia medicina en la universidad.", en: "My sister studies medicine at university." },
  { es: "Siempre desayunamos juntos los domingos.", en: "We always have breakfast together on Sundays." },
];
function WrCopyStage({ dictation }: { dictation?: boolean }) {
  const [i, setI] = useState(0);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);
  const s = WR_COPY[i];
  const ok = normSent(val) === normSent(s.es);
  const next = () => { setVal(""); setChecked(false); setI((n) => (n + 1) % WR_COPY.length); };
  useEffect(() => { if (dictation) speakEs(s.es); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">{dictation ? "Listen, then write what you heard." : "Copy the sentence exactly — build accuracy and spelling."}</p>
      {dictation
        ? <button className="ls-bigplay" onClick={() => speakEs(s.es)}><Icon name="speaker" size={26} /> Play sentence</button>
        : <div className="wr-copy-target">{s.es}<button className="vo-speak" onClick={() => speakEs(s.es)} title="Listen"><Icon name="speaker" size={18} /></button></div>}
      <textarea className="wr-editor" style={{ minHeight: 90 }} placeholder="Write here…" value={val} disabled={checked} onChange={(e) => setVal(e.target.value)} />
      {checked
        ? <>
            <p className="gr-fix">{ok ? "Exact match." : <>Target: <b>{s.es}</b></>} <span style={{ color: "var(--muted)" }}>· {s.en}</span></p>
            <div className="wr-editbar"><span className={"gr-verdict " + (ok ? "ok" : "no")}>{ok ? "Correct" : "Check the diff"}</span>
              <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={next}>Next <Icon name="chevron" size={16} /></button></div>
          </>
        : <div className="wr-editbar"><span /><button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} disabled={!val.trim()} onClick={() => setChecked(true)}>Check</button></div>}
    </div>
  );
}

// Stage 6: rewrite — style transforms.
const REWRITE_BTNS: { key: RewriteStyle; label: string }[] = [
  { key: "natural", label: "More natural" }, { key: "formal", label: "More formal" },
  { key: "shorter", label: "Shorter" }, { key: "mexican", label: "More Mexican" }, { key: "spain", label: "More Spanish (Spain)" },
];
function WrRewriteStage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<RewriteStyle | null>(null);
  const [out, setOut] = useState<{ rewritten: string; note: string } | null>(null);
  const [err, setErr] = useState("");
  const run = async (style: RewriteStyle) => {
    if (!text.trim()) return;
    setBusy(style); setErr(""); setOut(null);
    try { setOut(await writingApi.rewrite(text, style)); }
    catch { setErr("Could not rewrite right now — check that Gemini is configured."); }
    finally { setBusy(null); }
  };
  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Write something in Spanish, then transform it. Compare versions — fantastic learning.</p>
      <textarea className="wr-editor" style={{ minHeight: 120 }} placeholder="Escribe algo aquí…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="wr-rewrite-btns">
        {REWRITE_BTNS.map((b) => (
          <button key={b.key} className="sp-chip" style={{ cursor: "pointer" }} disabled={!!busy || !text.trim()} onClick={() => run(b.key)}>
            {busy === b.key ? "…" : b.label}
          </button>
        ))}
      </div>
      {err && <p className="gr-fix" style={{ color: "var(--negative)" }}>{err}</p>}
      {out && (
        <div className="wr-rewrite-out">
          <div className="wr-rewrite-text">{out.rewritten}<button className="vo-speak" onClick={() => speakEs(out.rewritten)} title="Listen"><Icon name="speaker" size={18} /></button></div>
          <p className="gr-corr-why" style={{ marginTop: 8 }}>{out.note}</p>
        </div>
      )}
    </div>
  );
}

function WritingScreen() {
  const [stage, setStage] = useState<WrStage>("copy");
  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Writing</p>
        <h1 className="sp-h1">Write a little every day</h1>
      </div>

      <div className="gr-stepper">
        {WR_STEPS.map((s) => (
          <button key={s.key} className={"gr-step" + (s.key === stage ? " is-active" : "")} onClick={() => setStage(s.key)}>
            <span className="gr-step-n">{s.n}</span>{s.label}
          </button>
        ))}
      </div>

      <div className="ls-stage">
        {stage === "copy" && <WrCopyStage />}
        {stage === "dictation" && <WrCopyStage dictation />}
        {stage === "translation" && (
          <WrFeedbackStage mode="translation" instructions="Translate into natural Spanish."
            tag="Translation" prompt="I have lived in this city for three years, but I still get lost sometimes."
            en="Translate the English sentence into Spanish." placeholder="Tu traducción…" />
        )}
        {stage === "guided" && (
          <WrFeedbackStage mode="guided" instructions="Write three sentences, each using one connector."
            tag="Guided" prompt="Write three sentences using: porque · aunque · sin embargo"
            en="Use each connector once. Make them about your own life." placeholder="Escribe tres frases…"
            connectors={["porque", "aunque", "sin embargo"]} />
        )}
        {stage === "journal" && (
          <WrFeedbackStage mode="journal" instructions="Free journal — 3+ sentences."
            tag="Journal · Daily prompt" prompt="¿Qué hiciste hoy?" en="What did you do today?"
            placeholder="Hoy…" />
        )}
        {stage === "rewrite" && <WrRewriteStage />}
      </div>
    </div>
  );
}

/* ════════════════════════ LISTENING ════════════════════════
   Progressive listening:  Words → Sentences → Dialogue → Podcast,
   plus Shadowing (speech-recognition scored). All audio is the
   browser's Spanish TTS voice; no backend needed. */

function normSent(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function lcsLen(a: string[], b: string[]): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[m][n];
}
function speakSeq(parts: string[]) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  parts.forEach((t) => {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "es-ES"; u.rate = 0.95;
    window.speechSynthesis.speak(u);
  });
}

type ListenLevel = "1" | "2" | "3" | "4" | "shadow";
const LISTEN_STEPS: { key: ListenLevel; n: string; label: string }[] = [
  { key: "1", n: "1", label: "Words" },
  { key: "2", n: "2", label: "Sentences" },
  { key: "3", n: "3", label: "Dialogue" },
  { key: "4", n: "4", label: "Podcast" },
  { key: "shadow", n: "★", label: "Shadowing" },
];

/* ── Level 1 · single word → choose picture ── */
const PIC_WORDS = [
  { es: "perro", ok: "🐕" }, { es: "gato", ok: "🐈" }, { es: "casa", ok: "🏠" },
  { es: "manzana", ok: "🍎" }, { es: "sol", ok: "☀️" }, { es: "coche", ok: "🚗" },
  { es: "libro", ok: "📖" }, { es: "árbol", ok: "🌳" }, { es: "agua", ok: "💧" },
  { es: "luna", ok: "🌙" }, { es: "flor", ok: "🌸" }, { es: "pez", ok: "🐟" },
];
function shuffle<T>(a: T[]): T[] { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }

function Level1Words() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const word = PIC_WORDS[i];
  const options = React.useMemo(() => {
    const distract = shuffle(PIC_WORDS.filter((w) => w.es !== word.es)).slice(0, 3).map((w) => w.ok);
    return shuffle([word.ok, ...distract]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  useEffect(() => { speakEs(word.es); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = () => { setPicked(null); setI((n) => (n + 1) % PIC_WORDS.length); };

  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Listen, then choose the picture.</p>
      <button className="ls-bigplay" onClick={() => speakEs(word.es)}><Icon name="speaker" size={26} /> Play word</button>
      <div className="ls-pics">
        {options.map((emo) => {
          const isOk = emo === word.ok;
          const sel = picked === emo;
          return (
            <button
              key={emo}
              className={"ls-pic" + (picked ? (isOk ? " good" : sel ? " bad" : "") : "")}
              onClick={() => !picked && setPicked(emo)}
            >{emo}</button>
          );
        })}
      </div>
      {picked && (
        <div className="gr-foot">
          <span className={"gr-verdict " + (picked === word.ok ? "ok" : "no")}>
            {picked === word.ok ? "Correct" : `It was ${word.es} ${word.ok}`}
          </span>
          <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={next}>Next <Icon name="chevron" size={16} /></button>
        </div>
      )}
    </div>
  );
}

/* ── Level 2 · short sentence → type what you heard ── */
const L2_SENTS = [
  { es: "El perro corre.", en: "The dog runs." },
  { es: "La casa es grande.", en: "The house is big." },
  { es: "Yo bebo agua.", en: "I drink water." },
  { es: "Ella lee un libro.", en: "She reads a book." },
  { es: "Nosotros comemos pan.", en: "We eat bread." },
];
function Level2Sentences() {
  const [i, setI] = useState(0);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);
  const s = L2_SENTS[i];
  useEffect(() => { speakEs(s.es); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = normSent(val) === normSent(s.es);
  const next = () => { setVal(""); setChecked(false); setI((n) => (n + 1) % L2_SENTS.length); };
  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Listen and type exactly what you heard.</p>
      <button className="ls-bigplay" onClick={() => speakEs(s.es)}><Icon name="speaker" size={26} /> Play sentence</button>
      <input className="gr-input" value={val} placeholder="Type the sentence…" disabled={checked}
        onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) setChecked(true); }} />
      {checked && (
        <>
          <p className="gr-fix">{ok ? "Perfect." : <>Answer: <b>{s.es}</b></>} <span style={{ color: "var(--muted)" }}>· {s.en}</span></p>
          <div className="gr-foot">
            <span className={"gr-verdict " + (ok ? "ok" : "no")}>{ok ? "Correct" : "Not quite"}</span>
            <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={next}>Next <Icon name="chevron" size={16} /></button>
          </div>
        </>
      )}
      {!checked && (
        <div className="gr-foot">
          <span />
          <button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} disabled={!val.trim()} onClick={() => setChecked(true)}>Check</button>
        </div>
      )}
    </div>
  );
}

/* ── Level 3 · dialogue (20-30s) → comprehension questions ── */
const L3_DIALOGUE = {
  title: "En la cafetería",
  lines: [
    { sp: "Ana", es: "Hola, ¿qué quieres tomar?" },
    { sp: "Luis", es: "Un café con leche, por favor. ¿Y tú?" },
    { sp: "Ana", es: "Yo prefiero un té. Tengo mucho sueño hoy." },
    { sp: "Luis", es: "¿Por qué? ¿Trabajaste anoche?" },
    { sp: "Ana", es: "Sí, hasta muy tarde. Pero mañana descanso." },
  ],
  questions: [
    { q: "What does Luis order?", options: ["A tea", "A coffee with milk", "Water"], answer: 1 },
    { q: "Why is Ana tired?", options: ["She worked late", "She is sick", "She woke up early"], answer: 0 },
    { q: "What will Ana do tomorrow?", options: ["Work again", "Rest", "Travel"], answer: 1 },
  ],
};
function Level3Dialogue() {
  const d = L3_DIALOGUE;
  const [picks, setPicks] = useState<(number | null)[]>(d.questions.map(() => null));
  const allDone = picks.every((p) => p !== null);
  const score = picks.filter((p, i) => p === d.questions[i].answer).length;
  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Listen to the whole dialogue, then answer. (Audio only — train your ear.)</p>
      <div className="ls-dialogue-controls">
        <button className="ls-bigplay" onClick={() => speakSeq(d.lines.map((l) => l.es))}><Icon name="play" size={24} /> Play dialogue</button>
        <span className="sp-tag ghost">{d.title}</span>
      </div>
      <div className="ls-questions">
        {d.questions.map((qu, qi) => (
          <div className="ls-q" key={qi}>
            <div className="ls-q-text">{qu.q}</div>
            <div className="gr-answers">
              {qu.options.map((o, oi) => {
                const sel = picks[qi] === oi;
                const reveal = picks[qi] !== null;
                const isAns = oi === qu.answer;
                return (
                  <button key={oi}
                    className={"gr-answer" + (reveal && isAns ? " correct" : "") + (reveal && sel && !isAns ? " wrong" : "")}
                    onClick={() => { if (picks[qi] === null) setPicks((p) => p.map((v, k) => (k === qi ? oi : v))); }}>
                    <span className="key">{String.fromCharCode(65 + oi)}</span>{o}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {allDone && <p className="gr-fix">Score: <b>{score} / {d.questions.length}</b></p>}
    </div>
  );
}

/* ── Shadowing · repeat the sentence, speech recognition scores it ── */
type SRInstance = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void;
};
function getSR(): SRInstance | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SRInstance; webkitSpeechRecognition?: new () => SRInstance };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}
const SHADOW = [
  { es: "Buenos días, ¿cómo estás?", en: "Good morning, how are you?" },
  { es: "Me gusta mucho el café por la mañana.", en: "I really like coffee in the morning." },
  { es: "El tren llega a las ocho en punto.", en: "The train arrives at eight o'clock." },
  { es: "¿Puedes repetir eso, por favor?", en: "Can you repeat that, please?" },
];
function ShadowingLevel() {
  const [i, setI] = useState(0);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [scores, setScores] = useState<{ pron: number; rhythm: number; stress: number } | null>(null);
  const supported = typeof window !== "undefined" && !!getSR();
  const t = SHADOW[i];

  const record = () => {
    const sr = getSR();
    if (!sr) return;
    sr.lang = "es-ES"; sr.interimResults = false; sr.maxAlternatives = 1; sr.continuous = false;
    setHeard(""); setScores(null); setListening(true);
    sr.onresult = (e) => {
      const r = e.results[0][0];
      const said = r.transcript || "";
      setHeard(said);
      const tgt = normSent(t.es).split(" ");
      const got = normSent(said).split(" ").filter(Boolean);
      const matched = tgt.filter((w) => got.includes(w)).length;
      const order = lcsLen(tgt, got);
      const pron = Math.round((matched / tgt.length) * 100);
      const rhythm = Math.round((order / tgt.length) * 100);
      const stress = Math.round(Math.min(1, (r.confidence || 0.6)) * 100);
      setScores({ pron, rhythm, stress });
    };
    sr.onend = () => setListening(false);
    sr.onerror = () => setListening(false);
    sr.start();
  };
  const next = () => { setHeard(""); setScores(null); setI((n) => (n + 1) % SHADOW.length); };

  return (
    <div className="sp-card gr-stage-card">
      <p className="gr-stage-hint">Listen, then repeat it aloud. Your pronunciation, rhythm and stress get scored.</p>
      <div className="ls-shadow-target">
        <div className="ls-shadow-es">{t.es}<button className="vo-speak" onClick={() => speakEs(t.es)} title="Listen"><Icon name="speaker" size={18} /></button></div>
        <div className="ls-shadow-en">{t.en}</div>
      </div>
      {!supported ? (
        <p className="gr-fix" style={{ color: "var(--negative)" }}>Speech recognition needs Chrome/Edge. Try there to use shadowing.</p>
      ) : (
        <button className={"sp-btn sp-btn-primary ls-rec" + (listening ? " is-rec" : "")} style={{ minHeight: 48 }} disabled={listening} onClick={record}>
          <Icon name="podcast" size={18} /> {listening ? "Listening…" : "Record yourself"}
        </button>
      )}
      {heard && <p className="gr-fix">Heard: <span style={{ fontStyle: "italic" }}>{heard}</span></p>}
      {scores && (
        <>
          <div className="ls-scores">
            {([["Pronunciation", scores.pron], ["Rhythm", scores.rhythm], ["Stress (est.)", scores.stress]] as [string, number][]).map(([lbl, v]) => (
              <div className="ls-score" key={lbl}>
                <div className="ls-score-top"><span>{lbl}</span><b>{v}%</b></div>
                <div className="sp-progress"><i style={{ width: `${v}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="gr-foot">
            <span className={"gr-verdict " + (scores.pron >= 70 ? "ok" : "no")}>{scores.pron >= 70 ? "¡Bien!" : "Try again"}</span>
            <button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} onClick={next}>Next sentence <Icon name="chevron" size={16} /></button>
          </div>
        </>
      )}
    </div>
  );
}

function ListeningScreen({ saved, onSave }: { saved: string[]; onSave: (w: string) => void }) {
  const [level, setLevel] = useState<ListenLevel>("1");
  const isPod = level === "4";
  return (
    <div className={"pod-page" + (isPod ? "" : " ls-padded")}>
      <div className="ls-levelbar">
        {LISTEN_STEPS.map((s) => (
          <button key={s.key} className={"gr-step" + (s.key === level ? " is-active" : "")} onClick={() => setLevel(s.key)}>
            <span className="gr-step-n">{s.n}</span>{s.label}
          </button>
        ))}
      </div>
      {level === "1" && <div className="ls-stage"><LevelHead eyebrow="Listening · Level 1" title="Single words" /><Level1Words /></div>}
      {level === "2" && <div className="ls-stage"><LevelHead eyebrow="Listening · Level 2" title="Short sentences" /><Level2Sentences /></div>}
      {level === "3" && <div className="ls-stage"><LevelHead eyebrow="Listening · Level 3" title="Dialogue" /><Level3Dialogue /></div>}
      {level === "4" && <PodcastScreen saved={saved} onSave={onSave} />}
      {level === "shadow" && <div className="ls-stage"><LevelHead eyebrow="Listening · Extra" title="Shadowing" /><ShadowingLevel /></div>}
    </div>
  );
}
function LevelHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="sp-pagehead">
      <p className="sp-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</p>
      <h1 className="sp-h1">{title}</h1>
    </div>
  );
}

/* ════════════════════════ REVIEW ════════════════════════
   Daily mixed retrieval — every skill interleaved, not separated.
   Translate → Listening → Grammar → Speaking → Vocabulary → Writing… */
type RvItem =
  | { skill: "Translate"; en: string; es: string }
  | { skill: "Listening"; es: string; en: string }
  | { skill: "Grammar"; before: string; after: string; en: string; options: string[]; answer: number }
  | { skill: "Speaking"; es: string; en: string }
  | { skill: "Vocabulary"; es: string; en: string }
  | { skill: "Writing"; prompt: string; en: string };

const REVIEW_ITEMS: RvItem[] = [
  { skill: "Translate", en: "I always drink coffee in the morning.", es: "Siempre bebo café por la mañana." },
  { skill: "Listening", es: "El tren llega a las ocho.", en: "The train arrives at eight." },
  { skill: "Grammar", before: "Nosotros ", after: " en Madrid.", en: "We live in Madrid.", options: ["vivo", "vives", "vivimos", "viven"], answer: 2 },
  { skill: "Speaking", es: "¿Puedes ayudarme, por favor?", en: "Can you help me, please?" },
  { skill: "Vocabulary", es: "la frontera", en: "the border" },
  { skill: "Writing", prompt: "Escribe una frase usando «porque».", en: "Write a sentence using “porque”." },
  { skill: "Translate", en: "She reads a book every night.", es: "Ella lee un libro cada noche." },
  { skill: "Grammar", before: "¿Tú ", after: " carne?", en: "Do you eat meat?", options: ["como", "comes", "come", "comen"], answer: 1 },
];

const SKILL_TONE: Record<RvItem["skill"], string> = {
  Translate: "pink", Listening: "aqua", Grammar: "pink", Speaking: "aqua", Vocabulary: "pink", Writing: "aqua",
};

function ReviewScreen() {
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const restart = () => { setStarted(true); setIdx(0); setCorrect(0); setDone(false); };
  const onResult = (ok: boolean) => {
    if (ok) setCorrect((c) => c + 1);
    if (idx + 1 >= REVIEW_ITEMS.length) setDone(true); else setIdx(idx + 1);
  };

  if (!started) {
    return (
      <div>
        <div className="sp-pagehead">
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Review · Daily mix</p>
          <h1 className="sp-h1">Where it all comes together</h1>
        </div>
        <div className="sp-card rv-intro">
          <p className="sp-sub" style={{ marginBottom: 16 }}>
            Everything you learn feeds here. One session interleaves vocabulary, grammar,
            listening, writing and speaking — mixed, not separated. Constant retrieval is
            what makes it stick.
          </p>
          <div className="rv-skill-row">
            {(["Translate", "Listening", "Grammar", "Speaking", "Vocabulary", "Writing"] as RvItem["skill"][]).map((s) => (
              <span key={s} className={"sp-tag " + SKILL_TONE[s]}>{s}</span>
            ))}
          </div>
          <button className="sp-btn sp-btn-primary" style={{ marginTop: 20 }} onClick={restart}>
            <Icon name="bolt" size={16} /> Start daily review · {REVIEW_ITEMS.length} questions
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <div className="sp-pagehead">
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Review · Complete</p>
          <h1 className="sp-h1">¡Bien hecho!</h1>
        </div>
        <div className="sp-card rv-intro" style={{ textAlign: "center" }}>
          <div className="gr-done-ico" style={{ margin: "0 auto 14px" }}><Icon name="check" size={26} /></div>
          <div className="gr-score ok" style={{ fontSize: 44 }}>{correct}<small>/{REVIEW_ITEMS.length}</small></div>
          <p className="sp-sub" style={{ margin: "8px 0 20px" }}>Mixed retrieval done for today. Come back tomorrow to keep the gains.</p>
          <button className="sp-btn sp-btn-primary" onClick={restart}>Again <Icon name="chevron" size={16} /></button>
        </div>
      </div>
    );
  }

  const item = REVIEW_ITEMS[idx];
  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Review · Daily mix</p>
        <h1 className="sp-h1">Question {idx + 1} of {REVIEW_ITEMS.length}</h1>
      </div>
      <div className="rv-prog">
        <div className="sp-progress"><i style={{ width: `${(idx / REVIEW_ITEMS.length) * 100}%` }} /></div>
      </div>
      <div className="ls-stage">
        <RvItemView key={idx} item={item} onResult={onResult} />
      </div>
    </div>
  );
}

function rvScore(target: string, said: string): boolean {
  const tgt = normSent(target).split(" ");
  const got = normSent(said).split(" ").filter(Boolean);
  const matched = tgt.filter((w) => got.includes(w)).length;
  return matched / tgt.length >= 0.6;
}

function RvItemView({ item, onResult }: { item: RvItem; onResult: (ok: boolean) => void }) {
  const [val, setVal] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [spokeOk, setSpokeOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (item.skill === "Listening") speakEs(item.es);
  }, [item]);

  const record = () => {
    if (item.skill !== "Speaking") return;
    const sr = getSR();
    if (!sr) { setSpokeOk(false); return; }
    sr.lang = "es-ES"; sr.interimResults = false; sr.maxAlternatives = 1; sr.continuous = false;
    setListening(true); setHeard("");
    sr.onresult = (e) => { const said = e.results[0][0].transcript || ""; setHeard(said); setSpokeOk(rvScore(item.es, said)); };
    sr.onend = () => setListening(false);
    sr.onerror = () => { setListening(false); setSpokeOk(false); };
    sr.start();
  };

  const tone = SKILL_TONE[item.skill];

  return (
    <div className="sp-card gr-stage-card">
      <span className={"sp-tag " + tone + " gr-kind"}>{item.skill}</span>

      {item.skill === "Translate" && (
        <>
          <div className="gr-prompt">{item.en}<span className="en">Translate into Spanish.</span></div>
          <input className="gr-input" value={val} placeholder="Tu traducción…" disabled={revealed}
            onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) setRevealed(true); }} />
          {revealed && <p className="gr-fix">Model: <b>{item.es}</b></p>}
          <SelfNext show={revealed} reveal={() => setRevealed(true)} canReveal={!!val.trim()} onResult={onResult} />
        </>
      )}

      {item.skill === "Listening" && (
        <>
          <p className="gr-stage-hint">Listen and type what you heard.</p>
          <button className="ls-bigplay" onClick={() => speakEs(item.es)}><Icon name="speaker" size={24} /> Play</button>
          <input className="gr-input" value={val} placeholder="Type the sentence…" disabled={checked}
            onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) setChecked(true); }} />
          {checked && <p className="gr-fix">{normSent(val) === normSent(item.es) ? "Correct." : <>Answer: <b>{item.es}</b></>} · {item.en}</p>}
          <AutoNext show={checked} doCheck={() => setChecked(true)} canCheck={!!val.trim()}
            ok={normSent(val) === normSent(item.es)} onResult={onResult} />
        </>
      )}

      {item.skill === "Grammar" && (
        <>
          <div className="gr-prompt">{item.before}<span className="blank">{picked !== null ? item.options[picked] : "_____"}</span>{item.after}<span className="en">{item.en}</span></div>
          <div className="gr-answers">
            {item.options.map((o, i) => (
              <button key={i} className={"gr-answer" + (checked && i === item.answer ? " correct" : "") + (checked && picked === i && i !== item.answer ? " wrong" : "")}
                onClick={() => { if (!checked) { setPicked(i); setChecked(true); } }}>
                <span className="key">{String.fromCharCode(65 + i)}</span>{o}
              </button>
            ))}
          </div>
          <AutoNext show={checked} doCheck={() => {}} canCheck={false} ok={picked === item.answer} onResult={onResult} />
        </>
      )}

      {item.skill === "Speaking" && (
        <>
          <p className="gr-stage-hint">Say this aloud.</p>
          <div className="wr-copy-target">{item.es}<button className="vo-speak" onClick={() => speakEs(item.es)} title="Listen"><Icon name="speaker" size={18} /></button></div>
          <div className="wr-prompt-en" style={{ marginBottom: 12 }}>{item.en}</div>
          {!getSR() ? (
            <>
              <p className="gr-fix" style={{ color: "var(--negative)" }}>Speech recognition needs Chrome/Edge.</p>
              <div className="gr-foot"><span /><button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => onResult(true)}>Skip <Icon name="chevron" size={16} /></button></div>
            </>
          ) : (
            <>
              <button className={"sp-btn sp-btn-primary ls-rec" + (listening ? " is-rec" : "")} style={{ minHeight: 46 }} disabled={listening} onClick={record}>
                <Icon name="podcast" size={16} /> {listening ? "Listening…" : "Record"}
              </button>
              {heard && <p className="gr-fix">Heard: <span style={{ fontStyle: "italic" }}>{heard}</span></p>}
              {spokeOk !== null && (
                <div className="gr-foot">
                  <span className={"gr-verdict " + (spokeOk ? "ok" : "no")}>{spokeOk ? "Good match" : "Close — keep going"}</span>
                  <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => onResult(spokeOk)}>Next <Icon name="chevron" size={16} /></button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {item.skill === "Vocabulary" && (
        <>
          <div className="gr-prompt" style={{ textAlign: "center", fontSize: 26, fontWeight: 700 }}>
            {item.es}<button className="vo-speak" onClick={() => speakEs(item.es)} title="Listen" style={{ marginLeft: 8 }}><Icon name="speaker" size={18} /></button>
          </div>
          {revealed && <p className="gr-fix" style={{ textAlign: "center", fontSize: 18 }}>{item.en}</p>}
          <SelfNext show={revealed} reveal={() => setRevealed(true)} canReveal revealLabel="Show meaning" onResult={onResult} />
        </>
      )}

      {item.skill === "Writing" && (
        <>
          <div className="gr-prompt">{item.prompt}<span className="en">{item.en}</span></div>
          <textarea className="wr-editor" style={{ minHeight: 90 }} placeholder="Escribe aquí…" value={val} disabled={revealed} onChange={(e) => setVal(e.target.value)} />
          <SelfNext show={revealed} reveal={() => setRevealed(true)} canReveal={!!val.trim()} revealLabel="Done" onResult={onResult} />
        </>
      )}
    </div>
  );
}

// Auto-graded item footer (listening/grammar): reveal verdict, then Next.
function AutoNext({ show, doCheck, canCheck, ok, onResult }: { show: boolean; doCheck: () => void; canCheck: boolean; ok: boolean; onResult: (ok: boolean) => void }) {
  if (!show) return canCheck ? (
    <div className="gr-foot"><span /><button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} onClick={doCheck}>Check</button></div>
  ) : <></>;
  return (
    <div className="gr-foot">
      <span className={"gr-verdict " + (ok ? "ok" : "no")}>{ok ? "Correct" : "Not quite"}</span>
      <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => onResult(ok)}>Next <Icon name="chevron" size={16} /></button>
    </div>
  );
}

// Self-graded item footer (translate/vocab/writing): reveal answer, rate yourself.
function SelfNext({ show, reveal, canReveal, revealLabel = "Reveal", onResult }: { show: boolean; reveal: () => void; canReveal: boolean; revealLabel?: string; onResult: (ok: boolean) => void }) {
  if (!show) return (
    <div className="gr-foot"><span /><button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} disabled={!canReveal} onClick={reveal}>{revealLabel}</button></div>
  );
  return (
    <div className="gr-foot">
      <span className="gr-verdict">How did you do?</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="sp-btn sp-btn-soft" style={{ minHeight: 44 }} onClick={() => onResult(false)}>Missed it</button>
        <button className="sp-btn sp-btn-primary" style={{ minHeight: 44 }} onClick={() => onResult(true)}>Got it <Icon name="check" size={15} /></button>
      </div>
    </div>
  );
}

/* ════════════════════════ MISSION ════════════════════════
   Scenario missions that chain every skill into one goal.
   Vocabulary → Grammar → Listening → Speaking → Writing → complete. */
// A mission's Vocabulary step advances past a word once it hits this level —
// not full mastery (5). Mirrors backend MISSION_ADVANCE_LEVEL in services/vocab.py.
const MISSION_ADVANCE_LEVEL = 2;
// Which vocab burst (0-indexed) a step drills, for the generated Vocabulary
// I/II/III steps — undefined for every other step (Listening, Grammar, ...).
type MissionLevel = { name: string; learn: string; minutes: number; vocabBurst?: number };
type Mission = {
  id: string; icon: string; title: string; blurb: string; tag: string;
  lat: number; lon: number;
  vocab: { es: string; en: string; level?: number | null }[];
  grammar: { es: string; en: string }[];
  listening: { es: string; en: string; q: { question: string; options: string[]; answer: number } };
  speaking: { es: string; en: string };
  writing: { promptEn: string; targetEs: string };
  levels?: MissionLevel[]; // the step-by-step levels shown on the planet
  // The LLM-generated 7-stage speaking role-play, loaded from the API on open.
  speakingScript?: MissionSpeaking | null;
  // The current user's progress: null/undefined if never started, else
  // "available" or "completed". Drives guided-flow vs free-practice-menu.
  status?: string | null;
  // The mission's backend GrammarPattern rows (id + cloze_template), loaded
  // from the API — lets GrammarLesson's hardcoded review cards post an FSRS
  // review for the matching pattern.
  grammarPatterns?: { id: string; cloze_template: string }[];
};
const MISSIONS: Mission[] = [
  {
    id: "m001-coffee-shop", icon: "coffee", title: "Ordering Coffee", blurb: "Walk into a café and order like a local.", tag: "A1 · Café", lat: 40.4, lon: -3.7,
    vocab: [
      { es: "el café", en: "coffee" }, { es: "el té", en: "tea" },
      { es: "la leche", en: "milk" }, { es: "el azúcar", en: "sugar" },
      { es: "el agua", en: "water" }, { es: "la cuenta", en: "the bill" },
      { es: "el vaso", en: "glass" }, { es: "la taza", en: "cup" },
    ],
    grammar: [
      { es: "Quisiera un café.", en: "I would like a coffee. (polite)" },
      { es: "Me gustaría un café con leche.", en: "I would like a coffee with milk." },
    ],
    listening: { es: "Buenos días, ¿qué le pongo?", en: "Good morning, what can I get you?",
      q: { question: "What is the waiter asking?", options: ["What you'd like to order", "Where you live", "The time"], answer: 0 } },
    speaking: { es: "Quisiera un café con leche, por favor.", en: "I'd like a coffee with milk, please." },
    writing: { promptEn: "Order a coffee with milk and sugar, then ask for the bill.", targetEs: "Quisiera un café con leche y azúcar, y la cuenta, por favor." },
    levels: [
      { name: "Listening", learn: "“Buenos días.” · “¿Algo más?” — hear the words in context before drilling them.", minutes: 4 },
      { name: "Grammar", learn: "Quisiera… · Me gustaría… · ¿Me puede dar…? — pulled from the same conversation, short explanation then practice.", minutes: 5 },
      { name: "Speaking", learn: "Talk with an AI waiter — order and complete the interaction naturally.", minutes: 6 },
      { name: "Writing", learn: "Write your order, what your friend orders, and a polite request.", minutes: 5 },
      { name: "Final Challenge", learn: "A real café conversation — no hints, native speed, multiple responses.", minutes: 7 },
    ],
  },
  {
    id: "m002-airport", icon: "plane", title: "At the Airport", blurb: "Check in and find your gate.", tag: "A2 · Travel", lat: 19.4, lon: -99.1,
    vocab: [
      { es: "el vuelo", en: "flight" }, { es: "la maleta", en: "suitcase" },
      { es: "la puerta", en: "gate" }, { es: "el billete", en: "ticket" },
    ],
    grammar: [
      { es: "¿Dónde está la puerta seis?", en: "Where is gate six?" },
      { es: "¿A qué hora sale el vuelo?", en: "What time does the flight leave?" },
    ],
    listening: { es: "Su vuelo sale por la puerta doce.", en: "Your flight leaves from gate twelve.",
      q: { question: "Which gate is the flight?", options: ["Gate two", "Gate twelve", "Gate twenty"], answer: 1 } },
    speaking: { es: "¿Dónde está la puerta de embarque, por favor?", en: "Where is the boarding gate, please?" },
    writing: { promptEn: "Ask where gate twelve is and what time the flight leaves.", targetEs: "¿Dónde está la puerta doce y a qué hora sale el vuelo?" },
    levels: [
      { name: "Listening", learn: "“Su billete y pasaporte.” · “Puerta doce.” — hear the words in context before drilling them.", minutes: 4 },
      { name: "Grammar", learn: "¿Dónde está…? · ¿A qué hora sale…? · Vamos a embarcar — pulled from the same conversation, short explanation then practice.", minutes: 5 },
      { name: "Speaking", learn: "Talk with an AI check-in agent — check in and find your gate naturally.", minutes: 6 },
      { name: "Writing", learn: "Write your gate question, departure time question and a thank-you.", minutes: 5 },
      { name: "Final Challenge", learn: "A real check-in desk conversation — no hints, native speed, multiple responses.", minutes: 7 },
    ],
  },
  {
    id: "m003-meeting-someone", icon: "people", title: "Meeting Someone", blurb: "Say hi and introduce yourself.", tag: "A1 · Social", lat: 4.7, lon: -74.1,
    vocab: [
      { es: "hola", en: "hello" }, { es: "me llamo", en: "my name is" },
      { es: "soy", en: "I am" }, { es: "gracias", en: "thank you" },
    ],
    grammar: [
      { es: "Me llamo Carlos.", en: "My name is Carlos." },
      { es: "Soy de México.", en: "I'm from Mexico." },
    ],
    listening: { es: "Hola, me llamo Ana. ¿Y tú?", en: "Hi, my name is Ana. And you?",
      q: { question: "What is she telling you?", options: ["Her name", "The time", "Where she lives"], answer: 0 } },
    speaking: { es: "Hola, me llamo Carlos. Mucho gusto.", en: "Hi, my name is Carlos. Nice to meet you." },
    writing: { promptEn: "Greet someone, give your name and say where you're from.", targetEs: "Hola, me llamo Carlos y soy de México." },
    levels: [
      { name: "Listening", learn: "“¡Hola!” · “¿Cómo estás?” — hear the words in context before drilling them.", minutes: 4 },
      { name: "Grammar", learn: "Me llamo… · Soy de… · ¿Cómo te llamas? · ¿De dónde eres? — pulled from the same conversation, short explanation then practice.", minutes: 5 },
      { name: "Speaking", learn: "Introduce yourself to an AI partner — name, where you're from, greetings.", minutes: 6 },
      { name: "Writing", learn: "Write a greeting, your name and where you're from.", minutes: 5 },
      { name: "Final Challenge", learn: "A real introduction — no hints, native speed, back and forth.", minutes: 7 },
    ],
  },
];

// Upcoming missions — shown as locked pointers on the globe, not yet playable.
type LockedMission = { id: string; title: string; blurb: string; tag: string; lat: number; lon: number };
const LOCKED_MISSIONS: LockedMission[] = [
  { id: "market", title: "At the Market", blurb: "Haggle for fruit and veg like a local.", tag: "A2 · Market", lat: -12.0, lon: -77.0 },
  { id: "hotel", title: "Hotel Check-in", blurb: "Get your room and the wifi code.", tag: "B1 · Travel", lat: 48.9, lon: 2.3 },
  { id: "interview", title: "Job Interview", blurb: "Sell yourself in Spanish.", tag: "B2 · Work", lat: 41.4, lon: 2.2 },
];

// The mission LIST is loaded from the API (missionsApi) so seeded missions —
// and every future one — appear automatically. The hardcoded MISSIONS above act
// as a per-id "overlay" of rich playable content (grammar/listening/speaking/
// writing/levels/emoji/coords) for missions that have it authored. A DB mission
// with no overlay still shows, driven by its title + vocab.
const MISSION_OVERLAY: Record<string, Mission> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
);

// Globe coordinates for missions with no authored overlay, so they still pin.
const FALLBACK_COORDS: [number, number][] = [
  [40.4, -3.7], [19.4, -99.1], [-12.0, -77.0], [48.9, 2.3],
  [-34.6, -58.4], [41.4, 2.2], [35.7, 139.7], [-33.9, 151.2],
];

// Build a Mission from its DB fields. Vocab is passed separately: the list
// renders with an empty vocab (loaded lazily per mission on open), the detail
// fetch passes the real vocab.
// Balanced [start, end) ranges splitting `total` words into bursts of ~4-5 —
// a working-memory-sized chunk for items being newly encoded (smaller than
// the ~4-7 often cited for *held* items, since new encoding tolerates less).
// A 12-word mission gets 3 bursts of 4, never one burst of 6+6.
function vocabBurstRanges(total: number): [number, number][] {
  if (total <= 0) return [];
  const burstCount = Math.max(1, Math.ceil(total / 5));
  const size = Math.ceil(total / burstCount);
  const ranges: [number, number][] = [];
  for (let start = 0; start < total; start += size) {
    ranges.push([start, Math.min(total, start + size)]);
  }
  return ranges;
}

const VOCAB_BURST_LABEL = ["I", "II", "III", "IV", "V", "VI"];

// Splices generated Vocabulary I/II/III… steps into a mission's authored
// non-vocab steps (Listening, Grammar, Speaking, Writing, Final Challenge):
// burst 1 after Listening, burst 2 after Grammar (interleaved, per the
// revised mission flow), any further bursts right before Speaking.
function buildMissionSteps(base: MissionLevel[], vocabCount: number): MissionLevel[] {
  const ranges = vocabBurstRanges(vocabCount);
  const vocabSteps: MissionLevel[] = ranges.map(([start, end], i) => ({
    name: ranges.length === 1 ? "Vocabulary" : `Vocabulary ${VOCAB_BURST_LABEL[i] ?? i + 1}`,
    learn: `${end - start} new word${end - start === 1 ? "" : "s"} — image recognition, active recall, pronunciation.`,
    minutes: Math.max(3, end - start),
    vocabBurst: i,
  }));
  const listening = base.find((s) => s.name === "Listening");
  const grammar = base.find((s) => s.name === "Grammar");
  const rest = base.filter((s) => s !== listening && s !== grammar);
  const steps: MissionLevel[] = [];
  if (listening) steps.push(listening);
  if (vocabSteps[0]) steps.push(vocabSteps[0]);
  if (grammar) steps.push(grammar);
  if (vocabSteps[1]) steps.push(vocabSteps[1]);
  steps.push(...vocabSteps.slice(2)); // any 3rd+ burst spills in, still before Speaking
  steps.push(...rest); // Speaking, Writing, Final Challenge, in authored order
  return steps;
}

function buildMission(
  id: string,
  title: string,
  description: string | null,
  vocab: { es: string; en: string }[],
  i: number,
  speakingScript?: MissionSpeaking | null,
  status?: string | null,
  grammarPatterns?: { id: string; cloze_template: string }[],
): Mission {
  const base = MISSION_OVERLAY[id];
  if (base) {
    // Rich content from the overlay, but title/blurb/vocab stay DB-driven, and
    // the vocab-burst steps are generated fresh from the real word count.
    const levels = base.levels ? buildMissionSteps(base.levels, vocab.length) : undefined;
    return { ...base, id, title, blurb: description ?? base.blurb, vocab, levels, speakingScript, status, grammarPatterns };
  }
  const [lat, lon] = FALLBACK_COORDS[i % FALLBACK_COORDS.length];
  return {
    id,
    icon: "globe",
    title,
    blurb: description ?? "",
    tag: "Mission",
    lat,
    lon,
    vocab,
    grammar: [],
    listening: { es: "", en: "", q: { question: "", options: [], answer: 0 } },
    speaking: { es: "", en: "" },
    writing: { promptEn: "", targetEs: "" },
    speakingScript,
    status,
  };
}

/* ════════════════════════ FINAL CHALLENGE ════════════════════════
   The mission finale: one continuous, unscaffolded real-world conversation.
   Cold open (NPC speaks first, no test framing), free text input, native-speed
   in-character replies. Meaning over form — the backend LLM judges intent and
   repairs misunderstandings IN ROLE rather than failing the learner. The scene
   ends only when the interaction genuinely completes (done=true). */
type FcTurn = { who: "npc" | "learner"; es: string; en?: string; correction?: string };

function FinalChallenge({ mission, onExit }: { mission: Mission; onExit: () => void }) {
  const [scene, setScene] = useState<SpeakingScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<FcTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Cold open: fetch the scene, drop the learner straight into the NPC's first
  // line — no "Final Challenge: order a coffee" setup screen. Speak it aloud so
  // it feels like walking into the café, not reading a quiz.
  useEffect(() => {
    let alive = true;
    missionsApi
      .speakingScene(mission.id)
      .then((s) => {
        if (!alive) return;
        setScene(s);
        setTurns([{ who: "npc", es: s.opening, en: s.opening_en }]);
        speakEs(s.opening);
      })
      .catch(() => { if (alive) setError("Could not start the challenge. Try again in a moment."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mission.id]);

  // Keep the newest line in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const send = async () => {
    const utterance = input.trim();
    if (!utterance || busy || !scene || done) return;
    // History the backend sees is everything BEFORE this utterance.
    const history = turns.map((t) => ({ speaker: t.who, text: t.es }));
    setTurns((t) => [...t, { who: "learner", es: utterance }]);
    setInput("");
    setBusy(true);
    try {
      const r = await missionsApi.speakingTurn(mission.id, {
        role: scene.role,
        setting: scene.setting,
        goal: scene.goal,
        history,
        utterance,
      });
      setTurns((t) => {
        const next = [...t];
        // Attach any gentle correction to the learner's line we just added.
        if (r.correction) {
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].who === "learner") { next[i] = { ...next[i], correction: r.correction }; break; }
          }
        }
        next.push({ who: "npc", es: r.npc_reply, en: r.npc_reply_en });
        return next;
      });
      speakEs(r.npc_reply);
      if (r.done) {
        setDone(true);
        // The interaction succeeded — record the mission as completed. Fire-and-
        // forget: a failed write must not block the celebratory finish.
        void missionsApi.complete(mission.id).catch(() => {});
      }
    } catch {
      // Stay in-scene on failure rather than throwing a test-style error.
      setTurns((t) => [...t, { who: "npc", es: "Perdone, no le oí bien. ¿Puede repetir?", en: "Sorry, I didn't catch that. Can you repeat?" }]);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ width: "100%", display: "grid", placeItems: "center", paddingTop: 60 }}>
        <div className="mi-prep-spinner" aria-hidden />
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ width: "100%", display: "grid", placeItems: "center", paddingTop: 40 }}>
        <div className="sp-card gr-stage-card" style={{ textAlign: "center", maxWidth: 460 }}>
          <p className="sp-sub" style={{ marginBottom: 18 }}>{error}</p>
          <button className="sp-btn sp-btn-primary" onClick={onExit}>Back to missions</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-wrap">
      <div className="fc-head">
        <span className="sp-tag pink"><Icon name="spark" size={15} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Final Challenge</span>
        {scene && <span className="fc-scene">{scene.setting}</span>}
      </div>

      <div className="fc-thread" ref={scrollRef}>
        {turns.map((t, i) => (
          <div key={i} className={"fc-turn " + t.who}>
            <div className="fc-bubble">
              <span className="fc-es">{t.es}</span>
              {t.who === "npc" && (
                <span className="fc-tools">
                  <button className="fc-icon" title="Hear it again" onClick={() => speakEs(t.es)}><Icon name="speaker" size={14} /></button>
                  <FcReveal en={t.en} />
                </span>
              )}
            </div>
            {t.correction && (
              <div className="fc-correction" title="A more natural way to say it">
                <Icon name="spark" size={12} /> {t.correction}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="fc-turn npc">
            <div className="fc-bubble fc-typing"><i /><i /><i /></div>
          </div>
        )}
      </div>

      {done ? (
        <div className="fc-done">
          <div className="fc-done-badge"><Icon name="check" size={22} /></div>
          <div className="fc-done-txt">
            <b>Mission complete</b>
            <span>You handled the whole conversation in Spanish.</span>
          </div>
          <button className="sp-btn sp-btn-primary" style={{ minHeight: 46 }} onClick={onExit}>
            Back to missions <Icon name="chevron" size={16} />
          </button>
        </div>
      ) : (
        <div className="fc-inputbar">
          <input
            className="fc-input"
            value={input}
            placeholder="Responde en español…"
            autoFocus
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          <button className="fc-send sp-btn sp-btn-primary" disabled={busy || !input.trim()} onClick={send} title="Send">
            <Icon name="chevron" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// English is hidden by default (immersion first). The learner can uncover it for
// one line if they're stuck — a repair aid, not an always-on translation.
function FcReveal({ en }: { en?: string }) {
  const [open, setOpen] = useState(false);
  if (!en) return null;
  return open ? (
    <span className="fc-en">{en}</span>
  ) : (
    <button className="fc-icon" title="What did that mean?" onClick={() => setOpen(true)}>?</button>
  );
}

// A mission run is now a focused vocabulary session: the exact same 5-level
// trainer as the Vocabulary tab, scoped to this mission's words. No multi-skill
// steps. The trainer self-centres (.vt-wrap has margin:auto), so we don't wrap
// it in .ls-stage (whose 760px cap would squeeze the level-1 layout).
function MissionRun({ mission, onExit }: { mission: Mission; onExit: () => void }) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div style={{ width: "100%", display: "grid", placeItems: "center", paddingTop: 40 }}>
        <div className="sp-card gr-stage-card" style={{ textAlign: "center", maxWidth: 460 }}>
          <div className="mi-complete-emoji"><Icon name={mission.icon} size={64} /></div>
          <div className="gr-done-ico" style={{ margin: "0 auto 12px" }}><Icon name="check" size={26} /></div>
          <h2 className="sp-h2" style={{ marginBottom: 6 }}>Vocabulary complete</h2>
          <p className="sp-sub" style={{ marginBottom: 20 }}>
            Every word is off to a solid start. They&apos;ll keep coming back in Review to build toward full mastery.
          </p>
          <button className="sp-btn sp-btn-primary" onClick={onExit}>Back to missions <Icon name="chevron" size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div className="mi-runhead" style={{ maxWidth: 640, margin: "0 auto", justifyContent: "center" }}>
        <span className="sp-tag pink"><Icon name={mission.icon} size={16} style={{ verticalAlign: "-2px", marginRight: 4 }} /> {mission.title}</span>
      </div>
      <VocabTrainer
        missionId={mission.id}
        advanceThreshold={MISSION_ADVANCE_LEVEL}
        missionVocabLevels={mission.vocab}
        onBack={onExit}
        onDone={() => setDone(true)}
        backLabel="Missions"
        emptyTitle="Vocabulary done!"
      />
    </div>
  );
}

// The "downloading" window shown the first time a mission is opened, while its
// vocabulary runs through the Gemini enrichment pipeline.
function MissionPreparing({ title, enriched, total, onCancel }: {
  title: string; enriched: number; total: number; onCancel: () => void;
}) {
  const pct = total > 0 ? Math.round((enriched / total) * 100) : 0;
  return (
    <div className="mi-prep-overlay" role="dialog" aria-modal="true">
      <div className="sp-card mi-prep-card">
        <div className="mi-prep-spinner" aria-hidden />
        <h2 className="sp-h2" style={{ marginBottom: 6 }}>Preparing {title || "mission"}…</h2>
        <p className="sp-sub" style={{ marginBottom: 18 }}>
          Downloading and enriching the vocabulary. This runs once — next time the mission opens instantly.
        </p>
        <div className="mi-prep-bar"><div className="mi-prep-fill" style={{ width: `${pct}%` }} /></div>
        <p className="mi-prep-count">{enriched} / {total || "…"} words ready</p>
        <button className="sp-btn sp-btn-soft" style={{ marginTop: 16, minHeight: 44 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function MissionScreen() {
  const router = useRouter();
  const [active, setActive] = useState<Mission | null>(null);
  const [planet, setPlanet] = useState<Mission | null>(null);
  const [lesson, setLesson] = useState(false); // running the mission's step-by-step lesson
  const [stepIndex, setStepIndex] = useState(0); // which step the user is practising
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  // Soft nudge (never a hard block) shown when the user has due reviews and
  // hasn't already dismissed it this session — offers a detour to /study
  // before jumping into a new mission.
  const [reviewPrompt, setReviewPrompt] = useState<{ missionId: string; dueCount: number } | null>(null);
  // The "downloading" window shown while a mission's Gemini enrichment runs
  // (first open only). null when no mission is being prepared.
  const [preparing, setPreparing] = useState<
    { id: string; title: string; enriched: number; total: number } | null
  >(null);
  // Cache each mission's fetched detail so re-opening doesn't refetch.
  const detailCache = useRef<Record<string, Mission>>({});
  // Deep-link restore: a mission/step/lesson read from the URL on first mount,
  // applied once the mission's planet has loaded. Cleared after it's consumed.
  const deepLink = useRef<{ mid: string; step: number; lesson: boolean } | null>(null);
  const didDeepLink = useRef(false);

  // The mission LIST is loaded from the backend (summaries only — no vocab), so
  // newly seeded missions appear here with no frontend change.
  useEffect(() => {
    let alive = true;
    missionsApi
      .list()
      .then((data) => {
        if (alive) setMissions(data.map((s, i) => buildMission(s.id, s.title, s.description, [], i)));
      })
      .catch(() => { if (alive) setError("Could not load missions."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Turn a fetched mission detail into a Mission and enter its planet.
  const enterPlanet = useCallback((detail: ApiMission) => {
    const i = missions.findIndex((m) => m.id === detail.id);
    const full = buildMission(
      detail.id,
      detail.title,
      detail.description,
      detail.vocab.map((v) => ({ es: v.spanish, en: v.english, level: v.level })),
      i < 0 ? 0 : i,
      detail.speaking,
      detail.status,
      detail.grammar,
    );
    detailCache.current[detail.id] = full;
    setPlanet(full);
    // The mission is now enriched and open — pre-generate its listening audio on
    // the backend (persisted to disk) so every clip is ready before the learner
    // reaches the Listening step. Fire-and-forget; playback synthesises live if
    // this hasn't finished. Only cached texts are skipped server-side.
    const listening = MISSION_LISTENING_LESSONS[detail.id];
    if (listening) {
      void ttsApi.prewarm(audioTextsForScript(listening)).catch(() => {});
    }
  }, [missions]);

  // Re-fetch a mission's vocab levels and patch the open planet + its cache, so
  // the rings reflect the user's real training level (e.g. after a session).
  const refreshLevels = useCallback(async (id: string) => {
    try {
      const detail = await missionsApi.get(id);
      const vocab = detail.vocab.map((v) => ({ es: v.spanish, en: v.english, level: v.level }));
      const cached = detailCache.current[id];
      const updated = cached ? { ...cached, vocab, status: detail.status } : null;
      if (updated) detailCache.current[id] = updated;
      setPlanet((p) => (p && p.id === id && updated ? updated : p));
    } catch { /* leave the current levels in place */ }
  }, []);

  // Load one mission on demand. If its Gemini enrichment has never run, show the
  // downloading window and only enter once it's ready; otherwise open straight.
  const enterMission = useCallback(async (id: string) => {
    const cached = detailCache.current[id];
    if (cached) {
      // Deck already exists — show instantly, then sync levels in the background.
      void missionsApi.start(id).catch(() => {});
      setPlanet(cached);
      void refreshLevels(id);
      return;
    }
    const title = missions.find((m) => m.id === id)?.title ?? "";
    setOpeningId(id);
    try {
      // Await start so the user's deck cards exist before we read their levels —
      // otherwise every word reads back as "New" on the first open. Idempotent.
      await missionsApi.start(id).catch(() => {});
      const detail = await missionsApi.get(id);
      if (detail.enrichment_status === "ready") {
        enterPlanet(detail);
      } else {
        // First open — the pipeline is (or is now) running. Show the window; the
        // polling effect below drives it to completion.
        setPreparing({ id, title, enriched: 0, total: detail.vocab.length });
      }
    } catch {
      setError("Could not open mission.");
    } finally {
      setOpeningId(null);
    }
  }, [missions, enterPlanet, refreshLevels]);

  // Entry point used by the UI. Checks for due reviews first and offers a
  // detour — but never blocks: skipping (or a failed check) always proceeds
  // straight into the mission. Asked at most once per browser session.
  const openMission = useCallback(async (id: string) => {
    const alreadyAsked =
      typeof window !== "undefined" && sessionStorage.getItem("sp-review-nudge-dismissed") === "1";
    if (!alreadyAsked) {
      try {
        const due = await studyApi.due();
        if (due.length > 0) {
          setReviewPrompt({ missionId: id, dueCount: due.length });
          return;
        }
      } catch { /* review check failed — don't let it block mission entry */ }
    }
    await enterMission(id);
  }, [enterMission]);

  // Deep link: on first mount, if the URL names a mission, open it straight
  // (bypassing the review nudge) and remember the step/lesson to restore once
  // the planet has loaded. Lets a reload drop the user back into the mission.
  useEffect(() => {
    if (didDeepLink.current || typeof window === "undefined") return;
    didDeepLink.current = true;
    const sp = new URLSearchParams(window.location.search);
    const mid = sp.get("mission");
    if (!mid) return;
    deepLink.current = { mid, step: Number(sp.get("step")) || 0, lesson: sp.get("lesson") === "1" };
    void enterMission(mid);
  }, [enterMission]);

  // Apply the deep-linked step/lesson once its planet is open, then consume it.
  useEffect(() => {
    const dl = deepLink.current;
    if (!planet || !dl || planet.id !== dl.mid) return;
    deepLink.current = null;
    setStepIndex(dl.step);
    if (dl.lesson) setLesson(true);
  }, [planet]);

  // Mirror the open mission into the URL (?mission=&step=&lesson=) so a reload
  // restores it. replaceState (not push) keeps in-dashboard history clean. The
  // ?tab= param set elsewhere is preserved.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (planet) {
      url.searchParams.set("mission", planet.id);
      if (stepIndex) url.searchParams.set("step", String(stepIndex));
      else url.searchParams.delete("step");
      if (lesson) url.searchParams.set("lesson", "1");
      else url.searchParams.delete("lesson");
    } else {
      url.searchParams.delete("mission");
      url.searchParams.delete("step");
      url.searchParams.delete("lesson");
    }
    window.history.replaceState(window.history.state, "", url);
  }, [planet, lesson, stepIndex]);

  // Leaving the mission tab unmounts this screen — strip the mission params so
  // the URL doesn't keep pointing at a mission the user has left.
  useEffect(() => () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("mission");
    url.searchParams.delete("step");
    url.searchParams.delete("lesson");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  // While the downloading window is up, poll enrichment progress. When ready,
  // fetch the now-enriched mission and enter it.
  useEffect(() => {
    if (!preparing) return;
    const id = preparing.id;
    let alive = true;
    const tick = async () => {
      try {
        const s = await missionsApi.status(id);
        if (!alive) return;
        setPreparing((p) => (p && p.id === id ? { ...p, enriched: s.enriched, total: s.total } : p));
        if (s.status === "ready") {
          const detail = await missionsApi.get(id);
          if (!alive) return;
          enterPlanet(detail);
          setPreparing(null);
        }
      } catch { /* transient — keep polling */ }
    };
    const iv = setInterval(tick, 2500);
    tick();
    return () => { alive = false; clearInterval(iv); };
  }, [preparing?.id, enterPlanet]);

  // Stable pin array — a fresh array each render would rebuild the globe and reset its rotation.
  const globePins = useMemo(
    () => [
      ...missions.map((m) => ({ id: m.id, title: m.title, lat: m.lat, lon: m.lon })),
      ...LOCKED_MISSIONS.map((m) => ({ id: m.id, title: m.title, lat: m.lat, lon: m.lon, locked: true })),
    ],
    [missions],
  );
  if (planet && lesson) {
    // Which step is being practised drives which exercise runs. Every step
    // returns to this same mission hub (progress bar + vocab-with-levels) on
    // completion — steps stay separated rather than auto-chaining into each
    // other — and refreshes levels so the hub reflects what just changed.
    const curStepLevel = planet.levels?.[Math.min(stepIndex, (planet.levels?.length ?? 1) - 1)];
    const stepName = curStepLevel?.name;
    const grammarScript = stepName === "Grammar" ? MISSION_GRAMMAR_LESSONS[planet.id] : undefined;
    const listeningScript = stepName === "Listening" ? MISSION_LISTENING_LESSONS[planet.id] : undefined;
    const writingScript = stepName === "Writing" ? MISSION_WRITING_LESSONS[planet.id] : undefined;
    const isSpeaking = stepName === "Speaking";
    const finalChallenge = stepName === "Final Challenge";
    // Each vocabulary step drills one ~4-5-word burst of the mission's words
    // (see buildMissionSteps/vocabBurstRanges) instead of all of them at once,
    // and finishes once every word in that burst reaches MISSION_ADVANCE_LEVEL
    // — not full mastery. Mastery keeps accruing later via ordinary FSRS review.
    const burstIndex = curStepLevel?.vocabBurst;
    const vocabBurstWords =
      burstIndex != null
        ? planet.vocab.slice(...vocabBurstRanges(planet.vocab.length)[burstIndex])
        : null;
    const backToHub = () => { setLesson(false); void refreshLevels(planet.id); };
    return (
      <div
        className="sp-lesson-fill"
        style={{
          position: "fixed", inset: 0, zIndex: 1002, background: "var(--bg)",
          overflow: "auto", padding: "clamp(18px, 2.4vw, 30px) clamp(18px, 3vw, 40px) 60px",
        }}
      >
        {grammarScript ? (
          <GrammarLesson script={grammarScript} onExit={backToHub} onDone={backToHub} patterns={planet.grammarPatterns} />
        ) : listeningScript ? (
          <ListeningLesson script={listeningScript} onExit={backToHub} onDone={backToHub} />
        ) : writingScript ? (
          <WritingLesson script={writingScript} onExit={backToHub} onDone={backToHub} />
        ) : isSpeaking ? (
          planet.speakingScript ? (
            <SpeakingTrainer
              speaking={planet.speakingScript}
              missionId={planet.id}
              onExit={backToHub}
              onDone={backToHub}
            />
          ) : (
            <div className="sp-card vt-card" style={{ textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
              <p className="sp-sub" style={{ marginBottom: 20 }}>
                Speaking practice is still being prepared for this mission. Check back in a moment.
              </p>
              <button className="sp-btn sp-btn-primary" onClick={backToHub}>Back</button>
            </div>
          )
        ) : finalChallenge ? (
          <FinalChallenge mission={planet} onExit={backToHub} />
        ) : vocabBurstWords ? (
          <VocabTrainer
            missionId={planet.id}
            words={vocabBurstWords.map((v) => v.es)}
            advanceThreshold={MISSION_ADVANCE_LEVEL}
            missionVocabLevels={vocabBurstWords}
            onBack={backToHub}
            onDone={backToHub}
            backLabel="Missions"
            emptyTitle={`${stepName} ready!`}
          />
        ) : (
          <MissionRun mission={planet} onExit={backToHub} />
        )}
      </div>
    );
  }
  if (planet) return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "var(--bg)",
      }}
    >
      {(() => {
        // If the mission defines step-levels, drive the planet from them.
        if (planet.levels && planet.levels.length) {
          const cur = Math.min(stepIndex, planet.levels.length - 1);
          const curLevel = planet.levels[cur];
          return (
            <PlanetScene
              title={planet.title}
              vocab={planet.vocab}
              steps={planet.levels}
              levelIndex={cur}
              levelCount={planet.levels.length}
              level={curLevel}
              nextLevel={planet.levels[cur + 1]}
              onLevel={curLevel.vocabBurst != null ? () => setLesson(true) : undefined}
              // Clicking a step selects it and starts its practice. Only the
              // vocabulary trainer is built, so every step runs it (scoped to
              // the mission's words) for now.
              onStep={(i) => { setStepIndex(i); setLesson(true); }}
            />
          );
        }
        // Fallback for missions without defined levels.
        const idx = missions.findIndex((x) => x.id === planet.id);
        const next = missions[(idx + 1) % missions.length];
        return (
          <PlanetScene
            title={planet.title}
            vocab={planet.vocab}
            levelIndex={idx}
            levelCount={7}
            level={{
              name: planet.tag,
              learn: `${planet.blurb} — ${planet.vocab.length} words, ${planet.grammar.length} grammar patterns.`,
              minutes: 5 + planet.vocab.length + planet.grammar.length,
            }}
            nextLevel={
              next && {
                name: next.tag,
                learn: next.blurb,
                minutes: 5 + next.vocab.length + next.grammar.length,
              }
            }
          />
        );
      })()}
      <button
        className="sp-btn"
        onClick={() => { setPlanet(null); setStepIndex(0); }}
        style={{ position: "absolute", top: 16, left: 16, zIndex: 1001 }}
      >
        <Icon name="chevron" size={16} /> Back
      </button>
    </div>
  );
  if (active) return (
    <>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Mission · {active.tag}</p>
        <h1 className="sp-h1">{active.title}</h1>
      </div>
      <MissionRun mission={active} onExit={() => setActive(null)} />
    </>
  );
  return (
    <div className="mi-stage">
      {preparing && (
        <MissionPreparing
          title={preparing.title}
          enriched={preparing.enriched}
          total={preparing.total}
          onCancel={() => setPreparing(null)}
        />
      )}
      {reviewPrompt && (
        <div className="mi-prep-overlay" role="dialog" aria-modal="true">
          <div className="sp-card mi-prep-card">
            <h2 className="sp-h2" style={{ marginBottom: 6 }}>Reviews are waiting</h2>
            <p className="sp-sub" style={{ marginBottom: 18 }}>
              {reviewPrompt.dueCount} word{reviewPrompt.dueCount !== 1 ? "s" : ""} from earlier missions
              could use a quick review before you start something new.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                className="sp-btn sp-btn-soft"
                onClick={() => {
                  sessionStorage.setItem("sp-review-nudge-dismissed", "1");
                  const id = reviewPrompt.missionId;
                  setReviewPrompt(null);
                  void enterMission(id);
                }}
              >
                Skip, start mission
              </button>
              <button
                className="sp-btn sp-btn-primary"
                onClick={() => { setReviewPrompt(null); router.push("/study"); }}
              >
                Review now
              </button>
            </div>
          </div>
        </div>
      )}
      <aside className="mi-side">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Missions</p>
        <h1 className="sp-h1" style={{ marginBottom: 8 }}>Real situations, every skill at once</h1>
        <p className="sp-sub" style={{ marginBottom: 22 }}>
          Spin the globe and hover a pin. Locked pins are missions you’ll unlock as you level up.
        </p>
        <h2 className="mi-side-title">Current available missions</h2>
        {loading && <p className="sp-sub">Loading missions…</p>}
        {error && <p className="sp-sub" style={{ color: "var(--negative)" }}>{error}</p>}
        {!loading && !error && missions.length === 0 && (
          <p className="sp-sub">No missions yet — run the seed to add them.</p>
        )}
        <div className="mi-side-list">
          {missions.map((m) => (
            <div key={m.id} className="sp-card mi-card mi-float-card" onClick={() => openMission(m.id)}>
              <div className="mi-card-body">
                <div className="mi-card-title">{m.title}</div>
                <div className="mi-card-blurb">{m.blurb}</div>
              </div>
              <span className="sp-tag ghost">{openingId === m.id ? "Loading…" : m.tag}</span>
            </div>
          ))}
        </div>
      </aside>

      <div className="mi-globe-col">
        <MissionGlobe
          pins={globePins}
          onSelect={(id) => { if (missions.some((x) => x.id === id)) openMission(id); }}
          renderCard={(p) => {
            if (p.locked) {
              const lm = LOCKED_MISSIONS.find((x) => x.id === p.id);
              if (!lm) return null;
              return (
                <div className="sp-card mi-card mi-float-card is-locked">
                  <div className="mi-card-body">
                    <div className="mi-card-title">{lm.title}</div>
                    <div className="mi-card-blurb">{lm.blurb}</div>
                  </div>
                  <span className="sp-tag ghost">Locked · {lm.tag}</span>
                </div>
              );
            }
            const m = missions.find((x) => x.id === p.id);
            if (!m) return null;
            return (
              <div className="sp-card mi-card mi-float-card" onClick={() => openMission(m.id)}>
                <div className="mi-card-body">
                  <div className="mi-card-title">{m.title}</div>
                  <div className="mi-card-blurb">{m.blurb}</div>
                </div>
                <span className="sp-tag ghost">{m.tag}</span>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

/* ════════════════════════ SPEAKING (placeholder) ════════════════════════
   Not wired yet — design surface only while the speech approach is decided. */
const SPEAKING_MODES = [
  { ic: "speaker", n: "Repeat", s: "Hear it → repeat it → pronunciation score." },
  { ic: "doc", n: "Read aloud", s: "A paragraph appears, you read it, get feedback." },
  { ic: "grammar", n: "Guided conversation", s: "AI chats with you, turn by turn." },
  { ic: "target", n: "Scenario mode", s: "Restaurant · airport · hotel · doctor · dating · job interview · travel." },
  { ic: "vocabulary", n: "Describe a picture", s: "An image appears — describe everything you see." },
  { ic: "bolt", n: "Debate", s: "Intermediate+. “Should cities ban cars?” AI rates grammar, vocab, fluency, naturalness." },
];
function SpeakingScreen() {
  return (
    <div>
      <div className="sp-pagehead">
        <p className="sp-eyebrow" style={{ marginBottom: 6 }}>Speaking</p>
        <h1 className="sp-h1">The missing piece</h1>
      </div>
      <div className="sp-card rv-intro" style={{ marginBottom: 16 }}>
        <p className="sp-sub">
          Speaking modes are being designed. Pick the approach for live speech and these
          come alive. <b style={{ color: "var(--pink-text)" }}>Coming soon.</b>
        </p>
      </div>
      <div className="quick-row sp-modes">
        {SPEAKING_MODES.map((m) => (
          <div className="sp-card quick sp-mode" key={m.n}>
            <div className="q-ico"><Icon name={m.ic} size={22} /></div>
            <div>
              <div className="q-name">{m.n}</div>
              <div className="q-sub">{m.s}</div>
            </div>
            <span className="sp-tag ghost sp-soon">Soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════ Shell ════════════════════════ */
export default function AppShell({ avatarLetter }: { avatarLetter: string }) {
  const router = useRouter();
  // Init to the server-safe default; read the real tab from the URL only after
  // mount so SSR and first client render agree (avoids a hydration mismatch).
  const [tab, setTabState] = useState<TabKey>("home");
  useEffect(() => { setTabState(readTabFromUrl()); }, []);
  const setTab = useCallback((k: TabKey) => {
    setTabState(k);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (k === "home") url.searchParams.delete("tab");
    else url.searchParams.set("tab", k);
    // replaceState (not push) keeps in-dashboard history clean while making the
    // current entry carry the tab, so browser Back from /vocab etc. restores it.
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const [saved, setSaved] = useState<string[]>(["frontera", "esperanza"]);
  // Same reasoning as `tab`: default false on server + first client render,
  // then resolve the stored/system theme after mount.
  const [dark, setDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("sp-theme");
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

  const onSave = (w: string) => {
    setSaved((s) => (s.includes(w) ? s : [...s, w]));
    // Best-effort persist to the real study deck (DeepL translate + card).
    vocabApi.save(w).catch(() => {});
  };

  const goVocab = () => router.push("/vocab");

  // Object build-in: drift + fade each screen's top-level blocks on tab change.
  const screenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
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
  }, [tab]);

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

  const screens: Record<TabKey, React.ReactNode> = {
    home: <HomeScreen go={setTab} onReview={goVocab} />,
    review: <ReviewScreen />,
    mission: <MissionScreen />,
    podcast: <ListeningScreen saved={saved} onSave={onSave} />,
    speaking: <SpeakingScreen />,
    grammar: <GrammarScreen />,
    vocabulary: <VocabularyScreen onReview={goVocab} />,
    writing: <WritingScreen />,
  };

  return (
    <div className={"sp-root" + (dark ? " dark" : "")}>
      <div ref={bgRef} className="sp-bg" aria-hidden="true">
        <div className="sp-cursor-glow" />
        <div className="sp-blob b1" />
        <div className="sp-blob b2" />
        <div className="sp-blob b3" />
      </div>

      <div className="sp-app">
        <header className="sp-topbar">
          <div className="sp-logo">
            <div className="sp-logo-mark">S</div>
            <div className="sp-logo-text">Spanish<b>Up</b></div>
          </div>
          <div className="sp-topbar-right">
            <div className="sp-mini-streak"><Flame size={19} style={{ margin: "-3px -1px" }} /> 0</div>
            <button className="sp-themetoggle" title={dark ? "Light mode" : "Dark mode"} onClick={() => setDark((d) => !d)}>
              <Icon name={dark ? "sun" : "moon"} size={17} />
            </button>
            <button className="sp-avatar" title="Open classic study mode" onClick={() => router.push("/study")}>
              {avatarLetter}
            </button>
          </div>
        </header>

        <main className="sp-main">
          <div className={"screen " + tab} key={tab} ref={screenRef}>
            {screens[tab]}
          </div>
        </main>
      </div>

      <WordNav tab={tab} setTab={setTab} />
    </div>
  );
}
