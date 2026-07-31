---
status: backlog
branch:
pr:
---

# A section renders for a group the report marks hidden

## Intent

`SelectionConfigurator.buildSections` never consults a group anchor's
`isHidden`. It filters option slots by their own `capability.isHidden`, and it
drops a section only when that section ends up with neither rows nor member
groups. A group the report marks hidden therefore keeps its header, its title
and its limit on the unit card as long as at least one of its members is
visible.

Found by the reviewer of issue 0143, executed on both revisions by intersecting
each card's section titles with the names of `groupAnchor` capabilities
carrying `isHidden: true`, across all 208 `type="unit"` entries of the six
fixture catalogues:

- before issue 0143: **1 card** — `Necromancer`, section `Magic Items`.
- after issue 0143: **7 cards** — `Zombies` / `Weapons`, `Necromancer` /
  `Magic Items`, and `Lores of Magic` on `Master Necromancer`,
  `0-1 Vampire Lord`, `Vampire Count`, `Zacharias the Everliving` and
  `Sethep, the Merciless`.

The hole is older than issue 0143; that change widened it, because it is what
moves those rows into their catalogue groups in the first place.

Identity is exact for `Lores of Magic`, not merely name-matched: the report
anchor at path `0/0/5` carries `defId 3e50-5f62-a177-304d` and
`isHidden: true`, the catalogue writes `hidden="true"` on that group
(`Vampire Counts (6th definitive edition).cat:2041`), and the options collector
returns the same `groupId` for the option inside it. The card renders
`Lores of Magic (Max: 1)` regardless.

This contradicts ADR 0035, which puts availability in the report rather than in
the UI: the report says the group is hidden and the card shows it anyway.

Not yet established, and the issue should settle it first: whether a hidden
group is meant to hide only *itself* — its header, title and limit — or its
members too. Issue 0132 asked the neighbouring question for options and the
BattleScribe data format reference decides this one, not this file. If hiding
the group must also hide its members, the members' own slots would have to
carry it, which is the evaluator's business rather than the card's.

Acceptance criteria:

1. It is established from the BattleScribe data format reference what a hidden
   `selectionEntryGroup` hides — itself only, or the options it holds — and the
   answer is recorded here with its source.
2. A group whose report anchor carries `isHidden: true` renders no section on
   the unit card. Measured by the sweep above: 7 cards today, 0 after.
3. Whatever a hidden group's visible members do instead — rise to the enclosing
   level or disappear with it — follows from criterion 1's answer and is
   recorded here before implementation.
4. Issue 0143's outcome holds unchanged: no untitled section, no barren
   section, container groups keep their catalogue name and depth, and the
   multiset of option rows per card is unchanged except for what criterion 3
   decides.

## Plan

## Tasks

## Decisions

## Log

- Filed out of issue 0143's first review round. That round's triage: the
  finding violates none of 0143's numbered criteria — criterion 5 speaks of
  option *rows*, and no hidden option row appears — so it is filed rather than
  fixed in that diff.
- The one thing fixed in 0143 instead: that change added a comment claiming
  "was sichtbar ist, sagt allein der Bericht (`isHidden`, ADR-0035)"
  (`SelectionConfigurator.jsx:29-33`), which this hole makes false. A statement
  a diff makes false is corrected in that same diff; the behaviour is this
  issue's.
- Neighbouring blind spot, same cause, recorded in 0143 and unfixed there: a
  section created from a descendant's ancestor chain reads `groupInfoById` at
  creation time and so loses the group's `constraints`/`modifiers`, not only
  its name. Section-level report data is consulted for `sortIndex` and `name`
  and nothing else. It costs nothing in the fixtures — rendered limit text is
  identical on all 208 cards before and after 0143 — but it is the same
  omission.

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
