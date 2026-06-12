from pydantic import BaseModel


class DashboardResponse(BaseModel):
    streak: int
    total_learned: int
    due_today: int
    weekly_xp: int
