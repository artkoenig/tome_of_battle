---
status: backlog
branch:
pr:
---

# Wurzel-Gruppen und Gruppen-Ziele bekommen kein Pflicht-Phantom

## Intent

`PHANTOM_DEFINITION_KINDS` (`src/evaluator/resolver.js:83`) entscheidet, welche
Definitionsarten überhaupt als Anker einer fehlenden Pflicht taugen. Enthalten
sind `ENTRY`, `FORCE` und `CATEGORY`. `GROUP` fehlt — und weil
`collectRootDefinitions` (`resolver.js:135`) bei einer nicht enthaltenen Art
**vor** der Kinderschleife zurückkehrt, schneidet eine Wurzel-Gruppe zugleich
ihren ganzen Teilbaum ab.

Daraus folgen zwei Fälle, die heute stumm bleiben:

1. Eine `min`-Grenze **an oder unterhalb einer Wurzel-`selectionEntryGroup`**
   bekommt kein Pflicht-Phantom. Fehlt die Auswahl ganz, meldet die Engine
   nichts.
2. Ein Wurzel-`entryLink`, dessen Ziel eine `selectionEntryGroup` ist. Issue
   0085 hat die Wurzel-Link-Form der Pflicht geschlossen, aber ausdrücklich nur
   für Links auf **Einträge** (Decision D9 dort). Ob ein Link auf eine Gruppe
   dieselbe Behandlung braucht oder eine eigene, ist offen.

Ob Fall 1 gewollt ist, sagt **kein Kommentar** im Code — anders als beim
Link-Abbruch, den ein Kopfkommentar mit ADR-0032 begründet. `§9.9` der
Formatdoku spricht nur von Einträgen und Links, nicht von Gruppen. Es ist also
unklar, ob hier eine Lücke oder eine bewusste Auslassung vorliegt; genau das
ist zuerst zu klären.

Acceptance criteria:

1. Belegt ist — aus den Katalogdaten, nicht aus Vermutung —, ob eine
   `min`-Grenze an oder unterhalb einer Wurzel-Gruppe in echten Katalogen
   überhaupt vorkommt, und ob ein Wurzel-`entryLink` auf eine Gruppe vorkommt.
   Kommt eine Form nicht vor, ist das ein Befund und wird als solcher notiert.
2. Für jede Form, die vorkommt, ist entschieden und begründet, ob sie einen
   Anker bekommt oder bewusst ohne bleibt. Die Entscheidung steht als Kommentar
   an `PHANTOM_DEFINITION_KINDS` — so, dass die nächste Leserin sie nicht
   erneut ausgraben muss.
3. Wird ein Anker eingeführt, gilt dieselbe Trennung wie in Issue 0085: er darf
   keine Pflicht synthetisieren, die ADR-0032 ausschließt (hinter einem Verweis
   liegende, nur bezogene Einträge), und er wertet nicht versehentlich geerbte
   Grenzen des Ziels mit aus.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Nebenbefund der Recherche zu Issue 0085 (2026-07-29) sowie
  dessen Decision D9. Dort außerhalb der Absicht: Issue 0085 schließt die
  Wurzel-Link-Form für Links auf Einträge und lässt Gruppen ausdrücklich offen.
- **Reihenfolge:** Nach Issue 0085, dessen Lösung das Vorbild für einen etwaigen
  Gruppen-Anker liefert (eigener Grenzen-Zuschnitt statt geerbter Grenzen).

## Log

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
