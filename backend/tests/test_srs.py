from datetime import date, timedelta

import pytest

from app.services.srs import schedule

TODAY = date(2026, 1, 1)


def review(state="new", stability=0.0, difficulty=0.0, reps=0, lapses=0, rating=3):
    return schedule(stability, difficulty, reps, lapses, state, rating, TODAY)


def test_new_card_easy_goes_straight_to_review():
    u = review(rating=4)
    assert u.state == "review"
    assert u.reps == 1
    assert u.due_date > TODAY + timedelta(days=1)


@pytest.mark.parametrize("rating", [1, 2, 3])
def test_new_card_other_ratings_start_learning_and_are_due_tomorrow(rating):
    u = review(rating=rating)
    assert u.state == "learning"
    assert u.due_date == TODAY + timedelta(days=1)


def test_learning_card_graduates_on_good():
    first = review(rating=3)
    u = schedule(first.stability, first.difficulty, first.reps, first.lapses,
                 first.state, 3, TODAY)
    assert u.state == "review"
    assert u.reps == first.reps + 1


def test_lapse_on_review_card_enters_relearning():
    u = review(state="review", stability=20.0, difficulty=5.0, reps=5, lapses=1, rating=1)
    assert u.state == "relearning"
    assert u.lapses == 2
    assert u.reps == 5
    assert u.due_date == TODAY + timedelta(days=1)


def test_successful_review_increases_stability_and_interval():
    u = review(state="review", stability=5.0, difficulty=5.0, reps=3, rating=3)
    assert u.state == "review"
    assert u.stability > 5.0
    assert u.reps == 4
    assert u.due_date > TODAY + timedelta(days=5)


def test_easier_ratings_schedule_further_out():
    kwargs = dict(state="review", stability=5.0, difficulty=5.0, reps=3)
    hard, good, easy = (review(rating=r, **kwargs) for r in (2, 3, 4))
    assert hard.due_date <= good.due_date <= easy.due_date
    assert hard.stability < good.stability < easy.stability


@pytest.mark.parametrize("rating", [1, 2, 3, 4])
@pytest.mark.parametrize("state", ["new", "learning", "review", "relearning"])
def test_difficulty_stays_in_bounds_and_due_date_is_in_the_future(state, rating):
    u = review(state=state, stability=3.0, difficulty=5.0, reps=2, rating=rating)
    assert 1.0 <= u.difficulty <= 10.0
    assert u.stability > 0
    assert u.due_date > TODAY


def test_difficulty_rises_on_again_and_falls_on_easy():
    kwargs = dict(state="review", stability=10.0, difficulty=5.0, reps=4)
    assert review(rating=1, **kwargs).difficulty > 5.0
    assert review(rating=4, **kwargs).difficulty < 5.0


def test_longer_gap_since_last_review_grows_stability_more():
    kwargs = dict(stability=5.0, difficulty=5.0, reps=3, lapses=0, state="review", rating=3, now=TODAY)
    on_time = schedule(**kwargs, elapsed_days=5)
    late = schedule(**kwargs, elapsed_days=30)
    assert late.stability > on_time.stability > 5.0
