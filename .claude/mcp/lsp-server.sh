#!/bin/bash
# Starts the MCP <-> LSP bridge for this project: mcp-language-server drives
# typescript-language-server, which reads the TypeScript library from the
# project's own node_modules (package.json pins the version).
#
# node_modules/typescript has to exist -- without it the language server refuses
# to initialize and this MCP server exits. In remote containers the session-start
# hook installs it; locally, run `npm ci` first.
set -euo pipefail

workspace="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

bridge="$(command -v mcp-language-server || true)"
if [ -z "$bridge" ]; then
  bridge="${GOBIN:-${GOPATH:-$HOME/go}/bin}/mcp-language-server"
fi
if [ ! -x "$bridge" ]; then
  echo "mcp-language-server not found. Install it with:" >&2
  echo "  go install github.com/isaacphi/mcp-language-server@v0.1.1" >&2
  exit 127
fi

exec "$bridge" \
  -workspace "$workspace" \
  -lsp typescript-language-server \
  -- --stdio
