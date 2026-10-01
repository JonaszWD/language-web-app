"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { statsApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import { PRONUNCIATION_TALLY_KEY, SOUNDS } from "@/components/PronunciationPractice";
import type { DashboardStats } from "@/types";

/* ════════════════════════ HOME ════════════════════════
   Trimmed to the two cards that matter right now: a quick jump into every
   study mode, and the raw tracked-data readout. */

// Glass bento card — mirrors the top dock's frosted-capsule look, with a
// subtle mouse-follow tilt and a corner arrow that reveals on hover.
function BentoCard({ className, onClick, children }: { className?: string; onClick?: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -3, y: px * 3 });
  };
  return (
    <div
      ref={ref}
      className={"sp-card bento-card" + (className ? " " + className : "")}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onClick={onClick}
      style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, cursor: onClick ? "pointer" : undefined }}
    >
      <span className="bento-arrow"><Icon name="chevron" size={16} style={{ transform: "rotate(-45deg)" }} /></span>
      {children}
    </div>
  );
}

export default function HomeScreen() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => { statsApi.dashboard().then(setStats).catch(() => {}); }, []);

  // Quick jump tiles — one tap into each study mode.
  const quickLinks: { label: string; ic: string; href: string }[] = [
    { label: "Vocabulary", ic: "vocabulary", href: "/vocabulary?mode=training" },
    { label: "Listening", ic: "podcast", href: "/listening" },
    { label: "Speaking", ic: "speaker", href: "/speaking" },
    { label: "Grammar", ic: "grammar", href: "/grammar" },
    { label: "Writing", ic: "writing", href: "/writing" },
    { label: "Missions", ic: "globe", href: "/missions" },
  ];

  return (
    <div className="bento-grid">
      {/* raw data — every tracked value, unrounded */}
      <BentoCard className="span-2">
        <TrackedData stats={stats} />
      </BentoCard>

      {/* quick access — one tap into any mode; sized to its content, not
          stretched to match the taller Data card beside it */}
      <BentoCard className="hm-jumpin-card">
        <h2 className="bento-title">Jump in</h2>
        <p className="bento-desc" style={{ margin: "2px 0 10px" }}>Every study mode, one tap away</p>
        <div className="bento-quick-grid">
          {quickLinks.map((q) => (
            <Link className="bento-quick-tile" key={q.label} href={q.href} style={{ textDecoration: "none", color: "inherit" }}>
              <span className="bento-quick-tile-ico"><Icon name={q.ic} size={18} /></span>
              <span className="bento-quick-tile-lbl">{q.label}</span>
            </Link>
          ))}
        </div>
      </BentoCard>
    </div>
  );
}

// Metrics grouped by lesson type — mirrors the mission's five steps. Each
// metric maps to a skill_stats row where one exists (attempts/accuracy/avg
// score/last practiced, from UserSkillStats — see backend/app/services/
// skill_stats.py), or to the deck/session aggregates in vocab_extra,
// grammar_extra and progress_extra (backend/app/routers/stats.py).
function skillField(
  stats: DashboardStats | null,
  key: string,
  field:
    | "attempts" | "accuracy" | "avg_score" | "last_practiced_at" | "avg_response_ms"
    | "max_stage_reached" | "replays_total" | "transcript_reveals_total" | "last_speed_reached"
    | "retries_total" | "recordings_total",
): string {
  const row = stats?.skills?.[key];
  if (!row) return "—";
  switch (field) {
    case "attempts": return String(row.attempts);
    case "accuracy": return row.attempts ? `${Math.round(row.accuracy * 100)}%` : "—";
    case "avg_score": return row.avg_score != null ? String(Math.round(row.avg_score)) : "—";
    case "last_practiced_at": return row.last_practiced_at ? new Date(row.last_practiced_at).toLocaleDateString() : "—";
    case "avg_response_ms": return row.avg_response_ms ? `${(row.avg_response_ms / 1000).toFixed(1)}s` : "—";
    case "max_stage_reached": return row.max_stage_reached != null ? String(row.max_stage_reached) : "—";
    case "replays_total": return String(row.replays_total);
    case "transcript_reveals_total": return String(row.transcript_reveals_total);
    case "last_speed_reached": return row.last_speed_reached != null ? `${row.last_speed_reached}x` : "—";
    case "retries_total": return row.attempts ? (row.retries_total / row.attempts).toFixed(1) : "—";
    case "recordings_total": return String(row.recordings_total);
  }
}

type DataMetric = { label: string; value: string };

const pct = (n: number | null | undefined) => (n != null ? `${Math.round(n * 100)}%` : "—");

