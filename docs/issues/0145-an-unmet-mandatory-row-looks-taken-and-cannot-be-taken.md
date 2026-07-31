---
status: active
branch: claude/plugin-update-metis-nzhs4f
pr:
---

# An unmet mandatory row renders as taken and can no longer be taken

## Intent

A mandatory option the roster does not hold renders on the unit card as a
**checked, disabled** control — it looks satisfied while it is not, and on most
paths it cannot be satisfied from the card at all. Meanwhile the section header
above it renders in error styling, from the same report field. One card
contradicts itself in two adjacent DOM nodes.

Measured on the current tree across all 208 `type="unit"` entries of the six
fixture catalogues, 3329 rendered option rows: **362 rows are mandatory
(`effectiveMin === effectiveMax > 0`), 83 of them unmet, on 36 cards.** All 83
carry `anchorKind: mandatoryPhantom`, `current: 0` and `isMandatoryUnmet: true`
together — the signals agree exactly. 340 rows render checked-and-disabled, and
every one of them is mandatory.

The sharpest case: `Zacharias the Everliving` (`1c05-5813-2f0c-f878`, Vampire
Counts definitive edition), row `Magic Level 4` in section
`Wizard Level (Max: 1)`. Report slot `0/0/7`: `mandatoryPhantom`,
`effectiveMin: 1`, `effectiveMax: 1`, `current: 0`, **`isBlocked: false`**. The
report asserts the slot is open; the card renders it locked and taken. The
roster validation panel says *"Magic Level 4 must be taken at least once"* at
the same moment.

Two separate defects produce this, and the issue fixes both.

**(A) The entry is never created.** `selectionFactory.populateChildren`
(`src/roster/selectionFactory.js:69-83`) walks a definition's direct entries,
its links and `def.selectionEntryGroups` — **one group level deep**.
`Wizard Level` (`af1f-355f-236b-a64f`, `min 1` / `max 1`) sits inside group
`Magic` (`fe61-20a7-8126-d5b9`), which carries no `min` of its own
(`Vampire Counts (6th definitive edition).cat:4878-4895`), so it is never
visited. That is why `Zombie Dragon` — a top-level `Mounts` member with `min 1`
— is populated on the same card and `Magic Level 4` is not. Verified through
the production call (`useRoster.addUnit`, with its `evaluationContext`), not
only through the test seam: the two trees are byte-identical and neither holds
`Magic Level 4`. Nothing else materialises it — issue 0138's auto-add scans
root pools only, auto-fill excludes phantoms by design, and roster
synchronisation only realigns names and ids.

This is what the BattleScribe data format prescribes.
`docs/battlescribe-data-format.md` §9.1: *"BattleScribe wählt beim Erzeugen
automatisch die Einträge, die ihr Minimum erfüllen … und hört danach auf, diese
Constraints zu erzwingen"*. §7.1 on `defaultSelectionEntryId`: *"Es greift, wenn
die Gruppe eine Mindestauswahl (`min > 0`) hat … Ist das Attribut gesetzt und
passt zu einer Option der Gruppe, muss diese Option erzeugt werden — nicht die
erste in der Liste."* The document takes precedence over the ADRs.

**(B) The card lies about what is outstanding.** The row classifiers derive
"mandatory" from `min === max` and render that as checked-and-disabled, without
consulting whether the obligation is met. `isMandatoryUnmet` is a per-slot
field on every capability, identical across all three render paths, and
`OptionGroup.jsx:117-119` already reads it — but only for the *group anchor*,
to colour the header. The row inside never reads it.

That breaks a promise ADR 0034 makes in its own words: *"Ein Widerspruch
zwischen Anzeige und Validierung ist strukturell ausgeschlossen, weil beide
dieselbe Auswertung lesen."* And it renders a state ADR 0035 says must be read
rather than derived: the slot reports `isBlocked: false`, the card shows it
disabled.

