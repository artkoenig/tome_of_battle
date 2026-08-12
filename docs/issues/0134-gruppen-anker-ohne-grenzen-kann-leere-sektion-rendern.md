---
status: done
branch: claude/offene-aufgaben-qfgmag
pr:
---

# Ein Gruppen-Anker ohne Grenzen kann eine leere Sektion auf der Einheitenkarte rendern

## Intent

Gefunden bei der Review von Issue 0133 (`sortIndex`-Unterstützung): ein
`sortIndex` auf einer `selectionEntryGroup` ohne eigene `<constraints>` löst
in `src/evaluator/evalTree.js` einen Gruppen-Anker aus (`attachGroupAnchor`),
damit sein deskriptiver Wert über `capabilities` erreichbar wird. Dieser Anker
entsteht **unconditional**, unabhängig davon, ob irgendein Mitglied der Gruppe
tatsächlich sichtbar/wählbar ist.

`SelectionConfigurator.buildSections()` filtert einen Slot nur nach dessen
**eigenem** `capability.isHidden` (Zeile ~184: `if (capability.isHidden)
continue;`), nicht danach, ob alle Mitglieder der Gruppe selbst versteckt
sind. Sind ALLE Mitglieder einer grenzenlosen Gruppe `hidden="true"`, aber die
Gruppe selbst trägt kein `hidden`, rendert die Einheitenkarte dadurch einen
leeren Sektions-Header ohne wählbare Optionen darunter — eine Regression, die
es vor der Einführung des `sortIndex`-Ankers für eine solche Gruppe nicht gab
(ohne Anker/ohne sichtbares Mitglied erschien vorher gar keine Sektion).

Reproduktion (vom Reviewer von Issue 0133 gebaut und wieder entfernt, hier zur
Nachstellung beschrieben): eine `selectionEntryGroup` ohne `<constraints>`,
deren einziges Mitglied `hidden="true"` trägt. Ohne `sortIndex` auf der Gruppe:
`buildSections()` erzeugt keinen `.option-group-header`. Mit `sortIndex="1"`
auf derselben, weiterhin grenzenlosen Gruppe: ein `.option-group-header`
erscheint, mit null wählbaren Zeilen darunter.

Betrifft ausschließlich die Anzeige (kein Einfluss auf Gültigkeits-Urteile —
das ist der bereits behobene, andere Befund aus derselben Review-Runde).

Acceptance criteria:

1. Eine `selectionEntryGroup`, deren gesamte Mitgliedschaft aus versteckten
   (`isHidden`) Slots besteht, rendert auf der Einheitenkarte keine Sektion —
   unabhängig davon, ob die Gruppe selbst einen `sortIndex` trägt oder einen
   Gruppen-Anker aus einem anderen Grund hat.
2. Eine Gruppe mit mindestens einem sichtbaren Mitglied rendert weiterhin wie
   bisher, `sortIndex` eingeschlossen.

## Plan

## Tasks

## Decisions

## Log

- 2026-08-12 — **Closed** on the maintainer's decision: the finding no longer
  reproduces (measurement in the entry above). Nothing was changed in the code
  for it, and no test pins the new behaviour — should an empty section for a
  limitless group reappear, it needs a fresh issue with a fresh measurement.

- 2026-08-12 (re-check, independent probe) — **Does NOT reproduce any more.**
  Synthetic case exactly as described: a `selectionEntryGroup` without
  `<constraints>` whose only member carries `hidden="true"`, rendered through the
  production seam (`processImportedData` -> `createSelectionFromDef` ->
  `toEvaluatorRoster` -> `prepareDataset`/`evaluate` -> `SelectionConfigurator`),
  fully expanded, with and without `sortIndex="1"` on the group.
  - without `sortIndex`: no group anchor, **0** `.option-group-header`, 0 rows;
  - with `sortIndex="1"`: the group anchor IS created
    (`groupAnchor:"Leere Gruppe"@0/0/0`, `isHidden false`) — and the card still
    renders **0** `.option-group-header` and 0 rows.
  So the anchor no longer drags an empty section along; the regression this file
  describes is gone. Candidate for closing — the human decides whether to pin the
  behaviour with a test first.

- Gefunden während der Review von Issue 0133 (fresh-review-Subagent), als
  Nebenwirkung derselben `evalTree.js`-Änderung, die auch Befund 1 (Gültigkeits-
  Urteile über grenzenlose Gruppen) auslöste. Befund 1 wurde in Issue 0133
  selbst behoben (Trennung von Anker-Erzeugung und Mitglieder-Zählung); dieser
  Befund verletzt keines der nummerierten Kriterien von Issue 0133 (die
  betreffen nur Reihenfolge) und wird deshalb hier separat verfolgt, statt in
  denselben Diff gemischt zu werden.

## Checkpoints

### Before implementation

### Before the PR

## Retro
