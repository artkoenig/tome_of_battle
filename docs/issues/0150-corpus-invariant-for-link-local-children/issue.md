---
status: active
branch: claude/evaluator-kampagne-lucke-ajvfad
pr:
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
(`docs/battlescribe-data-format.md` §4.4). Those children stand at that usage
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

## Tasks

## Decisions

## Log

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
