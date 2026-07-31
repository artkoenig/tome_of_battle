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
7. A group holding both its own options and links to other groups renders both
   in one section: its own options as direct rows, the groups it links nested
   beneath them. The Vampire Counts `Magic Items` group
   (`040b-d0d0-fe3b-9d13`, four group links and one direct option) shows its
   own option as a row and its four linked groups nested in the same section.

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
- **A mixed group renders both its options and its linked groups, in one
  section.** The test-author found three groups in `Vampire Counts.cat` holding
  both — `Magic Items` (`040b-d0d0-fe3b-9d13`) and two `Armour` groups
  (`5386-2926-6dea-1086`, `da62-06d6-2e07-317f`) — which criteria 1 and 5 left
  undecided between them. Added as criterion 7 before implementation started.
  Source: default, unanswered — it follows from the maintainer's choice to
  follow the catalogue's structure, and the alternative would render one group
  two different ways depending on its contents. The maintainer was told and can
  still overturn it.
- **Criterion 5's "unnested" means "not moved from where the catalogue puts
  it", not "top-level".** Review round 1 found that `Body Armour`
  (`3371-dd77-0697-195f`) — two own options, not a container — sits directly
  inside `Armour` in `Vampire Counts.cat:2447-2464` and is now rendered there
  instead of beside it, on the Vampire Thrall, Wight Lord and Wraith cards.
  Criterion 5's letter and criterion 6's letter disagree for a directly nested
  group. Put to the maintainer with both renderings; they chose the
  catalogue's structure, so a linked group and a directly nested group are
  treated alike. Source: maintainer's answer, this session.
- **The pruning carve-out stays.** `buildSections` prunes an item-less section
  only when the options collector returned something for the frame; when it
  returns nothing, every group anchor keeps its section. The reviewer probed
  every frame of every unit in both full multi-catalogue systems for that
  state and found **0 occurrences** — it is not reachable from catalogue data,
  and the only thing that exercises it is a pre-existing test that stubs the
  collector empty on purpose. Kept as a defensive fallback: without membership
  the configurator cannot tell "empty" from "unmapped", and dropping the
  section would take a group's limit off the card with it. Source: default,
  unanswered.
- **Criterion 7's "beneath them" means hierarchy, not document order.** The
  `test-author` asked whether a mixed group must put its own rows above its
  nested groups. Left unpinned: the criterion is about what contains what, and
  an ordering assertion would constrain the implementation past what the
  criterion decides. Source: default, unanswered.

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
- The `test-author` wrote two test files —
  `SelectionConfigurator.containerGroups.integration.test.jsx` (the real Ogre
  catalogue through the production seam) and
  `SelectionConfigurator.containerGroups.nesting.test.jsx` (synthetic) — 17
  tests, 13 red on the untouched tree, the 203 pre-existing tests in
  `src/components/editor` still passing.
- Four of those 17 are green from the start and stay as regression guards:
  criterion 5 states that non-container groups render exactly as today, and
  they do. Making them red would have meant fabricating a failure.
- The fixtures do not exercise criteria 6 and 4's second sentence at all: of
  201 groups across the three whfb6 catalogues and the game system, 43 are
  containers and **none** holds another container; there is no container whose
  members all vanish and no childless group. Those two criteria are pinned
  synthetically, which is the honest route.
- Worth knowing for the implementation: a group only gets a report anchor when
  it carries a constraint. Dropping a synthetic container's constraint made its
  anchor disappear and its leaf flatten up one level.
- Filed separately, not part of this run: an option held only by a hidden group
  keeps a visible offer anchor and renders as a stray ungrouped row
  (issue 0131).
- Criterion 7 turned out observable on the real catalogue after all: Vampire
  Counts `Magic Items` (`040b-d0d0-fe3b-9d13`, max 50) and its four linked
  groups each carry a constraint and so each produce a report anchor, flat at
  `0/0/2` … `0/0/6` under the Necromancer. Its own option `Armour of Bone`
  already renders as a row of that section today — only the nesting of the four
  linked groups is missing. The other two mixed groups carry no constraint at
  all, get no anchor, and are therefore unobservable; they are not tested.
- Final red state before implementation: three test files, 22 tests, 18 red.
  `npx vitest run src/components/editor` → 33 files, 225 tests, 18 failed,
  i.e. all 203 pre-existing tests still pass.
- Implementation landed in `5101c70` (later `919a8fe` after a committer-email
  rebase): the options collector carries `groupAncestorIds` on each item, the
  configurator assembles the flat slot-ordered sections into a tree from those
  chains and prunes what is left with neither rows nor members, and
  `OptionGroup` gained two inert-by-default props (`nestedSections`,
  `hasSelectedDescendant`). Verified by exit code: `npx vitest run
  src/components/editor` 33 files / 225 tests exit 0; `npm test` 254 files /
  2644 tests plus the puppeteer app E2E exit 0; `npm run lint`, `npm run
  typecheck`, `npm run depcruise` all exit 0, depcruise with only the
  pre-existing `no-circular` warning.

