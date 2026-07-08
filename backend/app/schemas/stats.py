from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SkillSummary(BaseModel):
    attempts: int
    accuracy: float          # correct_count / attempts, 0 when no attempts yet
    avg_score: Optional[float] = None  # score_sum / attempts, None when no scorer ever reported one
    last_practiced_at: Optional[datetime] = None


class DashboardResponse(BaseModel):
    streak: int
    total_learned: int
    due_today: int
    weekly_xp: int
    skills: dict[str, SkillSummary] = {}
