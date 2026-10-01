"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi, listeningApi, missionsApi, ttsApi } from "@/lib/api";
import { Icon } from "@/components/icons";
import GrammarLesson, { GRAMMAR_LESSONS as MISSION_GRAMMAR_LESSONS } from "@/components/GrammarLesson";
import ListeningLesson, { LISTENING_LESSONS as MISSION_LISTENING_LESSONS, audioTextsForScript } from "@/components/ListeningLesson";
import ListeningSession from "@/components/ListeningSession";
import WritingLesson, { WRITING_LESSONS as MISSION_WRITING_LESSONS } from "@/components/WritingLesson";
import SpeakingTrainer from "@/components/SpeakingTrainer";
import VocabTrainer from "@/components/VocabTrainer";
import { MISSION_ADVANCE_LEVEL, buildMission, vocabBurstRanges, type Mission } from "./missions/missionData";
import FinalChallenge from "./missions/FinalChallenge";
import MissionRun from "./missions/MissionRun";
import MissionPreparing from "./missions/MissionPreparing";
import ContextPreview from "./missions/ContextPreview";
import FeedbackCorrection from "./missions/FeedbackCorrection";
import type { ApiMission } from "@/types";

// The little building-covered planet — WebGL, browser-only.
const PlanetScene = dynamic(() => import("@/app/planet/PlanetScene"), { ssr: false });

