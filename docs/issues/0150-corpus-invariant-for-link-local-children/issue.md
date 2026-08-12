---
status: done
branch: claude/evaluator-kampagne-lucke-ajvfad
pr: https://github.com/artkoenig/tome_of_battle/pull/219
---

# A corpus invariant for children declared on an entryLink

## Intent

The coverage campaign cannot see a whole class of evaluator defect, and one of
that class shipped: on the Empire Captain, choosing the mount `Empire Warhorse`
offered no `Barding` option at all. Fixed in PR #214 (`ownerDefinitionOf`
returned only the resolved target of an `entryLink`, dropping the children the
link declares itself). This issue does not repeat that fix — it closes the blind
spot that let it through.

Per `Catalogue.xsd` an `EntryLink` extends `SelectionEntryBase` and may carry
its own `selectionEntries` / `selectionEntryGroups` / `entryLinks`
(`docs/battlescribe-data-format.md` §7.2). Those children stand at that usage
site alongside the target's. **149 of the 6328 `entryLink`s in the corpus do
exactly that**, spread across every one of its 15 catalogue files (and neither
of its two game-system files):

| File | Links with own children |
|---|---|
| The Empire (definitive) | 31 |
| Forces of Chaos (definitive) | 29 |
| Vampire Counts (definitive) | 16 |
| Bretonnia (definitive) | 13 |
| Skaven (definitive) | 12 |
| Vampire Counts (whfb6) | 10 |
| Orcs and goblins (definitive) | 9 |
| Lizardmen (definitive) | 7 |
| Dwarfs 2005 (definitive) | 5 |
| Dogs of War (whfb6) | 5 |
| Orcs and Goblins (whfb6) | 5 |
| Ogre Kingdoms (definitive) | 3 |
| Mercenaries (definitive) | 2 |
| Dark Elves (definitive) | 1 |
| Ogre Kingdoms (whfb6) | 1 |

Every one of them ran into the same defect. Not one was pinned.

## Context

Two independent reasons the campaign could not reach this, both measured on the
current tree.

**The search key carries no structural axis.** A constraint cell is
`constraint | type | field | scope | s | ics | icf | pct`
(`scripts/lib/evaluator-coverage-cells.js`). The `Barding` link's own constraint
(`5a58-a007-3d4f-0e30`: `max`, `selections`, `scope="parent"`, `shared="true"`,
the rest false) therefore lands in
`constraint|max|selectionCount|parent|s=true|ics=false|icf=false|pct=false` —
**5947 occurrences in the corpus, the most frequent cell there is**, long
covered by scenarios such as `army-standard-bearer` and
`ancestor-scope-instance-of`. The key records what kind of rule a construct is,
never where in the definition tree its carrier sits. "Child declared on the
link rather than on the shared target" is a structural axis the inventory does
not have, so the campaign correctly read "covered" and never came near this
location.

**The expectations are violation-shaped.** Only `expect.firing` / `expect.absent`
on a `limitId` is credited automatically (`coveredKeysFromManifests`). `Barding`
carries a `max 1` and no `min`, so whether the option exists or not, no
violation arises. The one key that could catch it is `expect.capabilities` with
`anchorKind: "offerAnchor"` — and the runner's own contract states the
expectation is *selektiv, nicht erschöpfend*
(`src/evaluator/e2e.testcatalog.test.js`): about slots a scenario does not name
it says nothing. A slot that is missing altogether is invisible unless some
scenario names precisely that slot. Of 117 scenarios, 9 carry an `offerAnchor`
assertion at all, 5 load the Empire catalogue, and 0 mention the Captain
(`6686-1f55-dee3-1bcf`), the warhorse link (`f817-432b-7c1a-a8ca`) or the
barding link (`0535-f68e-b9bc-749b`).

The campaign is essentially complete on its own terms — 130 cells, 6 open, each
with a single occurrence. Its question was "is every rule construct exercised?",
never "is every structural placement exercised?" and never "is the offer
complete?".

**Alternative considered and not taken: a structural axis in the cell key.**
The inventory classifies rule *constructs* — constraints, conditions,
modifiers, repeats. Adding "where the carrier sits" would change what a cell
means and re-baseline all 130 of them, to catch a property that is not a
property of the construct at all. What is wanted here is an invariant over the
data, not another cell.

## Acceptance criteria

1. A check derives, from the corpus XML alone, every `entryLink` that declares
   its own `selectionEntries`, `selectionEntryGroups` or `entryLinks`, and
   asserts that a roster holding that link gets a report slot for each of those
   locally declared children under the link's own slot. It reads only the
   catalogue files, `docs/battlescribe-data-format.md` and `Catalogue.xsd` for
   its expectation — never `src/evaluator/*.js` — and reaches the engine only
   through the facade (`prepareDataset` + `evaluate`), per ADR 0030 and the
   black-box principle of ADR 0033.
2. The check covers all 149 occurrences. Any it cannot address — because no
   roster can legally hold that link, or its carrier is not reachable from a
   force — is recorded with its reason rather than silently skipped, and the
   recorded count plus the checked count equals 149.
