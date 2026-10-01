from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.goal import Goal, UserGoal
from app.models.user import User
from app.schemas.goal import GoalResponse, UserGoalResponse, UserGoalsUpdateRequest

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalResponse])
def list_goals(db: Session = Depends(get_db)):
    """The full goal catalog, for the goal picker UI."""
    return db.query(Goal).order_by(Goal.id).all()


@router.get("/me", response_model=list[UserGoalResponse])
def my_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The current user's ranked goal selection, top priority first."""
    rows = (
        db.query(UserGoal)
        .filter(UserGoal.user_id == current_user.id)
        .order_by(UserGoal.priority.asc())
        .all()
    )
    if not rows:
        return []
    # No relationship defined on UserGoal, so resolve the Goal rows with one query.
    goals = {g.id: g for g in db.query(Goal).filter(Goal.id.in_(r.goal_id for r in rows)).all()}
    return [
        UserGoalResponse(goal=GoalResponse.model_validate(goals[row.goal_id]), priority=row.priority)
        for row in rows
    ]


@router.put("/me", response_model=list[UserGoalResponse])
def set_my_goals(
    body: UserGoalsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full replace of the learner's goal selection: deletes the existing set
    and inserts the given one. Validates every goal_key exists and priorities
    are positive and unique (duplicate priorities would make scoring ambiguous)."""
    priorities = [g.priority for g in body.goals]
    if len(priorities) != len(set(priorities)):
        raise HTTPException(status_code=400, detail="Duplicate priority values")
    if any(p < 1 for p in priorities):
        raise HTTPException(status_code=400, detail="Priority must be a positive integer")

    goals_by_key = {g.key: g for g in db.query(Goal).filter(Goal.key.in_(g.goal_key for g in body.goals)).all()}
    unknown = [g.goal_key for g in body.goals if g.goal_key not in goals_by_key]
    if unknown:
        raise HTTPException(status_code=404, detail=f"Unknown goal_key(s): {', '.join(unknown)}")

    db.query(UserGoal).filter(UserGoal.user_id == current_user.id).delete()
    for entry in body.goals:
        db.add(UserGoal(user_id=current_user.id, goal_id=goals_by_key[entry.goal_key].id, priority=entry.priority))
    db.commit()

    return my_goals(db, current_user)
