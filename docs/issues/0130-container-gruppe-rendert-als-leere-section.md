---
status: active
branch: claude/magic-items-big-names-empty-ev7nom
pr:
---

# Container group renders as an empty section instead of holding its member groups

## Intent

A `selectionEntryGroup` whose children are exclusively links to other
`selectionEntryGroup`s — a *container group* — renders on the unit card as a
section with a header and an expand chevron that opens onto nothing, while the
groups it contains render as its siblings next to it.

Reported for an Ogre Kingdoms list, where every character carries a
`MAgic Items anD biG naMeS` container. Reproduced against
`src/__fixtures__/whfb6/Ogre Kingdoms.cat`: for the Bruiser
(`d097-a3de-898f-91c8`) the container anchor `faf4-9300-097c-c415` sits at slot
path `0/0/3` with `effectiveMax` 50 and zero option rows, while its five
members — `Big Names` (`483a-21e9-80c5-e547`), `Magic Weapons`
(`b1cb-0509-d4b2-009a`), `Magic Armour` (`d92f-1fee-5b92-0ec8`), `Talismans`
(`4318-e908-dd47-08c6`), `Enchanted Items` (`f84b-7030-ee5b-d3a2`) — sit beside
it at `0/0/4` … `0/0/8` and carry all the options.

The container is not decoration: it carries its own cost constraint, so its
header is the one place on the unit card where that budget and its overrun are
visible. For the Tyrant (`2679-58f4-1771-662d`, container
`2802-decc-4c03-b662`, max 100) the header reads `(0 / 100)` empty and
`(105 / 100)` in error styling once Wallcrusher, Thundermace and Kineater are
chosen. The corresponding violation reaches the roster validation panel but
never the unit card, because it is anchored on a group path rather than a
selection path.

The wanted behaviour: the container holds its members. Expanding it reveals the
groups it contains, and its budget keeps its place on the card.

The pattern is not an Ogre one-off — 100 constraint-bearing container groups
exist across the Ogre Kingdoms, Orcs and Goblins and Vampire Counts catalogues
in the fixtures. Some carry a cost budget, others a `selections` cap.

Acceptance criteria:

1. When a unit owns a container group, the unit card renders the groups it
   contains inside that container's section, and none of them appears as a
   sibling of the container. For the Ogre Bruiser this means: expanding
   `MAgic Items anD biG naMeS` reveals `Big Names`, `Magic Weapons`,
   `Magic Armour`, `Talismans` and `Enchanted Items`; none of the five is a
   sibling section of the container.
2. The container's own limit stays readable on the card: with nothing chosen
   the Tyrant's container header shows its current-over-maximum budget
   (`0 / 100`), and when the chosen items exceed it (Wallcrusher +
   Thundermace + Kineater = 105) the header shows `105 / 100` and carries the
   error styling it carries today.
3. A nested member group behaves exactly as it does today when it stands
   alone: its own limit shows in its own header, and choosing an option inside
   it triggers the same write operation on the same target selection as before
   this change.
4. No section renders with neither option rows nor nested member groups. A
   container whose members all resolve away leaves nothing behind on the card.
5. A group that is not a container — one holding options directly, such as the
   Bruiser's `Weapons Selection` or `Armour` — renders exactly as it does
   today, unnested and with its options as direct rows.
6. Nesting follows the catalogue: a container inside a container renders its
   members at the depth the catalogue gives them, not flattened to one level.

## Plan

## Tasks

## Decisions

- **The container is nested, not hidden.** Three shapes were put to the
  maintainer: a non-expandable budget header with the members left as
  siblings, nesting the members inside the container, or dropping item-less
  sections entirely. They chose nesting. Source: maintainer's answer, this
  session.
- **Dropping the section was ruled out on evidence, before the question was
  asked.** The container header is the only place on the unit card showing its
  points budget; `unitCardValidation.selectionViolationsForCard` keeps only
  violations on selection paths, and the container's violation is anchored at a
  group path (`0/0/6` against selection paths `0/0`, `0/0/0` … `0/0/4`), so it
  never reaches the card. Source: researcher briefing, this session.

## Log

- Reproduced against the real Ogre catalogue through the production seam
  (`processImportedData` → `toEvaluatorRoster` → `prepareDataset`/`evaluate` →
  `getUnitOptions`): exactly one group anchor under the Bruiser has zero
  collector items, `faf4-9300-097c-c415`. Rendering the real
  `SelectionConfigurator` confirms a header with a chevron and no
  `.option-group-items` node.
- Cause located: `src/roster/optionsCollector.js:124` passes the *resolved
  child group's* name and id down the recursion, so a container's own id never
  lands on any collected item; `src/components/editor/SelectionConfigurator.jsx`
  pushes a section for every non-hidden group anchor regardless of whether any
  item joins it.
- Surprise worth recording: the evaluator does surface cost-field limits at a
  group anchor, and `current` there is a points sum rather than a selection
  count. The empty header therefore renders a live budget via
  `OptionGroup.jsx`'s `current / max` branch.
- No existing test constructs an empty group, and none would break if empty
  sections stopped rendering — equally, none guards the budget header today.
- Baseline on the untouched tree, this branch: `npx vitest run
  src/components/editor` 30 files / 203 tests exit 0; `npx vitest run
  src/evaluator` 68 files / 860 tests exit 0; `npm run lint` exit 0; `npm run
  typecheck` exit 0; `npm run depcruise` exit 0 with the pre-existing
  `no-circular` warning in `src/roster/modifierEvaluator.js`.

## Checkpoints

### Before implementation

- **Does this match what was asked?** The report was "an empty section is
  rendered". The criteria go further than removing it, because removing it
  would cost the card its points budget; the maintainer was shown that
  trade-off and chose nesting. Criterion 4 still carries the literal
  complaint: nothing empty survives.
- **What surprised me?** That the empty header is not empty of meaning — the
  evaluator surfaces cost-field limits at a group anchor, with `current` as a
  points sum, so the header renders a live budget and turns red over it. And
  the scale: 100 constraint-bearing containers across three catalogues, not an
  Ogre quirk.
- **What am I assuming without having verified it?** That container membership
  can be carried through the options collector from the catalogue structure —
  the report's group anchors are flat (all direct children of the unit path),
  so the nesting cannot come from there. And that no container has all its
  members hidden only at runtime: no *static* case exists in the fixtures, but
  modifier-driven visibility was not enumerated.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
