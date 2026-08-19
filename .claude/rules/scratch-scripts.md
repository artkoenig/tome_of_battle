# Scratch scripts

- A script that imports from `src/` runs from the repo root, not the scratchpad. Node resolves
  `node_modules` upward from the script's directory; absolute import paths do not help.
- `npm ci` does not fix that error. It installs into the repo, not next to the script.
- Data-only scripts (`python3` over a `.cat`, `curl`, `jq`) stay in the scratchpad.
- Delete what you dropped in the repo before committing. Check `git status --porcelain`.
