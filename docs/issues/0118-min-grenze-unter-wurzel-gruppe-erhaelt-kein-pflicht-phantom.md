---
status: done
branch:
pr:
---

# `min`-Grenze unter einer Wurzel-Gruppe erhält kein Pflicht-Phantom

## Intent

`PHANTOM_DEFINITION_KINDS` (`src/evaluator/resolver.js`) schneidet beim
Einsammeln der Wurzel-Definitionsliste nicht nur Verweise ab, sondern auch
**Wurzel-Gruppen** (`GROUP` fehlt): `collectRootDefinitions` bricht an einer
`selectionEntryGroup` unmittelbar unter der Katalogwurzel ab — samt ihrer
Kinder. Ein Wurzeleintrag mit `min`-Grenze (`scope="roster"`/`"force"`), der
in einer solchen Gruppe steckt, bekommt deshalb kein Pflicht-Phantom: eine
Liste ohne die Pflichteinheit meldet keinen Verstoß. Ob der Abbruch für
Gruppen Absicht ist, sagt kein Kommentar; §9.9 der BSData-Doku spricht nur
von Einträgen und Links. (Nebenbefund aus dem Lauf zu Issue 0085,
Log-Eintrag 2026-07-29.)

Zuerst ist zu klären, ob reale Kataloge das Muster überhaupt führen; danach
entweder die Traversierung öffnen oder den Abbruch begründet dokumentieren.

Acceptance criteria:

1. Es ist entschieden und im Issue belegt, ob eine Wurzel-Gruppe
   Pflicht-Kandidaten liefern soll (Datenlage aus den Fixture-Katalogen und
   §9.9).
2. Je nach Entscheidung: Entweder erzeugt ein Pflicht-Eintrag unter einer
   Wurzel-Gruppe bei Absenz einen blockierenden Verstoß, oder der bewusste
   Abbruch ist am Code dokumentiert und durch einen Test festgeschrieben.
3. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Closed 2026-08-12 without a code change.** The first acceptance criterion
  asked for the data census before anything else; the census says the pattern
  does not occur. The cut in `PHANTOM_DEFINITION_KINDS` stays as it is.

## Log

- 2026-08-12 (real-data sweep) — **Closed: root groups do not exist in real
  catalogues.** Across both complete upstream corpora —
  `artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition` (19 files) and
  `artkoenig/Warhammer-Fantasy-6th-edition` (17 files), 36 catalogue documents
  in total, cloned at their current heads — there are **0
  `selectionEntryGroup`s directly under a catalogue or game-system root** —
  every book puts its root offers in
  `selectionEntries` and `entryLinks`. The traversal cut at `GROUP` is therefore
  unobservable from data, and the question this file opens ("do real catalogues
  carry the pattern at all?") is answered: they do not.

- 2026-08-12 (re-check, independent probe) — **Reproduces, with the control in
  the same run.** A `selectionEntry` carrying `min 1 scope="roster"` inside a
  root `selectionEntryGroup` produces **no** violation for an empty roster; the
  same entry directly under the catalogue root produces `duty-min`, actual 0,
  bound 1. Both runs are diagnostic-free, so the difference is the traversal cut
  at `GROUP`, not a broken fixture.

- 2026-08-12 — Reproduced on the current tree with a control in the same run.
  A `selectionEntry` carrying `min 1 scope="roster"` inside a root
  `selectionEntryGroup` produces **no** violation for an empty force; the very
  same entry directly under the catalogue root produces `duty-min error
  actual=0 bound=1`. Cause unchanged: `PHANTOM_DEFINITION_KINDS`
  (`src/evaluator/resolver.js:90-95`) holds `ENTRY`, `ENTRY_LINK`, `FORCE` and
  `CATEGORY` but not `GROUP`, and `collectRootDefinitions` returns at the first
  kind outside that set (`resolver.js:147`), so the group and its whole subtree
  never reach the mandatory-phantom pass. Still no comment saying whether that
  is intended.

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
