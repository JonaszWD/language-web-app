from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    CefrLevelUpdate,
    LoginRequest,
    OnboardingPreferencesUpdate,
    RegisterRequest,
    UserResponse,
)
from app.services.auth import create_access_token, hash_password, verify_password
from app.services.missions import sync_user_goal_from_motivation

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = settings.jwt_expire_minutes * 60


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=COOKIE_MAX_AGE,
    )


@router.post("/register", response_model=UserResponse)
def register(body: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    _set_auth_cookie(response, token)
    return user


@router.post("/login", response_model=UserResponse)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id)})
    _set_auth_cookie(response, token)
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.patch("/me/cefr-level", response_model=UserResponse)
def update_cefr_level(
    body: CefrLevelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.cefr_level = body.cefr_level
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/onboarding", response_model=UserResponse)
def update_onboarding_preferences(
    body: OnboardingPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set the learner's skill-priority/motivation onboarding answers.

    Called once per screen as the /register flow progresses (see
    frontend/src/app/register/page.tsx's handlePriorityPick/handleMotivationPick),
    so each request only ever carries one of the two fields — only fields
    actually present on the request are updated.
    """
    if body.skill_priority is not None:
        current_user.skill_priority = body.skill_priority
    if body.motivation is not None:
        current_user.motivation = body.motivation
        # Bridge: mirror the single-select motivation into a UserGoal(priority=1)
        # row so goal-based scoring/example-sentence flavor works without any
        # frontend change (see services.missions.sync_user_goal_from_motivation).
        sync_user_goal_from_motivation(db, current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
