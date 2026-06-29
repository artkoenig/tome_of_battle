## 2026-06-29T06:40:36Z
You are a Developer/Implementer Worker (archetype: teamwork_preview_worker).
Your working directory is /Users/artkoenig/Workspace/army_builder/.agents/worker_m1.
Your task is to implement Milestone 1 of the Roster Builder Refactoring project: "Cleanup & Constants Setup".

Please perform the following actions:
1. Delete the following unused/dead files from the repository:
   - `src/App.css`
   - `src/assets/react.svg`
   - `src/assets/vite.svg`
   - `src/assets/hero.png`
   - `public/icons.svg`
   (Verify they are not referenced in the project).
2. Clean up unused imports:
   - In `src/components/PlayMode.jsx`, remove the unused imports `Shield` and `findEntryInCatalogue`.
   - In `src/components/RosterEditor.jsx`, remove the unused imports `Shield` and `BookOpen`.
3. Create the file `src/solver/constants.js` to centralize all keyword list configurations (to satisfy Rule R4). Define and export arrays/constants for:
   - Model profile type matching (e.g. `['profile', 'profil', ...]`) and excluded terms.
   - Upgrade classification keywords.
   - Saves calculation keywords (Shield, Full Plate, Heavy Armour, Light Armour, Mounts, Barding, Cavalry).
   - Ward save keywords and Blessing rules keywords.
   - Upgrade details check keywords.
   - Commander/General matching keywords (e.g. `['general', 'armeegeneral', ...]`).
4. Run the build and run unit tests (`npm test`) to ensure everything compiles and passes cleanly.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please document your changes and findings in `/Users/artkoenig/Workspace/army_builder/.agents/worker_m1/handoff.md` and send a message back to the parent (Conversation ID: 66403152-2ff1-426a-a9c5-4b71be2c56a3) with a summary when you are done.
