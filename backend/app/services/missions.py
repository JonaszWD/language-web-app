"""Mission orchestration — background Mistral enrichment of mission vocab.

When a mission is opened, every one of its vocab words is run through the Mistral
enrichment pipeline (see services.enrich) and the result cached on the
MissionVocab row. Work runs on a background thread so opening a mission stays
snappy; the cached data is served on subsequent loads.

Idempotent: words that already have enrichment are skipped, so re-opening a
mission does not re-hit Mistral.

Single-thread pool + one-process assumption, same as the podcast pipeline.
"""
from __future__ import annotations

import json
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.goal import Goal, MissionGoal, UserGoal, VocabularyExampleSentence
from app.models.mission import (
    ENRICH_PENDING,
    ENRICH_PROCESSING,
    ENRICH_READY,
    MISSION_COMPLETED,
    MISSION_TYPE_BONUS,
    MISSION_TYPE_CORE,
    Mission,
    MissionVocab,
    UserMission,
)
from app.models.user_card import UserCard
from app.models.word import Word
from app.services import enrich as enrich_service
from app.services import images as image_service

logger = logging.getLogger("missions")

# Onboarding motivation (User.motivation, exact PickOption.name strings from
# frontend/src/app/register/page.tsx's MOTIVATIONS) → the topic tag used on
# Mission.topics (see content/missions/*.json). One entry per motivation
# option so the mapping is 1:1, no fuzzy matching.
MOTIVATION_TOPIC_MAP: dict[str, str] = {
    "Travel": "travel",
    "Work / business": "work",
    "Academic study": "academic",
    "Living abroad / relocation": "relocation",
    "Family or heritage": "heritage",
    "Dating or a partner": "dating",
    "Making friends": "social",
    "Consuming media": "media",
    "Gaming / online communities": "gaming",
}


def sync_user_goal_from_motivation(db: Session, user) -> None:
    """Bridge for the single-select onboarding UI: mirrors User.motivation into
    a single UserGoal(priority=1) row so the goals-based scoring/flavor-text
    machinery below has real data without any frontend change. Called from
    PATCH /auth/me/onboarding whenever motivation is set.

    No-ops (clears any existing UserGoal rows) when motivation doesn't map to
    a known goal key — treat "no goal selected" as valid, not an error.
    """
    db.query(UserGoal).filter(UserGoal.user_id == user.id).delete()
    goal_key = MOTIVATION_TOPIC_MAP.get(user.motivation or "")
    if not goal_key:
        return
    goal = db.query(Goal).filter(Goal.key == goal_key).first()
    if goal is None:
        return
    db.add(UserGoal(user_id=user.id, goal_id=goal.id, priority=1))


def user_goal_weights(db: Session, user_id) -> dict[int, float]:
    """goal_id -> priority_weight for one user's selected goals. Rank 1 (top
    priority) weighs 1.0, rank 2 weighs 0.5, rank 3 weighs 0.33, ... — the top
    goal dominates but lower-ranked goals still nudge the score."""
    rows = db.query(UserGoal.goal_id, UserGoal.priority).filter(UserGoal.user_id == user_id).all()
    return {goal_id: 1.0 / priority for goal_id, priority in rows}


def recommended_mission_ids(db: Session, user) -> set[str]:
    """Ids of missions matching any of the user's selected goals — a soft
    "recommended for you" badge (see MissionSummary.recommended), not a sort
    or filter; GET /missions applies the real re-sort via mission_scores.

    Empty set when the user has no goals selected.
    """
    weights = user_goal_weights(db, user.id)
    if not weights:
        return set()
    rows = db.query(MissionGoal.mission_id).filter(MissionGoal.goal_id.in_(weights.keys())).all()
    return {mid for (mid,) in rows}


