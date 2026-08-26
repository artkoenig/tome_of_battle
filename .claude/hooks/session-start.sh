#!/bin/bash
set -euo pipefail

# Only needed in ephemeral Claude Code on the web containers; local checkouts
# already manage their own submodules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

git -C "$CLAUDE_PROJECT_DIR" submodule update --init --recursive

# The container image carries no node_modules, and typescript-language-server
# resolves the TypeScript library from the workspace's own -- without it the lsp
# MCP server exits at startup (see .claude/rules/lsp.md), and every check wrapper
# fails until someone installs by hand. Install once per container; a failure
# here is not fatal, the missing modules report themselves loudly enough.
# PUPPETEER_SKIP_DOWNLOAD keeps the browser out of it, as the CI workflow does:
# the Puppeteer E2E is run by hand and fetches its Chromium then, with
# `npx puppeteer browsers install chrome`.
if [ ! -d "$CLAUDE_PROJECT_DIR/node_modules" ] && command -v npm >/dev/null 2>&1; then
  PUPPETEER_SKIP_DOWNLOAD=true npm --prefix "$CLAUDE_PROJECT_DIR" ci \
    || echo "session-start: npm ci failed, node_modules is missing" >&2
fi

# The MCP <-> LSP bridge (see .mcp.json) is a Go binary that is not part of the
# image. Install it once per container; a failure here is not fatal, the MCP
# server then reports the missing binary itself. Claude Code starts that server
# in parallel with this hook, so it waits for both installs above rather than
# giving up on the first look -- see .claude/rules/lsp.md.
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
