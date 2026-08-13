---
status: active
branch: claude/aushebedialog-fehlende-kosten-bk8723
pr:
---

# The recruit dialog shows no price for units whose points live on their models

## Intent

Reported: in the recruit dialog ("Aushebedialog") several units carry no price
at all — Grave Guard in the Vampire Counts book, for instance.

Those units do not cost nothing. In the WHFB6 books a regiment is written as a
`type="unit"` entry with **no cost of its own** and a nested `type="model"`
entry that carries the points and a `min` (Grave Guard: entry 0 pts, model
12 pts, `min` 10 — 120 points when recruited). The dialog read
`capability.costs[costLimitType]` from the evaluator report, which is by
contract the **own** cost of one instance of that definition
(`costProjection.js`), so it read 0 — and a 0 is not rendered (`points > 0`).

The gap is not an evaluator bug. An offer anchor is a leaf: the mandatory
sub-selections a recruitment would create hang nowhere in the evaluation tree
yet, and *which* option fills a mandatory group is a rule of **editing**, which
the evaluator deliberately does not decide (`catalogReader.js` on
`defaultSelectionEntryId`). The write model does decide it — that is what
`createSelectionFromDef` populates when the unit is actually recruited — and it
has carried the matching price derivation, sharing one source of truth with the
factory (`selectionMembers.js`, ADR 0022, issue 50/06), since before the
evaluator cutover. Issue 0121 dropped the dialog's use of it; nothing replaced
the second half of the price.

Measured over the frozen fixtures (`src/__fixtures__/whfb6/`), priced offers
under an empty force: Vampire Counts 9 of 20 offers unpriced, Orcs and Goblins
11 of 29, Ogre Kingdoms 8 of 16, Dogs of War 13 of 22 — every rank-and-file
regiment of every book.

## Acceptance criteria

1. A candidate in the recruit dialog shows the price the recruitment will
   actually incur: the entry's own cost plus the mandatory sub-selections that
   come with it (Grave Guard: +120 pts).
2. That price equals what the selection factory creates when the candidate is
   clicked — same derivation, not a second reading of the catalogue.
3. A candidate that carries its own cost and no mandatory sub-selection keeps
   the price it showed before, read from the report (Wight Lord: +60 pts).
4. The candidate list is sorted by that price, descending, as before.
5. Everything else about the dialog is untouched: which candidates appear, the
   origin filter, hidden and blocked slots, the recruit callback.

## Result

`src/roster/rosterCounter.js`: `getMandatoryChildrenCost(system, entry,
costLimitType, ctx)` — the cost of the mandatory sub-structure alone, without
the entry's own cost. `getOptionDisplayCost` is now its caller (own cost + this)
instead of carrying its own copy of the walk, so both stay one derivation, and
the resolve-the-full-definition step both need became `resolveFullDefinition`.
Exported through the `src/roster` barrel.

`CategoryUnitAdder.jsx`: the displayed price is the report's effective own cost
(`capability.costs`, after cost modifiers — unchanged) **plus**
`getMandatoryChildrenCost`. The candidate list including its prices moved into a
`useMemo`, since the surcharge walks catalogue definitions per candidate; the
new `roster` prop is the cost context (a conditionally raised `min` sees the
same list as the factory does). `RosterCategorySection` and `ForceEditorSection`
pass it.

Tests: `CategoryUnitAdder.raiseCost.test.jsx` — real fixture (Vampire Counts)
through `processImportedData` and the real evaluator facade; guards the report
first (Grave Guard own cost 0), then reads the DOM, compares against
`getSelectionTotalCost(createSelectionFromDef(...))` rather than a hand-written
number, pins the sorting, and keeps a control case on a unit priced from the
report alone. Three of its four cases fail against the previous state.

## Log

- 2026-08-13 — Filed and implemented on `claude/aushebedialog-fehlende-kosten-bk8723`.
- Not changed here, same root: the fill-up panel (`AutoFillSuggestions`) prices
  its suggestions from `capability.costs` too, so it silently skips a regiment
  as "costs nothing" instead of weighing it against the remaining points.
