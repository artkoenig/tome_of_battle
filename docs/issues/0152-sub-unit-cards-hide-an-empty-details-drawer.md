---
status: waiting
branch: claude/goblin-streitwagengruppe-profile-pgjxon
pr: 234
---

# A sub-unit card hides its chips behind a drawer that is often empty

## Intent

A unit that holds independent sub-units — a Goblin Wolf Chariot group, for
instance — renders one card per sub-unit below the group card
(`UnitSelectionCard`, recursive branch `independentSubUnits`). A sub-unit card
already shows neither a stat block nor rules chips: both hang on `!isSubUnit`.
The profiles of the sub-units are inherited upwards and appear in the group's
profile table instead, which is where a player reads them.

What is left behind the sub-unit card's details toggle (the `ReceiptText`
button) is therefore only its upgrade chips — and `UnitUpgradesChips` renders
nothing at all when the sub-unit has no upgrades. A chariot without upgrades
thus offers a button that opens an empty drawer, and a chariot with upgrades
hides one short row of chips behind a click that has nothing else to reveal.

The upgrades stay where they are: they belong to the single sub-unit, not to
the group. One chariot carries scythed wheels and spears while its neighbour
carries none, and the two costs differ accordingly; merged into the group card
the chips would read as properties of every sub-unit.

## Acceptance criteria

1. A sub-unit card renders no details toggle button.
2. A sub-unit card that has upgrades renders its upgrade chips permanently
   visible, without any expand interaction.
3. A sub-unit card without upgrades renders no chip area and no empty box in
   its place.
4. The upgrade chips of a sub-unit keep every behaviour they have today —
   tooltip on the desktop, bottom sheet below 900 px, rule link — and they
   appear on the sub-unit card, never merged into the group card.
5. A top-level unit card is unchanged: it keeps its details toggle and shows
   profile table, upgrade chips and rules chips behind it.
6. Cost, name, the `⋮` actions menu and the violation alerts of a sub-unit card
   are unchanged, and so is the card's frame — a collapsed card keeps its torn
   lower edge.

## Result

`UnitSelectionCard.jsx`, two places: the details toggle is now wrapped in
`{!isSubUnit && ...}`, and the section's open state reads
`isSubUnit || isDetailsOpen` instead of `isDetailsOpen` alone. A sub-unit card
therefore has no toggle and shows its chip row permanently; nothing else about
the card changed, and the top-level card is untouched. The play view's card
(`PlayUnitDetails`) already hid its toggle on sub-units the same way.

Because `UnitUpgradesChips` renders `null` without upgrades, the permanently
open section of a sub-unit without upgrades stays empty and takes no height —
only the `.unit-card-torn-edge` marker sits in it, which renders nothing itself
and merely tells the CSS that the options editor below is still collapsed.

Tests: `UnitSelectionCard.subUnitDetails.test.jsx` — seven cases over a Goblin
Wolf Chariots group with two chariots, one with chips and one without. Two of
them fail against the old card (no toggle on a sub-card; chips visible without
a click), the rest are controls: the sub-cards exist, the empty drawer stays
empty, sub-cards carry neither stat block nor rules chips, the group card keeps
its toggle and opens on click, and cost, actions menu and torn-edge marker of a
sub-card are unchanged.

## Log

- 2026-08-14 — Implemented, tests green, version bumped to 2.0.3, PR #234 open.
