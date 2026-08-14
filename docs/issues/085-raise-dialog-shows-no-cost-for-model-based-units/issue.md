---
status: active
branch: claude/aushebedialog-fehlende-kosten-pes5x2
pr:
---

# The raise dialog shows no cost for units whose points sit on their models

## Intent

In the raise dialog of a category (`CategoryUnitAdder`) many units are offered
without a price. Grave Guard in a Vampire Counts force is one of them; so are
Zombies, Ghouls, Dire Wolves, Black Knights, Fell Bats, Spirit Host and Bat
Swarm. Characters and single models do show their price. In an empty Vampire
Counts force of the definitive-edition fixture, 17 of the 71 offers under the
force carry a visible price and 54 do not.

The dialog reads `capability.costs[costLimitType]` and hides the price when it
is 0 — that part is correct. The number behind it is the problem: `costs` is
the **own** cost of one instance of the offered entry, and a regiment carries
no own cost. `Grave Guard` (`92ee-2ebf-c6c0-71ff`, `type="unit"`) has no
`<costs>` element at all; the points hang on its model child
(`4d29-67e8-1d93-a404`, `type="model"`, `12` pts) which the unit must hold at
least 10 of (`constraint type="min" scope="parent" value="10"`). Raising the
unit therefore costs 120 points, and the dialog says nothing.

`totalCosts` does not help. An offer anchor is a leaf in the report — it has no
child slots — and it carries no instance, so both its own count and its subtree
sum are 0. The number the dialog needs is not projected anywhere today: what
one instance of this offer would cost **including the child selections the
raise is obliged to create**.

The surface must not compute this itself. What the catalogue data says is the
engine's answer (ADR-0034); the surface reads the report.

The same gap shows in the auto-fill suggestions (`AutoFillSuggestions.jsx`,
line 116), which read the same field for the same kind of offer.

## Decisions

- The dialog shows the raise cost plainly, in the form it already uses
  (`+120 pts`). It carries no "from" prefix and no marker that the unit can be
  raised larger — the shown price is what the raise puts into the list at that
  moment, exactly as it already is for a unit whose optional upgrades are still
  unchosen.
- Option lists inside a unit (`SelectionConfigurator`, `OptionGroup`) stay as
  they are. They show the own cost of an option, which is the right number
  there, and they are out of scope for this issue.

## Acceptance criteria

1. Every capability record of the evaluator report carries the **raise cost** of
   the slot: the effective own cost of one instance plus, for every mandatory
   child of that slot, that child's raise cost times the child's effective
   minimum count, applied recursively. Give it its own field beside `costs` and
   `totalCosts`; do not change what those two mean.
2. The raise cost reads effective values only — the cost after every cost
   modifier that holds in the current state, and the effective minimum after
   every modifier on that bound. A cost modifier tied to the force the offer
   hangs under is reflected in the number.
3. In an empty `Standard (VC-AB)` force of the definitive-edition Vampire Counts
   fixture, the offer anchor of `Grave Guard` reports a raise cost of 120 for
   cost type `ecfa-8486-4f6c-c249`.
4. A slot with no mandatory children reports the same raise cost as its own
   cost, so every unit that shows a price today shows the same price after the
   change.
5. `CategoryUnitAdder` shows the raise cost instead of the own cost, both in the
   price it prints and in the descending sort of its candidates.
6. `AutoFillSuggestions` shows the raise cost for the same reason.
7. The roster-wide cost totals (`costTotals`), the validation and the displayed
   cost of a selection that is already in the list are unchanged. An offer is
   still not a selection and contributes nothing to any sum.
8. The evaluator's E2E scenarios and unit tests stay green, and the raise cost
   is pinned by tests over real catalogue data, not only over synthetic XML.
9. `npm run typecheck`, `npm run lint` and `npm test` pass.

## Notes for the work

- Reproduction of the current state: prepare the dataset from
  `src/evaluator/__fixtures__/whfb6-definitive/Warhammer Fantasy Battles (6th definitive edition).gst`
  plus `Vampire Counts (6th definitive edition).cat`, evaluate a roster of one
  force `e989-15b8-7eb6-9668` with no children, and read the capability at path
  `0/37` — `costs`, `totalCosts` and the subtree are all 0.
- The Necromancer's Army force (`d3af-1add-4e99-b977`) sets the Grave Guard
  model cost to 10 by modifier. It is the natural second case for criterion 2.
- The cost projection lives in `src/evaluator/costProjection.js`; the capability
  record is built in `src/evaluator/report.js`.
- A raise cost must terminate on catalogue data that links in a cycle.
