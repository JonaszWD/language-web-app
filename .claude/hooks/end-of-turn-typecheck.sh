#!/usr/bin/env bash
# Stop: Run Python type checker (mypy preferred, pyright fallback) on modified files.
# Skips if no Python files were touched. Exits 0 on pass, 2 on errors.
set -uo pipefail
trap 'exit 0' ERR

INPUT=$(cat)
echo "$INPUT"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Only run if there are Python files in the project
PY_FILES=$(find "$PROJECT_DIR" -name "*.py" -not -path "*/.git/*" -not -path "*/venv/*" -not -path "*/__pycache__/*" 2>/dev/null | head -1)
if [ -z "$PY_FILES" ]; then
  exit 0
fi

# Prefer mypy, fall back to pyright, skip if neither available
if command -v mypy &>/dev/null; then
  CHECKER="mypy"
elif command -v pyright &>/dev/null; then
  CHECKER="pyright"
else
  exit 0
fi

# Run from project root, suppress cache noise
cd "$PROJECT_DIR" 2>/dev/null || exit 0

if [ "$CHECKER" = "mypy" ]; then
  OUTPUT=$(mypy . --ignore-missing-imports --no-error-summary 2>&1 || true)
else
  OUTPUT=$(pyright --outputjson 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    errs = d.get('generalDiagnostics', [])
    for e in errs[:10]:
        print(f\"{e.get('file','')}:{e.get('range',{}).get('start',{}).get('line',0)}: {e.get('message','')}\")
except Exception:
    pass
" 2>/dev/null || true)
fi

ERROR_COUNT=$(echo "$OUTPUT" | grep -cE '^.*error:' 2>/dev/null || echo "0")

if [ "$ERROR_COUNT" -eq 0 ]; then
  exit 0
fi

echo "" >&2
echo "Type check (${CHECKER}): ${ERROR_COUNT} error(s) found" >&2

# Show up to 10 errors
echo "$OUTPUT" | grep -E 'error:' | head -10 >&2

REMAINING=$((ERROR_COUNT - 10))
if [ "$REMAINING" -gt 0 ]; then
  echo "... and ${REMAINING} more. Run \`${CHECKER} .\` to see all." >&2
fi

echo "" >&2
exit 2
