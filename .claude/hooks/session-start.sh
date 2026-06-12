#!/usr/bin/env bash
# SessionStart: Load pending work, check disk, clean stale state markers.
# Always exits 0 — must never prevent session startup.
set -uo pipefail
trap 'exit 0' ERR

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATE_DIR="${HOME}/.claude/state"
mkdir -p "$STATE_DIR" 2>/dev/null || true

# ── Stale marker cleanup (older than 24h) ─────────────────────────────────────
find "$STATE_DIR" -name '.claude-*' -mtime +1 -delete 2>/dev/null || true

# ── Disk space warning ────────────────────────────────────────────────────────
AVAIL_KB=$(df -k "$PROJECT_DIR" 2>/dev/null | awk 'NR==2{print $4}' || echo "999999")
if [ "$AVAIL_KB" -lt 1048576 ] 2>/dev/null; then
  echo "WARNING: Less than 1 GB disk space available (${AVAIL_KB} KB). Consider cleaning up." >&2
fi

# ── Load pending tasks ────────────────────────────────────────────────────────
TASKS_FILE="${PROJECT_DIR}/.claude/tasks.md"
BANNER_LINES=()

if [ -f "$TASKS_FILE" ]; then
  IN_PROGRESS=$(grep '^\- \[~\]' "$TASKS_FILE" 2>/dev/null | sed 's/^- \[~\] //' | head -5 || true)
  TODO=$(grep '^\- \[ \]' "$TASKS_FILE" 2>/dev/null | sed 's/^- \[ \] //' | head -5 || true)

  if [ -n "$IN_PROGRESS" ]; then
    BANNER_LINES+=("IN PROGRESS:")
    while IFS= read -r line; do
      BANNER_LINES+=("  [~] $line")
    done <<< "$IN_PROGRESS"
  fi

  if [ -n "$TODO" ]; then
    BANNER_LINES+=("TODO:")
    while IFS= read -r line; do
      BANNER_LINES+=("  [ ] $line")
    done <<< "$TODO"
  fi
fi

# ── Check for last compact checkpoint ────────────────────────────────────────
LEARNINGS="${PROJECT_DIR}/.claude/session-learnings.md"
if [ -f "$LEARNINGS" ]; then
  LAST_CHECKPOINT=$(grep -c "^## Compact Checkpoint" "$LEARNINGS" 2>/dev/null || echo "0")
  if [ "$LAST_CHECKPOINT" -gt 0 ]; then
    BANNER_LINES+=("NOTE: ${LAST_CHECKPOINT} compact checkpoint(s) in .claude/session-learnings.md")
  fi
fi

# ── Print banner if anything to report ───────────────────────────────────────
if [ "${#BANNER_LINES[@]}" -gt 0 ]; then
  echo "" >&2
  echo "╔══════════════════════════════════════════════╗" >&2
  echo "║         SESSION START — PENDING WORK         ║" >&2
  echo "╚══════════════════════════════════════════════╝" >&2
  for line in "${BANNER_LINES[@]}"; do
    echo "  $line" >&2
  done
  echo "" >&2
fi

exit 0
