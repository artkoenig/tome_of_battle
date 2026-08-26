---
status: backlog
branch:
pr:
---

# One name for a selection's identity, one for the catalogue entry it references

## Goal

A `Selection` carries two ids, and the code derives a working id from them in two opposite orders:
`entryLinkId || selectionEntryId` at fourteen sites, `selectionEntryId || entryLinkId` at three. The
divergence looks like a defect and is not one — the two orders name **two different domain concepts**,
and that is exactly the problem: neither concept has a name, a home, or a glossary row, so the only
thing distinguishing them is the order of two operands in an inline expression.

What the two are. `docs/battlescribe-data-format.md` §7.2 has an `entryLink` carry its own
constraints, costs and children, so the same target may cost different amounts through different
links; §3.4 and §7.6 have `scope="parent"` compare **target** ids. §15 records that the wiki says
nothing about which id carries a selection's identity in a `.ros`. ADR 0011 §2 decides it for this
project: identity is the link id, and the import is an anti-corruption step
(`reconcileImportedSelectionIds`) that normalises the file's target ids onto it. So
`entryLinkId`-first is **the identity of a selection**, and `selectionEntryId`-first is **the
catalogue entry a raw, not-yet-reconciled import refers to**.

Both are correct where they stand today, and two of the three "reversed" sites are load-bearing:
`rosterSync.js:61` (`catalogueEntryIdOf`, used by `withOptionIdsAligned:150` against a map keyed by
the canonical target id at `:139`) and `rosterSerialization.js:400-412` (`checkNeedsSplit`) both run
*before* reconciliation, where link-id-first would silently miss every linked option. After
reconciliation exactly one of the two fields is set — `rosterSync.js:153-158` nulls the other — so on
a normalised roster both orders agree and the choice is inert.

That is what makes this worth an issue rather than a fix. `findEntryInSystem`
(`catalogResolver.js:128`) indexes every object that has an `id` (`indexEntriesById:38`), link ids
and entry ids alike, so **either order always resolves to something** and a wrong grab is silent.
Real data has both fields set and different: `docs/testing/equal-to-self-general-black-arc/rosters/`
carries one `entryId` behind twelve distinct `entryLinkId`s. Today the distinction survives on
convention and on two comments; the next inline copy that picks the wrong order will resolve to a
different catalogue entry and report nothing.

So: two named functions in one place, each saying in its name and its doc which side of
reconciliation it belongs to; the fourteen inline copies and the second `defIdOf`
(`src/tests/test-utils/rosParser.js:37`, `||` where `acl/rosterAdapter.js:82` has `??`) call it; two
glossary rows so the names are the project's words. `rosterSerialization.js:222-228`
(`resolveSelectionEntry`) is the one site to switch: it runs on export, on normalised data, so the
change is inert — but it reads today as a precedent for the wrong order.

The home is the implementer's call. `src/shared/rostermodel/` serves all three consumers
(`armylist`, the evaluator's ACL, the UI's play and editor viewmodels) and issue 0195 sets the
precedent for a rule living there; `armylist/model/` keeps it closer to the aggregate but leaves
`acl/rosterAdapter.js` reaching across a boundary it is not allowed to cross. The engine needs
neither — it speaks its own vocabulary behind the facade.

No version bump: on a reconciled roster every call site keeps its result, and the export site's
change is inert. Nothing a user can see changes.

## Acceptance criteria

- AC1: Two functions with distinct names exist in one module, one for the selection's identity (link id first) and one for the raw import's target (entry id first), each documenting which side of `reconcileImportedSelectionIds` it applies to. | verify: manual read during review
- AC2: No production module derives either id inline any more — the expression appears only in the module that defines the two functions. | verify: `bash -c 'test "$(grep -rn "entryLinkId ?? \|entryLinkId || \|selectionEntryId || selection" src/contexts src/ui src/shared --include=*.js --include=*.jsx | grep -v "^src/tests" | wc -l)" -le 2'`
- AC3: `src/tests/test-utils/rosParser.js:37` no longer keeps a second, subtly different copy — it calls the one definition or is shown to need its own for a stated reason. | verify: manual read during review
- AC4: `resolveSelectionEntry` uses the identity function, and the export is byte-identical for a reconciled roster. | verify: `forge-test --run src/tests/contexts/armylist`
- AC5: The import path still aligns linked options against the catalogue — the pre-reconciliation concept did not get replaced by the identity one. | verify: `forge-test --run rosterSync`
- AC6: `docs/glossary.md` carries one row per concept, naming the synonym each replaces. | verify: manual read during review
- AC7: Round-trip and evaluator contract unchanged on real rosters with both fields set. | verify: `forge-test --run src/tests/contexts/ruleengine/engine/evaluator.rosterContract`
- AC8: Whole suite, lint, types, no dead export. | verify: `bash -c 'forge-test && forge-lint && forge-typecheck && npm run knip'`

## Out of scope

- The serialiser writing `entryId=""` for a linked selection where BattleScribe writes both ids
  (`rosterSerialization.js:180-190`). Real, separate, and it changes a file a user can export.
- Turning either id into a value object with a constructor. Two named functions are the smallest
  thing that removes the ambiguity; a wrapper type touches every `Selection` in the tree.
- `reconcileImportedSelectionIds` itself and the ADR 0011 decision it implements.
- The evaluator's own id vocabulary behind the facade — it is reconciled input by contract
  (`docs/issues/084-…`, pinned in `evaluator.rosterContract.test.js:107-124`).
