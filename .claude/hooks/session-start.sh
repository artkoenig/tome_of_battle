#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Loads Artjom's personal skills + global instructions by cloning the agents
# repo directly (instead of via the Claude Code plugin marketplace) and
# exposing each skill under ~/.claude/skills so a SessionStart `reloadSkills`
# picks them up.
# ---------------------------------------------------------------------------

# stdout is reserved for the final hook JSON; everything else goes to the log.
CLAUDE_HOME="${HOME}/.claude"
LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/session-start.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec 3>&1            # fd 3 = real stdout (hook JSON only)
exec 1>"$LOG_FILE" 2>&1
echo "=== Hook initialized: $(date) ==="

failure_handler() {
  echo "❌ CRASH on line $1 (Exit Code: $?)"
}
trap 'failure_handler ${LINENO}' ERR

# Only manage skills in the remote (Claude Code on the web) environment;
# locally the user owns their own ~/.claude.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "Executed locally. Skipping remote skill setup."
  exit 0
fi

repo_url="https://github.com/artkoenig/global-agents-config-and-skills.git"
repo_dir="${CLAUDE_HOME}/artkoenig-agents"
skills_dir="${CLAUDE_HOME}/skills"

# 1. Clone or update the agents repo.
if [ -d "${repo_dir}/.git" ]; then
  echo "Updating agents repo..."
  git -C "$repo_dir" pull --quiet --ff-only || \
    echo "⚠️  Pull failed; using cached clone."
else
  echo "Cloning agents repo..."
  rm -rf "$repo_dir"
  git clone --quiet --depth 1 "$repo_url" "$repo_dir"
fi

# 2. Expose each skill at the one-level depth that skill discovery expects.
#    Symlink so `git pull` updates are reflected without copying, and so we
#    can safely identify and prune only the links we own.
mkdir -p "$skills_dir"
for link in "$skills_dir"/*; do
  [ -L "$link" ] || continue
  case "$(readlink "$link")" in
    "${repo_dir}/skills/"*) rm -f "$link" ;;   # prune renamed/removed skills
  esac
done
for skill in "${repo_dir}/skills"/*/; do
  [ -f "${skill}SKILL.md" ] || continue
  ln -sfn "${skill%/}" "${skills_dir}/$(basename "$skill")"
  echo "Linked skill: $(basename "$skill")"
done

# 3. Sync global instructions (previously done by the plugin's own hook).
if [ -f "${repo_dir}/AGENTS.md" ]; then
  cp "${repo_dir}/AGENTS.md" "${CLAUDE_HOME}/CLAUDE.md"
  echo "Synced AGENTS.md -> ~/.claude/CLAUDE.md"
fi

echo "✅ Hook finished successfully."

# 4. Tell Claude Code to reload skills now that they're in place.
echo '{"hookSpecificOutput": {"hookEventName": "SessionStart", "reloadSkills": true}}' >&3
