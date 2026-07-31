---
status: active
branch: claude/plugin-update-metis-nzhs4f
pr:
---

# The unit card loses group membership: nameless sections and homeless option rows

## Intent

Two defects on the unit card, reported together by the maintainer on a Vampire
Thrall of a Vampire Counts list. Both come from one seam.

`SelectionConfigurator` takes two different things from two different sources:
*which options exist* comes from the evaluator report (`capabilities`), *which
group an option belongs to* comes from the options collector
(`src/roster/optionsCollector.js`). Wherever the two disagree, the card loses
the catalogue's structure.

**(A) A container group renders with an empty title.** A `selectionEntryGroup`
that carries no constraint of its own gets no group anchor in the report, and
holds no option directly, so neither source supplies its name. Since issue 0131
built the section tree from the collector's `groupAncestorIds` — a chain of
**ids without names** — such a group renders as a titled box with no title.

Rendered Vampire Thrall card (`e37b-c827-99ac-b706`, Vampire Counts definitive
edition), every section expanded:

```
[Magic selection]
  []                              <- Magic Items      (11e6-e9d4-f6e4-c02d)
    [Magic Weapons (VC)] … eight further magic-item groups
[Mounts]
[]                                <- Equipment        (3588-2a1f-2754-0f50)
  [Weapons]
```

(This diagram first named the upper container `Bloodline`
(`0719-24b8-19d4-c832`). That was wrong and is corrected here — see the Log.)

**(B) An option the collector does not know renders outside every group.**
`Blood Drinker` and `Asp Bow` are `entryLink`s of the catalogue group
`Magic Weapons (VC)` (`bf27-6ca6-5c3a-3449`), which sits under `Magic
selection`. On the card they render as standalone rows at the very bottom,
outside every section. They reach the card through the fallback in
`SelectionConfigurator.jsx:266` — "a capability of the report with no
counterpart in the catalogue structure" — which renders such a slot as a
standalone row after every structurally placed section.

The cause is a disagreement about `hidden`: the report offers the option, the
collector's own visibility evaluation drops it, and with it goes the option's
group membership. `Blood Drinker` carries a `set hidden="true"` modifier
conditioned on `notInstanceOf` the category *Vampire*, `scope="unit"`. The
Vampire Thrall does carry that category
(`Vampire Counts (6th definitive edition).cat:3528`), so the modifier must not
fire and the option belongs on the card — the report is right and the collector
is wrong. `Asp Bow` is the same shape mirrored: base `hidden="true"` plus a
`set hidden="false"` modifier conditioned on the category *Clan Lahmia*, which
is why it appears on a Lahmia vampire.

This is not what PR #190 (issues 0132, 0135) fixed. That change landed in
`main` as `249d1ca` and gates base-`hidden` inheritance at link targets; the
measurements below were taken with it in place.

Acceptance criteria:

1. A container group renders with the name the catalogue gives it. On the
   Vampire Thrall card (Vampire Counts definitive edition, force
   `Standard (VC-AB)`): the section inside `Magic selection` that holds the
   eight magic-item groups is titled `Magic Items`, and the section that holds
   `Weapons` is titled `Equipment`. (The first version of this criterion named
   the first section `Bloodline`. The rule — "the name the catalogue gives it"
   — is unchanged; only the example was factually wrong, see the Log.)
2. No unit card in the fixture catalogues renders a section with an empty
   title. Established by rendering every unit of the six catalogues under
   `src/evaluator/__fixtures__/whfb6-definitive/` and `src/__fixtures__/whfb6/`
   and counting sections whose header text is empty — 9 today, 0 after.
3. An option the report offers renders inside the catalogue group that holds
   it, not as a standalone row. On the Vampire Thrall card in force
   `Standard (VC-AB)`, `Blood Drinker` renders inside `Magic Weapons (VC)`,
   which is itself inside `Magic selection`.
4. The set of options offered on a card does not change — this change moves
   rows, it does not add or remove them. For every unit of the six fixture
   catalogues, the multiset of option rows on the card is the same before and
   after; only their placement in sections differs.
5. An option the report hides (`isHidden: true`) still renders nowhere. On the
   Vampire Thrall in force `Standard (VC-AB)`, `Asp Bow` — whose slot carries
   `isHidden: true` there — has no row.