def mission_scores(
    db: Session, user_id, mission_ids: list[str] | None = None, mission_type: str = MISSION_TYPE_CORE
) -> dict[str, float]:
    """mission_id -> score = order_index - sum(priority_weight * relevance_weight)
    over the user's selected goals. Sorting ascending by this score keeps the
    CEFR order_index as the floor, and lets a stronger goal match pull a
    mission earlier; missions with no goal match keep their pure order_index
    position (bonus term is 0)."""
    query = db.query(Mission.id, Mission.order_index).filter(Mission.mission_type == mission_type)
    if mission_ids is not None:
        query = query.filter(Mission.id.in_(mission_ids))
    base = {mid: float(order_index) for mid, order_index in query.all()}

    weights = user_goal_weights(db, user_id)
    if not weights or not base:
        return base

    mg_rows = (
        db.query(MissionGoal.mission_id, MissionGoal.goal_id, MissionGoal.relevance_weight)
        .filter(MissionGoal.goal_id.in_(weights.keys()))
        .all()
    )
    bonus: dict[str, float] = {}
    for mission_id, goal_id, relevance_weight in mg_rows:
        if mission_id not in base:
            continue
        bonus[mission_id] = bonus.get(mission_id, 0.0) + weights[goal_id] * relevance_weight
    return {mid: base[mid] - bonus.get(mid, 0.0) for mid in base}


# Missions this many steps ahead of the user's progress get goal-based
# re-sorting; the rest of the pending tail (and every completed mission)
# keeps pure order_index order — the CEFR spine itself never reorders.
NEXT_WINDOW = 8


def ordered_mission_ids(db: Session, user) -> list[str]:
    """Core mission play order, with the next NEXT_WINDOW not-yet-completed
    missions re-sorted by mission_scores. Completed missions keep their
    chronological order_index position so progress views don't jump."""
    all_rows = (
        db.query(Mission.id)
        .filter(Mission.mission_type == MISSION_TYPE_CORE)
        .order_by(Mission.order_index)
        .all()
    )
    all_ids = [mid for (mid,) in all_rows]
    completed_ids = {
        mid
        for (mid,) in db.query(UserMission.mission_id)
        .filter(UserMission.user_id == user.id, UserMission.status == MISSION_COMPLETED)
        .all()
    }
    pending = [mid for mid in all_ids if mid not in completed_ids]
    window, rest = pending[:NEXT_WINDOW], pending[NEXT_WINDOW:]
    scores = mission_scores(db, user.id, mission_ids=window)
    window_sorted = sorted(window, key=lambda mid: scores.get(mid, float("inf")))

    reordered_pending = iter(window_sorted + rest)
    return [mid if mid in completed_ids else next(reordered_pending) for mid in all_ids]


def bonus_mission_ids_scored(db: Session, user) -> list[str]:
    """Bonus mission ids (mission_type='bonus'), most goal-relevant first.
    Entirely separate from ordered_mission_ids — bonus content is optional
    and never part of the core progression."""
    scores = mission_scores(db, user.id, mission_type=MISSION_TYPE_BONUS)
    return sorted(scores, key=lambda mid: scores[mid])


def pick_example_sentences(db: Session, vocab_ids: list, user_id) -> dict:
    """mission_vocab_id -> goal-flavored example sentence, for every vocab id
    that has a variant matching the user's #1-priority goal. Ids without a
    matching row are simply absent — callers should fall back to
    MissionVocab.example_sentence themselves. One query, not N+1."""
    if not vocab_ids:
        return {}
    top_goal = (
        db.query(UserGoal.goal_id)
        .filter(UserGoal.user_id == user_id)
        .order_by(UserGoal.priority.asc())
        .first()
    )
    if top_goal is None:
        return {}
    rows = (
        db.query(VocabularyExampleSentence.mission_vocab_id, VocabularyExampleSentence.example_text)
        .filter(
            VocabularyExampleSentence.mission_vocab_id.in_(vocab_ids),
            VocabularyExampleSentence.goal_id == top_goal[0],
        )
        .all()
    )
    return {r[0]: r[1] for r in rows}

