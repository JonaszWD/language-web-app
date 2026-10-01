"use client";

// The "downloading" window shown the first time a mission is opened, while its
// vocabulary runs through the LLM enrichment pipeline.
export default function MissionPreparing({ title, enriched, total, onCancel }: {
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
