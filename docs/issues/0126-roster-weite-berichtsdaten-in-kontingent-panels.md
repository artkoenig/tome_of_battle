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

- 2026-08-12 (real-data E2E) — **Reproduces at the report level, not only in the
  rendering.** Definitive corpus, roster with **two** contingents of the same
  definition, force A empty, force B holding "Skeletons": force A's own "Core"
  category anchor (`0/21`) reads **`current=1`** although force A holds nothing,
  and 4 of the 11 violations anchor under force A's path. The earlier probe
  reached the same conclusion by reading `RosterCategorySection`; this one shows
  the leak is already in the report the UI renders. The neighbouring engine
  question stands unchanged: whether a `shared="true"` category limit at a
  `forceEntry`'s `categoryLink` is meant to count another contingent's selections
  is undecided, and it decides how much of this belongs in the UI at all.

- 2026-08-12 (re-check, independent probe) — **Point 1 reproduces; point 2 is
  confirmed at the code, and a neighbouring engine question turned up.**
  - Point 1: `RosterValidationPanel` takes no `forcePath` prop at all
    (`RosterValidationPanel.jsx:22-31`) and `ForceEditorSection` hands it the
    roster-wide `violations`/`unresolvedSelections` unfiltered
    (`ForceEditorSection.jsx:173-178`). Rendered twice, the panel produces
    character-identical output. One `ForceEditorSection` per force means the
    same list N times.
  - Point 2: `RosterCategorySection` filters violations by
    `anchor.anchorKind === 'categoryAnchor'` and `anchor.defId`, never by the
    anchor's force (`RosterCategorySection.jsx:98-101`) — although it holds
    `forcePath` and uses it for the count anchor two lines below
    (`:106-107`). In a two-force roster over a shared category limit the chip of
    the **empty** force A rendered `1 / Max: 0` in `badge badge-danger`.
  - Open next to it, not this file's claim: in that same run the report carried a
    `special-max` violation at BOTH force anchors (`0/0` and `1/1`) with actual 1,
    though only force B held the unit, and force A's category anchor read
    `current 1`. That is a `shared="true"` category limit at a `forceEntry`'s
    `categoryLink` — the shape the WHFB6 `.gst` really uses. Whether counting a
    foreign force's selections there is intended is an engine question and needs
    its own look; with `shared="false"` the same limit fired nowhere at all.

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