3. Existence is the assertion, not visibility. A conditionally hidden child
   still has a slot; the check asserts the slot is present and does not assert
   `isHidden`. Otherwise it would re-encode a rule the engine owns.
4. The check fails on the pre-PR-#214 engine and passes on the current one.
   Demonstrate this, do not assume it: `git stash` of the `ownerDefinitionOf`
   change, or an equivalent isolated revert, must turn it red.
5. It runs as part of the evaluator suite (`npx vitest run src/evaluator`) and
   stays inside the suite's timeout — the corpus parse dominates, so each
   catalogue is prepared at most once per run (the memoisation pattern
   `src/evaluator/CLAUDE.md` prescribes).
6. `docs/testing/covered-cells.json` gains an entry recording what this check
   attests, so the campaign's bookkeeping shows the class as covered by
   something other than a manifest `limitId` — that file's `_comment` already
   provides for exactly this case.
7. The campaign's own documentation states the limit in one sentence: the
   inventory measures rule constructs, not structural placements, and this
   check is what covers the placement axis. Put it where the loop will read it
   (`.claude/skills/evaluator-constraint-explorer/SKILL.md` and/or
   `docs/testkatalog-evaluator-e2e.md`).
8. `npm test`, lint and typecheck stay green.

## Plan

Delivered in three increments on `claude/evaluator-kampagne-lucke-ajvfad`, one
branch each.

1. **Increment 1 — the invariant, proven on the catalogue that shipped the
   defect.** A new facade-level check,
   `src/evaluator/evaluator.corpusLinkLocalChildren.test.js`, derives from the
   Empire (definitive) catalogue XML alone every `entryLink` that declares its
   own children (31 occurrences) and asserts that a roster holding the link
   gets a report slot for each of those children under the link's own slot.
   Existence is the whole claim; `isHidden` is never asserted. Demonstrated red
   against an isolated revert of PR #214.
2. **Increment 2 — all 149 occurrences across both corpora.** The same check
   spans the 15 catalogue files of
   `src/evaluator/__fixtures__/whfb6-definitive/` and `src/__fixtures__/whfb6/`,
   loads one dataset per corpus so cross-catalogue targets resolve, and closes
   its books: every occurrence it cannot assert, and every child it can assert
   only as part of a group, is recorded with its reason.
3. **Increment 3 — the campaign's books, its stated limit, and this record.**
   The `docs/testing/covered-cells.json` entry for the placement axis, the
   limit sentence in `.claude/skills/evaluator-constraint-explorer/SKILL.md`,
   the record in this file, and the two loose ends the increment-2 reviews left
   standing (the tautological books-close identity, the German block comments).

## Tasks

## Decisions

- **No structural axis in the cell key.** As the Context section argues:
  adding "where the carrier sits" would change what a cell means and
  re-baseline all 130 of them, to catch a property that is not a property of
  the construct at all. The remedy is an invariant over the data.
- **The invariant lives in the evaluator suite, not in the E2E scenario
  track.** It is one vitest file that derives its expectation from the raw
  catalogue XML and reaches the engine only through `prepareDataset` +
  `evaluate` (ADR 0030, ADR 0033). A `docs/testing/` scenario could not carry
  it: the manifest expectation is selective, so a slot that is missing
  altogether stays invisible unless some scenario names precisely that slot.
- **One `prepareDataset` per corpus, not one per catalogue.** All catalogues of
  a corpus are loaded together, so a target reached through a `catalogueLink`
  — the Mercenaries banners under the Empire Battle Standard Bearer — resolves;
  both datasets are built once in a single `beforeAll`, and only plain data
  survives into the module-level constants, because retaining DOM elements pins
  every parsed document in memory.
- **Existence, never visibility.** The check asserts that the slot is there and
  says nothing about `isHidden`; asserting visibility would re-encode a rule
  the engine owns.
- **A slot counts only through its own `defId`.** Matching on the shared
  `targetDefId` would let a slot belonging to a different link satisfy the
  claim. Where two children of one occurrence's closure resolve to the same
  target, the engine emits a single slot, so the group is asserted as a whole
  and both members are booked as shadowed rather than asserted individually.
- **The books close against a tally taken before the classification.** The
  derived total is the per-file count of links with own children, incremented
  while the XML is walked and before any link is classified as checkable or
  unaddressable, cross-checked against a second count over the same documents
  that shares no code path with the first, and against the hand-measured
  per-file table above. Defining the total as the sum of the two books, as
  increment 2 first did, made the closing case a tautology.
- **The campaign's books record the check without claiming a cell.** The
  `docs/testing/covered-cells.json` entry carries `"key": null` and an `axis`
  instead of a cell key, because what the check attests is a structural
  placement and the cell space has no such axis. Only `key` is read by the
  tooling, so the entry credits no cell, moves no worklist total and raises no
  stale-key warning. Rejected: a synthetic pipe-delimited key, which would make
  every future inventory run report a false "stale covered key"; and reusing
  the Barding constraint's cell key, which is already covered and is not what
  the check attests.
