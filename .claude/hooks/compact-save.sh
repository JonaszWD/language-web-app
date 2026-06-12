#!/usr/bin/env bash
# PreCompact: Write a checkpoint to session-learnings.md before context compaction.
# Always exits 0 — must never prevent compaction.
set -uo pipefail
trap 'exit 0' ERR

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LEARNINGS="${PROJECT_DIR}/.claude/session-learnings.md"

mkdir -p "$(dirname "$LEARNINGS")" 2>/dev/null || true

# Find in-progress tasks from tasks.md
ACTIVE_TASKS=""
TASKS_FILE="${PROJECT_DIR}/.claude/tasks.md"
if [ -f "$TASKS_FILE" ]; then
  ACTIVE_TASKS=$(grep '^\- \[~\]' "$TASKS_FILE" 2>/dev/null | sed 's/^- \[~\] /  - /' | head -10 || true)
fi

{
  echo ""
  echo "## Compact Checkpoint — ${TIMESTAMP}"
  echo ""
  echo "- **CWD:** ${PROJECT_DIR}"
  if [ -n "$ACTIVE_TASKS" ]; then
    echo "- **In-progress tasks:**"
    echo "$ACTIVE_TASKS"
  fi
  echo "- **Action:** Re-read \`.claude/tasks.md\` and \`.claude/session-notes.md\` after compaction. Resume from last completed phase."
  echo ""
} >> "$LEARNINGS" 2>/dev/null || true

echo "PreCompact: checkpoint saved to ${LEARNINGS}" >&2
exit 0
