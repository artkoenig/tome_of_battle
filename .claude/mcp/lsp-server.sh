#!/bin/bash
# Starts the MCP <-> LSP bridge for this project: mcp-language-server drives
# typescript-language-server, which reads the TypeScript library from the
# project's own node_modules (package.json pins the version).
#
# Both prerequisites -- the bridge binary and node_modules/typescript -- are
# installed by .claude/hooks/session-start.sh, and Claude Code starts this
# server in parallel with that hook rather than after it. Giving up on the first
# look therefore loses the race on a cold container and leaves the whole session
# without code intelligence, so this waits for what the hook is still
# installing. The wait stays under Claude Code's 30s connection timeout: one
# that outlived it would report a timeout instead of the reason.
set -euo pipefail

workspace="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
deadline="${LSP_STARTUP_WAIT_SECONDS:-25}"
poll_seconds=0.5

bridge_path() {
  local found
  found="$(command -v mcp-language-server || true)"
  if [ -n "$found" ]; then
    printf '%s\n' "$found"
  else
    printf '%s\n' "${GOBIN:-${GOPATH:-$HOME/go}/bin}/mcp-language-server"
  fi
}

bridge_ready() {
  [ -x "$(bridge_path)" ]
}

# `npm ci` empties node_modules/.package-lock.json before it unpacks, so a
# tsserver.js seen while the install is still running does not count as ready.
# A tree installed by something other than npm has no such file to wait for,
# which is what the package-lock.json test distinguishes.
typescript_ready() {
  [ -f "$workspace/node_modules/typescript/lib/tsserver.js" ] || return 1
  [ -f "$workspace/package-lock.json" ] || return 0
  [ -e "$workspace/node_modules/.package-lock.json" ]
}

# $SECONDS counts from the start of this script, so both waits share one budget.
wait_for() {
  local what="$1" ready="$2"

  "$ready" && return 0
  echo "lsp-server: $what is not there yet, waiting up to $(( deadline - SECONDS ))s for it" >&2
  while [ "$SECONDS" -lt "$deadline" ]; do
    sleep "$poll_seconds"
    "$ready" && {
      echo "lsp-server: $what appeared after ${SECONDS}s" >&2
      return 0
    }
  done
  return 1
}

if ! wait_for "the mcp-language-server binary" bridge_ready; then
  echo "mcp-language-server not found. Install it with:" >&2
  echo "  go install github.com/isaacphi/mcp-language-server@v0.1.1" >&2
  exit 127
fi

# Not fatal on its own: typescript-language-server can be pointed at a
# TypeScript installation elsewhere, so this names the likely cause and still
# hands over to the bridge, whose own error says what it looked for.
if ! wait_for "node_modules/typescript" typescript_ready; then
  echo "lsp-server: $workspace/node_modules/typescript is still missing." >&2
  echo "  Run \`npm ci\` -- without it the language server refuses to initialize." >&2
fi

exec "$(bridge_path)" \
  -workspace "$workspace" \
  -lsp typescript-language-server \
  -- --stdio
