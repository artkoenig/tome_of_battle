---
status: backlog
branch:
pr:
---

# Gewählte, effektiv versteckte Auswahl erzeugt keinen Fehler

## Intent

Das BSData-Wiki (*Data structure overview*, „Props: Hidden") beschreibt die
Gegenrichtung zur Min-Unterdrückung aus Issue 0088: Eine Auswahl, die im
Roster **liegt**, deren Definition aber effektiv versteckt ist (Basis-Attribut
oder `hidden`-Modifier), soll einen Fehler in der Fehlerliste erzeugen — der
Spieler hat etwas gewählt, das ihm gar nicht angeboten werden dürfte
(typisch: Armee-Variante gewechselt, Altauswahl bleibt liegen).

Die Reinraum-Engine (`src/evaluator/`) kennt diese Prüfung nicht: `isHidden`
ist im Bericht ein reines Capability-Flag, ein Verstoß entsteht nicht. In
Issue 0088 wurde entschieden, diese Gegenrichtung nicht im selben Lauf
umzusetzen, sondern hier zu erfassen.

Acceptance criteria:

1. Liegt im Roster eine Auswahl, deren Träger-Definition zur Auswertungszeit
   effektiv versteckt ist, enthält die Meldungsliste dafür einen
   blockierenden Verstoß.
2. Wird die Definition (etwa per Modifier) wieder sichtbar, verschwindet
   dieser Verstoß.
3. Der Verstoß benennt die betroffene Auswahl über stabile Merkmale
   (Definitions-/Link-Id), nicht über Anzeigenamen.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Abspaltung aus Issue 0088 (Decisions, 2026-07-29): die
  Wiki-Gegenrichtung gehört nicht in den Min-Unterdrückungs-Lauf.

## Log

- 2026-08-12 (real-data E2E) — **Reproduces end to end on real data.** Whole
  definitive corpus (18 books) prepared in one dataset, force "Standard (VC-AB)"
  (`e989-15b8-7eb6-9668`), unit **"Dire Wolves"** holding its own option
  **"Scouts"** (`ff2c-a7c6-4cab-b0fd`), which the catalogue declares
  `hidden="true"`. Report through the facade: slot `0/0/0` reads
  `anchorKind=occupied, isHidden=true, current=1` — the report knows the
  selection is there and knows it should not be offered — and **not one of the 5
  violations names it**. The shape is everywhere in the data: 545 elements carry
  `hidden="true"` and 1,456 modifiers write `field="hidden"` across both corpora.

- 2026-08-12 (re-check, independent probe) — **Reproduces unchanged.** A unit
  holds an option declared `hidden="true"`. Its slot reads
  `{anchorKind: "occupied", isHidden: true, current: 1}` at path `0/0` — the
  report knows the selection is there and knows it should not be offered — and
  the report carries **zero violations and zero diagnostics**.

- 2026-08-12 — Reproduced on the current tree. A unit holds an option declared
  `hidden="true"` in the roster. The report gives that slot
  `{anchorKind: "occupied", isHidden: true, current: 1}` — it knows the
  selection is there and knows it should not be offered — and reports **no**
  violation and **no** diagnostic. `isHidden` is read in exactly one direction
  today: `constraints.js:202` suppresses MIN violations at hidden carriers
  (issue 0088). The counter-direction this file asks for does not exist.

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