# One worker: only one mission enriches at a time (never hammer the APIs across
# parallel opens). Within a mission, words are fetched concurrently — see
# _enrich_mission_job — since enrichment + image lookups are network-bound.
_enrich_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mission-enrich")


def _enrich_one(spanish: str, english: str) -> dict:
    """Enrich one word. On a Mistral 429 the enrich service falls back to Claude,
    so no local backoff/retry is needed here."""
    return enrich_service.enrich_word(spanish, english)


def _fetch_word(spanish: str, english: str) -> tuple[dict | None, str | None]:
    """Network-only fetch for one word: (enrichment, image_url). Touches no DB,
    so it's safe to run on a worker thread. Either field may be None on failure."""
    enrichment: dict | None = None
    try:
        enrichment = _enrich_one(spanish, english)
    except enrich_service.EnrichmentError as exc:
        logger.warning("Mission enrichment failed for %r: %s", spanish, exc)
    image = image_service.find_image(english)
    return enrichment, image


def _backfill_word(db: Session, vocab: MissionVocab) -> None:
    """Copy a freshly-enriched mission word onto the shared dictionary Word (and
    thus every user's deck card for it), so the vocab trainer serves it instantly
    instead of lazily re-enriching on /vocab/next. Matched by lowercased spanish,
    the same key add_mission_vocab_to_deck uses."""
    spanish = vocab.spanish.strip().lower()
    if not spanish:
        return
    word = db.query(Word).filter(func.lower(Word.spanish) == spanish).first()
    if word is None:
        return
    if word.enrichment is None and vocab.enrichment is not None:
        word.enrichment = vocab.enrichment
    if word.image_url is None and vocab.image_url is not None:
        word.image_url = vocab.image_url


# Bump when the speaking-script design changes (prompt/schema) so already-cached
# scripts regenerate on next open instead of serving the old shape.
SPEAKING_VERSION = 2


def speaking_stale(script: dict | None) -> bool:
    """True when a mission has no speaking script or one from an older design."""
    return not isinstance(script, dict) or script.get("v") != SPEAKING_VERSION


def _generate_speaking(db: Session, mission_id: str) -> None:
    """Generate the 7-stage speaking role-play for a mission.

    Regenerates when the stored script is missing or from an older SPEAKING_VERSION.
    Failures are logged and swallowed — a missing speaking script must not fail
    vocab enrichment.
    """
    mission = db.get(Mission, mission_id)
    if mission is None or not speaking_stale(mission.speaking):
        return
    vocab = [(v.spanish, v.english) for v in mission.vocab]
    if not vocab:
        return
    try:
        script = enrich_service.generate_speaking_script(
            mission.title, mission.description or "", vocab
        )
        script["v"] = SPEAKING_VERSION
        mission.speaking = script
        db.commit()
        logger.info("Generated speaking script (v%d) for mission %s", SPEAKING_VERSION, mission_id)
    except enrich_service.EnrichmentError as exc:
        db.rollback()
        logger.warning("Speaking-script generation failed for %s: %s", mission_id, exc)


# Bump when the Context Preview design changes so already-cached previews
# regenerate on next open instead of serving the old shape.
CONTEXT_PREVIEW_VERSION = 1


def context_preview_stale(preview: dict | None) -> bool:
    """True when a mission has no Context Preview or one from an older design."""
    return not isinstance(preview, dict) or preview.get("v") != CONTEXT_PREVIEW_VERSION


def _fallback_context_preview(mission: Mission) -> dict:
    """A minimal Context Preview synthesized from mission fields, used when the
    LLM call fails or quota-stalls — the step must never block on Mistral."""
    phrases = [
        {"es": v.spanish, "english": v.english} for v in mission.vocab[:4]
    ]
    return {
        "situation": mission.description or mission.title,
        "situation_en": mission.description or mission.title,
        "key_phrases": [{"es": p["es"], "en": p["english"]} for p in phrases],
        "v": CONTEXT_PREVIEW_VERSION,
    }


