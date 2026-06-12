import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.study_session import StudySession
from app.models.user import User
from app.models.user_card import UserCard
from app.schemas.stats import DashboardResponse

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

    result = {
        "streak": current_user.streak_count,
        "total_learned": total_learned,
        "due_today": due_today,
        "weekly_xp": int(weekly_xp) * 10,
    }
    _cache_set(cache_key, result)
    return DashboardResponse(**result)