// Converts the server's UTC hour to the viewer's local clock, bucketed.
function studyTimeOfDay(utcHour: number | null | undefined): string {
  if (utcHour == null) return "—";
  const d = new Date();
  d.setUTCHours(utcHour, 0, 0, 0);
  const h = d.getHours();
  const part = h < 5 ? "Night" : h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  return `${part} (~${String(h).padStart(2, "0")}:00)`;
}

// Weakest vs strongest accuracy among skills with enough attempts to mean something.
function skillBalance(stats: DashboardStats | null): string {
  const rows = Object.entries(stats?.skills ?? {}).filter(([, r]) => r.attempts >= 3);
  if (rows.length < 2) return "—";
  rows.sort((a, b) => a[1].accuracy - b[1].accuracy);
  const [weak, strong] = [rows[0], rows[rows.length - 1]];
  return `${weak[0]} ${pct(weak[1].accuracy)} vs ${strong[0]} ${pct(strong[1].accuracy)}`;
}

// Per-sound accuracy recorded by PronunciationPractice (browser-local).
function loadProblemSounds(): string {
  try {
    const raw = window.localStorage.getItem(PRONUNCIATION_TALLY_KEY);
    const tally = raw ? (JSON.parse(raw) as Record<string, { hit: number; miss: number }>) : {};
    const weak = SOUNDS.map((s) => {
      const t = tally[s.id];
      const total = t ? t.hit + t.miss : 0;
      return { label: s.label, total, acc: total ? t.hit / total : 1 };
    })
      .filter((s) => s.total > 0 && s.acc < 0.8)
      .sort((a, b) => a.acc - b.acc)
      .slice(0, 3);
    return weak.length ? weak.map((s) => `${s.label} ${pct(s.acc)}`).join(", ") : "—";
  } catch {
    return "—";
  }
}
type DataGroup = { label: string; ic: string; metrics: DataMetric[] };