- **The stated limit goes into the skill, not the Testkatalog.**
  `.claude/skills/evaluator-constraint-explorer/SKILL.md` is what the closure
  loop reads on every invocation, while `docs/testkatalog-evaluator-e2e.md`
  catalogues E2E scenarios and this check is not one. Criterion 7 allows
  either.

## Log

- 2026-08-12 — Closed: merged as PR #217 and #219 (`35c14a2`, `6dc6b78`). The
  invariant lives in `src/evaluator/evaluator.corpusLinkLocalChildren.test.js`.
  Bookkeeping only; the status line was never flipped.

- Filed out of PR #214. The maintainer asked how the closure campaign could
  have missed the missing `Barding` option; the two reasons above are the
  answer, and this issue is the remedy they asked for.
- Every number here was measured on the tree at PR #214, not estimated: the
  6328/149 split and its per-file distribution by walking the corpus with the
  campaign's own loader (`loadCorpus(CORPUS_DIRS)`); the 5947 occurrences and
  the covered state of that cell via `extractCells` +
  `coveredKeysFromManifests` + `keysFromCoveredRecord`; the scenario counts by
  grep over `docs/testing/*/scenario.json`.
- The defect reached a second construct on the same catalogue page: the Empire
  Captain's `Battle Standard Bearer` link declares the group `Magic banners`
  locally, and that whole group was missing from the report for the same
  reason. Worth keeping as a second named case for the check.
- **Increment 1, the criterion-4 red/green demonstration**, run on the tree at
  PR #214. The command under test:
  `npx vitest run src/evaluator/evaluator.corpusLinkLocalChildren.test.js`.
  Green first: exit 0, 35 of 35 cases. The isolated revert:
  `git show 0969e81 -- src/evaluator/evalTree.js | git apply -R` (exit 0);
  `git diff` confirmed the only source change was `ownerDefinitionOf` in
  `src/evaluator/evalTree.js`, its union branch replaced by
  `return node.def.resolved;` plus the matching JSDoc paragraph. Red on that
  revert: exit 1, 32 failed and 3 passed of 35. The three that stayed green are
  exactly the ones the revert cannot touch — the KONTROLLE derivation count (31
  links, computed from the raw XML), the `UNRESOLVED_DEFINITION` guard (the
  revert drops child slots, never a branch), and the single group-typed
  occurrence `29cc-7184-aa01-dc85` ("Knightly Orders (WD#310(UK))"), whose
  group-link descent in `offer.js` predates PR #214. A representative failure:
  `Battle Standard Bearer: kein Slot fuer eigenes Kind 14b9-9df2-f13c-f31b
  unter 0/7/0: expected false to be true`. Restored with
  `git checkout -- src/evaluator/evalTree.js` (exit 0), after which the check
  returned to exit 0, 35 of 35. Outside criterion 4 and informational: with the
  revert in place the pre-existing unit test
  `src/evaluator/evalTree.linkLocalChildren.test.js` also went red (4 failed, 2
  passed of 6). Whole suite after the increment: `npx vitest run src/evaluator`,
  exit 0, 92 files, 1560 cases.
- **Increment 1 also closed a gap in the format documentation.**
  `docs/battlescribe-data-format.md` never stated that an `entryLink` may
  declare children of its own; §7.2 now says so, derived from `Catalogue.xsd`
  and evidenced on the Empire catalogue. The `§4.4` citations that named a
  section of that document which does not exist were corrected to §7.2 — in
  `evalTree.js` by increment 1, in `evalTree.linkLocalChildren.test.js` by
  increment 3.
- **Increment 2, the figures, re-derived from the corpus rather than taken from
  the table above.** 149 occurrences across the 15 catalogue files of both
  corpora, per file exactly as the table states; neither `.gst` file holds one.
  Those 149 links declare 760 children in total, of which 754 are asserted
  individually by their own report-slot `defId` and 6 are recorded as shadowed.
  The occurrence-level unaddressable list is empty, because one
  `prepareDataset` per corpus resolves the cross-catalogue targets (the
  Mercenaries banners under the Empire Battle Standard Bearer) that increment
  1's single-catalogue dataset could not. `npx vitest run src/evaluator` after
  the increment: exit 0, 92 files, 1688 cases, 68 s.
- **The shadowed-children finding.** The six shadowed children are
  `781f-9b7a-2f8a-b7c6` and `b510-4632-d172-0c50` under each of the three
  Forces-of-Chaos "Battle Standard Bearer" links `0c1c-b835-63a1-14fc`,
  `1d8b-61be-1c53-db8d` and `22c8-1475-0ffd-8768`. Each of those links declares
  exactly one local child, a group link to the shared "Magic Banners" group
  `a979-ec7a-7a45-f11b`; two members of that group's closure - reached from two
  different groups, neither declared on the link and not siblings of each other
  — resolve to the same target `f327-567f-ef99-0403`, for which the engine
  emits a single report slot. The check therefore asserts the pair as a group
  and books both ids as shadowed instead of asserting either individually.

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
