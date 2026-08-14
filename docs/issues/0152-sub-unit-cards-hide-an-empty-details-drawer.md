---
status: backlog
branch: claude/goblin-streitwagengruppe-profile-pgjxon
pr:
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

## Log
