---
status: backlog
branch:
pr:
---

# Make the cast rules blocking and run them in CI

## Goal

The cast rule set landed at `severity: "warn"` so its findings could be counted first. The count is
in: over all seventeen forbidden entries the check finds exactly one site, and that site is a
measurement script reaching past the evaluator facade into a test fixture that happens to live
inside the evaluator directory. dependency-cruiser never saw it because it excluded the fixture
directory from its scan; cast has no such exclusion, and it is right not to — a production module
importing test scaffolding is worth knowing about. Move the scaffolding into the test tree, then
switch every rule to `error`. Nothing else in the tree changes, because every other rule finds
nothing.

The second half is CI. The switch to cast dropped the structural step from the workflow on the
premise that a Claude Code plugin cannot be installed on a runner. Only the first half of that is
true: cast is not on npm, but it is plain Node with no dependencies at all, living in a public
repository, so a shallow clone and `node` run it. Since the ADR-0037 layer rules have no mirror in
the oxlint config, CI currently checks none of them; the clone gives them back, in the lint
workflow and in the status report's structure gate alike.

## Acceptance criteria

- AC1: No test scaffolding module sits inside the evaluator directory any more; the tests and the measurement script reach the roster and report helpers from the test tree, and the evaluator's own tests pass. | verify: `bash -c '! ls src/domain/evaluator/__fixtures__/*.js >/dev/null 2>&1 && forge-test --run src/tests/domain/evaluator'`
- AC2: Every forbidden entry of the cast rule set is `severity: "error"`, and no baseline file holds anything back. | verify: `node -e 'const fs=require("fs");if(fs.existsSync(".cast/baseline.json")){console.error("baseline present");process.exit(1)}const r=JSON.parse(fs.readFileSync(".cast/rules.json","utf8"));const w=(r.forbidden||[]).filter(x=>x.severity!=="error").map(x=>x.name);if(w.length){console.error("not error: "+w.join(","));process.exit(1)}'`
- AC3: With the rules blocking, the lint gate still passes — the structural check finds nothing at all. | verify: `forge-lint`
- AC4: The lint workflow runs the structural check, obtaining cast by a shallow clone of its public repository rather than through npm, and a violation fails the workflow. | verify: `bash -c 'grep -q ai-blacksmith .github/workflows/ci.yml'`
- AC5: The status report's structure gate runs in the workflow that builds the report, so the page shows a verdict instead of `not-run`. | verify: `bash -c 'grep -q ai-blacksmith .github/workflows/status-report.yml'`
- AC6: The ADR that records cast as the structural checker states that the rules block, describes how CI obtains cast, and carries an edge count that matches what the check reports. | verify: `bash -c 'grep -qi error docs/adr/0041-cast-als-strukturpruefer.md && ! grep -q 1234 docs/adr/0041-cast-als-strukturpruefer.md'`

## Out of scope

- The catalog data directory under the evaluator's fixtures. It is twelve megabytes of data reached by path strings from more than twenty test files, never by an import, so the structural check does not see it and moving it buys nothing here.
- Pinning the CI clone to a fixed revision. The workflow tracks the tool's current state deliberately.
- The `no-restricted-imports` mirror in the oxlint config. It stays as the second net that reports inside the editor, even where cast now covers the same boundaries.
- The module graph the status report computes and discards, and the widened environment-abort pattern in its gate runner. Both are their own issue.
- A version bump: nothing a user of the app can see changes.
