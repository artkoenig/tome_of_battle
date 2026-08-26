# lsp

Code intelligence comes from an MCP server, not from Claude Code's built-in LSP tool: that
tool stays inactive in remote sessions, where the runtime defers the language server manager
and never starts it. `.mcp.json` therefore registers `lsp`, a bridge
([isaacphi/mcp-language-server](https://github.com/isaacphi/mcp-language-server) v0.1.1) that
drives `typescript-language-server` over stdio and offers its answers as MCP tools.

## Tools

- `definition`, `references`, `rename_symbol` take a bare `symbolName`.
- `hover` takes `filePath`, `line`, `column` (1-based) and returns the signature the JSDoc
  annotations produce, plus the doc comment.
- `diagnostics` takes a `filePath` and reports what the language server sees in that file --
  narrower and faster than `forge-typecheck`, which is still what the gate runs.
- `edit_file` is denied in `.claude/settings.json`: edits go through Edit, so they stay visible.

## Two conditions, both silent when unmet

- **Absolute paths only.** The bridge turns a `filePath` into a URI by prefixing `file://`
  without resolving it against the workspace, so a relative path opens
  `file://src/...` -- a URI whose host is `src`. The language server then answers about a file
  that does not exist, and `definition` reports the symbol as not found instead of failing.
- **`node_modules` first.** `typescript-language-server` resolves the TypeScript library from
  `node_modules/typescript`, the version `package.json` pins. Without it the server refuses to
  initialize and the MCP server exits at startup -- the tools are then simply absent, with no
  error in the session. A checkout that has never been installed therefore has no code
  intelligence; `npm ci` is what buys it.

## Installation

`.claude/hooks/session-start.sh` installs the project's npm dependencies and the bridge in remote
containers, each only where it is missing, so a warm container pays for neither. Locally:
`go install github.com/isaacphi/mcp-language-server@v0.1.1`. The language server itself is
`npm install -g typescript-language-server`.

Claude Code starts the MCP servers in parallel with that hook, not after it, so on a cold
container the bridge is asked to start while `npm ci` and `go install` are still running. Giving
up on the first look loses that race for the whole session, which is why
`.claude/mcp/lsp-server.sh` waits for both prerequisites -- the binary, and a `node_modules` whose
install has finished -- before it hands over. The wait is bounded at 25 seconds
(`LSP_STARTUP_WAIT_SECONDS`), under Claude Code's 30-second connection timeout, so an install that
outruns it still reports its own reason rather than a timeout. What each attempt did is in
`~/.cache/claude-cli-nodejs/<workspace>/mcp-logs-lsp/`; the session itself stays silent.

The same hook writes `lsp` into `enabledMcpjsonServers` in `~/.claude/settings.json`, because a
server declared in `.mcp.json` waits for an approval Claude Code only reads from settings outside
the repository -- and in a container nobody trusts the workspace by hand. That means content from
this repository approves its own MCP server, which is a decision for this repository and not a
pattern to copy: a contribution that touches the hook or `.mcp.json` no longer gets asked about.
Locally the hook exits before this point, so the trust dialog still decides.
