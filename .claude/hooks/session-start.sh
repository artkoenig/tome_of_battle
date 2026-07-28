#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Metis loader — the ONLY file installed per project, kept deliberately thin
# and stable: its single responsibility is keeping metis current. In a cloud
# session it clones or updates ~/.claude/metis and hands over to the sync
# logic INSIDE the clone (session-start-core.sh); in a local session it
# fast-forwards the user's own metis clone (found via the ~/.claude symlinks)
# and touches nothing else. Workflow changes therefore reach every
# bootstrapped project on its next session start, cloud and local alike,
# without anyone re-running the bootstrap skill there.
#
# Installed by the `bootstrap` skill in https://github.com/artkoenig/metis.
# Re-run that skill to update this file rather than hand-editing it.
# ---------------------------------------------------------------------------

# stdout is reserved for the final hook JSON; everything else goes to the log.
CLAUDE_HOME="${HOME}/.claude"
LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/session-start.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec 3>&1            # fd 3 = real stdout (hook JSON only)
exec 1>"$LOG_FILE" 2>&1
echo "=== Metis loader initialized: $(date) ==="

failure_handler() {
  echo "❌ CRASH on line $1 (Exit Code: $?)"
}
trap 'failure_handler ${LINENO}' ERR

# Local session: ~/.claude belongs to the user, so no symlink management —
# the only job is keeping the local metis clone current, since the symlinked
# skills/agents and CLAUDE.md are exactly as fresh as that clone. Without
# this, local sessions accumulate the same drift the loader/core split fixes
# for cloud sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "Local session: looking for the local metis clone..."
  clone=""
  for link in "$CLAUDE_HOME"/skills/* "$CLAUDE_HOME"/agents/*; do
    [ -L "$link" ] || continue
    target=$(readlink "$link") || continue
    case "$target" in /*) ;; *) continue ;; esac   # need an absolute target
    candidate="${target%/skills/*}"
    candidate="${candidate%/agents/*}"
    [ -d "${candidate}/.git" ] || continue
    url=$(git -C "$candidate" remote get-url origin 2>/dev/null || true)
    case "$url" in
      *artkoenig/metis*|*/metis|*/metis.git) clone="$candidate"; break ;;
    esac
  done
  if [ -z "$clone" ]; then
    echo "No local metis clone found via ~/.claude symlinks; nothing to update."
    exit 0
  fi
  if [ -n "$(git -C "$clone" status --porcelain)" ]; then
    echo "⚠️  Local clone at ${clone} has uncommitted changes; not touching it."
    exit 0
  fi
  before=$(git -C "$clone" rev-parse HEAD)
  if ! git -C "$clone" pull --quiet --ff-only; then
    echo "⚠️  Pull failed (diverged or offline); leaving the clone as it is."
    exit 0
  fi
  after=$(git -C "$clone" rev-parse HEAD)
  if [ "$before" = "$after" ]; then
    echo "Local clone already up to date."
  else
    echo "Updated local clone: ${before:0:7} -> ${after:0:7}"
    echo '{"hookSpecificOutput": {"hookEventName": "SessionStart", "reloadSkills": true}}' >&3
  fi
  exit 0
fi

repo_url="https://github.com/artkoenig/metis.git"
repo_dir="${CLAUDE_HOME}/metis"

# Clone, or update — and on a failed update, re-clone rather than silently
# serving a stale cache: a session that loads yesterday's workflow because a
# pull failed is exactly the drift this loader exists to prevent.
if [ -d "${repo_dir}/.git" ]; then
  echo "Updating metis repo..."
  git -C "$repo_dir" pull --quiet --ff-only || {
    echo "⚠️  Pull failed; re-cloning for a fresh copy."
    rm -rf "$repo_dir"
  }
fi
if [ ! -d "${repo_dir}/.git" ]; then
  echo "Cloning metis repo..."
  rm -rf "$repo_dir"
  git clone --quiet --depth 1 "$repo_url" "$repo_dir"
fi

# Hand over to the current sync logic from the clone. `exec bash` keeps the
# log redirection and fd 3, so the core script inherits both.
core="${repo_dir}/skills/bootstrap/assets/session-start-core.sh"
if [ ! -f "$core" ]; then
  echo "❌ Core script missing at ${core}."
  exit 1
fi
exec bash "$core"
