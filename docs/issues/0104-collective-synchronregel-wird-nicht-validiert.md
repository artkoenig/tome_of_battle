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

Die Projekt-Doku (`battlescribe-data-format.md` §10) beschreibt die
Synchronfunktion selbst durchaus (Funktion 2 „Synchronisierte Auswahl",
inkl. Ninja-Beispiel und Kaskaden-Warnung); ob die Engine sie **prüfen**
muss, sagt sie aber nicht — ihr Auswertungs-Kasten („`collective`
beeinflusst nur die *Darstellung* gestapelter Instanzen — die Kosten- und
Constraint-Mathematik läuft immer durch") deckt allein den
Mathematik-Schnitt. Die Engine liest
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
- **Entscheidung „prüfen" (2026-07-29, Quelle: Mensch + BSData-Wiki):** Der
  Mensch hat verfügt, dass die BSData-Doku höchste Priorität hat. Das
  BSData-Wiki (*Collective Entries*) formuliert die Synchronregel als Regel:
  „The parent of a collective entry must always have the same number of
  selections of that entry as all other instances of that parent entry who
  share a common parent." Damit fällt die Entscheidung auf **prüfen**
  (Befund bei Divergenz), nicht auf dokumentierten Verzicht. Voraussetzung:
  das `collective`-Attribut wird gelesen (Issue 0102 Punkt 4) — 0102 läuft
  deshalb vor diesem Issue.

## Log

- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  Intent korrigiert — §10 beschreibt die Synchronfunktion des Wikis bereits
  (Funktion 2), es fehlt nur die Aussage zur Prüfpflicht. Zudem eingeordnet:
  das Wiki rahmt `collective` als zwei „behaviours" des Referenzprogramms
  (Auto-Synchronisation), das Wort „Validierung" fällt dort nicht — ob
  Divergenz ein Verstoß ist oder durch Sync verhindert wird, lässt die
  Quelle offen. Die „prüfen"-Entscheidung in Decisions bleibt davon
  unberührt (normativer Wortlaut „must always have").

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
