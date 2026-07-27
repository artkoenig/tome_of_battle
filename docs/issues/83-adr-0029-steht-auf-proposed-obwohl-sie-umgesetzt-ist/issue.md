Status: needs-triage
Type: chore
Blocked by: None

## Description

ADR-0029 („Zentrale Query-Engine fuer Constraint-, Condition- und
Repeat-Auswertung") traegt den Status **Proposed** — sowohl im Kopf der ADR als
auch in der Zeile des Index `docs/adr/README.md`. Umgesetzt ist sie aber
laengst: Main-Issue 63 traegt genau diesen Titel, steht auf `resolved` und ist
als PR #125 auf `main` gelandet. Eine umgesetzte Entscheidung, die als blosser
Vorschlag ausgewiesen ist, verkehrt den Zweck des Statusfeldes: wer den Index
liest, haelt eine geltende Architekturregel fuer unverbindlich.

Erschwerend kommt hinzu, dass zwei spaetere ADRs den Bezugsrahmen dieser
Entscheidung verschoben haben, ohne dass ihr Status nachgezogen wurde:

- ADR-0022, die ADR-0029 ausdruecklich fortschreibt, ist inzwischen selbst
  `Superseded (0035)`.
- ADR-0030 hat den Ersatz der Engine beschlossen, in der die Query-Engine aus
  ADR-0029 lebt (`src/solver/`), und grenzt sich von ADR-0029 ab, ohne sie
  aufzuheben.

Zu klaeren ist deshalb nicht nur das Statusfeld, sondern welchen Status die
Entscheidung heute wirklich hat: umgesetzt und geltend, oder umgesetzt und
durch die Ersatz-Entscheidung ueberholt. Die Antwort gehoert an die ADRs, nicht
an eine Annahme — und sie beruehrt eine Architekturaussage, weshalb dieses
Issue auf `needs-triage` steht statt sofort umgesetzt zu werden.

## Acceptance Criteria
- [ ] Der Status von ADR-0029 ist aus der Historie belegt und begruendet festgelegt (umgesetzt/geltend gegenueber umgesetzt/ueberholt).
- [ ] Kopf der ADR und Zeile im Index `docs/adr/README.md` nennen denselben Status.
- [ ] Das Verhaeltnis zu ADR-0030 und zum Cutover ist in der ADR benannt, sodass ein Leser nicht raten muss, ob die Regel den Cutover ueberlebt.

## Decisions
- `[po]` Gefunden bei der Cutover-Recherche zu Issue 64. Nicht als trivialer Change nebenbei mitgenommen, weil zwei Dateien betroffen sind (die ADR und der Index docs/adr/README.md) und das Praedikat aus scripts/git_workflow_rules.py genau eine Datei verlangt. Dient keinem Akzeptanzkriterium des laufenden Main-Issues 81, daher neues Main-Issue auf needs-triage statt Child-Issue.

## Comments
