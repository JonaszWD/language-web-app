import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.skill_stats import UserSkillStats
from app.models.study_session import StudySession
from app.models.user import User
from app.models.user_card import UserCard
from app.schemas.stats import DashboardResponse, SkillSummary

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

    skill_rows = db.query(UserSkillStats).filter(UserSkillStats.user_id == current_user.id).all()
    skills: dict[str, SkillSummary] = {
        row.skill: SkillSummary(
            attempts=row.attempts,
            accuracy=row.correct_count / row.attempts if row.attempts else 0.0,
            avg_score=row.score_sum / row.scored_attempts if row.scored_attempts else None,
            last_practiced_at=row.last_practiced_at,
        )
        for row in skill_rows
    }

    result: DashboardResponse = DashboardResponse(
        streak=current_user.streak_count,
        total_learned=total_learned,
        due_today=due_today,
        weekly_xp=int(weekly_xp) * 10,
        skills=skills,
    )
    _cache_set(cache_key, result.model_dump(mode="json"))
    return result
