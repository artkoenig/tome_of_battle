#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Loads Artjom's personal skills, subagents and global instructions by cloning
# the agents repo directly (there is no plugin marketplace anymore) and
# exposing each skill/subagent under ~/.claude so a SessionStart
# `reloadSkills` picks them up.
#
# Installed and kept in sync by the `cloud-session-bootstrap` skill in
# https://github.com/artkoenig/global-agents-config-and-skills. Re-run that
# skill in this project to update this file rather than hand-editing it.
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

# Only manage skills/agents in the remote (Claude Code on the web) environment;
# locally the user owns their own ~/.claude.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "Executed locally. Skipping remote skill/agent setup."
  exit 0
fi

repo_url="https://github.com/artkoenig/global-agents-config-and-skills.git"
repo_dir="${CLAUDE_HOME}/artkoenig-agents"
skills_dir="${CLAUDE_HOME}/skills"
agents_dir="${CLAUDE_HOME}/agents"

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

# 3. Same treatment for subagents. Each subagent is a folder
#    (agents/<name>/agent.md, with its evals/ colocated), so link the folder,
#    mirroring the skills step above. Claude Code scans ~/.claude/agents
#    recursively and takes a subagent's identity from its agent.md `name` field,
#    not from the path, so the folder layout loads without any scoped-name
#    surprises (those only apply to plugin agents/ directories).
mkdir -p "$agents_dir"
for link in "$agents_dir"/*; do
  [ -L "$link" ] || continue
  case "$(readlink "$link")" in
    "${repo_dir}/agents/"*) rm -f "$link" ;;   # prune renamed/removed agents
  esac
done
for agent in "${repo_dir}/agents"/*/; do
  [ -f "${agent}agent.md" ] || continue
  ln -sfn "${agent%/}" "${agents_dir}/$(basename "$agent")"
  echo "Linked agent: $(basename "$agent")"
done

# 4. Sync global instructions (previously done by the plugin's own hook).
if [ -f "${repo_dir}/AGENTS.md" ]; then
  cp "${repo_dir}/AGENTS.md" "${CLAUDE_HOME}/CLAUDE.md"
  echo "Synced AGENTS.md -> ~/.claude/CLAUDE.md"
fi

# 5. Activate the deterministic pre-push workflow checks for this project by
#    pointing its git hooks at the agents repo's .githooks. The hook locates its
#    checker script relative to itself, so nothing is copied into the project.
project_dir="${CLAUDE_PROJECT_DIR:-.}"
if [ -d "${repo_dir}/.githooks" ] && \
   git -C "$project_dir" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$project_dir" config core.hooksPath "${repo_dir}/.githooks"
  echo "Set core.hooksPath -> ${repo_dir}/.githooks"
fi

echo "✅ Hook finished successfully."

# 6. Tell Claude Code to reload skills now that they're in place.
echo '{"hookSpecificOutput": {"hookEventName": "SessionStart", "reloadSkills": true}}' >&3
