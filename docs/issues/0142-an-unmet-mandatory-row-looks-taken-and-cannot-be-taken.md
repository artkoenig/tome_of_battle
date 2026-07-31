---
status: active
branch: claude/plugin-update-metis-nzhs4f
pr:
---

# An unmet mandatory row renders as taken and can no longer be taken

## Intent

A `mandatoryPhantom` slot — an option the catalogue demands but the roster does
not hold — renders on the unit card as a **checked, disabled** control. That is
the documented contract in `OptionGroup.jsx`'s header ("eine offene Pflicht …
rendert als angehakte, gesperrte Checkbox") and the checkbox branch has always
done it.

It has two consequences nobody has weighed together:

1. The row **looks satisfied when it is not.** A checked control is how the
   card says "this is taken"; an open obligation is precisely one that is not.
2. There is **no way to satisfy it from the card.** The control is disabled and
   the row's label click is gated by `isClickable = !isMandatory && …`. The
   auto-add of issue 0138 covers list-rule mandatories only, not a unit's
   sub-options, so nothing else materialises it either.

Found by the reviewer of issue 0140, round 2, on the sharpest case in the
fixtures: `Zacharias the Everliving` (`1c05-5813-2f0c-f878`, Vampire Counts
definitive edition), row `Magic Level 4` in section `Wizard Level (Max: 1)`.
The report slot at `0/0/7` reads `anchorKind: mandatoryPhantom`,
`effectiveMin: 1`, `effectiveMax: 1`, **`current: 0`**, `isBlocked: false`,
`costs { pts: 0, Casting Dice: 4, Dispel Dice: 2 }`. Before issue 0140 this row
rendered as an **unchecked, enabled** radio and one click wrote
`increaseCount(<unit>, 799b-f6a5-b38c-b0c2)`. After it, the row is checked and
disabled and the click writes nothing.

Provenance, stated plainly: issue 0140 did not create this contract, it
extended it. Its fix made the radio branch honour `isMandatory` the way the
checkbox branch and the standalone path already did, which is the consistent
thing to do — and doing so brought seven rows on six cards under the contract
that were outside it before. Six of those seven lose only the ability to
*remove* a pick the catalogue demands, which is a repair. This one loses the
ability to *add* one, and that is the case worth its own decision.

The distinction the card does not currently draw: the report already separates
a met obligation from an unmet one (`isMandatoryUnmet` / `current`). A met
mandatory has nothing to click and reads correctly as checked. An unmet one is
a different thing wearing the same clothes.

Acceptance criteria:

1. It is settled, and recorded here with its source, whether an unmet mandatory
   should render as taken at all — or as an outstanding obligation the card
   distinguishes from a satisfied one.
2. A mandatory slot the roster does not hold (`current: 0`) can be satisfied
   from the unit card, or the card states why it cannot and what does satisfy
   it instead. Concretely: on `Zacharias the Everliving`, `Magic Level 4`
   reaches the roster through the card, as it did before issue 0140.
3. A mandatory slot the roster **does** hold still renders as taken and still
   cannot be removed from the card — the behaviour issue 0140 established for
   the other six rows is unchanged. Named cards: `Zombie Dragon` on Zacharias,
   `Level 4 Shaman` on `Wurrzag Ud Ura Zahubu`, `Grom's Chariot` and
   `The Axe of Grom: Elf-Biter` on `Grom the Paunch`, `Level 2 Shaman` on
   `Azhag the Slaughterer`, `Bulak's Bloody Armour` on `Morglum Necksnapper`.
4. Whatever criterion 1 settles applies to the checkbox branch, the radio
   branch and the standalone row alike — the three paths do not disagree about
   what an obligation looks like.

## Plan

## Tasks

## Decisions

## Log

- Filed out of issue 0140's second review round, which measured the whole reach
  of that issue's fix by clicking every control on all 208 unit cards of the
  six fixture catalogues on three revisions (`origin/main` `0598752`, the
  round-1 tip `02a24b3`, and `545a7a7`). Exactly 7 rows on 6 cards differ from
  `origin/main` beyond the five the fix was aimed at; all seven carry
  `effectiveMin === effectiveMax > 0`.
- The reviewer also established that the lock strands nobody: all 12
  locked-and-checked radios sit in sections that render exactly one row, so no
  user faces a capped group whose only taken option is locked while a sibling
  is offered. `Magic Level 4` is the sole row that loses an *add*.
- Triage in 0140: violates none of that issue's numbered criteria — criterion 6
  speaks of an option that *moves* into a group, and these seven did not move.
  Filed rather than fixed there.
- The maintainer chose to repair this issue before issue 0140 lands, so the two
  go out as one change on the same branch. Source: maintainer's answer, this
  session.
- **Collision to settle first, and the reason this cannot be a small change.**
  `Lore of Necromancy` — the row issue 0140's review round 1 turned on — is
  itself a `mandatoryPhantom`, i.e. an *unmet* obligation. Five assertions in
  `SelectionConfigurator.mandatoryInCappedGroup.test.jsx` pin it as `checked`,
  written on a recorded judgment call. If criterion 1 settles that an unmet
  obligation must look unmet, those five assertions are wrong and this issue
  corrects them. The reviewer of 0140 predicted exactly this lock-in and named
  its cost; it is being paid here rather than argued away. Both issues are
  unmerged and on one branch, so the correction is ordinary work, not a revert.

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
