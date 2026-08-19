---
status: backlog
branch: claude/hochelfen-pure-of-heart-emj86h
pr:
---

# A shared honour reachable only from a hero is auto-added to the army

## Intent

A fresh High Elves roster carries `Pure of Heart` as a standalone entry at
contingent level. The catalogue offers that entry nowhere at that place: it is a
character honour, chosen on a hero. Reported by the maintainer.

Wanted observable behaviour: a fresh High Elves roster carries no `Pure of Heart`
selection of its own, and a High Elf character that links the `Honours` group can
take `Pure of Heart` there.

## Context

**What the catalogue says.** In `High Elves (6th definitive edition).cat` (and
identically in `High Elf.cat` of the second source), `Pure of Heart`
(`d0ce-b0c4-fcc1-6cac`) stands in `sharedSelectionEntries`:

```xml
<selectionEntry id="d0ce-b0c4-fcc1-6cac" name="Pure of Heart" type="upgrade">
  <constraints>
    <constraint type="max" value="1" scope="roster" .../>
    <constraint type="max" value="1" scope="parent" .../>
    <constraint type="min" value="1" scope="roster"
               includeChildSelections="true" includeChildForces="true" .../>
  </constraints>
```

It is offered through exactly one place: the shared group `Honours`
(`45a3-3e65-6c49-5cc0`, alongside `Lion Guard`, `Channeler`, `Loremaster`,
`Seer`, `Swordmaster`), which the character entries pull in by `entryLink`. The
`min=1 scope="roster"` with `includeChildSelections="true"` therefore says: one
character of the army must carry this honour — not: the army holds the entry
loose at its root.

**Why the app adds it.** `findMissingMandatoryListRuleSelections`
(`src/roster/listRules.js:193`) searches three root pools for unconditional
mandatory list rules, and one of them is `catalogue.sharedSelectionEntries`.
`Pure of Heart` passes every filter: `isListRuleEntryKind` (it is `upgrade`),
`isUnconditionalMandatoryListRule` (no own sub-options, own `min ≥ 1` with an
explicitly written `scope="roster"`), not hidden, not present. The auto-add
effect in `src/hooks/useRoster.js:208-231` then creates it at force level on
every fresh roster.

**The engine already holds the opposite rule.** Per ADR 0032 the evaluator
synthesises no mandatory phantom for a shared or linked entry:
`collectRootDefinitions` (`src/evaluator/resolver.js:146`) follows `children`
only, never a resolved link target, so an entry reachable only behind a group
boundary is no root offering. The write model contradicts that.

**Blast radius.** All 18 catalogues of the Definitive Edition were scanned for a
shared, childless entry carrying `min ≥ 1` at `roster`/`force` scope:
`Pure of Heart` is the only hit. A root-level mandatory rule declared as a root
`selectionEntry` (the `Allow experimental rules?` shape the auto-add was built
for, issues 0138/0140) is untouched by the pool change, and one declared as a
root `entryLink` onto a shared target keeps working because the filters run on
the *resolved* entry.

**The existing rosters.** The auto-add is gated on `isFreshRoster`, so a roster
saved before the fix keeps the wrongly added selection. Whether the user can
delete it is open: `buildListRuleStates` marks a mandatory rule's checkbox as
locked while the rule is present.

## Acceptance criteria

1. An entry that a catalogue holds only in `sharedSelectionEntries` is no
   candidate for the mandatory auto-add, however its constraints read: a fresh
   roster over such a catalogue gets no selection of that entry at force level.
   Pin it on an inline fixture that mirrors the real shape — the entry in
   `sharedSelectionEntries` with `type="upgrade"`, no own sub-options, `min=1
   scope="roster" includeChildSelections="true"`, offered through a shared group
   a character links — and name `Pure of Heart` / `Honours` in a comment.
   verify: `npx vitest run src/roster/listRules src/hooks/useRoster`
2. A mandatory list rule declared at the catalogue root is still set
   automatically, in both root forms: as a root `selectionEntry`, and as a root
   `entryLink` whose target is a shared entry carrying the `min`.
   verify: `npx vitest run src/hooks/useRoster.mandatoryAutoAdd
   src/hooks/useRoster.costedMandatoryAutoAdd` stay green, plus a new case for
   the root-`entryLink`-onto-shared-target form.
3. The entry stays choosable where the catalogue does offer it: on a character
   that links the group holding it, the option is offered and can be taken.
   verify: `npx vitest run src/roster`
4. A roster that already carries the wrongly added selection can be freed of it
   by hand — the mandatory lock must not hold a selection at a place the
   catalogue never offered. Establish first whether the lock does that today; if
   it does not, record that in this file and leave the code alone.
5. The JSDoc of `findMissingMandatoryListRuleSelections` states the rule and
   names ADR 0032, so the write model and the engine read the same on this
   point.
6. `npx vitest run`, `npm run lint` and `npm run typecheck` are green.
   verify: `npx vitest run && npm run lint && npm run typecheck`
7. `package.json` carries version `2.0.4` — a user-visible fix — set with
   `node scripts/release.js patch` and committed on the issue branch before the
   pull request.

## Out of scope

- The evaluator (`src/evaluator/`). It already holds the rule; nothing there
  changes.
- The catalogue data. `Pure of Heart` is encoded as the upstream authors wrote
  it, and this issue reads it, it does not repair it.
- An automatic migration of saved rosters. Criterion 4 asks only that the user
  can remove the selection by hand.
