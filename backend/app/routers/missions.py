from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db
from app.models.mission import (
    MISSION_AVAILABLE,
    MISSION_LOCKED,
    MISSION_TYPE_BONUS,
    MISSION_TYPE_CORE,
    Mission,
    MissionVocab,
    UserMission,
)
from app.models.user import User
from app.models.user_card import UserCard
from app.models.word import Word
from app.schemas.mission import (
    GrammarPatternResponse,
    MissionCompleteResponse,
    MissionEnrichStatus,
    MissionResponse,
    MissionStartResponse,
    MissionSummary,
    MissionVocabResponse,
    SpeakingScene,
    SpeakingTurnRequest,
    SpeakingTurnResponse,
)
from app.services import missions as missions_service
from app.services import skill_stats as skill_stats_service
from app.services import vocab as vocab_service

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("", response_model=list[MissionSummary])
def list_missions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Core missions (mission_type='core') in play order — summaries only, no
    vocab. Vocab is loaded per mission via GET /missions/{id} so the list stays
    light even at 100 missions.

    The next NEXT_WINDOW not-yet-completed missions are re-sorted by the
    user's selected goals (see services.missions.ordered_mission_ids);
    everything else, and every completed mission, keeps pure order_index
    order — the CEFR spine itself never reorders. `recommended` is a separate
    soft badge for any goal overlap, shown regardless of position.

    Bonus missions (mission_type='bonus') are excluded — see GET /missions/bonus.
    """
    rows = (
        db.query(
            Mission.id,
            Mission.order_index,
            Mission.title,
            Mission.description,
            Mission.mission_type,
            Mission.level,
            func.count(MissionVocab.id),
        )
        .outerjoin(MissionVocab, MissionVocab.mission_id == Mission.id)
        .filter(Mission.mission_type == MISSION_TYPE_CORE)
        .group_by(Mission.id)
        .all()
    )
    by_id = {r[0]: r for r in rows}
    order = missions_service.ordered_mission_ids(db, current_user)
    recommended = missions_service.recommended_mission_ids(db, current_user)
    return [
        MissionSummary(
            id=r[0], order_index=r[1], title=r[2], description=r[3], mission_type=r[4],
            level=r[5], vocab_count=r[6], recommended=r[0] in recommended,
        )
        for mid in order
        for r in [by_id[mid]]
    ]


@router.get("/bonus", response_model=list[MissionSummary])
def list_bonus_missions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bonus missions (mission_type='bonus'), most goal-relevant to the current
    user first. Entirely separate from GET /missions — not part of the core
    progression, no lock/unlock semantics."""
    rows = (
        db.query(
            Mission.id,
            Mission.order_index,
            Mission.title,
            Mission.description,
            Mission.mission_type,
            Mission.level,
            func.count(MissionVocab.id),
        )
        .outerjoin(MissionVocab, MissionVocab.mission_id == Mission.id)
        .filter(Mission.mission_type == MISSION_TYPE_BONUS)
        .group_by(Mission.id)
        .all()
    )
    by_id = {r[0]: r for r in rows}
    order = missions_service.bonus_mission_ids_scored(db, current_user)
    recommended = missions_service.recommended_mission_ids(db, current_user)
    return [
        MissionSummary(
            id=r[0], order_index=r[1], title=r[2], description=r[3], mission_type=r[4],
            level=r[5], vocab_count=r[6], recommended=r[0] in recommended,
        )
        for mid in order
        for r in [by_id[mid]]
    ]


