---
status: backlog
branch:
pr:
---

# The `.ros` export omits cost types a catalogue declares

## Goal

Found while verifying finding T1 of [`docs/ddd-review-2026-08.md`](../ddd-review-2026-08.md); a
defect in its own right, not part of that measure.

`exportRosterToXml` writes the `<costs>` block by iterating **`system.costTypes`**
(`src/contexts/armylist/model/rosterSerialization.js:117`), with the comment *"A cost type only
exists if the game system declares it"*. That premise is false. `costTypes` sits on `CatalogueBase`
in `src/platform/battlescribe/schema/Catalogue.xsd:720` — the complexType both `gameSystem` and
`catalogue` extend — so a `.cat` may declare one, and one in this repository's own corpus does:
`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/Lizardmen (6th definitive edition).cat`
is a non-library book (`library="false"`) carrying
`<costType name="SC Saurus Chars" id="bc66-b624-4194-2f0f"/>`.

Meanwhile `system.costTypes` is parsed from the `.gst` root alone
(`src/platform/battlescribe/xmlParser.js:522-527`, handed through at `:675`); `.cat` roots are never
read for cost types on that path. The report's `costTotals`, by contrast, is keyed by
`description.costTypes`, which reads **every** catalogue root
(`src/contexts/ruleengine/engine/datasetDescription.js:57-59`, and `evaluator.js` uses the same
`costTypesOf`).

**So the exported `<costs>` block is a strict subset of what the roster actually costs.** With that
book loaded, a total the report carries under `bc66-b624-4194-2f0f` is silently dropped from the
file. The same line writes `<costLimits>` from `system.costTypes` too (`:124`, `:128`), so a roster
measured in a catalogue-declared type would export no limit at all.

It is invisible today only because every value of that type in that book is `0`. It becomes visible
on any catalogue revision that gives such a type a non-zero value — and it is a **fidelity** defect:
the file this app writes does not describe the list it exported, and another BattleScribe-compatible
tool reading it would compute a different total.

The fix is to write the block from the same declarations the report was keyed by, which the caller
already has: `exportRosterToXml(roster, system, report)` receives the report by decision (ADR-0039,
issue 0174), and `report.description.costTypes` is the superset. Keep the `roundCost` treatment and
the empty-block behaviour when nothing is declared.

**Ordering interaction with issue 0195.** That issue moves the cost-type vocabulary into
`src/shared/costs/` and explicitly leaves this line alone, noting that `:124`'s `<costLimit typeId>`
must agree with the `<costs>` block at `:117`. Land 0195 first if both are taken, so this change has
one function to call rather than two twins to choose between; taken alone it is still correct, just
with the twin that exists today.

This changes a file the user can export, so a **patch** bump is due before the PR. Propose it; do
not decide it.

## Acceptance criteria

- AC1: The `<costs>` block contains one `<cost>` per cost type the **report** declares, including one declared by a catalogue root rather than by the game system. | verify: `forge-test --run src/tests/contexts/armylist/model/rosterSerialization`
- AC2: A roster whose `costLimitType` is a catalogue-declared type exports a `<costLimits>` entry with that type's name and id. | verify: `forge-test --run src/tests/contexts/armylist/model/rosterSerialization`
- AC3: A dataset that declares no cost types anywhere still exports an empty `<costs>` block rather than an invented one — the existing behaviour survives. | verify: `forge-test --run src/tests/contexts/armylist/model/rosterSerialization`
- AC4: Values are still rounded exactly as before; no total changes for a dataset whose `.gst` declares every type. | verify: `forge-test --run src/tests/contexts/armylist/model`
- AC5: Export and re-import round-trips a roster measured in a catalogue-declared cost type without loss. | verify: `forge-test --run src/tests/contexts/armylist/model/rosterSerialization`
- AC6: The misleading comment at `rosterSerialization.js:115-116` is gone or corrected. | verify: `bash -c '! grep -q "only exists if the game system declares it" src/contexts/armylist/model/rosterSerialization.js'`
- AC7: The write model still evaluates nothing — the report is handed in, not fetched (ADR-0039). | verify: `forge-lint`
- AC8: Types hold. | verify: `forge-typecheck`
- AC9: The full suite is green apart from the pinned red scenarios in `docs/testing/campaign-state.json`. | verify: `forge-test`
- AC10: Exporting from the running app still produces a file the importer accepts. | verify: `node e2e/ui.test.js`

## Out of scope

- The duplicated cost-type rule and the `budgetOf` value — issue 0195. This issue fixes one export
  site; it does not unify the vocabulary.
- `docs/battlescribe-data-format.md:170`, which claims cost types are `.gst`/library only. It is
  wrong for the same reason and is corrected in 0195 (AC14).
- The `<costLimits>` sentinel question (`-1` = unlimited) — issue 0199.
- Anything about how `costTotals` is computed. The engine is right; the export is not.

## Open questions

1. `exportRosterToXml` already takes the report, but the `.ros` **import** path
   (`rosterSerialization.js:257`) has none. It resolves the limit type from `system` alone. Should
   the import stay narrower — meaning a file exported with a catalogue-declared limit type
   re-imports with a different one — or does the import need the report too? The second is a larger
   change and probably its own issue.
2. Is there a real `.gst` in the whfb6 fork that declares no `<costTypes>` at all? Not checkable
   from this repository (catalogues are fetched at runtime, ADR-0014/0017/0018). If there is, the
   `<costs>` block is empty today for every roster in that system.