The app already has a vocabulary for an open obligation and does not need a new
one: `CategoryCountBadge` renders `0 / Min: 1` in `badge-danger`
(`RosterSidebar.jsx:38-49`), the group header switches to
`option-group-header--error`, and the row level already has
`sub-selection-row--unavailable` for "you cannot take this now". The list-rule
checklist uses the presence convention rather than the mandatory-implies-checked
one: `checked: !!selection` (`listRules.js:257`).

The three paths do not even agree with each other today: the quantity-stepper
path never honoured `isMandatory`, so 3 of the 83 unmet rows *can* already be
clicked into the roster while the other 80 cannot.

Acceptance criteria:

1. Adding a unit creates the mandatory members the catalogue demands, at any
   group depth. Concretely: adding `Zacharias the Everliving` to a fresh roster
   creates `Magic Level 4` (`799b-f6a5-b38c-b0c2`), held in group
   `Wizard Level` nested inside group `Magic`. The mandatory members units
   receive today are unchanged — `Zombie Dragon` and the six Bloodline powers
   on the same card still appear exactly once each.
2. Where a group names a `defaultSelectionEntryId` that matches one of its own
   options, that option is the one created. Where the attribute is absent or
   points at nothing — as `Wizard Level`'s own `42d9-cebe-18d5-cdbd` does, an
   id that appears nowhere else in that catalogue — what is created is
   unchanged from today.
3. A row whose slot carries `isMandatoryUnmet: true` renders as an outstanding
   obligation rather than as taken: its control is not checked, and clicking it
   writes the option into the roster. Measured across all 208 cards: 0 rows
   render checked while their slot is `isMandatoryUnmet` — 83 do today.
4. A mandatory the roster **does** hold still renders as taken and still cannot
   be removed from the card. Named rows: `Zombie Dragon` on Zacharias,
   `Level 4 Shaman` on `Wurrzag Ud Ura Zahubu`, `Grom's Chariot` and
   `The Axe of Grom: Elf-Biter` on `Grom the Paunch`, `Level 2 Shaman` on
   `Azhag the Slaughterer`, `Bulak's Bloody Armour` on `Morglum Necksnapper`.
5. The three render paths agree: the group's checkbox branch, the group's radio
   branch and the standalone row — quantity stepper included — produce the same
   display state and the same write for the same slot state.
6. No card contradicts itself. Wherever a group header carries the unmet-
   obligation error styling, no row inside that section renders as taken.
7. Issue 0143's outcome holds: the section tree, the section titles and the
   per-card row multiset are unchanged, except where criterion 1 now creates a
   member that was missing.

## Plan

## Tasks

## Decisions

- **Both defects are fixed, not one.** Four shapes were put to the maintainer:
  create-and-display, display only, create only, or reverting just the one row
  issue 0143 caused. They chose create-and-display. Source: maintainer's
  answer, this session.

## Log

- Filed out of issue 0143's second review round, which measured the whole reach
  of that issue's fix by clicking every control on all 208 unit cards of the
  six fixture catalogues on three revisions (`origin/main` `0598752`, the
  round-1 tip `02a24b3`, and `545a7a7`). Exactly 7 rows on 6 cards differ from
  `origin/main` beyond the five the fix was aimed at; all seven carry
  `effectiveMin === effectiveMax > 0`.
- The reviewer also established that the lock strands nobody: all 12
  locked-and-checked radios sit in sections that render exactly one row, so no
  user faces a capped group whose only taken option is locked while a sibling
  is offered. `Magic Level 4` is the sole row that loses an *add*.
- Triage in 0143: violates none of that issue's numbered criteria — criterion 6
  speaks of an option that *moves* into a group, and these seven did not move.
  Filed rather than fixed there.
- The maintainer chose to repair this issue before issue 0143 lands, so the two
  go out as one change on the same branch. Source: maintainer's answer, this
  session.
