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

### Review round 1 — fresh context

Four findings, one of them against a criterion. Everything the reviewer
reported was executed on both revisions (`origin/main` = `0598752` and HEAD),
rendering all 208 unit cards of the six fixture catalogues through the
production seam.

| criterion | round 1 |
| --- | --- |
| 1 container carries the catalogue name | 0 |
| 2 no untitled section | 0 |
| 3 option inside its group | 0 |
| 4 the offer does not change | 0 |
| 5 hidden stays hidden | 0 |
| 6 same write operation | 1 |
| 7 issue 0131 holds | 0 |
| violates no criterion | 3 |
| **total** | **4** |

Triage:

- **A mandatory row that moves into a capped group becomes a live radio.**
  Names criterion 6. `Lore of Necromancy` is a `mandatoryPhantom`
  (`effectiveMin: 1`, path `0/0/2`). On main it rendered as a standalone
  **checked, disabled checkbox** and a click wrote nothing; on HEAD it sits in
  the new section `Lores of Magic (Max: 1)`, renders as an **unchecked,
  enabled radio**, and a click issues `increaseCount(<unit>, 09ca-…)`. Cause:
  the radio branch at `OptionGroup.jsx:284-300` ignores `isMandatory`, while
  the checkbox branch below it and the standalone path both honour it. Five
  cards: `Master Necromancer`, `0-1 Vampire Lord`, `Vampire Count`,
  `Zacharias the Everliving`, `Sethep, the Merciless`. **Fixed in this
  diff** — it is the named criterion, and the defect only became reachable
  because this change moves the row into the group.
  Why the suite missed it: criterion 6's tests pin `Blood Drinker` and
  `Frostblade`, both in `Magic Weapons (VC)`, a group with no max — neither
  ever takes the radio path. Criterion 4's sweep compares row *names* only,
  never control state or writes.
- **A section renders for a group the report marks hidden.** Violates no
  criterion — criterion 5 speaks of option rows, and no hidden option row
  appears. Pre-existing (1 card on main: `Necromancer` / `Magic Items`), and
  widened to 7 cards by this change, because `buildSections` never consults a
  group anchor's `isHidden`; a section is only dropped when it ends up barren.
  **Filed as its own issue, not fixed here.** But the comment this diff added
  at `SelectionConfigurator.jsx:29-33` — "was sichtbar ist, sagt allein der
  Bericht" — is false while this hole exists, and a statement this diff made
  false is fixed in this diff.
- **The control shape changes for rows that move into a capped group.**
  Violates no criterion; it follows directly from criterion 3, since the
  group's own max then governs the control. Three rows across all 208 cards,
  all with an unchanged write operation: `Wyvern` on `Black Orc Bigboss` and
  `Orc Bigboss` goes from a quantity stepper to a radio inside
  `Mounts (Max: 1)`, and `Spears` on `Zombies` from a checkbox to a radio
  inside `Weapons (Max: 1)`. Recorded here rather than filed: it is the
  criteria working as written, but it is user-visible and the issue did not
  say so. The maintainer can overturn it.
- **No version bump proposed, second checkpoint unanswered.** Violates no
  criterion; it is this project's pre-PR obligation and is settled before the
  PR is opened.

Confirmed accurate by the reviewer's own independent measurement, not taken on
trust: the Log's "9 untitled sections on 7 of 208 cards" reproduces card for
card; `Magic Weapons (Relics of Lustria)` is still a standalone row before and
after, so criterion 3 was not silently widened; and the two assertions
corrected after the implementation existed state the catalogue's fact — the
reviewer re-derived `Magic Items` (`11e6-e9d4-f6e4-c02d`, `.cat:21272`) from
the XML itself.

Also established: `getUnitOptions`' `visibilityContext` now has no production
caller. The two remaining production callers — `rosterSync.js:133` and
`SelectionConfigurator.jsx:135` — both call it unfiltered, and roster
synchronisation always did. List rules and army-wide selectors build their own
visibility contexts and never touch the collector, so nothing outside the unit
card lost filtering. Rendered limit text is identical on all 208 cards before
and after, so the unrepaired constraint loss on container-derived sections
costs nothing in the fixtures.

### Review round 2 — the same context continued

One finding, against no criterion. Criterion 6 is met: the reviewer re-executed
its own round-1 reproduction on all five cards, and each now renders checked
and disabled with the click writing nothing — matching `origin/main` exactly
but for the control type and the section placement.

| criterion | round 1 | round 2 |
| --- | --- | --- |
| 1 container carries the catalogue name | 0 | 0 |
| 2 no untitled section | 0 | 0 |
| 3 option inside its group | 0 | 0 |
| 4 the offer does not change | 0 | 0 |
| 5 hidden stays hidden | 0 | 0 |
| 6 same write operation | 1 | **0** |
| 7 issue 0131 holds | 0 | 0 |
| violates no criterion | 3 | 1 |
| **total** | **4** | **1** |

Method worth recording: the round measured the fix's whole reach rather than
its target, by clicking every control on all 208 cards on **three** revisions —
`origin/main` `0598752`, the round-1 tip `02a24b3`, and `545a7a7` — and
diffing control kind, `checked`, `disabled` and the operations from both the
control and the label.

- **The mandatory lock reaches 7 rows on 6 cards the finding never named.**
  Violates no criterion — criterion 6 speaks of an option that *moves* into a
  group, and these seven were already radios in capped groups on `main`.
  **Filed as issue 0142, not fixed here.** Six of the seven lose only the
  ability to remove a pick the catalogue demands, which is a repair; the
  seventh, `Magic Level 4` on `Zacharias the Everliving`, is an *unmet*
  obligation (`current: 0`) that rendered unchecked and addable on `main` and
  now renders checked and locked — it looks satisfied while it is not, and no
  path from the card satisfies it. That is 0142's subject.
- Established alongside it, and the reason the lock is not itself a defect: all
  12 locked-and-checked radios on this tree sit in sections rendering exactly
  one row, so no user is stranded in a capped group whose only taken option is
  locked while a sibling is offered. Every one of the seven carries
  `effectiveMin === effectiveMax > 0`, and no non-mandatory radio row lost its
  write anywhere in the six catalogues.
- Row multisets and section trees are identical between the round-1 tip and
  this one — the configurator diff in round 2 is comment-only.

The reviewer also weighed the five display assertions written on a judgment
call and did not find them incorrect or code-mirroring: `checked` was taken
from `origin/main`'s observed rendering, which it had captured itself in round
1. The cost it names is lock-in — future work wanting an unmet obligation to
*look* unmet (plausibly issue 0142) must edit assertions filed under a
criterion-6 heading, where a later reader would not look for a display
decision. The test file's header discloses the judgment call, which limits it.

One cosmetic imprecision in round 1's record, corrected here: the `Spears`
section renders as `Weapons (10 pts | Max: 1)`, not `Weapons (Max: 1)`.

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
