#!/usr/bin/env bash
# PostCompact: Surface the last checkpoint so the agent re-orients after compaction.
# Always exits 0.
set -uo pipefail
trap 'exit 0' ERR

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LEARNINGS="${PROJECT_DIR}/.claude/session-learnings.md"

if [ ! -f "$LEARNINGS" ]; then
  exit 0
fi

# Extract the most recent checkpoint block
LAST=$(awk '/^## Compact Checkpoint/{found=1; buf=""} found{buf=buf"\n"$0} END{print buf}' "$LEARNINGS" 2>/dev/null || true)

if [ -n "$LAST" ]; then
  echo "PostCompact: Context was compacted. Last checkpoint:" >&2
  echo "$LAST" >&2
  echo "" >&2
  echo "Re-read .claude/tasks.md and .claude/session-notes.md to restore context." >&2
fi

exit 0
