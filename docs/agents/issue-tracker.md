# Issue tracker: local markdown

Work for this repository is tracked as a recursive tree of markdown issues.

## Layout
- Root: `docs/issues/`
- Each issue is a directory `NN-<slug>/` containing an `issue.md`.
- Child issues are subdirectories of their parent. A "feature" is just an issue
  with children; its `issue.md` holds the specification (PRD).
- An issue is addressed by its path relative to `docs/issues/`,
  e.g. `01-checkout/02-cart-api`.

## States (enforced transitions)
- `needs-triage` — awaiting evaluation by the maintainer
- `needs-info` — waiting for feedback
- `ready-for-agent` — fully specified, ready for autonomous implementation (AFK)
- `claimed` — in progress by the agent
- `resolved` — implemented and done

Allowed transitions:
- `needs-triage` -> `needs-info`, `ready-for-agent`
- `needs-info` -> `ready-for-agent`, `needs-triage`
- `ready-for-agent` -> `claimed`, `needs-info`
- `claimed` -> `resolved`, `ready-for-agent`
- `resolved` -> `ready-for-agent` (reopen)

A parent issue cannot become `resolved` while any child is still open.

## Implementing an issue
Work issues one at a time. For each:
1. Pick the next actionable issue with `tracker.py next` (add `--parent <id>` to
   focus on one feature). It returns the next `ready-for-agent` leaf whose
   blockers are all `resolved`. If nothing is returned, there is no ready work.
2. Claim it: `tracker.py set-status <id> claimed`, and read it with
   `tracker.py show <id>`.
3. Implement **only** what that issue specifies — do not anticipate other issues.
   Work in small increments on a branch (e.g. `issue/<slug>`), following this
   project's engineering principles (meaningful names, single responsibility,
   comprehensive tests).
4. Run the test suite; verify all tests pass and the acceptance criteria are met.
5. Resolve it: append a short solution summary with
   `tracker.py comment <id> "..."`, then `tracker.py set-status <id> resolved`.

Repeat until `next` reports no ready issues.

## Merging a main-issue's PR into main
Once every child-issue of a main-issue is resolved and its PR is ready to
merge, use **Squash-Merge** (per ADR 0009), never a regular merge commit. Set
the squash commit's subject to `<prefix>: <short English summary>`, where
`<prefix>` is derived from the main-issue's `Type:`:

| `Type`     | Prefix       |
|------------|--------------|
| `feature`  | `feat:`      |
| `fix`      | `fix:`       |
| `refactor` | `refactor:`  |
| `chore`    | `chore:`     |

Only `feat:`/`fix:` subjects surface in the app's release notes (see
`vite.config.js`'s commit filter); `refactor:`/`chore:` are still prefixed for
consistency but intentionally excluded there.

## Do not hand-edit
Manage issues through the `issue-tracker` skill's `tracker.py` so that the state
machine and blocker rules are respected.
