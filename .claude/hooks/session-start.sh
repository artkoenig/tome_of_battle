#!/bin/bash
set -euo pipefail

# Only needed in ephemeral Claude Code on the web containers; local checkouts
# already manage their own submodules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

git -C "$CLAUDE_PROJECT_DIR" submodule update --init --recursive

# The MCP <-> LSP bridge (see .mcp.json) is a Go binary that is not part of the
# image. Install it once per container; a failure here is not fatal, the MCP
# server then reports the missing binary itself.
if ! command -v mcp-language-server >/dev/null 2>&1 \
  && [ ! -x "${GOBIN:-${GOPATH:-$HOME/go}/bin}/mcp-language-server" ] \
  && command -v go >/dev/null 2>&1; then
  go install github.com/isaacphi/mcp-language-server@v0.1.1 \
    || echo "session-start: could not install mcp-language-server" >&2
fi
