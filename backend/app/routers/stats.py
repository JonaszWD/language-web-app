import json
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.grammar_pattern import GrammarPattern, UserGrammarCard
from app.models.mission import MISSION_COMPLETED, Mission, UserMission
from app.models.skill_stats import UserSkillStats
from app.models.study_session import StudySession
from app.models.user import User
from app.models.user_card import UserCard
from app.schemas.stats import DashboardResponse
from app.services.grammar_pattern import grammar_dashboard_summary
from app.services.vocab import vocab_dashboard_summary

router = APIRouter(prefix="/stats", tags=["stats"])

try:
    import redis as redis_lib

    _redis = redis_lib.from_url(settings.redis_url, decode_responses=True)
except Exception:
    _redis = None

CACHE_TTL = 300  # 5 minutes


def _cache_get(key: str):
    if _redis is None:
        return None
    try:
        val = _redis.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def _cache_set(key: str, value: dict) -> None:
    if _redis is None:
        return
    try:
        _redis.setex(key, CACHE_TTL, json.dumps(value))
    except Exception:
        pass


def _progress_extra(db: Session, user: User, skill_rows: list[UserSkillStats]) -> dict[str, Any]:
    """Study-habit aggregates for the Home dashboard's Progress group."""
    today = date.today()

    vocab_reps, vocab_lapses = (
        db.query(func.coalesce(func.sum(UserCard.reps), 0), func.coalesce(func.sum(UserCard.lapses), 0))
        .filter(UserCard.user_id == user.id)
        .one()
    )
    grammar_reps, grammar_lapses = (
        db.query(
            func.coalesce(func.sum(UserGrammarCard.reps), 0), func.coalesce(func.sum(UserGrammarCard.lapses), 0)
        )
        .filter(UserGrammarCard.user_id == user.id)
        .one()
    )
    reps = int(vocab_reps) + int(grammar_reps)
    retention_rate = max(0.0, 1 - (int(vocab_lapses) + int(grammar_lapses)) / reps) if reps else None

    since = datetime.now(timezone.utc) - timedelta(days=30)
    recent_starts = [
        row[0]
        for row in db.query(StudySession.started_at)
        .filter(StudySession.user_id == user.id, StudySession.started_at >= since)
        .all()
    ]
    active_days_30 = len({s.date() for s in recent_starts})
    hours = Counter(s.astimezone(timezone.utc).hour for s in recent_starts)
    typical_study_hour_utc = hours.most_common(1)[0][0] if hours else None

    week_start = today - timedelta(days=today.weekday())
    xp_by_week = []
    for weeks_ago in range(3, -1, -1):
        start = week_start - timedelta(weeks=weeks_ago)
        correct = (
            db.query(func.coalesce(func.sum(StudySession.cards_correct), 0))
            .filter(
                StudySession.user_id == user.id,
                StudySession.started_at >= start,
                StudySession.started_at < start + timedelta(weeks=1),
            )
            .scalar()
            or 0
        )
        xp_by_week.append(int(correct) * 10)

    last_session = db.query(func.max(StudySession.started_at)).filter(StudySession.user_id == user.id).scalar()
    last_seen = [d for d in [last_session, *(r.last_practiced_at for r in skill_rows)] if d is not None]
    days_since_last_session = (
        (datetime.now(timezone.utc) - max(last_seen)).days if last_seen else None
    )

    relearning_count = (
        db.query(func.count(UserCard.id))
        .filter(UserCard.user_id == user.id, UserCard.state == "relearning")
        .scalar()
        or 0
    )

    by_structure = (
        db.query(GrammarPattern.pattern, func.sum(UserGrammarCard.reps).label("reps"))
        .join(UserGrammarCard, UserGrammarCard.pattern_id == GrammarPattern.id)
        .filter(UserGrammarCard.user_id == user.id, UserGrammarCard.reps > 0)
        .group_by(GrammarPattern.pattern)
        .order_by(func.sum(UserGrammarCard.reps).desc())
        .limit(5)
        .all()
    )

    return {
        "retention_rate": retention_rate,
        "active_days_30": active_days_30,
        "xp_by_week": xp_by_week,
        "typical_study_hour_utc": typical_study_hour_utc,
        "days_since_last_session": days_since_last_session,
        "lapses_total": int(vocab_lapses),
        "relearning_count": relearning_count,
        "grammar_reps_by_structure": [{"structure": p, "reps": int(n)} for p, n in by_structure],
    }


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"dashboard:{current_user.id}"
    cached = _cache_get(cache_key)
    if cached:
        return DashboardResponse(**cached)

    today = date.today()

    due_today = (
        db.query(func.count(UserCard.id))
        .filter(
            UserCard.user_id == current_user.id,
            UserCard.due_date <= today,
        )
        .scalar()
        or 0
    )

    total_learned = (
        db.query(func.count(UserCard.id))
        .filter(
            UserCard.user_id == current_user.id,
            UserCard.state == "review",
        )
        .scalar()
        or 0
    )

    week_start = today - timedelta(days=today.weekday())
    weekly_xp = (
        db.query(func.coalesce(func.sum(StudySession.cards_correct), 0))
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.started_at >= week_start,
        )
        .scalar()
        or 0
    )

    # Only completed sessions count — one left open (ended_at NULL, e.g. an
    # abandoned tab) has no known duration and shouldn't skew the total.
    session_totals = (
        db.query(
            func.coalesce(func.sum(func.extract("epoch", StudySession.ended_at - StudySession.started_at)), 0),
            func.count(StudySession.id),
        )
        .filter(
            StudySession.user_id == current_user.id,
            StudySession.ended_at.isnot(None),
        )
        .first()
    )
    total_study_seconds, study_sessions_count = session_totals or (0, 0)

    missions_completed = (
        db.query(func.count(UserMission.id))
        .filter(UserMission.user_id == current_user.id, UserMission.status == MISSION_COMPLETED)
        .scalar()
        or 0
    )

    current_mission_row = (
        db.query(UserMission.mission_id, Mission.title)
        .join(Mission, Mission.id == UserMission.mission_id)
        .filter(
            UserMission.user_id == current_user.id,
            UserMission.status != MISSION_COMPLETED,
            UserMission.last_opened_at.isnot(None),
        )
        .order_by(UserMission.last_opened_at.desc())
        .first()
    )
    current_mission = (
        {"id": current_mission_row[0], "title": current_mission_row[1]} if current_mission_row else None
    )

    skill_rows = db.query(UserSkillStats).filter(UserSkillStats.user_id == current_user.id).all()
    skills = {
        row.skill: {
            "attempts": row.attempts,
            "accuracy": row.correct_count / row.attempts if row.attempts else 0.0,
            "avg_score": row.score_sum / row.scored_attempts if row.scored_attempts else None,
            "last_practiced_at": row.last_practiced_at.isoformat() if row.last_practiced_at else None,
            "avg_response_ms": row.response_ms_total / row.attempts if row.attempts else None,
            "max_stage_reached": row.max_stage_reached,
            "replays_total": row.replays_total,
            "transcript_reveals_total": row.transcript_reveals_total,
            "last_speed_reached": row.last_speed_reached,
            "retries_total": row.retries_total,
            "recordings_total": row.recordings_total,
        }
        for row in skill_rows
    }

    result: dict[str, Any] = {
        "streak": current_user.streak_count,
        "longest_streak": current_user.longest_streak,
        "total_learned": total_learned,
        "due_today": due_today,
        "weekly_xp": int(weekly_xp) * 10,
        "cefr_level": current_user.cefr_level,
        "missions_completed": missions_completed,
        "current_mission": current_mission,
        "total_study_seconds": int(total_study_seconds),
        "study_sessions_count": study_sessions_count,
        "skills": skills,
        "vocab_extra": vocab_dashboard_summary(db, current_user.id),
        "grammar_extra": grammar_dashboard_summary(db, current_user.id),
        "progress_extra": _progress_extra(db, current_user, skill_rows),
    }
    _cache_set(cache_key, result)
    return DashboardResponse(**result)
