#!/usr/bin/env bash
# Claude Code WorktreeCreate hook: redirect Claude Code's native worktree paths
# (EnterWorktree, --worktree, isolation: "worktree", background sessions) into
# this repo's .worktrees/<name> convention instead of the default
# .claude/worktrees/, per AGENTS.md's "Worktree Isolation" rule.
#
# Without this hook a native worktree lands in .claude/worktrees/, sidestepping
# the .worktrees/ convention and its .gitignore entry. The hook replaces the
# default git behavior entirely — which also means the base ref is this hook's
# own choice: `worktree.baseRef` is NOT passed in. It branches from HEAD (plain
# `git worktree add <path>`), matching the "head" semantics AGENTS.md requires.
#
# Installed as a project's .claude/hooks/worktree-create.sh, wired into
# .claude/settings.json's hooks.WorktreeCreate, by the cloud-session-bootstrap
# skill. Kept byte-identical to this asset (a deterministic self-test binds the
# two), so there is a single source of truth for the redirect logic rather than
# a bash blob duplicated inline in every settings.json.
#
# WorktreeCreate JSON contract (see https://code.claude.com/docs/en/hooks.md,
# "WorktreeCreate input"/"WorktreeCreate output"):
#   stdin:  {"name": ..., "session_id": ..., "cwd": ...} — `name` is the only
#           worktree-specific field; there is no base-ref field.
#   stdout: the created worktree's absolute path as the last non-empty line;
#           all other output must go to stderr.
#   exit:   any non-zero code aborts worktree creation (and with it the session
#           that requested it), so failures are loud by design. In particular a
#           `name` whose branch already exists fails the `git worktree add`
#           below rather than silently reusing that branch.
set -euo pipefail

# -e: fail loudly if `name` is missing/null instead of yielding the string
# "null" and creating a bogus worktree.
name=$(jq -er .name)

# Resolve the *main* checkout's root, not the current worktree's: invoked from
# inside a linked worktree, --show-toplevel would nest a new .worktrees/ under
# that worktree. --git-common-dir's parent is shared by every linked worktree,
# so every worktree stays registered flat against the one .git — the layout
# AGENTS.md's "Worktree Isolation" rule requires.
root=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
dir="$root/.worktrees/$name"

# No commit-ish argument: git branches the new worktree from HEAD. git's own
# stdout goes to stderr so the created path is the only thing on our stdout.
git worktree add "$dir" >&2
echo "$dir"