def _generate_context_preview(db: Session, mission_id: str) -> None:
    """Generate the Context Preview stage for a mission.

    Regenerates when the stored preview is missing or from an older
    CONTEXT_PREVIEW_VERSION. On LLM failure, falls back to a minimal preview
    synthesized from the mission's own fields rather than leaving it null —
    the step must never block the ladder on a quota stall.
    """
    mission = db.get(Mission, mission_id)
    if mission is None or not context_preview_stale(mission.context_preview):
        return
    vocab = [(v.spanish, v.english) for v in mission.vocab]
    try:
        if vocab:
            preview = enrich_service.generate_context_preview(
                mission.title, mission.description or "", vocab
            )
            preview["v"] = CONTEXT_PREVIEW_VERSION
        else:
            preview = _fallback_context_preview(mission)
        mission.context_preview = preview
        db.commit()
        logger.info("Generated context preview (v%d) for mission %s", CONTEXT_PREVIEW_VERSION, mission_id)
    except enrich_service.EnrichmentError as exc:
        db.rollback()
        logger.warning("Context-preview generation failed for %s, using fallback: %s", mission_id, exc)
        mission.context_preview = _fallback_context_preview(mission)
        db.commit()


def _finalize_status(db: Session, mission_id: str) -> None:
    """Set the mission's enrichment_status from how many words are enriched:
    ready if all done, else back to pending so a later open can retry."""
    remaining = (
        db.query(MissionVocab)
        .filter(MissionVocab.mission_id == mission_id, MissionVocab.enrichment.is_(None))
        .count()
    )
    mission = db.get(Mission, mission_id)
    if mission is not None:
        mission.enrichment_status = ENRICH_READY if remaining == 0 else ENRICH_PENDING
        db.commit()


def _enrich_mission_job(mission_id: str) -> None:
    db = SessionLocal()
    try:
        rows = (
            db.query(MissionVocab)
            .filter(MissionVocab.mission_id == mission_id)
            .order_by(MissionVocab.order_index)
            .all()
        )
        todo = [v for v in rows if v.enrichment is None]
        if not todo:
            _generate_speaking(db, mission_id)
            _generate_context_preview(db, mission_id)
            _finalize_status(db, mission_id)
            return

        # Fetch all words concurrently (network-bound), then write results back
        # on this thread's single session as each completes — DB stays serial,
        # the slow API calls overlap. Commit per word so the progress poll
        # advances live and partial work survives a crash.
        workers = max(1, min(len(todo), settings.enrich_concurrency))
        logger.info(
            "Enriching %d/%d words for mission %s (%d workers)",
            len(todo), len(rows), mission_id, workers,
        )
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="mission-word") as pool:
            fut_to_id = {
                pool.submit(_fetch_word, v.spanish, v.english): v.id for v in todo
            }
            for fut in as_completed(fut_to_id):
                vocab = db.get(MissionVocab, fut_to_id[fut])
                if vocab is None:
                    continue
                enrichment, image = fut.result()
                changed = False
                if enrichment is not None and vocab.enrichment is None:
                    vocab.enrichment = enrichment
                    changed = True
                if image and vocab.image_url is None:
                    vocab.image_url = image
                    changed = True
                if changed:
                    # Back-fill the deck Word too. add_mission_vocab_to_deck runs
                    # on mission start (before this finishes), so it copies a null
                    # enrichment; without this the vocab trainer would re-enrich
                    # each word synchronously on /vocab/next (~10s stall per card).
                    _backfill_word(db, vocab)
                    db.commit()
        _generate_speaking(db, mission_id)
        _generate_context_preview(db, mission_id)
        _finalize_status(db, mission_id)
        logger.info("Finished enriching mission %s", mission_id)
    except Exception:  # noqa: BLE001 — background thread must not crash silently
        logger.exception("Mission enrichment job failed for %s", mission_id)
        try:
            mission = db.get(Mission, mission_id)
            if mission is not None:
                mission.enrichment_status = ENRICH_PENDING
                db.commit()
        except Exception:
            logger.exception("Could not reset status for %s", mission_id)
    finally:
        db.close()