@router.get("/{mission_id}", response_model=MissionResponse)
def get_mission(
    mission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One mission with its full vocab, each word tagged with the current user's
    training level."""
    mission = (
        db.query(Mission)
        .options(selectinload(Mission.vocab), selectinload(Mission.grammar))
        .filter(Mission.id == mission_id)
        .first()
    )
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    # First open only: run every word through the Mistral pipeline in the
    # background. queue_enrichment is gated on enrichment_status, so a mission
    # that is already ready/processing is left untouched.
    missions_service.queue_enrichment(mission_id)
    # (Re)generate the speaking role-play when missing or from an older design
    # version (queue_enrichment above no-ops for already-enriched missions).
    if missions_service.speaking_stale(mission.speaking):
        missions_service.queue_speaking(mission_id)
    if missions_service.context_preview_stale(mission.context_preview):
        missions_service.queue_context_preview(mission_id)

    # Per-user training level for each mission word, matched by lowercased
    # spanish (the same key add_mission_vocab_to_deck uses to mint Words).
    keys = [v.spanish.strip().lower() for v in mission.vocab if v.spanish.strip()]
    levels: dict[str, int] = {}
    if keys:
        rows = (
            db.query(func.lower(Word.spanish), UserCard.level)
            .join(UserCard, UserCard.word_id == Word.id)
            .filter(
                UserCard.user_id == current_user.id,
                func.lower(Word.spanish).in_(keys),
            )
            .all()
        )
        levels = {k: lvl for k, lvl in rows}

    # Goal-flavored example sentences for the user's top-priority goal, batched
    # in one query — falls back to the vocab's generic example_sentence for any
    # word without a matching flavor variant.
    flavored = missions_service.pick_example_sentences(
        db, [v.id for v in mission.vocab], current_user.id
    )

    vocab = [
        MissionVocabResponse(
            id=v.id,
            order_index=v.order_index,
            spanish=v.spanish,
            english=v.english,
            example_sentence=flavored.get(v.id, v.example_sentence),
            part_of_speech=v.part_of_speech,
            enrichment=v.enrichment,
            image_url=v.image_url,
            level=levels.get(v.spanish.strip().lower()),
        )
        for v in mission.vocab
    ]
    grammar = [
        GrammarPatternResponse.model_validate(g)
        for g in sorted(mission.grammar, key=lambda g: g.order_index)
    ]
    user_mission = (
        db.query(UserMission)
        .filter(UserMission.user_id == current_user.id, UserMission.mission_id == mission_id)
        .first()
    )
    return MissionResponse(
        id=mission.id,
        order_index=mission.order_index,
        title=mission.title,
        description=mission.description,
        level=mission.level,
        enrichment_status=mission.enrichment_status,
        speaking=mission.speaking,
        context_preview=mission.context_preview,
        vocab=vocab,
        grammar=grammar,
        status=user_mission.status if user_mission else None,
        completed_at=user_mission.completed_at if user_mission else None,
    )


@router.get("/{mission_id}/status", response_model=MissionEnrichStatus)
def mission_status(mission_id: str, db: Session = Depends(get_db)):
    """Enrichment progress — polled by the 'preparing mission' window. No side
    effects (does not trigger the pipeline)."""
    exists = db.query(Mission.id).filter(Mission.id == mission_id).first()
    if exists is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    status, enriched, total = missions_service.enrichment_progress(db, mission_id)
    return MissionEnrichStatus(
        mission_id=mission_id, status=status, enriched=enriched, total=total
    )


@router.post("/{mission_id}/start", response_model=MissionStartResponse)
def start_mission(
    mission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Make a mission available for the current user and push its vocabulary
    into their deck.

    Marks the UserMission ``available`` and mints Word + UserCard rows for every
    mission word so it shows up in the Vocabulary tab and enters FSRS review.
    Idempotent — safe to call every time the mission is opened.
    """
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if mission is None:
        raise HTTPException(status_code=404, detail="Mission not found")

    user_mission = (
        db.query(UserMission)
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.mission_id == mission_id,
        )
        .first()
    )
    if user_mission is None:
        user_mission = UserMission(
            user_id=current_user.id, mission_id=mission_id, status=MISSION_AVAILABLE
        )
        db.add(user_mission)
    elif user_mission.status == MISSION_LOCKED:
        user_mission.status = MISSION_AVAILABLE
    # Bumped on every open (this endpoint is called idempotently each time),
    # so "most recent, non-completed UserMission" is a reliable "current
    # mission" for the dashboard.
    user_mission.last_opened_at = datetime.now(timezone.utc)
    db.commit()

    added = missions_service.add_mission_vocab_to_deck(db, current_user.id, mission_id)
    # Enrich in the background so the newly added deck words gain rich data too.
    missions_service.queue_enrichment(mission_id)
    skill_stats_service.bust_dashboard_cache(current_user.id)
    return MissionStartResponse(
        mission_id=mission_id, status=user_mission.status, vocab_added=added
    )


@router.post("/{mission_id}/complete", response_model=MissionCompleteResponse)
def complete_mission(
    mission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a mission completed for the current user — called when the Final
    Challenge conversation reaches its natural end. Idempotent."""
    if db.query(Mission.id).filter(Mission.id == mission_id).first() is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    status, completed_at = missions_service.complete_mission(
        db, current_user.id, mission_id
    )
    skill_stats_service.bust_dashboard_cache(current_user.id)
    return MissionCompleteResponse(
        mission_id=mission_id, status=status, completed_at=completed_at
    )


@router.get("/{mission_id}/speaking/scene", response_model=SpeakingScene)
def speaking_scene(
    mission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The Final Challenge scene — role, setting, goal and the NPC's cold-open
    line. Resolved from the mission's generated speaking script when present, or
    a hand-authored fallback so the challenge is always playable."""
    scene = missions_service.speaking_scene(db, mission_id)
    if scene is None:
        raise HTTPException(status_code=404, detail="Mission not found")
    return SpeakingScene(**scene)


@router.post("/{mission_id}/speaking/turn", response_model=SpeakingTurnResponse)
def speaking_turn(
    mission_id: str,
    body: SpeakingTurnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Evaluate one learner utterance in a free-conversation speaking stage
    (stages 5-7) and return the NPC's in-character reply. Also used by the
    Final Challenge, which shares this same endpoint.

    Guided stages (1-4) are graded on the client; only the open stages call the
    LLM here. Returns 502 when the LLM provider is unavailable/unconfigured.
    """
    vocab = [
        v.spanish for v in db.query(MissionVocab).filter(MissionVocab.mission_id == mission_id)
    ]
    try:
        result = missions_service.speaking_turn(
            role=body.role,
            setting=body.setting,
            goal=body.goal,
            history=[(t.speaker, t.text) for t in body.history],
            utterance=body.utterance,
            vocab=vocab,
        )
    except missions_service.enrich_service.EnrichmentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    # A word correctly, spontaneously produced in free conversation is a
    # stronger mastery signal than a scripted drill answer — feed it into the
    # word's own FSRS schedule (rating 4/Easy) instead of throwing it away.
    if result.get("understood"):
        for spanish in result.get("words_used") or []:
            vocab_service.apply_word_signal(db, current_user.id, spanish, rating=4)
    skill_stats_service.record_attempt(
        db, current_user.id, skill_stats_service.SKILL_CONVERSATION,
        correct=result.get("understood"), retries=body.retry_count, recorded=body.recorded,
    )
    if body.confidence is not None:
        skill_stats_service.record_attempt(
            db, current_user.id, skill_stats_service.SKILL_PRONUNCIATION,
            score=body.confidence * 100,
        )
    return SpeakingTurnResponse(**result)
