# Handoff Report - Codebase Discovery

## 1. Observation
We observed the following files and code snippets in the `army_builder` codebase:
* **Rule R4 Violations:**
  * In `src/components/PlayMode.jsx` (lines 99-100):
    `return ['profile', 'profil', 'unit', 'einheit', 'creature', 'kreatur', 'monster', 'charakteristik', 'charakterwerte', 'mount', 'reittier'].some(t => typeLower.includes(t)) && !['magic item', 'equipment', 'ausrüstung', 'magic weapon', 'armour', 'rüstung', 'weapon', 'waffe', 'virtue', 'talisman', 'item', 'special rule', 'banner', 'standarte', 'runes', 'runen'].some(t => typeLower.includes(t));`
  * In `src/components/PlayMode.jsx` (lines 160-170):
    `if (t.includes('shield') || t.includes('schild')) { hasShield = true; }`
    `if (t.includes('full plate') || t.includes('plattenrüstung') || t.includes('gromril') || t.includes('chaos armour') || t.includes('chaos-rüstung')) { armourValue = Math.min(armourValue, 4); }`
  * In `src/components/editor/SelectionConfigurator.jsx` (lines 350-354):
    `return nameLower === 'general' || nameLower === 'armeegeneral' || nameLower === 'army general' || nameLower.includes('warlord') || nameLower === 'general der armee' || ...`
* **Test Suite:**
  * In `package.json` (line 11): `"test": "node src/solver/validator.test.js"`
  * No unit test files exist for `xmlParser.js`, `zipExtractor.js`, `useRoster.js`, or the saves calculations in `PlayMode.jsx`.
* **Dead Code:**
  * `src/App.css` exists but is never imported or referenced in `src/main.jsx` or any component.
  * Static assets `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`, and `public/icons.svg` are not referenced.

## 2. Logic Chain
1. Naming checks and substring matches in `PlayMode.jsx` and `SelectionConfigurator.jsx` use hardcoded German and English strings to determine model profile types, magic item upgrades, general/commander priority, and combat saves calculations.
2. Since these strings are directly used to evaluate gameplay rules and parse data structures, this violates **Rule R4** ("Es sollen keine (Sub)Strings auf Englisch oder Deutsch als Schlüssel für das Parsen oder Validieren in der Geschäftslogik verwendet werden").
3. Since only `validator.test.js` is executed under `npm test`, coverage is missing for state hooks, decompression utilities, and XML parsers.
4. Since `App.css` and the assets noted above are never referenced, they represent dead code and assets.

## 3. Caveats
No manual or visual execution of the browser was performed; structural analysis is based entirely on static code analysis, the Puppeteer script `debug_ui.js`, and the existing unit test suite execution.

## 4. Conclusion
The codebase is currently functional but exhibits structural duplication, dead files/assets, zero test coverage on parsers/hooks, and multiple hardcoded string key violations (Rule R4) in rule validations. A refactoring strategy is proposed to extract rules logic, resolve R4 violations, and extend test coverage.

## 5. Verification Method
* Review the full discovery report at `/Users/artkoenig/Workspace/army_builder/.agents/explorer_discovery/discovery_report.md`.
* Run the existing unit test suite: `npm test`.
* Run the dev server and launch Puppeteer: `node src/solver/debug_ui.js` (requires dev server running on port 5175).
