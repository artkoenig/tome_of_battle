#!/usr/bin/env python3
"""Claude Code PreToolUse hook: keep non-trivial Edit/Write/NotebookEdit calls
out of the main checkout, per AGENTS.md's "Worktree Isolation" rule.

That rule was previously guidance only — text in AGENTS.md with no way to
verify a session actually followed it, unlike the branch-name/co-author rules
in ../../../scripts/git_workflow_rules.py, which leave an artifact trace in
the finished commit that a pre-push hook can check after the fact. Whether an
edit happened inside a worktree leaves no such trace, so this hook enforces it
at the point of the edit instead, by denying the tool call outright.

Two-role split, same as git_workflow_rules.py:
  1. Pure predicates (no git, no I/O) — unit-tested directly:
       - is_issue_tracker_path(rel_path, issue_tracker_dir)
       - evaluate_direct_edit(existing_files, incoming_file, issue_tracker_dir)
       - is_protected_branch(branch)
  2. A thin CLI that reads the hook's stdin JSON, gathers git state, and
     applies those predicates.

Installed as a project's `.claude/hooks/worktree_guard.py`, wired into
`.claude/settings.json`'s `hooks.PreToolUse`, by the `cloud-session-bootstrap`
skill. Deliberately self-contained (does not import
../../../scripts/git_workflow_rules.py): a copy-installed hook in a foreign
project has no access to this config repo's checkout, so TRIVIAL_EXTENSIONS is
duplicated from there and must be kept in sync by hand.

Escape hatches:
  - A bypass marker file `<main-repo-root>/.claude/.worktree-bypass` disables
    every check below, for a session the user has explicitly told to work
    directly in the checkout (mirrors this repo's `git push --no-verify`).
  - Only Edit/Write/NotebookEdit are checked. Bash-driven file writes (e.g.
    `cat > file`) are not inspected — this is a nudge for the common path, not
    a sandbox.
  - Files under the issue tracker's own directory (`docs/issues/` by default,
    or `$ISSUE_TRACKER_DIR`) are always exempt: `issue-tracker`'s decompose
    and merge workflows write several `issue.md` files directly in the main
    checkout by design (see skills/issue-tracker/workflows/decompose.md and
    implement.md) — that is bookkeeping, not the code-writing work this rule
    targets.

PreToolUse JSON contract (see https://code.claude.com/docs/en/hooks.md):
  stdin:  {"tool_name": ..., "tool_input": {"file_path": ...}, ...}
  stdout: {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                   "permissionDecision": "deny",
                                   "permissionDecisionReason": "..."}}
          (nothing printed, exit 0, means "allow" — defer to normal flow)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path, PurePosixPath

TRIVIAL_EXTENSIONS = frozenset({".md", ".json", ".yaml", ".yml", ".txt"})
PROTECTED_BRANCHES = frozenset({"main", "master"})
CHECKED_TOOLS = frozenset({"Edit", "Write", "NotebookEdit"})
DEFAULT_ISSUE_TRACKER_DIR = "docs/issues"
BYPASS_MARKER_RELPATH = Path(".claude") / ".worktree-bypass"


# --------------------------------------------------------------------------- #
# Pure predicates (no git, no I/O)                                            #
# --------------------------------------------------------------------------- #

def is_issue_tracker_path(rel_path: str, issue_tracker_dir: str) -> bool:
    """True if ``rel_path`` (repo-relative, forward slashes) lives under the
    issue tracker's own directory, exempt from worktree isolation."""
    prefix = issue_tracker_dir.strip("/") + "/"
    return rel_path.replace(os.sep, "/").startswith(prefix)


def is_protected_branch(branch: str | None) -> bool:
    """True if ``branch`` must never be edited on directly, trivial or not."""
    return branch in PROTECTED_BRANCHES


def evaluate_direct_edit(
    existing_files, incoming_file: str, issue_tracker_dir: str = DEFAULT_ISSUE_TRACKER_DIR
):
    """Decide whether ``incoming_file`` may be edited directly in the main
    checkout, given the repo-relative paths already dirty there.

    Approximates ``git_workflow_rules.is_trivial_change``: exactly one file,
    with a docs/config extension. Unlike that function this runs *before* the
    edit, so it cannot see the resulting diff size — the "large diff to a
    single non-doc file" case that function also treats as trivial is not
    recognized here; it is caught as non-trivial instead. That is a
    deliberately conservative approximation, not a bug: the bypass marker
    covers any resulting false positive.

    Returns (allowed: bool, reason: str | None).
    """
    if is_issue_tracker_path(incoming_file, issue_tracker_dir):
        return True, None

    relevant_existing = {
        f for f in existing_files if not is_issue_tracker_path(f, issue_tracker_dir)
    }
    combined = relevant_existing | {incoming_file}
    if len(combined) > 1:
        others = ", ".join(sorted(combined - {incoming_file}))
        return False, (
            f"'{incoming_file}' would not be the only dirty file in the main "
            f"checkout (also: {others}) — that is not a trivial change"
        )

    suffix = PurePosixPath(incoming_file).suffix.lower()
    if suffix in TRIVIAL_EXTENSIONS:
        return True, None
    return False, f"'{incoming_file}' is not a docs/config file, so this is not a trivial change"


