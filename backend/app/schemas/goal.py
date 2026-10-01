from pydantic import BaseModel


class GoalResponse(BaseModel):
    id: int
    key: str
    display_name: str

    model_config = {"from_attributes": True}


class UserGoalUpdate(BaseModel):
    """One entry in the learner's ranked goal selection."""

    goal_key: str
    priority: int  # 1 = highest priority


class UserGoalsUpdateRequest(BaseModel):
    """Full replace of the learner's goal selection — server deletes the
    existing set and inserts this one, so there's no partial-update ambiguity
    when a goal is dropped."""

    goals: list[UserGoalUpdate]


class UserGoalResponse(BaseModel):
    goal: GoalResponse
    priority: int
