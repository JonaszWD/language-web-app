from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SkillSummary(BaseModel):
    attempts: int
    accuracy: float          # correct_count / attempts, 0 when no attempts yet
    avg_score: Optional[float] = None  # score_sum / attempts, None when no scorer ever reported one
    last_practiced_at: Optional[datetime] = None
    # response_ms_total / attempts — only meaningful for skills that actually
    # send response_ms (currently vocab + grammar).
    avg_response_ms: Optional[float] = None
    # The rest are only populated by skills with the matching concept
    # (scripted-lesson stage/replay/reveal/speed for Grammar/Listening/Writing;
    # retries/recordings for Speaking) — 0/None everywhere else.
    max_stage_reached: Optional[int] = None
    replays_total: int = 0
    transcript_reveals_total: int = 0
    last_speed_reached: Optional[float] = None
    retries_total: int = 0
    recordings_total: int = 0


class VocabExtra(BaseModel):
    """Deck-wide vocab aggregates not tied to any single skill row — see
    services.vocab.vocab_dashboard_summary."""
    due_tomorrow: int
    new_count: int
    learning_count: int
    reviewing_count: int
    mature_count: int
    avg_stability: Optional[float] = None
    lapse_rate: Optional[float] = None
    hardest_words: list[str] = []
    avg_response_ms: Optional[float] = None


class GrammarExtra(BaseModel):
    """Deck-wide grammar-pattern aggregates — see
    services.grammar_pattern.grammar_dashboard_summary."""
    mastered_count: int
    weakest_structure: Optional[str] = None


class ProgressExtra(BaseModel):
    """Study-habit aggregates derived from study_sessions + the FSRS decks."""
    # 1 - lapses/reps across vocab + grammar cards — share of reviews recalled.
    retention_rate: Optional[float] = None
    # Distinct days with a study session in the last 30 days.
    active_days_30: int = 0
    # XP per ISO week, oldest first, ending with the current week (4 entries).
    xp_by_week: list[int] = []
    # Most common hour (0-23, UTC) that sessions start in — the client
    # converts it to the viewer's local time.
    typical_study_hour_utc: Optional[int] = None
    # Days since the most recent session or skill practice; None if never.
    days_since_last_session: Optional[int] = None
    # Vocab cards forgotten at least once (sum of lapses) / currently relearning.
    lapses_total: int = 0
    relearning_count: int = 0
    # Reviews per grammar structure, most practised first (top 5).
    grammar_reps_by_structure: list[dict] = []


class CurrentMission(BaseModel):
    id: str
    title: str


class DashboardResponse(BaseModel):
    streak: int
    longest_streak: int
    total_learned: int
    due_today: int
    weekly_xp: int
    cefr_level: str
    missions_completed: int
    current_mission: Optional[CurrentMission] = None
    total_study_seconds: int
    study_sessions_count: int
    skills: dict[str, SkillSummary] = {}
    vocab_extra: VocabExtra
    grammar_extra: GrammarExtra
    progress_extra: ProgressExtra = ProgressExtra()
