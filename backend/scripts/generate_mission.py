#!/usr/bin/env python
"""Generate a complete, playable mission from a scenario + level.

Every exercise is built from this mission's NEW vocab plus the vocab already
taught by earlier missions — never untaught words. After generating, the script
lints the output against that budget and refuses to write if it drifts (unless
--force), so you always ship content the learner can actually handle.

Usage:
    # From inside the backend container (needs MISTRAL_API_KEY or CLAUDE_API_KEY):
    python scripts/generate_mission.py --scenario "At the pharmacy" --level B1
    python scripts/generate_mission.py --scenario "At the market" --level A2 --id m005-market

    # Lint an already-generated mission offline (no LLM, no keys needed):
    python scripts/generate_mission.py --check m004-doctor

    # Generate a checkpointed narrative listening item (standalone or mission-scoped):
    python scripts/generate_mission.py --story --scenario "Losing your passport" --level B1
    python scripts/generate_mission.py --story --scenario "At the doctor" --level A2 \
        --scenario-tag m004-doctor --id m004-doctor-story-1

    # Generate a story pinned to an exact topic vocabulary (keeps it on-topic —
    # standalone stories otherwise draw from every word taught across all
    # missions, which drifts off-topic for anything outside that pool):
    python scripts/generate_mission.py --story --scenario "A city traffic debate" --level C1 \
        --vocab "el tráfico,el coche,la calle,rápido,lento,el autobús,cruzar" --id c1-traffic
    python scripts/generate_mission.py --story --scenario "Renting an apartment" --level B2 \
        --vocab-file vocab-renting.txt --id b2-renting

Writes:
    backend/content/missions/<id>.json          (seeded by `make seed`)
    frontend/src/content/generated-missions.json (merged; overlay + lesson decks)
    backend/content/listening/<id>.json          (--story; seeded by seed_listening_items.py)

After generating, review both files, then `make migrate && make seed`.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import mission_gen  # noqa: E402

FRONTEND_GENERATED = REPO_ROOT / "frontend" / "src" / "content" / "generated-missions.json"


def _slug(scenario: str, order: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", scenario.lower()).strip("-")
    return f"m{order:03d}-{base}"


def _load_aggregate() -> dict:
    if FRONTEND_GENERATED.exists():
        return json.loads(FRONTEND_GENERATED.read_text(encoding="utf-8"))
    return {}


def cmd_check(mission_id: str) -> int:
    """Offline lint: does the mission's content stay within taught+new vocab?"""
    backend_path = mission_gen.CONTENT_DIR / f"{mission_id}.json"
    if not backend_path.exists():
        print(f"No mission JSON at {backend_path}", file=sys.stderr)
        return 2
    mission = json.loads(backend_path.read_text(encoding="utf-8"))
    known = mission_gen.load_known_vocab(exclude_id=mission_id)

    # Fold the frontend lesson decks in so exercise text is linted too.
    agg = _load_aggregate().get(mission_id)
    if agg:
        mission = {**mission, "_lessons": agg}

    violations = mission_gen.lint_vocab(mission, known)
    if violations:
        print(f"✗ {mission_id}: {len(violations)} out-of-vocab word(s):")
        for v in violations:
            print(f"    {v}")
        return 1
    print(f"✓ {mission_id}: all exercise vocab is taught or known ({len(known)} known words).")
    return 0


