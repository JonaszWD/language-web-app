#!/usr/bin/env bash
# PostToolUse/Write|Edit|MultiEdit: Scan written files for accidental secret exposure.
# Fails open on internal errors so it never blocks legitimate edits.
# Never logs secret values — only line numbers and pattern names.
set -uo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inp = d.get('tool_input', {})
print(inp.get('file_path', inp.get('path', '')))
" 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Skip test files, example env files, docs, vendor dirs
case "$FILE_PATH" in
  *test*|*spec*|*.example|*vendor*|*node_modules*|*.md|*.txt|*.rst)
    exit 0 ;;
esac

# Skip gitignored files
if git check-ignore -q "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

ALERT_LOG="${HOME}/.claude/state/secret-alerts.log"
mkdir -p "$(dirname "$ALERT_LOG")" 2>/dev/null || true

FOUND=0

check_pattern() {
  local name="$1"
  local pattern="$2"
  local matches
  matches=$(grep -nE "$pattern" "$FILE_PATH" 2>/dev/null | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')
  if [ -n "$matches" ]; then
    echo "SECRET DETECTED [$name] in ${FILE_PATH} at line(s): ${matches}" >&2
    echo "$(date -Iseconds) [$name] ${FILE_PATH}:${matches}" >> "$ALERT_LOG" 2>/dev/null || true
    FOUND=1
  fi
}

check_pattern "anthropic-api-key"  'sk-ant-[a-zA-Z0-9_\-]{20,}'
check_pattern "openai-api-key"     'sk-[a-zA-Z0-9]{32,}'
check_pattern "aws-access-key"     'AKIA[0-9A-Z]{16}'
check_pattern "github-pat"         'ghp_[a-zA-Z0-9]{36}'
check_pattern "slack-token"        'xox[baprs]-[a-zA-Z0-9\-]+'
check_pattern "pem-private-key"    '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
check_pattern "generic-api-key"    '(api_key|API_KEY|apikey)\s*[=:]\s*["\x27][a-zA-Z0-9_\-]{16,}'

if [ "$FOUND" -eq 1 ]; then
  echo "" >&2
  echo "BLOCKED: Potential secret(s) found in ${FILE_PATH}. Remove before proceeding." >&2
  echo "Check ${ALERT_LOG} for details (values are never stored)." >&2
  exit 2
fi

exit 0
