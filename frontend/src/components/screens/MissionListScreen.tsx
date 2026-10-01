"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { missionsApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import { buildMission, type Mission } from "./missions/missionData";
import ReviewScreen from "./missions/MissionReview";

// The mission list: fetches summaries, shows Review in-place (not a route —
// checkpoint granularity too fine, same as the mission's own step/lesson),
// and hands off into /missions/[missionId] on card click. The old in-shell
// `openMission` due-review check + LLM-enrichment "preparing" window both
// move to the detail route now — a card click here is just a navigation.
export default function MissionListScreen() {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  // The mission LIST is loaded from the backend (summaries only — no vocab), so
  // newly seeded missions appear here with no frontend change.
  useEffect(() => {
    let alive = true;
    missionsApi
      .list()
      .then((data) => {
        if (alive) {
          setMissions(data.map((s, i) =>
            buildMission(s.id, s.title, s.description, [], i, null, null, undefined, s.recommended)
          ));
        }
      })
      .catch(() => { if (alive) setError("Could not load missions."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const openMission = (id: string) => {
    setOpeningId(id);
    router.push(`/missions/${id}`);
  };

  if (reviewing) return (
    <>
      <button className="sp-btn" onClick={() => setReviewing(false)} style={{ marginBottom: 16 }}>
        <Icon name="chevron" size={16} /> Missions
      </button>
      <ReviewScreen />
    </>
  );

  return (
    <>
      <section className="mi-review-section">
        <h2 className="mi-side-title">Review</h2>
        <div className="sp-card mi-review-card" onClick={() => setReviewing(true)}>
          <div className="mi-card-body">
            <div className="mi-card-title">Review</div>
            <div className="mi-card-blurb">Practise the words and patterns you&apos;ve already learned.</div>
          </div>
          <Icon name="chevron" size={18} />
        </div>
      </section>
      <div className="mi-stage">
        <aside className="mi-side">
          <h1 className="sp-h1" style={{ marginBottom: 22 }}>Missions</h1>
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
                {m.recommended && <span className="sp-tag pink">Recommended for you</span>}
                <span className="sp-tag ghost">{openingId === m.id ? "Loading…" : m.tag}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
