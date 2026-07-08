#!/usr/bin/env python
"""Generate a complete, playable mission from a scenario + level.

Every exercise is built from this mission's NEW vocab plus the vocab already
taught by earlier missions — never untaught words. After generating, the script
lints the output against that budget and refuses to write if it drifts (unless
--force), so you always ship content the learner can actually handle.

Usage:
    # From inside the backend container (needs GEMINI_KEY or CLAUDE_API_KEY):
    python scripts/generate_mission.py --scenario "At the pharmacy" --level B1
    python scripts/generate_mission.py --scenario "At the market" --level A2 --id m005-market

    # Lint an already-generated mission offline (no LLM, no keys needed):
    python scripts/generate_mission.py --check m004-doctor

Writes:
    backend/content/missions/<id>.json          (seeded by `make seed`)
    frontend/src/content/generated-missions.json (merged; overlay + lesson decks)

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


def cmd_generate(scenario: str, level: str, mission_id: str | None, force: bool) -> int:
    order = mission_gen.next_order_index()
    mission_id = mission_id or _slug(scenario, order)
    print(f"Generating {mission_id} — \"{scenario}\" ({level})…", file=sys.stderr)

    result = mission_gen.generate_mission(scenario, level, mission_id)
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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scenario", help="Real-world scene, e.g. 'At the pharmacy'")
    ap.add_argument("--level", default="A2", help="CEFR level (A1/A2/B1/B2)")
    ap.add_argument("--id", dest="mission_id", help="Mission slug (default: derived)")
    ap.add_argument("--force", action="store_true", help="Write even if vocab lint fails")
    ap.add_argument("--check", metavar="MISSION_ID", help="Lint an existing mission offline and exit")
    args = ap.parse_args()

    if args.check:
        return cmd_check(args.check)
    if not args.scenario:
        ap.error("--scenario is required (or use --check <id>)")
    return cmd_generate(args.scenario, args.level, args.mission_id, args.force)


if __name__ == "__main__":
    raise SystemExit(main())
