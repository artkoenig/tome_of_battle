---
status: done
branch: claude/issues-186-192-r1f86s
pr:
---

# An anti-corruption layer for the editor: catalogue vocabulary stops at the boundary

## Goal

Finding F6 of `docs/ddd-assessment-and-refactoring-plan.md`. The evaluator has an
anti-corruption layer — `rosterAdapter.js` translates between our list vocabulary and the
engine's input contract, and the mapping rules are written down at that seam. The editor has
none, so BattleScribe XML vocabulary travels unchanged into the presentation:

- `src/ui/components/editor/ForceEditorSection.jsx:45-54` maps over `categoryLinks` and keys on
  `categoryLink.targetId`.
- Twelve more UI modules read raw catalogue vocabulary — `selectionEntries`, `entryLinks`,
  `categoryLinks`, `targetId`, `sharedSelectionEntries`, `infoLinks` — led by
  `usePlayUnit.js` (13 occurrences), `usePlayRoster.js` (8),
  `editor/useForceSection.js` (8), `editor/optionRowDerivations.js` (7),
  `components/play/PlayUnitDetails.jsx` (7), `components/editor/UnitSelectionCard.jsx` (7).

The effect is that the BattleScribe schema is a de-facto part of the UI contract. A change in
how the format is read — or a catalogue that uses a legal-but-unusual construction — reaches
the render tree directly, and `docs/battlescribe-data-format.md` becomes required reading for
anyone touching a component.

Give the editor the same seam the evaluator has: a translation in the list context that turns
catalogue entries into the app's own display vocabulary (a category with a name and an id, an
offer, an option group), so the UI consumes our words. Where the report already provides the
answer (ADR-0034), prefer the report over a second translation — much of what the UI reads from
the catalogue today is available from the slot index, and every occurrence removed that way is
better than one translated.

The end state is enforceable: a cast rule forbidding `src/ui/** -> src/shared/battlescribe/**`
and any read of the raw vocabulary in UI code.

## Acceptance criteria

- AC1: No module under `src/ui/` names raw BattleScribe vocabulary. | verify: `bash -c 'hits=$(grep -rnE "\b(selectionEntries|entryLinks|categoryLinks|sharedSelectionEntries|infoLinks|targetId)\b" src/ui --include=*.js --include=*.jsx || true); test -z "$hits" || { echo "$hits"; exit 1; }'`
- AC2: No module under `src/ui/` imports the BattleScribe shared kernel. | verify: `bash -c '! grep -rqE "from .[^\"]*shared/battlescribe/" src/ui'`
- AC3: A cast rule makes AC1 and AC2 permanent, and the gate is green. | verify: `bash -c 'grep -q "ui-kein-fremdformat" .cast/rules.json && npm run cast'`
- AC4: The translation lives at one named seam in the list context, documented like `rosterAdapter.js` is — with the mapping rules and their reasons at the boundary. | verify: `bash -c 'test -d src/contexts/armylist/acl && grep -rqi "abbildungsregel\|mapping rule" src/contexts/armylist/acl'`
- AC5: Where the report already answers the question, the report is used instead of a second translation — the 39 catalogue reads removed from `src/ui/` do not simply reappear outside the ACL. Measured over `contexts/armylist/` without `acl/`, against the 35 that live in `domain/roster` today. | verify: `bash -c 'n=$(grep -rhoE "\b(selectionEntries|entryLinks|categoryLinks|targetId)\b" src/contexts/armylist --include=*.js --exclude-dir=acl | wc -l); test "$n" -le 45 || { echo "catalogue reads outside the ACL: $n (limit 45)"; exit 1; }'`
- AC6: Behaviour is unchanged — the full suite passes. | verify: `forge-test`
- AC7: Types, lint and build stay green. | verify: `bash -c 'forge-typecheck && forge-lint && forge-build'`
- AC8: The editor and play mode render identically in the real app. | verify: `node e2e/ui.test.js`
- AC9: The area note for the UI records that a component consumes our vocabulary, never the catalogue's. | verify: `bash -c 'grep -qi "fremdformat\|battlescribe" .claude/rules/areas/ui.md'`

## Out of scope

- Issue 0186 lands first (the shared kernel must exist), and issue 0188 should, so the ACL has an
  application layer to sit next to.
- The evaluator's own reader. `contexts/ruleengine/engine/catalogReader.js` is intentionally
  separate from the parser (ADR-0032) and is not touched.
- Changing what the UI displays. This is a translation, not a redesign: the same information
  reaches the same components under different names.
- The importer (`src/ui/viewmodels/useImporter.js`) where it reports on a file being imported —
  it legitimately speaks about `.cat`/`.gst` files. Only the vocabulary of catalogue *entries*
  is in scope.
- A version bump — nothing a user can see changes.
