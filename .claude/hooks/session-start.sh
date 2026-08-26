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

# Approve this project's MCP servers for the container. Claude Code reads that
# approval from settings outside the repository, so .mcp.json on its own leaves
# the server at "pending approval" in a workspace nobody trusted by hand.
if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY' || echo "session-start: could not approve the lsp MCP server" >&2
import json
import pathlib

settings = pathlib.Path.home() / ".claude" / "settings.json"
settings.parent.mkdir(parents=True, exist_ok=True)
config = json.loads(settings.read_text()) if settings.exists() else {}
approved = config.setdefault("enabledMcpjsonServers", [])
if "lsp" not in approved:
    approved.append("lsp")
    settings.write_text(json.dumps(config, indent=2) + "\n")
PY
fi
