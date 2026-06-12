#!/usr/bin/env bash
# Stop: Anti-premature completion gate.
# Blocks the session from ending if incomplete tasks exist in tasks.md
# without a corresponding completion evidence marker.
# Gates only when a session has actually done work — fast path for Q&A.
set -uo pipefail
trap 'exit 0' ERR

INPUT=$(cat)

# Pass the input through (Stop hooks must echo input to stdout)
echo "$INPUT"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="${HOME}/.claude/state"

# Derive session ID from input if available
SESSION_ID=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('session_id', 'unknown'))
except Exception:
    print('unknown')
" 2>/dev/null || echo "unknown")

if [ "$SESSION_ID" = "unknown" ]; then
  exit 0
fi

TASKS_FILE="${PROJECT_DIR}/.claude/tasks.md"
if [ ! -f "$TASKS_FILE" ]; then
  exit 0
fi

# Count in-progress tasks
IN_PROGRESS_COUNT=$(grep -c '^\- \[~\]' "$TASKS_FILE" 2>/dev/null || echo "0")

if [ "$IN_PROGRESS_COUNT" -eq 0 ]; then
  exit 0
fi

# Check for evidence marker (written manually or by /plan after execution)
EVIDENCE="${STATE_DIR}/.claude-completion-evidence-${SESSION_ID}"
if [ -f "$EVIDENCE" ]; then
  exit 0
fi

# Check throttle marker — warn once per session per in-progress set
WARNED="${STATE_DIR}/.claude-verify-warned-${SESSION_ID}"
if [ -f "$WARNED" ]; then
  exit 0
fi

mkdir -p "$STATE_DIR" 2>/dev/null || true
: > "$WARNED"

{
  echo ""
  echo "WARNING: ${IN_PROGRESS_COUNT} task(s) still marked [~] in .claude/tasks.md."
  echo "If these are genuinely complete, update their status to [x] before finishing."
  echo ""
  echo "If you have verified completion, write evidence to:"
  echo "  ${EVIDENCE}"
  echo "  (e.g.: echo 'verified: true' > ${EVIDENCE})"
} >&2

# Exit 1 = warn (not hard block) — user can continue
exit 1