function dataGroups(stats: DashboardStats | null, problemSounds: string): DataGroup[] {
  const v = stats?.vocab_extra;
  const g = stats?.grammar_extra;
  const pr = stats?.progress_extra;
  return [
    {
      label: "Progress", ic: "target",
      metrics: [
        { label: "Streak", value: stats ? `${stats.streak} days` : "—" },
        { label: "Longest streak", value: stats ? `${stats.longest_streak} days` : "—" },
        { label: "Weekly XP", value: stats ? String(stats.weekly_xp) : "—" },
        { label: "Retention rate", value: pct(pr?.retention_rate) },
        { label: "CEFR level", value: stats?.cefr_level ?? "—" },
        { label: "Missions completed", value: stats ? String(stats.missions_completed) : "—" },
        { label: "Current mission", value: stats?.current_mission?.title ?? "—" },
        { label: "Total study time", value: stats ? `${Math.round(stats.total_study_seconds / 60)} min` : "—" },
        { label: "Study sessions", value: stats ? String(stats.study_sessions_count) : "—" },
        { label: "Consistency (active days / last 30)", value: pr ? `${pr.active_days_30} / 30` : "—" },
        { label: "XP trend (last 4 weeks)", value: pr?.xp_by_week.length ? pr.xp_by_week.join(" → ") : "—" },
        { label: "Typical study time of day", value: studyTimeOfDay(pr?.typical_study_hour_utc) },
      ],
    },
    {
      label: "Vocabulary", ic: "vocabulary",
      metrics: [
        { label: "Total learned", value: stats ? String(stats.total_learned) : "—" },
        { label: "Due today", value: stats ? String(stats.due_today) : "—" },
        { label: "Due tomorrow", value: v ? String(v.due_tomorrow) : "—" },
        { label: "Recognition accuracy", value: skillField(stats, "recognition", "accuracy") },
        { label: "Recall accuracy", value: skillField(stats, "recall", "accuracy") },
        { label: "Cards reviewed", value: skillField(stats, "recall", "attempts") },
        { label: "Last practiced", value: skillField(stats, "recall", "last_practiced_at") },
        { label: "New / learning / mature counts", value: v ? `${v.new_count} / ${v.learning_count} / ${v.mature_count}` : "—" },
        { label: "Avg card stability", value: v?.avg_stability != null ? `${v.avg_stability.toFixed(1)}d` : "—" },
        { label: "Lapse rate", value: v?.lapse_rate != null ? `${Math.round(v.lapse_rate * 100)}%` : "—" },
        { label: "Hardest words (top lapses)", value: v && v.hardest_words.length ? v.hardest_words.join(", ") : "—" },
        { label: "Avg response time", value: v?.avg_response_ms ? `${(v.avg_response_ms / 1000).toFixed(1)}s` : "—" },
        { label: "Forgotten (lapses) / relearning now", value: pr ? `${pr.lapses_total} / ${pr.relearning_count}` : "—" },
        {
          label: "Words learned per session",
          value: stats?.study_sessions_count ? (stats.total_learned / stats.study_sessions_count).toFixed(1) : "—",
        },
      ],
    },
    {
      label: "Grammar", ic: "grammar",
      metrics: [
        { label: "Attempts", value: skillField(stats, "grammar", "attempts") },
        { label: "Accuracy", value: skillField(stats, "grammar", "accuracy") },
        { label: "Last practiced", value: skillField(stats, "grammar", "last_practiced_at") },
        { label: "Structures mastered", value: g ? String(g.mastered_count) : "—" },
        { label: "Weakest structure", value: g?.weakest_structure ?? "—" },
        { label: "Avg response time", value: skillField(stats, "grammar", "avg_response_ms") },
        {
          label: "Reviews by structure",
          value: pr?.grammar_reps_by_structure.length
            ? pr.grammar_reps_by_structure.map((r) => `${r.structure} (${r.reps})`).join(", ")
            : "—",
        },
      ],
    },
    {
      label: "Listening", ic: "podcast",
      metrics: [
        { label: "Attempts", value: skillField(stats, "listening", "attempts") },
        { label: "Accuracy", value: skillField(stats, "listening", "accuracy") },
        { label: "Last practiced", value: skillField(stats, "listening", "last_practiced_at") },
        { label: "Stage reached", value: skillField(stats, "listening", "max_stage_reached") },
        { label: "Replays used", value: skillField(stats, "listening", "replays_total") },
        { label: "Avg listening speed reached", value: skillField(stats, "listening", "last_speed_reached") },
        { label: "Transcript reveals used", value: skillField(stats, "listening", "transcript_reveals_total") },
      ],
    },
    {
      label: "Speaking", ic: "speaker",
      metrics: [
        { label: "Attempts", value: skillField(stats, "pronunciation", "attempts") },
        { label: "Pronunciation accuracy", value: skillField(stats, "pronunciation", "accuracy") },
        { label: "Conversation avg score", value: skillField(stats, "conversation", "avg_score") },
        { label: "Last practiced", value: skillField(stats, "pronunciation", "last_practiced_at") },
        { label: "Avg clarity score", value: skillField(stats, "pronunciation", "avg_score") },
        { label: "Avg attempts per line (retries)", value: skillField(stats, "conversation", "retries_total") },
        { label: "Recording count", value: skillField(stats, "conversation", "recordings_total") },
        { label: "Problem sounds", value: problemSounds },
      ],
    },
    {
      label: "Writing", ic: "writing",
      metrics: [
        { label: "Attempts", value: skillField(stats, "writing", "attempts") },
        { label: "Avg coach score", value: skillField(stats, "writing", "avg_score") },
        { label: "Last practiced", value: skillField(stats, "writing", "last_practiced_at") },
        { label: "Messages written", value: skillField(stats, "writing", "attempts") },
        {
          label: "Correction rate",
          value: (() => {
            const row = stats?.skills?.["writing"];
            return row?.attempts ? `${Math.round((1 - row.accuracy) * 100)}%` : "—";
          })(),
        },
      ],
    },
    {
      label: "Overall", ic: "target",
      metrics: [
        { label: "Skill balance (weakest vs strongest)", value: skillBalance(stats) },
        {
          label: "Days since last session",
          value: pr?.days_since_last_session != null ? String(pr.days_since_last_session) : "—",
        },
      ],
    },
  ];
}

// Every value backing the dashboard, grouped by lesson type.
function TrackedData({ stats }: { stats: DashboardStats | null }) {
  // Browser-local, so read after mount to keep SSR and first render identical.
  const [problemSounds, setProblemSounds] = useState("—");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate localStorage value after mount
  useEffect(() => { setProblemSounds(loadProblemSounds()); }, []);
  return (
    <div className="hm-data">
      <div className="sp-section-label" style={{ margin: "0 0 6px" }}><h2 className="sp-h2">Data</h2></div>
      {dataGroups(stats, problemSounds).map((g) => (
        <div className="hm-data-group" key={g.label}>
          <div className="hm-data-group-head">
            <span className="hm-due-ico"><Icon name={g.ic} size={16} /></span>
            <span className="hm-data-group-lbl">{g.label}</span>
          </div>
          {g.metrics.map((m) => (
            <div className="hm-data-row" key={m.label}>
              <span className="hm-data-lbl">{m.label}</span>
              <span className="hm-data-val">{m.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

