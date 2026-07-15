#!/usr/bin/env bash
set -euo pipefail

PIDS=$(pgrep -f 'node.*tools/rules-editor/server\.js' || true)

if [ -z "$PIDS" ]; then
  echo "  ✅ No editor instances running."
  exit 0
fi

echo "  🛑 Stopping editor instances (PID(s): $(echo "$PIDS" | tr '\n' ' '))..."
kill $PIDS 2>/dev/null

# Wait briefly and confirm
sleep 1
REMAINING=$(pgrep -f 'node.*tools/rules-editor/server\.js' || true)
if [ -n "$REMAINING" ]; then
  echo "  ⚠️  Force killing remaining instance(s)..."
  kill -9 $REMAINING 2>/dev/null
fi

echo "  ✅ All editor instances stopped."
