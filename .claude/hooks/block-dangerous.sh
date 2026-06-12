#!/usr/bin/env bash
# PreToolUse/Bash: Hard-block catastrophic commands; soft-block reversible-but-risky ones.
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
  exit 0
fi

# ── HARD BLOCKS (exit 2 = deny with no override) ──────────────────────────────

hard_block() {
  local reason="$1"
  echo "{\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"HARD_BLOCK: ${reason}\"}" >&2
  exit 2
}

# Root / home filesystem destruction
if echo "$COMMAND" | grep -qE 'rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+(\/\*?|~|\$HOME)\b'; then
  hard_block "rm -rf targeting root or home is forbidden"
fi

# System directories
if echo "$COMMAND" | grep -qE 'rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+\/(etc|usr|var|bin|sbin|lib|boot)'; then
  hard_block "rm -rf targeting system directory"
fi

# chmod 777 on system paths
if echo "$COMMAND" | grep -qE 'chmod\s+-R\s+777\s+\/(etc|usr|var|bin|home)'; then
  hard_block "chmod -R 777 on system path"
fi

# Raw disk writes
if echo "$COMMAND" | grep -qE '\bdd\b.*of=\/dev\/'; then
  hard_block "dd to block device"
fi

# Fork bomb
if echo "$COMMAND" | grep -qE ':\(\)\{.*:\|:&\}|:\(\)\s*\{.*\}'; then
  hard_block "fork bomb pattern detected"
fi

# ── SOFT BLOCKS (exit 1 = warn; Claude will surface to user) ──────────────────

soft_block() {
  local reason="$1"
  echo "WARNING: ${reason}. Confirm with the user before proceeding." >&2
  exit 1
}

# Force push
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*(-f\b|--force\b)'; then
  soft_block "git force push detected"
fi

# Pushing directly to main/master
if echo "$COMMAND" | grep -qE 'git\s+push\s+(origin\s+)?(main|master)\b'; then
  soft_block "pushing directly to main/master"
fi

# git reset --hard
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  soft_block "git reset --hard will discard uncommitted changes"
fi

# git clean -f
if echo "$COMMAND" | grep -qE 'git\s+clean\s+-[a-zA-Z]*f'; then
  soft_block "git clean -f will permanently delete untracked files"
fi

# Force branch delete
if echo "$COMMAND" | grep -qE 'git\s+branch\s+-D\b'; then
  soft_block "git branch -D permanently deletes a branch"
fi

exit 0