### Review round 1 — fresh context

Five findings. The reviewer proved two things beyond the criteria: the
collector's output is byte-identical to before across every unit of seven
catalogues (6327 lines dumped on both revisions), so roster synchronisation is
untouched; and across 357 rendered unit cards the change removes 62 empty
sections and adds none, changing no row and no limit text.

| criterion | round 1 |
| --- | --- |
| 1 container holds its members | 0 |
| 2 the budget stays readable | 0 |
| 3 a nested member behaves as today | 0 |
| 4 nothing empty survives | 1 |
| 5 non-containers unchanged | 1 |
| 6 depth follows the catalogue | 0 |
| 7 mixed groups | 0 |
| violates no criterion | 3 |
| **total** | **5** |

Triage:

- **`holdsSelection` misses the `targetDefId` fallback its two siblings have**
  (`SelectionConfigurator.jsx:447`). A roster storing an option under its
  shared entry id rather than its link id leaves the container collapsed, so a
  chosen item is not in the DOM at all; before this change the member group was
  top-level and opened itself. Reachable in the window before
  `syncRosterSelectionsWithSystem` normalises ids — e.g. after a catalogue
  update — and it persists, because the expanded state is a `useState`
  initialiser. The reviewer named no criterion. **Named criterion 3 on triage
  and fixed now:** "behaves exactly as it does today" is the criterion's
  general clause, and a member group that today opens itself to show its
  selection does not behave as it does today when it is hidden instead. The
  two items after the colon are what that clause was spelled out with, not its
  whole extent. Recorded so the maintainer can overturn the reading.

  **That triage was wrong, and the finding is dismissed.** Told to write the
  test for it, the `test-author` rendered the reproduction on HEAD *and* on
  the pre-change commit and found the account it rests on to be false. The
  chosen item is not missing from the DOM: Wallcrusher renders as a stray
  checked row outside every group — before the change as well as after. And
  `Big Names` did **not** open itself before the change either, for the same
  reason. So "behaves exactly as it does today" is satisfied: today it behaves
  exactly like this too. The report carries a single `occupied` slot for the
  shared id and no offer anchor for the link at all, so a `targetDefId`
  fallback in `holdsSelection` could not reach the case regardless —
  `section.group.items` holds no Wallcrusher entry to fall back on. The stray
  row is a membership defect in the neighbourhood of issue 0131, not this
  change's doing. Nothing was fixed for this finding.
- **The lesson, recorded because it cost a round:** the reviewer's finding was
  taken at face value and named against a criterion before anyone re-ran its
  reproduction on both revisions. A finding's reproduction has to be executed,
  not read — a reproduction that only shows the *new* state cannot tell a
  regression from behaviour that was always there.
- **`hasSelectedDescendant` has no test coverage** — removing it from the
  initialiser leaves all 225 editor tests green, because every new test expands
  everything before asserting. Violates no criterion. **Fixed together with
  the finding above** rather than filed: the untested code is the code the
  defect sits in, and tests are what turn both into facts.
- **A non-container is now nested** (`Body Armour` inside `Armour`). Names
  criterion 5. **Dismissed** — see the Decisions entry; the maintainer settled
  the reading in favour of the catalogue.
- **Criterion 4's carve-out.** Names criterion 4. **Dismissed** — see the
  Decisions entry; 0 occurrences across both full multi-catalogue systems.
- **The issue's record was not updated by the implementation commit.**
  Violates no criterion; violates this project's tracker convention. **Fixed
  now** — this section and the Decisions above are that fix.

Outcome of the round after that correction: **one finding acted on, four
dismissed.** The coverage gap was closed —
`SelectionConfigurator.containerGroups.initialExpansion.test.jsx`, seven tests
written from the criterion without any `expandAll`, so they observe the card as
it first renders. Three of them go red when `hasSelectedDescendant ||` is
removed from the expanded-state initialiser (the Ogre container holding a
chosen Wallcrusher, two member groups holding choices at once, and a synthetic
selection two containers deep); the other four pin the boundaries that must not
move — nothing chosen stays shut, a standalone group still opens itself, a
mandatory group with a preselection still opens. No production code changed:
`npx vitest run src/components/editor` → 34 files, 232 tests, exit 0.

A process slip worth the record: the probe file the `test-author` had on disk
was swept into commit `1059cf5` by a `git add -A`. Removed in the commit that
follows it.
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
