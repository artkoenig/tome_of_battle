#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
PORT="${PORT:-3001}"

# Open browser after a short delay (macOS)
if [[ "$(uname)" == "Darwin" ]]; then
  (sleep 1 && open "http://localhost:$PORT") &
fi

echo "  🛠  Starting Rules URL Editor on http://localhost:$PORT ..."
echo "     Press Ctrl+C to stop."
node tools/rules-editor/server.js