def queue_enrichment(mission_id: str) -> None:
    """Run the Mistral pipeline for a mission — but only the first time.

    Gated on Mission.enrichment_status: a mission that is already ``ready`` or
    currently ``processing`` is left alone, so opening a mission a second time
    never re-hits Mistral. Only a ``pending`` mission is flipped to ``processing``
    and submitted to the background pool.
    """
    db = SessionLocal()
    try:
        mission = db.get(Mission, mission_id)
        if mission is None or mission.enrichment_status != ENRICH_PENDING:
            return
        mission.enrichment_status = ENRICH_PROCESSING
        db.commit()
    finally:
        db.close()
    _enrich_pool.submit(_enrich_mission_job, mission_id)


# Missions currently having their speaking script generated, so a burst of opens
# doesn't submit the same LLM job repeatedly.
_speaking_in_flight: set[str] = set()


def _speaking_job(mission_id: str) -> None:
    db = SessionLocal()
    try:
        _generate_speaking(db, mission_id)
    finally:
        db.close()
        _speaking_in_flight.discard(mission_id)


def queue_speaking(mission_id: str) -> None:
    """(Re)generate a mission's speaking script if it is missing or stale.

    Covers missions enriched before speaking existed, and scripts from an older
    SPEAKING_VERSION. Idempotent and de-duplicated: skips when the script is
    current or a job is already in flight. Shares the single-worker enrich pool
    so it never runs concurrently with vocab enrichment.
    """
    if mission_id in _speaking_in_flight:
        return
    db = SessionLocal()
    try:
        mission = db.get(Mission, mission_id)
        if mission is None or not speaking_stale(mission.speaking):
            return
    finally:
        db.close()
    _speaking_in_flight.add(mission_id)
    _enrich_pool.submit(_speaking_job, mission_id)


# Missions currently having their Context Preview generated, so a burst of
# opens doesn't submit the same LLM job repeatedly.
_context_preview_in_flight: set[str] = set()


def _context_preview_job(mission_id: str) -> None:
    db = SessionLocal()
    try:
        _generate_context_preview(db, mission_id)
    finally:
        db.close()
        _context_preview_in_flight.discard(mission_id)


def queue_context_preview(mission_id: str) -> None:
    """(Re)generate a mission's Context Preview if it is missing or stale.

    Same idempotent/de-duplicated pattern as queue_speaking, sharing the single-
    worker enrich pool so it never runs concurrently with vocab enrichment.
    """
    if mission_id in _context_preview_in_flight:
        return
    db = SessionLocal()
    try:
        mission = db.get(Mission, mission_id)
        if mission is None or not context_preview_stale(mission.context_preview):
            return
    finally:
        db.close()
    _context_preview_in_flight.add(mission_id)
    _enrich_pool.submit(_context_preview_job, mission_id)


def enrichment_progress(db: Session, mission_id: str) -> tuple[str, int, int]:
    """Return (status, enriched_count, total) for the mission's enrichment."""
    mission = db.get(Mission, mission_id)
    if mission is None:
        return (ENRICH_PENDING, 0, 0)
    total = (
        db.query(MissionVocab).filter(MissionVocab.mission_id == mission_id).count()
    )
    enriched = (
        db.query(MissionVocab)
        .filter(MissionVocab.mission_id == mission_id, MissionVocab.enrichment.isnot(None))
        .count()
    )
    return (mission.enrichment_status, enriched, total)


def speaking_turn(
    role: str,
    setting: str,
    goal: str,
    history: list[tuple[str, str]],
    utterance: str,
    vocab: list[str] | None = None,
) -> dict:
    """Evaluate one learner utterance in a free-conversation speaking stage and
    return the NPC's in-character reply. Thin pass-through to the enrich LLM."""
    return enrich_service.evaluate_speaking_turn(role, setting, goal, history, utterance, vocab)


