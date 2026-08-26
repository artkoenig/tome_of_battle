#!/bin/bash
set -euo pipefail

# Only needed in ephemeral Claude Code on the web containers; local checkouts
# already manage their own submodules and their own tooling.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

git -C "$CLAUDE_PROJECT_DIR" submodule update --init --recursive

# The typescript-lsp plugin enabled in .claude/settings.json ships no binary, and
# both the binary and the plugin cache live outside the checkout, so a fresh
# container has to supply them. Neither step may fail the session start.
if ! command -v typescript-language-server >/dev/null 2>&1; then
  npm install -g typescript-language-server typescript >/dev/null 2>&1 || true
fi

if ! claude plugin list 2>/dev/null | grep -q 'typescript-lsp@claude-plugins-official'; then
  claude plugin marketplace add anthropics/claude-plugins-official >/dev/null 2>&1 || true
  claude plugin install typescript-lsp@claude-plugins-official --scope user --yes >/dev/null 2>&1 || true
fi
