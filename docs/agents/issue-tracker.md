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

## Version bump after merging a feature/fix main-issue
Before a main-issue of `Type: feature` or `Type: fix` is merged, propose a
version bump — never for `refactor`/`chore`, which have no user-facing
release reason:

1. Read the current version from `package.json` on the `issue/<slug>` branch.
2. Suggest the next version: patch bump for `fix`, minor bump for `feature`
   (`node scripts/release.js patch` / `minor` computes this).
3. Ask the user to confirm the suggestion, supply their own version, or leave
   the version unchanged.
4. If confirmed: run `node scripts/release.js <patch|minor|X.Y.Z>` to update
   `package.json`, then commit it on the `issue/<slug>` branch, before
   pushing and opening (or updating) the PR. The squash-merge then carries the
   version bump into `main` together with the rest of the change, in the same
   commit — no separate commit or push to `main` is ever needed for this.

After the PR is merged, tag the resulting `main` commit `v<version>` and push
**only the tag** (`git push origin v<version>`) — never the `main` branch
itself. `git push` to `refs/heads/main` is always rejected by the pre-push
hook (only a GitHub PR merge may advance `main`); a tag push targets
`refs/tags/v<version>` instead, which that check does not apply to, so no
`--no-verify` is ever needed. Do this only after pulling the merged commit
locally, so the tag points at a commit that is actually part of `main`'s
history.

## Do not hand-edit
Manage issues through the `issue-tracker` skill's `tracker.py` so that the state
machine and blocker rules are respected.