// One mission's full playable content: planet/hub, step-by-step lesson runner,
// LLM-enrichment "preparing" window, and the deep-linked ?step=&lesson=
// resume behaviour. Split out of the old combined MissionScreen — the list
// (summaries, review, future-missions) now lives at /missions instead.
export default function MissionDetailScreen({ missionId }: { missionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [planet, setPlanet] = useState<Mission | null>(null);
  const [lesson, setLesson] = useState(false); // running the mission's step-by-step lesson
  const [stepIndex, setStepIndex] = useState(0); // which step the user is practising
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadError, setLoadError] = useState("");
  // The "downloading" window shown while a mission's LLM enrichment runs
  // (first open only). null when no mission is being prepared.
  const [preparing, setPreparing] = useState<
    { id: string; title: string; enriched: number; total: number } | null
  >(null);
  // Cache each mission's fetched detail so re-opening (within this mount)
  // doesn't refetch.
  const detailCache = useRef<Record<string, Mission>>({});
  // The checkpointed narrative listening item generated for this mission
  // (services.mission_gen --story --scenario-tag <mission id>), if any — the
  // Listening step prefers this over the older scripted ListeningLesson deck.
  // One story per mission is the current authoring convention; take the first.
  const [scopedListeningItemId, setScopedListeningItemId] = useState<string | null>(null);
  // Whether the running lesson's content has been scrolled — hides the
  // fixed mission title (slides it up out of view) so it doesn't sit over
  // the content once the user starts reading.
  const [lessonScrolled, setLessonScrolled] = useState(false);
  // The user's onboarding skill priority (Speaking/Listening/Reading/Writing),
  // used to bump the matching step to the front of the ladder — see
  // missionData.ts's prioritiseStep. null until loaded / if never answered.
  const skillPriority = useRef<string | null>(null);
  useEffect(() => {
    authApi.me().then((u) => { skillPriority.current = u.skill_priority ?? null; }).catch(() => {});
  }, []);
  // Deep-link restore: the step/lesson read from the URL on first mount,
  // applied once the mission's planet has loaded. Cleared after it's consumed.
  const deepLink = useRef<{ step: number; lesson: boolean } | null>(null);
  const didDeepLink = useRef(false);
  useEffect(() => {
    if (didDeepLink.current) return;
    didDeepLink.current = true;
    deepLink.current = { step: Number(searchParams.get("step")) || 0, lesson: searchParams.get("lesson") === "1" };
    // Read once on mount only — intentionally not reactive to searchParams
    // changes caused by our own router.replace mirroring below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only used for the fallback-coords index and the "next mission" preview
  // when a mission has no authored step levels — a cheap, separate fetch
  // from the list route's own (per the migration plan: refetching here is
  // cheap, so no shared cache/context is needed between list and detail).
  useEffect(() => {
    let alive = true;
    missionsApi
      .list()
      .then((data) => {
        if (alive) setMissions(data.map((s, i) => buildMission(s.id, s.title, s.description, [], i)));
      })
      .catch(() => {});
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
      undefined,
      skillPriority.current,
      detail.context_preview,
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

  useEffect(() => {
    if (!planet) return;
    let alive = true;
    listeningApi
      .items(planet.id)
      .then((items) => { if (alive) setScopedListeningItemId(items[0]?.id ?? null); })
      .catch(() => { if (alive) setScopedListeningItemId(null); });
    return () => { alive = false; setScopedListeningItemId(null); };
  }, [planet]);

  // Load the mission on demand. If its LLM enrichment has never run, show the
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
        setPreparing({ id, title: detail.title, enriched: 0, total: detail.vocab.length });
      }
    } catch {
      setLoadError("Could not open mission.");
    }
  }, [enterPlanet, refreshLevels]);

  // Enter this route's mission on mount (and whenever the route's missionId
  // changes) — replaces the old click-triggered openMission from the list.
  useEffect(() => {
    void enterMission(missionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  // Apply the deep-linked step/lesson once its planet is open, then consume it.
  useEffect(() => {
    const dl = deepLink.current;
    if (!planet || !dl) return;
    deepLink.current = null;
    setStepIndex(dl.step);
    if (dl.lesson) setLesson(true);
  }, [planet]);

  // Mirror the open step/lesson into the URL (?step=&lesson=) so a reload
  // restores it. router.replace (not push) keeps back/forward granularity at
  // one entry per real navigation, not per step.
  useEffect(() => {
    if (!planet) return;
    const params = new URLSearchParams();
    if (stepIndex) params.set("step", String(stepIndex));
    if (lesson) params.set("lesson", "1");
    const qs = params.toString();
    router.replace(`/missions/${missionId}${qs ? `?${qs}` : ""}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planet, lesson, stepIndex, missionId]);

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
    // Keyed on the id only — re-polling on every progress update would reset the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparing?.id, enterPlanet]);

  const backToMissions = () => router.push("/missions");

  if (planet && lesson) {
    // Which step is being practised drives which exercise runs. Every step
    // returns to this same mission hub (progress bar + vocab-with-levels) on
    // completion — steps stay separated rather than auto-chaining into each
    // other — and refreshes levels so the hub reflects what just changed.
    const curStepLevel = planet.levels?.[Math.min(stepIndex, (planet.levels?.length ?? 1) - 1)];
    const stepName = curStepLevel?.name;
    const grammarScript = stepName === "Grammar" ? MISSION_GRAMMAR_LESSONS[planet.id] : undefined;
    // Prefer the checkpointed narrative item (ListeningSession, scoped to this
    // mission's scenario_tag) over the older scripted ListeningLesson deck —
    // one engine, two entry points; falls back for missions with no story yet.
    const listeningItemId = stepName === "Listening" ? scopedListeningItemId : null;
    const listeningScript = stepName === "Listening" && !listeningItemId ? MISSION_LISTENING_LESSONS[planet.id] : undefined;
    const writingScript = stepName === "Writing" ? MISSION_WRITING_LESSONS[planet.id] : undefined;
    const isSpeaking = stepName === "Speaking";
    const isContextPreview = stepName === "Context Preview";
    const isFeedback = stepName === "Feedback";
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
        onScroll={(e) => setLessonScrolled(e.currentTarget.scrollTop > 8)}
        style={{
          // Below the nav (1001) so the dock and mission title stay visible
          // over a running lesson, above the planet/hub overlay (1000).
          position: "fixed", inset: 0, zIndex: 999, background: "var(--bg)",
          overflow: "auto", padding: "150px clamp(18px, 3vw, 40px) 60px",
        }}
      >
        <div
          style={{
            // Same position/style as the mission title on the planet/hub
            // screen (PlanetScene.tsx) — below the top nav, centered. Slides
            // up and fades out once the lesson content is scrolled, so it
            // doesn't linger over the content the user is reading.
            position: "fixed", top: 92, left: 0, right: 0, zIndex: 1000,
            textAlign: "center", pointerEvents: "none",
            font: "600 26px var(--font-display, system-ui)",
            color: "var(--ink, #141210)",
            transition: "opacity .2s ease, transform .2s ease",
            opacity: lessonScrolled ? 0 : 1,
            transform: lessonScrolled ? "translateY(-24px)" : "translateY(0)",
          }}
        >
          {planet.title}
        </div>
        <button
          className="sp-btn"
          onClick={backToHub}
          // Same position/style as the back button on the planet/hub screen —
          // one back affordance for the whole mission, not one per lesson.
          style={{ position: "fixed", top: 88, left: 24, zIndex: 1000 }}
        >
          <Icon name="chevron" size={16} /> Back
        </button>
        {isContextPreview ? (
          <ContextPreview mission={planet} onDone={backToHub} />
        ) : isFeedback ? (
          <FeedbackCorrection missionId={planet.id} onDone={backToHub} />
        ) : grammarScript ? (
          <GrammarLesson script={grammarScript} onExit={backToHub} onDone={backToHub} patterns={planet.grammarPatterns} missionId={planet.id} />
        ) : listeningItemId ? (
          <ListeningSession itemId={listeningItemId} scenarioTag={planet.id} onExit={backToHub} onDone={backToHub} hideBack />
        ) : listeningScript ? (
          <ListeningLesson script={listeningScript} onExit={backToHub} onDone={backToHub} hideBack />
        ) : writingScript ? (
          <WritingLesson script={writingScript} onExit={backToHub} onDone={backToHub} missionId={planet.id} />
        ) : isSpeaking ? (
          planet.speakingScript ? (
            <SpeakingTrainer
              // Guided stages only (1-4: repeat/choice/fill/prompt) — the free-
              // conversation stages (5-7) still get generated because Final
              // Challenge's scene is derived from stage 7, but they no longer
              // play out here as a second conversation.
              speaking={{ ...planet.speakingScript, stages: planet.speakingScript.stages.filter((s) => s.n <= 4) }}
              missionId={planet.id}
              onExit={backToHub}
              onDone={backToHub}
            />
          ) : (
            <div className="sp-card vt-card" style={{ textAlign: "center", maxWidth: 460, margin: "0 auto" }}>
              <p className="sp-sub" style={{ marginBottom: 20 }}>
                Speaking practice is still being prepared for this mission. Check back in a moment.
              </p>
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
            hideBack
            emptyTitle={`${stepName} ready!`}
          />
        ) : (
          <MissionRun mission={planet} onExit={backToHub} isReview={stepName === "Vocabulary Recap"} />
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
              steps={planet.levels}
              levelIndex={cur}
              pathSeed={planet.id}
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
            levelIndex={idx}
            pathSeed={planet.id}
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
        onClick={backToMissions}
        // Below the persistent top nav (fixed, top:24, height:52) rather
        // than under it, matching PlanetScene's title — the nav stays
        // visible/clickable over this screen instead of being covered.
        style={{ position: "absolute", top: 88, left: 24, zIndex: 6 }}
      >
        <Icon name="chevron" size={16} /> Back
      </button>
    </div>
  );

  if (preparing) {
    return (
      <MissionPreparing
        title={preparing.title}
        enriched={preparing.enriched}
        total={preparing.total}
        onCancel={backToMissions}
      />
    );
  }

  if (loadError) {
    return (
      <div style={{ width: "100%", display: "grid", placeItems: "center", paddingTop: 60 }}>
        <div className="sp-card gr-stage-card" style={{ textAlign: "center", maxWidth: 460 }}>
          <p className="sp-sub" style={{ marginBottom: 18 }}>{loadError}</p>
          <button className="sp-btn sp-btn-primary" onClick={backToMissions}>Back to missions</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", display: "grid", placeItems: "center", paddingTop: 60 }}>
      <div className="mi-prep-spinner" aria-hidden />
    </div>
  );
}
