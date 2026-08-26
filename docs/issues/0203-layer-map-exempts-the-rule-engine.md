---
status: backlog
branch:
pr:
---

# The layer map exempts the rule engine from every context rule

## Goal

`.cast/layers.json` assigns every module of `src/contexts/ruleengine/` to one of five dedicated
layers — `evaluator-fassade`, `evaluator-intern`, `acl`, `readmodel-fassade`, `readmodel-intern` —
on the lines **above** `"src/contexts/**": "kontexte"`. cast gives each module exactly one layer and
the first match wins, so no rule-engine module is ever a `kontexte` module. Every rule phrased with
`kontexte` on its `from` side therefore skips the largest context in the tree, 12 677 of roughly
28 000 production lines: `fachlogik-kein-rueckgriff` (`kontexte -> ui`), `keine-i18n-unter-ui`
(`kontexte -> i18n`), `kontext-nicht-auf-plattform` (`kontexte -> plattform`) and
`kontext-kein-fremder-kontext` (`kontexte -> kontexte`).

Measured, not inferred. Two probe modules placed under `src/contexts/ruleengine/engine/` — one
importing `src/ui/i18n/useTranslation.js`, one importing `src/platform/persistence/database.js` —
raise the graph from 1289 to 1291 module edges, so both resolve and are seen, and `npm run cast`
still answers `0 violations (0 errors)`. `.oxlintrc.json` does not close the gap either: its
`no-restricted-imports` groups cover the engine's internals, the two directions between
`ruleengine` and `armylist`, and effects in components — nothing about the UI layer, i18n, the
platform, or the three other contexts. The rule engine may reach into the database or the
translation table today and both gates stay green, while the same import from any other context
fails. `.claude/rules/areas/evaluator.md:19-22` tells a reader the opposite.

The second half is the door. `lesemodell-die-eine-tuer` is `allowed` from `**` to
`readmodel-fassade`, and in cast an `allowed` rule wins over a `forbidden` one: a probe under
`src/contexts/armylist/model/` importing `readmodel/index.js` passes with `0 violations`, although
`roster-keine-evaluator-abhaengigkeit` forbids `src/contexts/armylist/** -> src/contexts/ruleengine/**`
by path. Inside cast that ban is dead; only `.oxlintrc.json` still holds it. The same probe against
`readmodel/slotIndex.js` does fail with 2 violations, so the facade protection itself works — the
allowance is simply wider than its purpose. The door exists for one caller
(`armylist/application/mandatoryListRules.js:28`, sanctioned by `.claude/rules/areas/contexts.md`);
`from: "**"` opens it to every layer including the platform and the shared kernel.

Two decisions belong to whoever implements this: whether the four missing bans are expressed as
path-phrased rules (`src/contexts/ruleengine/** -> …`, robust against any future layer split) or as
four more layer-phrased rules per rule-engine layer; and whether `lesemodell-die-eine-tuer` narrows
its `from` to the layers that legitimately hold a door key, or stays wide with the widening recorded
where a reader will find it. Either answer satisfies the criteria below.

No version bump: a gate change is a chore.

## Acceptance criteria

- AC1: A module under `src/contexts/ruleengine/engine/` that imports from `src/ui/` fails the gate. | verify: `bash -c 'printf "import { useTranslation } from \x27../../../ui/i18n/useTranslation.js\x27;\nexport const p = useTranslation;\n" > src/contexts/ruleengine/engine/__probeUi.js; forge-lint; rc=$?; rm -f src/contexts/ruleengine/engine/__probeUi.js; test $rc -ne 0'`
- AC2: A rule-engine module that imports the platform fails the gate. | verify: `bash -c 'printf "import { openDatabase } from \x27../../../platform/persistence/database.js\x27;\nexport const p = openDatabase;\n" > src/contexts/ruleengine/engine/__probePlatform.js; forge-lint; rc=$?; rm -f src/contexts/ruleengine/engine/__probePlatform.js; test $rc -ne 0'`
- AC3: A rule-engine module that imports another context fails the gate. | verify: `bash -c 'printf "import { loadAvailableSystems } from \x27../../catalog/application/systemLibrary.js\x27;\nexport const p = loadAvailableSystems;\n" > src/contexts/ruleengine/acl/__probeContext.js; forge-lint; rc=$?; rm -f src/contexts/ruleengine/acl/__probeContext.js; test $rc -ne 0'`
- AC4: The facade protections still fire — a reach past the read model's door is still refused. | verify: `bash -c 'printf "import { SlotIndex } from \x27../../ruleengine/readmodel/slotIndex.js\x27;\nexport const p = SlotIndex;\n" > src/contexts/armylist/model/__probeInner.js; forge-lint; rc=$?; rm -f src/contexts/armylist/model/__probeInner.js; test $rc -ne 0'`
- AC5: The evaluator facade is still the only way into the engine. | verify: `bash -c 'printf "import { buildEvalTree } from \x27../../ruleengine/engine/evalTree.js\x27;\nexport const p = buildEvalTree;\n" > src/contexts/armylist/model/__probeEngine.js; forge-lint; rc=$?; rm -f src/contexts/armylist/model/__probeEngine.js; test $rc -ne 0'`
- AC6: The one sanctioned door edge still passes — the tree as it stands is green, and it contains that import. | verify: `bash -c 'grep -q "ruleengine/readmodel/index.js" src/contexts/armylist/application/mandatoryListRules.js && forge-lint'`
- AC7: `.claude/rules/areas/evaluator.md` states what the gates actually hold, including whatever was decided about the width of the read model's door. | verify: manual read during review
- AC8: Suite, types and build unaffected. | verify: `bash -c 'forge-test && forge-typecheck && forge-build'`

## Out of scope

- Any production module change. No import in `src/` moves for this issue; the tree is green before
  and after, and only the gates change.
- The React imports in `readmodel/` — issue 0194 owns them, and cast cannot see an external edge at
  all.
- Cycle detection in the gate — issue 0200 owns that.
- Whether `armylist/application/mandatoryListRules.js:28` should exist as a cross-context import.
  Issue 0198 carries that question; this issue only stops the allowance from covering edges nobody
  asked for.
