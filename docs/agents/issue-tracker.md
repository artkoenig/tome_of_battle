# Issue tracker: local markdown

Work for this repository is tracked as local markdown issues in two levels.

## Layout
- Root: `docs/issues/`.
- A top-level `NN-<slug>/` directory is a **main-issue**: it maps 1:1 to one
  branch `issue/<slug>`, one worktree and one pull request, and its `issue.md`
  holds the specification (PRD). It carries a `Type:`
  (feature|fix|refactor|chore) — the change category that used to be a
  branch-name prefix.
- The directories nested inside a main-issue are its **child-issues** — the
  vertically-sliced units that make up that one PR. A child-issue inherits its
  main-issue's type.
- Each issue is a directory `NN-<slug>/` with an `issue.md`, addressed by its
  path relative to `docs/issues/`, e.g. `01-checkout/02-cart-api`.

## States (enforced transitions)
- `needs-triage` — awaiting evaluation by the maintainer
- `needs-info` — waiting for feedback
- `ready-for-agent` — fully specified, ready for autonomous implementation (AFK)
- `claimed` — in progress by the agent
- `resolved` — implemented and done
- `superseded` — closed without being implemented: replaced by another issue,
  made obsolete, or a duplicate. Which of those it was is stated in the
  mandatory reason, not in the state name.

Allowed transitions:
- `needs-triage` -> `needs-info`, `ready-for-agent`, `superseded`
- `needs-info` -> `ready-for-agent`, `needs-triage`, `superseded`
- `ready-for-agent` -> `claimed`, `needs-info`, `superseded`
- `claimed` -> `resolved`, `ready-for-agent`, `superseded`
- `resolved` -> `ready-for-agent` (reopen)
- `superseded` -> `needs-triage` (reopen)

`superseded` is reachable from every open state — work in progress can become
obsolete too — but never from `resolved`: finished work is not undone after the
fact. The transition requires a reason and is rejected without one:

```bash
tracker.py set-status <id> superseded --reason "Subsumed by 03-cart-rewrite."
```

The reason is recorded as a comment on the issue.

`resolved` and `superseded` both count as **closed**. A main-issue cannot become
`resolved` while any child-issue is still open, so it is "done" — and its PR
ready to open — only once its whole subtree is closed; a `superseded`
child-issue does not hold it up. Likewise a `superseded` blocker releases the
issues it blocks — otherwise an issue that will never be implemented would block
its neighbours forever.

## Implementing a main-issue
Every child-issue is implemented on the main-issue's one branch `issue/<slug>`;
the pull request is opened only once every child-issue is closed (`resolved`, or
`superseded` for a slice that turned out not to be needed).

Work the child-issues one at a time. For each:
1. Pick the next actionable child with `tracker.py next --parent <main-id>`. It
   returns the next `ready-for-agent` child whose blockers are all closed.
   If nothing is returned, there is no ready work.
2. Claim it: `tracker.py set-status <id> claimed`, and read it with
   `tracker.py show <id>`.
3. Implement **only** what that child specifies — do not anticipate other
   children. Follow this project's engineering principles (meaningful names,
   single responsibility, comprehensive tests).
4. Run the test suite; verify all tests pass and the acceptance criteria are met.
5. Resolve it: append a short solution summary with
   `tracker.py comment <id> "..."`, then `tracker.py set-status <id> resolved`.

Repeat until `next` reports no ready child. Then resolve the main-issue and open
the PR.

## Implementing several child-issues at once
`tracker.py next --parent <main-id> --all` prints every actionable child-issue
instead of just the first. Blocked issues are excluded, so the printed set is
independent by construction and safe to implement in parallel — one agent per
child, each in its own git worktree, none of them claiming through the
dispatcher (a worktree branches from the main-issue branch and never sees the
dispatcher's uncommitted claim).

Merge the finished child branches back into the main-issue branch **sequentially
in dependency order**. Numeric prefix order is a valid dependency order: a child
can only be blocked by a sibling that already existed when it was created, so
every blocker has a lower prefix. Remove each child worktree after its merge
(`git worktree remove`); no child branch outlives its merge.

## Do not hand-edit
Manage issues through the `issue-tracker` skill's `tracker.py` so that the state
machine and blocker rules are respected.
