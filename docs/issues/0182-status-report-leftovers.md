---
status: backlog
branch:
pr:
---

# Clean up what the status report left behind

## Goal

Three things around the status report are wrong in a way that only shows on a bad day, which is
why none of them blocked the switch to cast.

The report is generated fresh on every push and published, never committed — the docs area note
says so outright. A generated copy from before the switch nevertheless sits in the tree. While the
build succeeds the fresh report overwrites it and nobody notices; the day the generating step
fails, Jekyll serves the stale page as though it were current, still naming the tool that is gone.

The generator computes a module graph and the caller never takes it, so every report run pays a
graph scan for a value nobody reads. This predates the switch — the previous tool's output was
discarded the same way — and it is dead weight either way.

The gate runner decides whether a tool aborted before it checked anything or actually reported
findings. Its missing-executable signature matches any output containing that wording anywhere,
not just a shell's own line, so a gate that genuinely found something and happens to say it about
a path is shown as "not checked". That is the worst failure a status page has: a red gate rendered
as an absent one.

## Acceptance criteria

- AC1: No generated status page is checked in, and the tree is set up so none can return by accident. | verify: `bash -c '! test -e docs/status/index.html && grep -q "docs/status" .gitignore'`
- AC2: The generator no longer builds a module graph nobody reads, and no longer pays a graph scan per report run; the report's own tests pass. | verify: `bash -c '! grep -q importGraph scripts/project-state/generate.js && forge-test --run scripts/project-state'`
- AC3: The missing-executable signature matches only a shell reporting a command it could not find, so a gate whose findings mention a path that was not found is still classified as having findings. | verify: `node --input-type=module -e 'const { classifyGate, GateStatus } = await import("./scripts/project-state/gates.js"); const r = classifyGate({ exitCode: 1, output: "src/domain/roster/index.js: not found in the report" }); if (r.status !== GateStatus.Findings) { console.error("misread as " + r.status); process.exit(1); }'`
- AC4: A missing tool is still recognised as an environment abort, in both the shell wordings the report meets. | verify: `forge-test --run scripts/project-state/gates.test.js`

## Out of scope

- Showing the module graph on the page. Naming the dependency cycles the graph knows about would be a feature of its own; this issue only stops computing what nobody takes.
- The structure gate's own coverage in the report workflow, which issue 0181 carries.
- A version bump: nothing a user of the app can see changes.
