#!/usr/bin/env python
"""Upsert every backend/content/listening/*.json into the DB.

Mirrors seed.py's seed_missions(): canonical content lives as version-controlled
JSON, one file per item, generated via `generate_mission.py --story` and reviewed
before running this. Idempotent — safe to re-run.

Usage (inside the backend container):
    python scripts/seed_listening_items.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("DATABASE_URL", os.getenv("DATABASE_URL", ""))

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy.orm import Session  # noqa: E402

from app.database import engine  # noqa: E402
from app.models.listening_item import ListeningCheckpoint, ListeningItem  # noqa: E402

LISTENING_DIR = BACKEND_DIR / "content" / "listening"


def seed_listening_items(session: Session) -> None:
    files = sorted(LISTENING_DIR.glob("*.json"))
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))

        item = session.get(ListeningItem, data["id"])
        if item is None:
            item = ListeningItem(id=data["id"])
            session.add(item)
        item.scenario_tag = data.get("scenario_tag")
        item.cefr_level = data["cefr_level"]
        item.title = data["title"]
        item.sentences = data["sentences"]
        item.vocab_reused = data.get("vocab_reused", [])
        item.long_form = data.get("long_form", False)

        # Replace checkpoints wholesale, same as seed_missions() does for vocab —
        # content is hand-reviewed generated JSON, not user data.
        item.checkpoints.clear()
        session.flush()
        for c in data.get("checkpoints", []):
            item.checkpoints.append(
                ListeningCheckpoint(
                    after_sentence_id=c["after_sentence_id"],
                    type=c["type"],
                    prompt=c["prompt"],
                    options=c.get("options") or None,
                    correct_answer=c["correct_answer"],
                    linked_concept_type=c.get("linked_concept_type"),
                    linked_concept_id=c.get("linked_concept_id"),
                    difficulty_tag=c.get("difficulty_tag"),
                )
            )

    session.commit()
    print(f"Seeded {len(files)} listening items from {LISTENING_DIR}.")


def main() -> None:
    with Session(engine) as session:
        seed_listening_items(session)


if __name__ == "__main__":
    main()