6. Choosing an option that moves into a group triggers the same write operation
   on the same target selection as before this change.
7. Issue 0131's outcome holds unchanged: a group holding options directly
   renders them as its own rows, a container holds its members at the depth the
   catalogue gives them, and no section renders with neither rows nor nested
   member groups.

## Plan

## Tasks

## Decisions

- **Both defects are one issue, not two.** Put to the maintainer as a choice;
  they answered "zusammen". Source: maintainer's answer, this session.
- **A nameless container gets its catalogue name rather than being dropped.**
  Two shapes were put to the maintainer: carry the enclosing groups' names
  through the options collector so the box reads `Bloodline` / `Equipment`, or
  give a group without an anchor no section at all and let its children move up
  one level — which is what the comment at `SelectionConfigurator.jsx:282`
  already claims happens. Source: **default, unanswered.** The maintainer
  settled the same question inside issue 0131 ("criterion 5's 'unnested' means
  'not moved from where the catalogue puts it'") in favour of following the
  catalogue's structure, so the naming option follows from a decision already
  on record. They were told and can still overturn it.

## Log

- **Correction, found by the `implementer` and verified independently before
  it was accepted.** This issue's own reproduction named the wrong group.
  `Magic selection` (`53e8-0ce2-eaf6-0163`) holds **two** containers, not one:
  `Bloodline` (link `85fb-0691-1ee6-37f8` → group `0719-24b8-19d4-c832`,
  `.cat:21223`), which holds only five `Vampiric Powers` group links, all
  `hidden="true"`; and `Magic Items` (link `14d2-cec2-9b1c-418c` → group
  `11e6-e9d4-f6e4-c02d`, `.cat:21272`), which holds the fourteen magic-item
  group links including the eight the card shows. The untitled container is
  `Magic Items`. The original reading came from the `Bloodline` link written
  inline on the `Magic selection` *entryLink* (`.cat:3790`) without looking
  inside that link's target group. The measurement was never wrong — 9 untitled
  sections on 7 of 208 cards, 2 on the Thrall — only one of the two ids was.
  Criterion 1's example is corrected above; its rule, "the name the catalogue
  gives it", is untouched.
- Following from the same correction: no `Bloodline` section renders on this
  card at all, before or after the change. Under force `Standard (VC-AB)` no
  bloodline is chosen, the five `Vampiric Powers` reveal modifiers stay
  unfired, and the group is barren — which criterion 7 forbids from rendering.
  Nothing to decide here: the two criteria only appeared to collide because the
  example was wrong.
- Reproduced through the production seam (`processImportedData` →
  `createSelectionFromDef` → `toEvaluatorRoster` → `prepareDataset`/`evaluate` →
  `SelectionConfigurator`) against
  `src/evaluator/__fixtures__/whfb6-definitive/`, on `main` at `0598752`.
  Throwaway probe files, removed again after measuring.
- Defect (A), scale: rendering every unit entry of six catalogues and counting
  sections with an empty header gives **9 empty sections on 7 of 208 cards** —
  Vampire Counts DE 8 on 6 of 48 cards, Orcs and Goblins DE 1 of 65, Ogre
  Kingdoms DE 0 of 15, and **0** across the three older `src/__fixtures__/whfb6/`
  catalogues. That last number explains why issue 0131's suite did not catch
  it: the fixtures it tested against do not contain the case.
- Defect (A), cause: `groupAncestorIds` carries ids only
  (`optionsCollector.js:117`). `ensureGroupSection` therefore falls back to
  `info?.name ?? anchor?.name ?? fallbackName`, and for a group with neither a
  direct option nor a constraint all three are absent.
- Defect (B), measured on the Vampire Thrall in force `Standard (VC-AB)`:

  | source | Blood Drinker |
  | --- | --- |
  | collector **with** visibility context | not collected |
  | collector **without** visibility context | `groupName: "Magic Weapons (VC)"` |
  | report | `offerAnchor`, `isHidden: false`, path `0/0/33` |
  | rendered DOM | standalone row, no enclosing section |

  Same probe under force `Clan Lahmia (VC-AB)`: identical. `Asp Bow` carries
  `isHidden: true` in the report under both forces, so its visible state is not
  reachable from the fixtures without whatever the maintainer's roster holds —
  only its mirrored catalogue shape is established, not an end-to-end
  reproduction.
- Worth knowing for the implementation: ADR 0035 puts availability in the
  report, not in the UI. The collector supplying membership *and* applying its
  own visibility filter is what makes the two disagree at all; the collector
  already offers an unfiltered mode (`getUnitOptions` without a visibility
  context) which roster synchronisation relies on for exactly that reason.
- Not investigated, and not part of this issue: *why* the collector's
  `scope="unit"` category conditions evaluate differently from the report's.
  Criterion 4 pins that the offer itself must not move either way.
- The `test-author` wrote two files —
  `SelectionConfigurator.groupMembership.test.jsx` (14 tests, the reported
  Thrall card through the production seam) and
  `SelectionConfigurator.groupMembership.fixtureSweep.test.jsx` (5 tests over
  all 208 `type="unit"` entries of the six fixture catalogues, one render pass
  in `beforeAll`). **19 tests, 5 red, 14 green from the start.**
  `npx vitest run src/components/editor` → 41 files, 312 tests, 5 failed, i.e.
  all 293 pre-existing tests still pass.
- The sweep reproduces the issue's own measurement to the number: 9 empty
  sections on 7 of 208 cards — Wight Lord 1, `0-1 Vampire Lord` 1, Vampire
  Count 1, Vampire Thrall 2, Zacharias 1, Vampire Fleet Captain 2, and
  `0-1 Hill Goblins` 1 in Orcs and Goblins.
- Criteria 4, 5, 6 and 7 are green from the start, and deliberately so.
  Criterion 4 forbids change, so it cannot be red; it is expressed as an
  invariant rather than a frozen artifact — a card's rows *are* the report's
  offer, measured across all 208 cards. Criterion 5 is a regression guard
  (`Asp Bow` is `isHidden: true` under both forces reachable from the
  fixtures). Criterion 6 pins today's write call so the move cannot change it,
  with `Frostblade` — already inside `Magic Weapons (VC)` — as the in-group
  reference. Criterion 7 is issue 0131's outcome, which holds today.
- Worth knowing: a naive "all rows equal all offers over all frames" does not
  hold today. Nine cards (Goblin Spear Chukka, Wolf Chariots, Grimgor and
  others) offer options under sub-unit frames that render on their own card, so
  criterion 4's sweep is split into two assertions — rows outside a nested
  block against the unit's own slot path, and no row anywhere naming something
  the report does not offer.
- **Open shape, left unasserted:** `Magic Weapons (Relics of Lustria)`
  (`4f42-15c8-57d9-48e0`) is an `entryLink type="selectionEntryGroup"` inside
  the group `Magic Weapons (VC)` (`Vampire Counts (6th definitive
  edition).cat:21119`), yet the report gives it an `offerAnchor`, so it renders
  as a homeless **row** rather than a section. A literal reading of criterion 3
  moves it into `Magic Weapons (VC)`; criterion 4 pins it as a row, so turning
  it into a section would go red. The issue never discussed this shape and the
  `test-author` refused to guess. If an implementation collides with it, it is
  a maintainer decision, not a criterion to reinterpret.

## Checkpoints

### Before implementation

- **Does this match what was asked?** The maintainer reported two visible
  things — boxes with no title, and Asp Bow sitting in the wrong place — and
  asked for both in one issue. The criteria carry both, plus criterion 4, which
  guards that moving rows into their groups does not quietly change *which*
  options a card offers. One shape was not answered and is taken as a default:
  a nameless container gets its catalogue name rather than disappearing.
- **What surprised me?** That the three older `src/__fixtures__/whfb6/`
  catalogues contain **zero** instances of defect (A). Issue 0131 built the
  section tree and tested it against catalogues that cannot show this bug at
  all. And that defect (B) points the opposite way from issues 0132/0135, which
  were fixed days ago: there the report was too permissive, here the report is
  right and the write model's visibility check is the one that is wrong.
- **What am I assuming without having verified it?** That `Asp Bow` on the
  maintainer's card is the mirrored case of `Blood Drinker` — its visible state
  is not reachable from the fixtures, so only the catalogue shape is
  established, not an end-to-end reproduction. And that repairing membership
  cannot move a validity judgement: the collector also feeds roster
  synchronisation, but through its unfiltered mode, which this change does not
  touch.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