def stream_speaking_turn(
    role: str,
    setting: str,
    goal: str,
    history: list[tuple[str, str]],
    utterance: str,
    vocab: list[str] | None = None,
    objectives: list[str] | None = None,
):
    """Streamed variant of speaking_turn (Claude Haiku only). Thin pass-through."""
    yield from enrich_service.stream_speaking_turn(role, setting, goal, history, utterance, vocab, objectives)


# Final Challenge scenes for the authored missions, used when a mission's Mistral
# speaking script hasn't been generated yet (free-tier quota can stall it). Keyed
# by mission id; a generic default derived from the title covers the rest.
_SCENE_FALLBACKS: dict[str, dict] = {
    "m001-coffee-shop": {
        "role": "camarero", "role_en": "waiter", "setting": "a café in Spain",
        "opening": "Buenos días. ¿Qué desea?",
        "opening_en": "Good morning. What would you like?",
        "goal": (
            "Greet the waiter, order a drink, answer a follow-up (anything else, "
            "size), choose dine-in or takeaway, and pay."
        ),
    },
    "m002-airport": {
        "role": "agente", "role_en": "check-in agent", "setting": "an airport check-in desk",
        "opening": "Buenos días. ¿Su billete y pasaporte, por favor?",
        "opening_en": "Good morning. Your ticket and passport, please?",
        "goal": (
            "Check in for the flight, hand over ticket/passport, ask where the "
            "gate is and what time the flight leaves."
        ),
    },
    "m003-meeting-someone": {
        "role": "persona nueva", "role_en": "someone new", "setting": "a friendly first meeting",
        "opening": "¡Hola! Me llamo Ana. ¿Y tú?",
        "opening_en": "Hi! My name is Ana. And you?",
        "goal": "Greet, give your name, say where you're from, and ask the same back.",
    },
    "m004-doctor": {
        "role": "médica", "role_en": "doctor", "setting": "a doctor's office in Spain",
        "opening": "Buenos días. Cuénteme, ¿qué le pasa?",
        "opening_en": "Good morning. Tell me, what's wrong?",
        "goal": (
            "Greet the doctor, describe a symptom (what hurts), say how long "
            "you've had it, answer a follow-up question, and ask for medication "
            "or advice."
        ),
    },
}

_CONTENT_DIR = Path(__file__).resolve().parents[2] / "content" / "missions"
_SCENE_KEYS = {"role", "role_en", "setting", "opening", "opening_en", "goal"}


def _scene_from_content(mission_id: str) -> dict | None:
    """Read a `speaking_scene` block from the mission's content JSON, if present
    and complete. Missions carry their own Final Challenge scene this way."""
    path = _CONTENT_DIR / f"{mission_id}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    scene = data.get("speaking_scene")
    if isinstance(scene, dict) and _SCENE_KEYS <= set(scene):
        return {k: scene[k] for k in _SCENE_KEYS}
    return None


def speaking_scene(db: Session, mission_id: str) -> dict | None:
    """Resolve the Final Challenge scene for a mission.

    Prefers the mission's generated speaking script (its final ``free`` stage
    carries the natural opening line + goal). Falls back to a hand-authored scene
    when the script hasn't been generated yet. Returns None only for an unknown
    mission with no fallback and no title.
    """
    mission = db.get(Mission, mission_id)
    if mission is None:
        return None

    script = mission.speaking
    if isinstance(script, dict) and script.get("stages"):
        stages = script["stages"]
        # The free-conversation finale is the 'free' stage (else the last one).
        free = next((s for s in stages if s.get("type") == "free"), stages[-1])
        opening = free.get("npc") or ""
        if opening:
            return {
                "role": script.get("role") or "camarero",
                "role_en": script.get("role_en") or "the local",
                "setting": script.get("setting") or "a real-world scene in Spain",
                "goal": free.get("goal") or "Complete the interaction naturally.",
                "opening": opening,
                "opening_en": free.get("npc_en") or "",
            }

    # Authored/generated scene stored in the mission's content JSON — the
    # generator (scripts/generate_mission.py) writes a `speaking_scene` block, so
    # new missions supply their own Final Challenge with no code change.
    scene = _scene_from_content(mission_id)
    if scene:
        return scene

    fallback = _SCENE_FALLBACKS.get(mission_id)
    if fallback:
        return dict(fallback)

    # Generic default for a mission with no script and no authored scene.
    return {
        "role": "la persona", "role_en": "the person",
        "setting": f"a real-world scene: {mission.title}",
        "goal": f"Complete the interaction for “{mission.title}” naturally in Spanish.",
        "opening": "Hola, buenos días.",
        "opening_en": "Hello, good morning.",
    }


