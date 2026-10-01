import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator

CEFR_LEVELS: tuple[str, ...] = ("A1", "A2", "B1", "B2", "C1")

# Exact PickOption.name strings from frontend/src/app/register/page.tsx's
# SKILL_PRIORITIES/MOTIVATIONS — kept in lockstep so neither side can drift.
SKILL_PRIORITIES: tuple[str, ...] = ("Speaking", "Listening", "Reading", "Writing")
MOTIVATIONS: tuple[str, ...] = (
    "Travel",
    "Work / business",
    "Academic study",
    "Living abroad / relocation",
    "Family or heritage",
    "Dating or a partner",
    "Making friends",
    "Consuming media",
    "Gaming / online communities",
)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    streak_count: int
    created_at: datetime
    cefr_level: str
    skill_priority: str | None = None
    motivation: str | None = None

    model_config = {"from_attributes": True}


class CefrLevelUpdate(BaseModel):
    cefr_level: Literal["A1", "A2", "B1", "B2", "C1"]


class OnboardingPreferencesUpdate(BaseModel):
    skill_priority: Literal[
        "Speaking", "Listening", "Reading", "Writing"
    ] | None = None
    motivation: Literal[
        "Travel",
        "Work / business",
        "Academic study",
        "Living abroad / relocation",
        "Family or heritage",
        "Dating or a partner",
        "Making friends",
        "Consuming media",
        "Gaming / online communities",
    ] | None = None
