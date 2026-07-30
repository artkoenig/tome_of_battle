---
status: backlog
branch:
pr:
---

# Roster-weite Berichtsdaten erscheinen in jedem Kontingent-Panel

## Intent

Der Evaluator-Bericht ist roster-weit: `violations` und die daraus
projizierten `unresolvedSelections` gelten für die ganze Armeeliste. Die
Oberfläche rendert sie aber **je Kontingent**: `RosterEditor` erzeugt
eine `ForceEditorSection` pro Kontingent, und jede übergibt dieselben
roster-weiten Daten an ihr `RosterValidationPanel` und an ihre
Kategorie-Chips. Bei einer Liste mit **einem** Kontingent — dem
Normalfall und dem der Fixture — fällt das nicht auf. Bei zwei fällt es
zweifach auf:

1. **Dieselbe Meldung zweimal.** Die Meldung „diese Auswahl gibt es im
   Katalog nicht mehr" erscheint im Panel jedes Kontingents, obwohl die
   verlorene Auswahl nur in einem davon liegt.
2. **Fehlmarkierung über Kontingentgrenzen.** `RosterCategorySection`
   filtert Verletzungen allein nach `anchor.defId`, nicht nach dem
   Kontingent des Ankers: eine Verletzung aus Kontingent B färbt den
   gleichnamigen Kategorie-Chip in Kontingent A rot. Das verhält sich
   wie vor Issue 0121 — keine Regression, aber inkonsistent, denn die
   **Grenzen** daneben sind seit dem Cutover kontingent-skopiert (sie
   lesen den `frame` des Slots), die Fehlmarkierung nicht.

Der Bericht liefert alles, was zur Trennung nötig ist: jede Verletzung
nennt ihren Anker mit Pfad, und der Pfad beginnt mit dem
Kontingent-Index. Es fehlt keine Angabe — es fehlt ihre Auswertung in
der Oberfläche.

Acceptance criteria:

1. Eine Verletzung färbt nur Kategorie-Chips des Kontingents, in dem ihr
   Anker liegt. Belegt an einem Roster mit zwei Kontingenten, die
   dieselbe Kategorie führen.
2. Eine unauflösbare Auswahl wird genau einmal gemeldet — im Kontingent,
   in dem sie liegt (oder, wenn die Meldung roster-weit gehört, genau
   einmal außerhalb der Kontingent-Panels).
3. Bei einem Roster mit einem Kontingent ändert sich nichts Sichtbares.

## Plan

## Tasks

## Decisions

- **Nicht in Issue 0121 behoben.** Punkt 2 ist Nachhall der
  Runde-1-Korrektur dort, Punkt 1 ist vorbestehend; beide liegen
  außerhalb der acht freigegebenen Kriterien, und wohin roster-weite
  Meldungen in der Oberfläche gehören, ist eine Gestaltungsfrage.
  *(Default, unanswered.)*

## Log

- 2026-07-30: Von Prüfrunde 2 zu Issue 0121 als Beobachtung außerhalb
  der Kriterien gemeldet, strukturell nachvollzogen an
  `RosterEditor.jsx`, `ForceEditorSection.jsx` und
  `RosterCategorySection.jsx`.

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
