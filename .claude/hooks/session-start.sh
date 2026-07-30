#!/bin/bash
set -euo pipefail

# Only needed in ephemeral Claude Code on the web containers; local checkouts
# already manage their own submodules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

git -C "$CLAUDE_PROJECT_DIR" submodule update --init --recursive