- **Two claims in this issue's first Intent were wrong, both corrected above
  by the `researcher`'s measurement.** First, "there is no way to satisfy it
  from the card" holds for 80 of 83 rows, not all: the quantity-stepper path
  never honoured `isMandatory`, so its `+` button writes today
  (`SelectionConfigurator.jsx:518`, `OptionGroup.jsx:346`). Second, this issue
  framed `Magic Level 4` as the case. It is the only one issue **0143** caused;
  74 rows on the two checkbox paths were already in this state on
  `origin/main`, untouched by that diff. The decision reaches 83 rows on 36
  cards, not one.
- Numbers behind the criteria, all from one sweep of the 208 cards: 3329
  rendered option rows, 362 mandatory, 83 unmet, 279 met; unmet by path — 67
  group checkbox, 6 group radio, 7 standalone checkbox, 3 quantity steppers
  (the three that can already be clicked). Per catalogue: Vampire Counts DE 44,
  Orcs and goblins DE 27, Ogre Kingdoms DE 9, legacy Vampire Counts 3, legacy
  Orcs and Ogres 0.
- **`isMandatoryUnmet` is the discriminator to use, and neither `current` nor
  `anchorKind` is.** `current` falls back to 0 when a slot has no min and no
  max result — three held rows (`Von Carstein` on the legacy Vampire Lord,
  Count and Thrall) read `current: 0` while occupied. `anchorKind` is too
  broad: 103 rendered rows are `mandatoryPhantom` but only 83 are obligations,
  the other 20 carrying `effectiveMin: 0`. And a phantom is **not** always the
  unmet case — 97 of 1575 phantom slots in the report carry `current > 0`,
  including one genuine `min === max === 1` (the `General` category phantom on
  the legacy Manfred von Carstein). It happens to hold for every phantom a unit
  card renders, which is a fact about these fixtures, not a rule.
- Worth knowing for criterion 5: the standalone checkbox carries a lock the
  group paths lack — `disabled={… || (count > 0 && count <= minLimit)}`
  (`SelectionConfigurator.jsx:487`) — which locks a *satisfied* minimum even
  where `max > min`. A fourth variation on what an obligation looks like.
- `.sub-selection-taken-hint` (`src/styles/09-editor-options.css:66-69`) has no
  user anywhere in `src/` — dead style, and conspicuously the name a "taken"
  hint would want.
- **Collision to settle first, and the reason this cannot be a small change.**
  `Lore of Necromancy` — the row issue 0143's review round 1 turned on — is
  itself a `mandatoryPhantom`, i.e. an *unmet* obligation. Five assertions in
  `SelectionConfigurator.mandatoryInCappedGroup.test.jsx` pin it as `checked`,
  written on a recorded judgment call. If criterion 1 settles that an unmet
  obligation must look unmet, those five assertions are wrong and this issue
  corrects them. The reviewer of 0143 predicted exactly this lock-in and named
  its cost; it is being paid here rather than argued away. Both issues are
  unmerged and on one branch, so the correction is ordinary work, not a revert.

## Checkpoints

### Before implementation

- **Does this match what was asked?** The maintainer was shown four shapes with
  their reach and chose the widest but one — create what the catalogue demands,
  and stop the card claiming an outstanding obligation is met. What they were
  not shown, because it only became visible while writing the criteria: 74 of
  the 83 rows were already like this before issue 0143, so most of this change
  repairs something nobody reported. That follows from their choice rather than
  going against it, but it is worth their knowing.
- **What surprised me?** That the card already contradicts itself in two
  adjacent DOM nodes — the group header in error styling, the single row inside
  it rendered as taken — from the *same* report field, and that ADR 0034
  promises in its own words that exactly this cannot happen. And that the three
  render paths already disagreed before anyone touched them: the quantity
  stepper never honoured `isMandatory` at all.
- **What am I assuming without having verified it?** That creating the missing
  members cannot make a previously valid roster invalid — a created member
  costs points, and a unit near the points limit could tip over. Nothing was
  measured on that. Also that `defaultSelectionEntryId` matters anywhere in
  these catalogues: the one occurrence found points at an id that exists
  nowhere, so criterion 2 may be pinning a rule the fixtures never exercise.
  And, as in issue 0143, that the six fixture catalogues stand in for what
  users load.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