# --------------------------------------------------------------------------- #
# Git plumbing (side-effecting, not unit-tested directly)                     #
# --------------------------------------------------------------------------- #

def _run_git(*args: str, cwd: Path) -> str | None:
    result = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True
    )
    return result.stdout.strip() if result.returncode == 0 else None


def _repo_root(cwd: Path) -> str | None:
    return _run_git("rev-parse", "--show-toplevel", cwd=cwd)


def _main_repo_root(cwd: Path) -> str | None:
    """The main checkout's root, whether ``cwd`` is that checkout or a linked
    worktree of it — both share one ``--git-common-dir``."""
    common_dir = _run_git(
        "rev-parse", "--path-format=absolute", "--git-common-dir", cwd=cwd
    )
    return str(Path(common_dir).parent) if common_dir else None


def _nearest_existing_dir(path: Path) -> Path:
    """Walk up from ``path`` to the nearest directory that exists on disk.

    A new file's parent directory may not exist yet (Write can create it), but
    git only needs *some* existing directory inside the repo to run in.
    """
    for candidate in (path, *path.parents):
        if candidate.is_dir():
            return candidate
    return path


def _current_branch(repo_root: str) -> str | None:
    return _run_git("symbolic-ref", "--short", "HEAD", cwd=Path(repo_root))


def _dirty_files(repo_root: str) -> set[str]:
    """Repo-relative paths with uncommitted changes (staged, unstaged, or
    untracked). Renames are reported under their new path."""
    out = _run_git(
        "status", "--porcelain", "--untracked-files=all", cwd=Path(repo_root)
    )
    if not out:
        return set()
    files = set()
    for line in out.splitlines():
        body = line[3:]  # 2-char status code + 1 space
        if " -> " in body:
            body = body.split(" -> ", 1)[1]
        files.add(body.strip().strip('"'))
    return files


# --------------------------------------------------------------------------- #
# CLI                                                                         #
# --------------------------------------------------------------------------- #

def _deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # malformed input is not this hook's problem to enforce

    if payload.get("tool_name") not in CHECKED_TOOLS:
        return 0

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not file_path:
        return 0

    target = Path(file_path)
    parent = _nearest_existing_dir(target.parent if str(target.parent) else Path("."))

    repo_root = _repo_root(parent)
    if repo_root is None:
        return 0  # not inside a git repo: not this hook's concern

    main_root = _main_repo_root(parent)
    if main_root is None:
        return 0

    if (Path(main_root) / BYPASS_MARKER_RELPATH).exists():
        return 0

    if repo_root != main_root:
        return 0  # already isolated in some linked worktree

    branch = _current_branch(main_root)
    if is_protected_branch(branch):
        _deny(
            f"Currently on protected branch '{branch}'. AGENTS.md never allows "
            "direct edits there, not even trivial ones — check out a work "
            "branch first (see AGENTS.md 'Git & Version Control')."
        )
        return 0

    try:
        incoming_rel = str(target.resolve().relative_to(Path(main_root).resolve()))
    except ValueError:
        return 0  # file is outside the repo entirely: not this hook's concern
    incoming_rel = incoming_rel.replace(os.sep, "/")

    issue_tracker_dir = os.environ.get("ISSUE_TRACKER_DIR", DEFAULT_ISSUE_TRACKER_DIR)
    existing = _dirty_files(main_root)
    allowed, reason = evaluate_direct_edit(existing, incoming_rel, issue_tracker_dir)
    if not allowed:
        _deny(
            f"Blocked by AGENTS.md's 'Worktree Isolation' rule: {reason}. Run "
            "`git worktree add .worktrees/<slug> <branch>` and redo this edit "
            "there. If working directly in this checkout was explicitly "
            f"approved for this task, create '{BYPASS_MARKER_RELPATH}' "
            "(any content) to skip this check."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
