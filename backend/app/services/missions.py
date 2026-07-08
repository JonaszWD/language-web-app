"""Mission orchestration — background Gemini enrichment of mission vocab.

When a mission is opened, every one of its vocab words is run through the Gemini
enrichment pipeline (see services.enrich) and the result cached on the
MissionVocab row. Work runs on a background thread so opening a mission stays
snappy; the cached data is served on subsequent loads.

Idempotent: words that already have enrichment are skipped, so re-opening a
mission does not re-hit Gemini.

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
from app.models.mission import (
    ENRICH_PENDING,
    ENRICH_PROCESSING,
    ENRICH_READY,
    MISSION_COMPLETED,
    Mission,
    MissionVocab,
    UserMission,
)
from app.models.user_card import UserCard
from app.models.word import Word
from app.services import enrich as enrich_service
from app.services import images as image_service

logger = logging.getLogger("missions")

# One worker: only one mission enriches at a time (never hammer the APIs across
# parallel opens). Within a mission, words are fetched concurrently — see
# _enrich_mission_job — since enrichment + image lookups are network-bound.
_enrich_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mission-enrich")


def _enrich_one(spanish: str, english: str) -> dict:
    """Enrich one word. On a Gemini 429 the enrich service falls back to Claude,
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
    """Run the Gemini pipeline for a mission — but only the first time.

    Gated on Mission.enrichment_status: a mission that is already ``ready`` or
    currently ``processing`` is left alone, so opening a mission a second time
    never re-hits Gemini. Only a ``pending`` mission is flipped to ``processing``
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


# Final Challenge scenes for the authored missions, used when a mission's Gemini
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
    doesn't have to re-hit Gemini/Pexels for it.
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
