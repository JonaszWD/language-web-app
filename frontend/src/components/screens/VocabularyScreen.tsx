"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { vocabApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import { speakEs } from "@/lib/speak";
import VocabTrainer from "@/components/VocabTrainer";
import type { VocabDetail, VocabListItem } from "@/types";

/* ════════════════════════ VOCABULARY ════════════════════════
   The v2 word-collection grid wired to the real 5-level trainer:
   each saved word shows its training level (1-5), and reviewing
   launches the level exercises via ?mode=training. */
const LEVEL_LABEL = ["", "Recognise", "Build", "Recall", "Context", "Produce", "Mastered"];

// `?mode=training` replaces the old shell-level `training` boolean toggle —
// the grid and the trainer now live at the same route, distinguished by a
// query param instead of a sibling shell swapping between two screens.
export default function VocabularyScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const training = searchParams.get("mode") === "training";

  const goTrain = () => router.push("/vocabulary?mode=training");
  const backToGrid = () => router.push("/vocabulary");

  if (training) {
    return <VocabTrainer onBack={backToGrid} onAuthError={() => router.push("/login")} />;
  }
  return <VocabularyGrid onReview={goTrain} />;
}

function VocabularyGrid({ onReview }: { onReview: () => void }) {
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
                {detail.cefr_level && detail.cefr_level !== "?" && <span className="sp-tag ghost">{detail.cefr_level}</span>}
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
