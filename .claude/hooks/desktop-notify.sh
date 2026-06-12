#!/usr/bin/env bash
# Stop: Send a macOS desktop notification when Claude finishes a turn.
# Never blocks — always exits 0.
set -uo pipefail
trap 'exit 0' ERR

INPUT=$(cat)
echo "$INPUT"

# Extract a short summary from the stop event if available
SUMMARY=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    msg = d.get('stop_reason', '') or d.get('message', '') or 'Task complete'
    print(str(msg)[:80])
except Exception:
    print('Claude finished')
" 2>/dev/null || echo "Claude finished")

# macOS notification via osascript
if command -v osascript &>/dev/null; then
  osascript -e "display notification \"${SUMMARY}\" with title \"Claude Code\" sound name \"Submarine\"" 2>/dev/null || true
fi

exit 0