def complete_mission(
    db: Session, user_id: uuid.UUID, mission_id: str
) -> tuple[str, datetime | None]:
    """Mark a mission completed for the user — called when the Final Challenge
    conversation reaches its natural end. Idempotent: re-completing keeps the
    original completed_at. Creates the UserMission row if it never existed (e.g.
    the mission was opened straight into the challenge). Returns (status, when).
    """
    user_mission = (
        db.query(UserMission)
        .filter(UserMission.user_id == user_id, UserMission.mission_id == mission_id)
        .first()
    )
    if user_mission is None:
        user_mission = UserMission(user_id=user_id, mission_id=mission_id)
        db.add(user_mission)

    if user_mission.status != MISSION_COMPLETED:
        user_mission.status = MISSION_COMPLETED
        user_mission.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("User %s completed mission %s", user_id, mission_id)
    return user_mission.status, user_mission.completed_at


def add_mission_vocab_to_deck(db: Session, user_id: uuid.UUID, mission_id: str) -> int:
    """Add every word of a mission to the user's study deck (Word + UserCard).

    Runs when a mission becomes available so its vocabulary shows up in the
    Vocabulary tab and enters FSRS scheduling. Idempotent: a word already in the
    dictionary is reused, and a card the user already has is left untouched.
    Returns the number of new cards added.

    Reuses the same get-or-create pattern as POST /vocab/save, and copies the
    mission's cached enrichment/image onto a freshly minted Word so the deck
    doesn't have to re-hit Mistral/Pexels for it.
    """
    rows = (
        db.query(MissionVocab)
        .filter(MissionVocab.mission_id == mission_id)
        .order_by(MissionVocab.order_index)
        .all()
    )
    added = 0
    for mv in rows:
        spanish = mv.spanish.strip().lower()
        if not spanish:
            continue
        word = db.query(Word).filter(func.lower(Word.spanish) == spanish).first()
        if word is None:
            word = Word(
                spanish=spanish,
                english=mv.english,
                example_sentence=mv.example_sentence,
                category="Mission",
                cefr_level="?",
                enrichment=mv.enrichment,
                image_url=mv.image_url,
            )
            db.add(word)
            db.flush()
        elif word.english.strip().lower() != mv.english.strip().lower():
            # Two missions share a spelling but were authored with a different
            # sense/gloss (a homograph). The shared Word row keeps whichever
            # mission claimed it first — silently doing nothing here would let
            # the mismatch go unnoticed and make review cards ambiguous about
            # which mission's meaning is actually being tested.
            logger.warning(
                "Ambiguous shared word %r: mission %s teaches %r here, "
                "existing deck word is %r — review cards for this word may "
                "reflect the wrong sense.",
                spanish, mission_id, mv.english, word.english,
            )

        exists = (
            db.query(UserCard.id)
            .filter(UserCard.user_id == user_id, UserCard.word_id == word.id)
            .first()
        )
        if exists is None:
            db.add(
                UserCard(
                    user_id=user_id,
                    word_id=word.id,
                    due_date=date.today(),
                    state="new",
                )
            )
            added += 1

    db.commit()
    logger.info("Added %d mission words to deck for user %s (%s)", added, user_id, mission_id)
    return added
