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
