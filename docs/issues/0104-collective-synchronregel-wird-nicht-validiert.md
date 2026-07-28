---
status: backlog
branch:
pr:
---

# `collective`-Synchronregel wird nicht validiert

## Intent

Das BSData-Wiki (*Collective Entries*, Punkt 2) macht aus `collective` neben
der Darstellungsfunktion eine **Validierungsregel**: Eltern-Einträge, die
sich einen gemeinsamen Elternknoten teilen, müssen bei einem
`collective`-Kind konsistente Auswahlen haben — „The parent of a collective
entry must always have the same number of selections of that entry as all
other instances" (Beispiel im Wiki: wählt ein Ninja des Trupps die Climbing
Claws, müssen alle Ninjas sie nehmen).

Die Projekt-Doku (`battlescribe-data-format.md` §10) deckt bewusst nur den
Mathematik-Schnitt („`collective` beeinflusst nur die *Darstellung*
gestapelter Instanzen — die Kosten- und Constraint-Mathematik läuft immer
durch") — über die Synchron-Prüfung sagt sie nichts. Die Engine liest
`collective` gar nicht (kein Vorkommen in `src/evaluator/`, nur in den
Fixtures, z. B. `Mercenaries.cat` mit `collective="true"`); zwei
Geschwister-Instanzen mit abweichender Wahl eines `collective`-Kindes
erzeugen keinerlei Befund.

Ausgang offen: entweder die Engine prüft die Synchronregel (Verstoß bzw.
Befund bei Divergenz), oder der Verzicht wird in §10 als bewusster Schnitt
dokumentiert — der jetzige stille Zustand ist der Fehler. Das Attribut-Lesen
selbst gehört zu Issue 0102 (Punkt 4).

Acceptance criteria:

1. Die Entscheidung „prüfen oder dokumentierter Verzicht" ist gefallen und
   mit Quelle im Issue festgehalten.
2. Bei „prüfen": zwei Instanzen mit gemeinsamem Elternknoten und
   abweichender Auswahl eines `collective`-Kindes erzeugen einen Befund im
   Bericht; konsistente Auswahlen erzeugen keinen (je ein Testfall).
3. Bei „Verzicht": `battlescribe-data-format.md` §10 benennt die
   Synchronregel des Wikis und den Verzicht ausdrücklich; dieses Issue wird
   mit dieser Begründung geschlossen.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); zunächst als Punkt 4 in Issue 0102 mitgeführt, auf
  Wunsch des Menschen als eigenständiges Issue herausgelöst (2026-07-28).

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
