# lsp

Code intelligence comes from an MCP server, not from Claude Code's built-in LSP tool: that
tool stays inactive in remote sessions, where the runtime defers the language server manager
and never starts it. `.mcp.json` therefore registers `lsp`, a bridge
([isaacphi/mcp-language-server](https://github.com/isaacphi/mcp-language-server) v0.1.1) that
drives `typescript-language-server` over stdio and offers its answers as MCP tools.

## Tools

- `definition` and `references` take a bare `symbolName`. `rename_symbol` does **not**: it takes
  `filePath`, `line`, `column` and `newName` like `hover`, and it writes the files itself -- one
  call renamed three occurrences across two files in a throwaway project, with no Edit in the
  transcript.
- `hover` takes `filePath`, `line`, `column` (1-based) and returns the signature the JSDoc
  annotations produce, plus the doc comment.
- `diagnostics` takes a `filePath` and reports what the language server sees in that file --
  narrower and faster than `forge-typecheck`, which is still what the gate runs. It also reports
  `HINT`s the gate never fails on (`implicitly has an 'any' type`, code 7044, is the common one),
  so a green `forge-typecheck` and a talkative `diagnostics` do not contradict each other.
- `references` lists **call sites only**: the bridge asks with `includeDeclaration: false`, so the
  declaration itself never appears in its own reference list. `definition` is the other half.
- A symbol name matches **exactly and case-sensitively** -- `raiseunit` and `raise` find nothing
  where `raiseUnit` finds five sites. A qualified `A.b` matches a symbol called `A.b` *or* `b`,
  which in practice means the qualified form is useless here: `SlotIndex.fromMaps` finds nothing,
  bare `fromMaps` returns the whole class.
- A JSDoc `@typedef` is **not** a workspace symbol. `Roster` and `Selection` come back "not found"
  although `src/shared/rostermodel/types.js` declares them, so the project's type vocabulary is
  invisible to both symbol tools -- grep stays the tool for it.
- `LSP_CONTEXT_LINES` (default 5) sets how many source lines each hit carries.
- `edit_file` is denied in `.claude/settings.json`: edits go through Edit, so they stay visible.
  `rename_symbol` writes just as invisibly and is **not** denied.

## The first call decides the session

None of this is in the bridge's README; it was measured against this checkout (bridge v0.1.1,
TypeScript 6.0.2) and the numbers are what a repeat should reproduce.

- **The symbol tools are dead until some file is open.** At startup the bridge opens the
  workspace's `.ts`/`.tsx` files -- and this project has none, so its log says
  `Opened 0 TypeScript files`, tsserver holds no project at all, and a first `definition` or
  `references` fails outright: `No Project`. Patience does not help, it still fails ten seconds
  later. `hover` and `diagnostics` open their file themselves, and that is what creates the
  project.
- **Then give it about four seconds.** A symbol query fired straight after that first open answers
  `not found` / `No references found` -- an empty answer, not an error, which is the shape that
  misleads. Measured on `raiseUnit`: empty at t+0, t+1 and t+2 seconds, complete at t+4 (five call
  sites in four files).
- **Once the project stands, all of `tsconfig.json` is indexed**, not just what was opened: a
  symbol in a file no tool ever touched is found.
- **Absolute paths -- and what a relative one costs is the project, not the answer.** `hover` on
  `src/contexts/armylist/application/raiseUnit.js` returns the correct signature (from any working
  directory), but no project attaches, and every symbol query stays empty for the rest of that
  server's life. Re-opening the *same* file with its absolute path does not repair it; opening
  *another* file absolutely does.

The reliable opening move is therefore one `diagnostics` (or `hover`) with an **absolute** path on
some file in the area about to be asked about, and only then `definition`/`references`.

**An empty answer from the two symbol tools is not evidence of absence.** The same race can be lost
later in a session: `definition withRaisedUnits` came back "not found" once while a `hover` opened
another file, and answered correctly a moment later on its own — a repeat of that pairing did not
reproduce it, so the timing is what it is. Ask a second time before believing a "not found";
`hover` and `diagnostics` were stable in every run.

**`node_modules` first**, before any of it: `typescript-language-server` resolves the TypeScript
library from `node_modules/typescript`, the version `package.json` pins. Without it the server
refuses to initialize and the MCP server exits at startup -- the tools are then simply absent, with
no error in the session. A checkout that has never been installed has no code intelligence;
`npm ci` is what buys it.

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