def cmd_lessons(mission_id: str, level: str, force: bool) -> int:
    """Generate ONLY the lesson decks for an already-authored mission, reusing its
    committed vocab/grammar/scene. Writes just the frontend lesson entry."""
    print(f"Generating lessons for {mission_id} ({level})…", file=sys.stderr)
    result = mission_gen.generate_lessons(mission_id, level)
    frontend = result["frontend"]

    lint_input = {"vocab": result["vocab"], "_lessons": frontend}
    violations = mission_gen.lint_vocab(lint_input, result["known"])
    if violations:
        print(f"  ⚠ {len(violations)} out-of-vocab word(s):", file=sys.stderr)
        for v in violations[:20]:
            print(f"      {v}", file=sys.stderr)
        if not force:
            print("  Refusing to write (use --force to override).", file=sys.stderr)
            return 1

    agg = _load_aggregate()
    entry = agg.get(mission_id, {})
    entry.update(frontend)  # keep any existing overlay; replace decks
    agg[mission_id] = entry
    FRONTEND_GENERATED.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND_GENERATED.write_text(json.dumps(agg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote lessons for {mission_id} → {FRONTEND_GENERATED.relative_to(REPO_ROOT)}", file=sys.stderr)
    return 0


def cmd_generate(
    scenario: str, level: str, mission_id: str | None, force: bool, topics: list[str] | None = None
) -> int:
    order = mission_gen.next_order_index()
    mission_id = mission_id or _slug(scenario, order)
    print(f"Generating {mission_id} — \"{scenario}\" ({level})…", file=sys.stderr)

    result = mission_gen.generate_mission(scenario, level, mission_id, topics=topics)
    backend = result["backend"]
    frontend = result["frontend"]
    print(f"  known vocab: {result['known_count']} words · new: {len(backend['vocab'])}", file=sys.stderr)

    known = mission_gen.load_known_vocab(exclude_id=mission_id)
    violations = mission_gen.lint_vocab({**backend, "_lessons": frontend}, known)
    if violations:
        print(f"  ⚠ {len(violations)} out-of-vocab word(s):", file=sys.stderr)
        for v in violations[:20]:
            print(f"      {v}", file=sys.stderr)
        if not force:
            print("  Refusing to write (use --force to override).", file=sys.stderr)
            return 1

    backend_path = mission_gen.CONTENT_DIR / f"{mission_id}.json"
    backend_path.write_text(json.dumps(backend, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    agg = _load_aggregate()
    agg[mission_id] = frontend
    FRONTEND_GENERATED.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND_GENERATED.write_text(json.dumps(agg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"  wrote {backend_path.relative_to(REPO_ROOT)}", file=sys.stderr)
    print(f"  wrote {FRONTEND_GENERATED.relative_to(REPO_ROOT)}", file=sys.stderr)
    print("  Review both, then: make seed", file=sys.stderr)
    return 0


def _story_slug(scenario: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", scenario.lower()).strip("-")
    return f"story-{base}"


def cmd_story(
    scenario: str,
    level: str,
    item_id: str | None,
    scenario_tag: str | None,
    force: bool,
    vocab: list[str] | None = None,
) -> int:
    """Generate one checkpointed narrative listening item — transcript + inline
    comprehension checkpoints — via mission_gen.generate_story(), then lint and
    write it to content/listening/<id>.json (seeded separately, see
    scripts/seed_listening_items.py)."""
    item_id = item_id or _story_slug(scenario)
    scope = f"scoped to {scenario_tag}" if scenario_tag else "standalone"
    if vocab:
        scope += f", pinned to {len(vocab)} given word(s)"
    print(f"Generating listening item {item_id} — \"{scenario}\" ({level}, {scope})…", file=sys.stderr)

    result = mission_gen.generate_story(scenario, level, item_id, scenario_tag=scenario_tag, vocab=vocab)
    item = result["item"]
    print(f"  known vocab: {result['known_count']} words · "
          f"{len(item['sentences'])} sentences · {len(item['checkpoints'])} checkpoints", file=sys.stderr)

    violations = mission_gen.lint_story_vocab(item, result["allowed"])
    if violations:
        print(f"  ⚠ {len(violations)} out-of-vocab word(s):", file=sys.stderr)
        for v in violations[:20]:
            print(f"      {v}", file=sys.stderr)
        if not force:
            print("  Refusing to write (use --force to override).", file=sys.stderr)
            return 1

    LISTENING_DIR = mission_gen.LISTENING_CONTENT_DIR
    LISTENING_DIR.mkdir(parents=True, exist_ok=True)
    item_path = LISTENING_DIR / f"{item_id}.json"
    item_path.write_text(json.dumps(item, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {item_path.relative_to(REPO_ROOT)}", file=sys.stderr)
    print("  Review, then: python scripts/seed_listening_items.py", file=sys.stderr)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scenario", help="Real-world scene, e.g. 'At the pharmacy'")
    ap.add_argument("--level", default="A2", help="CEFR level (A1/A2/B1/B2)")
    ap.add_argument("--id", dest="mission_id", help="Mission/item slug (default: derived)")
    ap.add_argument("--force", action="store_true", help="Write even if vocab lint fails")
    ap.add_argument("--check", metavar="MISSION_ID", help="Lint an existing mission offline and exit")
    ap.add_argument("--topics", dest="topics",
                    help="Comma-separated topic tags for the new mission (e.g. 'travel,social') — "
                         "the small fixed vocabulary that maps 1:1 to onboarding motivation options, "
                         "used to recommend this mission to matching users. Editorial, not inferred.")
    ap.add_argument("--lessons", metavar="MISSION_ID",
                    help="Generate only the lesson decks for an existing mission (keeps its JSON)")
    ap.add_argument("--story", action="store_true",
                    help="Generate a checkpointed narrative listening item instead of a mission")
    ap.add_argument("--scenario-tag", dest="scenario_tag",
                    help="Mission id to scope a --story to (its vocab/grammar); omit for standalone")
    ap.add_argument("--vocab", dest="vocab",
                    help="--story only: comma-separated Spanish words/phrases that become the ENTIRE "
                         "known-vocab pool for this story (replaces the global cross-mission pool, "
                         "which otherwise skews toward whatever's already been taught and drifts "
                         "off-topic for anything outside it)")
    ap.add_argument("--vocab-file", dest="vocab_file",
                    help="--story only: path to a file with one Spanish word/phrase per line, same "
                         "effect as --vocab (use for longer lists)")
    args = ap.parse_args()

    if args.check:
        return cmd_check(args.check)
    if args.lessons:
        return cmd_lessons(args.lessons, args.level, args.force)
    if args.story:
        if not args.scenario:
            ap.error("--scenario is required with --story")
        vocab: list[str] | None = None
        if args.vocab_file:
            vocab = [
                line.strip() for line in Path(args.vocab_file).read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
        elif args.vocab:
            vocab = [w.strip() for w in args.vocab.split(",") if w.strip()]
        return cmd_story(args.scenario, args.level, args.mission_id, args.scenario_tag, args.force, vocab=vocab)
    if not args.scenario:
        ap.error("--scenario is required (or use --check <id> / --lessons <id> / --story)")
    topics = [t.strip() for t in args.topics.split(",") if t.strip()] if args.topics else None
    return cmd_generate(args.scenario, args.level, args.mission_id, args.force, topics=topics)


if __name__ == "__main__":
    raise SystemExit(main())
