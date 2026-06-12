"""FSRS-4.5 scheduler ported to Python.

Ratings: 1=Again, 2=Hard, 3=Good, 4=Easy
States:  new → learning → review (→ relearning on lapse)
"""
from datetime import date, timedelta
import math

# FSRS-4.5 default weights
W = [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102,
    0.5316, 1.0651, 0.0589, 1.5330, 0.1544,
    1.0071, 1.9395, 0.1100, 0.2900, 2.2700,
    0.2500, 2.9898,
]

DECAY = -0.5
FACTOR = 0.9 ** (1 / DECAY) - 1
REQUEST_RETENTION = 0.9


def _forgetting_curve(t: float, s: float) -> float:
    """Retrievability after t days with stability s."""
    return (1 + FACTOR * t / s) ** DECAY if s > 0 else 0.0


def _init_stability(rating: int) -> float:
    return max(W[rating - 1], 0.1)


def _init_difficulty(rating: int) -> float:
    d = W[4] - math.exp(W[5] * (rating - 1)) + 1
    return min(max(d, 1.0), 10.0)


def _next_interval(stability: float) -> int:
    interval = stability / FACTOR * (REQUEST_RETENTION ** (1 / DECAY) - 1)
    return max(1, round(interval))


def _difficulty_update(d: float, rating: int) -> float:
    delta = W[6] * (3 - rating)
    d_new = d + delta * (10 - d) / 9
    return min(max(d_new, 1.0), 10.0)


def _short_term_stability(s: float, rating: int) -> float:
    return s * math.exp(W[17 - 1] * (rating - 3 + W[18 - 1])) if len(W) > 17 else s * 1.0


def _recall_stability(d: float, s: float, r: float, rating: int) -> float:
    hard_penalty = W[15] if rating == 2 else 1.0
    easy_bonus = W[16] if rating == 4 else 1.0
    return s * (
        math.exp(W[8])
        * (11 - d)
        * s ** (-W[9])
        * (math.exp((1 - r) * W[10]) - 1)
        * hard_penalty
        * easy_bonus
        + 1
    )


def _forget_stability(d: float, s: float, r: float) -> float:
    return (
        W[11]
        * d ** (-W[12])
        * ((s + 1) ** W[13] - 1)
        * math.exp((1 - r) * W[14])
    )


class CardUpdate:
    __slots__ = ("stability", "difficulty", "reps", "lapses", "state", "due_date")

    def __init__(self, stability, difficulty, reps, lapses, state, due_date):
        self.stability = stability
        self.difficulty = difficulty
        self.reps = reps
        self.lapses = lapses
        self.state = state
        self.due_date = due_date


def schedule(
    stability: float,
    difficulty: float,
    reps: int,
    lapses: int,
    state: str,
    rating: int,
    now: date,
) -> CardUpdate:
    """Compute next card state after a review.

    Args:
        stability: Current memory stability (days).
        difficulty: Current difficulty (1–10).
        reps: Number of successful reviews.
        lapses: Number of times the card was forgotten.
        state: Current state ('new', 'learning', 'review', 'relearning').
        rating: User rating 1=Again, 2=Hard, 3=Good, 4=Easy.
        now: Date of the review.

    Returns:
        CardUpdate with new field values.
    """
    if state == "new":
        new_stability = _init_stability(rating)
        new_difficulty = _init_difficulty(rating)
        new_reps = 1 if rating >= 3 else 0
        new_lapses = lapses

        if rating == 1:
            new_state = "learning"
            interval = 1
        elif rating == 2:
            new_state = "learning"
            interval = 1
        elif rating == 3:
            new_state = "learning"
            interval = 1
        else:
            new_state = "review"
            interval = _next_interval(new_stability)

    elif state in ("learning", "relearning"):
        new_difficulty = _difficulty_update(difficulty if difficulty > 0 else _init_difficulty(rating), rating)
        new_lapses = lapses

        if rating == 1:
            new_stability = max(stability if stability > 0 else _init_stability(rating), 0.1)
            new_state = state
            interval = 1
            new_reps = reps
        elif rating == 2:
            new_stability = max(stability if stability > 0 else _init_stability(rating), 0.1)
            new_state = state
            interval = 1
            new_reps = reps
        else:
            new_stability = stability if stability > 0 else _init_stability(rating)
            new_stability = max(new_stability * 1.1, _init_stability(rating))
            new_state = "review"
            interval = _next_interval(new_stability)
            new_reps = reps + 1

    else:  # review
        r = _forgetting_curve(
            (now - now).days if reps == 0 else 0,
            stability,
        )
        r = max(r, REQUEST_RETENTION * 0.5)
        new_difficulty = _difficulty_update(difficulty if difficulty > 0 else 5.0, rating)

        if rating == 1:
            new_stability = _forget_stability(new_difficulty, stability, r)
            new_stability = max(new_stability, 0.1)
            new_state = "relearning"
            interval = 1
            new_lapses = lapses + 1
            new_reps = reps
        else:
            new_stability = _recall_stability(new_difficulty, stability, r, rating)
            new_stability = max(new_stability, stability * 0.1)
            new_state = "review"
            interval = _next_interval(new_stability)
            new_lapses = lapses
            new_reps = reps + 1

    return CardUpdate(
        stability=round(new_stability, 4),
        difficulty=round(new_difficulty, 4),
        reps=new_reps,
        lapses=new_lapses,
        state=new_state,
        due_date=now + timedelta(days=interval),
    )
