---
status: backlog
branch:
pr:
---

# Die Reinraum-Grenze des Schreibmodells entscheiden

## Goal

`src/domain/roster/rosterSerialization.js:6` importiert
`../evaluation/evaluationCache.js` und ruft in `exportRosterToXml` (`:100`)
`evaluateAppRoster(system, roster)` auf, um `costTotals` und `slots` für den
Summenblock des Exports zu bekommen. Damit erreicht das Schreibmodell den
Evaluator mittelbar.

Die Regel `roster-keine-evaluator-abhaengigkeit` greift nicht: Importziel ist
`domain/evaluation/`, nicht `domain/evaluator/`. Der Buchstabe ist erfüllt, die
Absicht des Reinraums (ADR-0030) nicht. Es ist die einzige Kante dieser Art im
ganzen Graphen.

Zwei Wege, und die Entscheidung gehört in einen ADR, nicht in einen stillen
Umbau:

1. **Bericht hereinreichen.** `exportRosterToXml(roster, system, report)`; der
   einzige Aufrufer ist `src/ui/hooks/useRosterList.js:206` und liegt in der
   UI-Schicht, die den Bericht ohnehin haben darf. Dann fällt die Kante, und
   eine Regel `roster-keine-evaluation-abhaengigkeit` hält sie fern.
2. **Kante ausdrücklich erlauben.** ADR-0030/0037 halten fest, dass das
   Schreibmodell den Bericht **lesen** darf, solange es nichts selbst ableitet
   — dann ist der heutige Zustand richtig und nur unbeschrieben.

Weg 1 ist der vorgeschlagene: er hält die Richtung UI → Fachlogik → Daten
sauber und kostet eine Signatur.

**Entschieden: Weg 1.** Der Bericht wird hereingereicht; AC3 entfällt damit.

## Acceptance criteria

- AC1 Die Entscheidung steht als Nachtrag zu ADR-0030 und ADR-0037 oder als eigener ADR, mit Zeile in `docs/adr/README.md`.
- AC2 Bei Weg 1: `src/domain/roster/` importiert `src/domain/evaluation/` nicht mehr, und eine depcruise-Regel `roster-keine-evaluation-abhaengigkeit` mit `severity: 'error'` hält das fest. | verify: forge-lint
- AC3 Bei Weg 2: die Regel bleibt aus, und der ADR nennt die erlaubte Kante samt Begründung, warum sie den Reinraum nicht verletzt.
- AC4 Der exportierte `.ros`-Inhalt ist für ein Roster des eingefrorenen Korpus byte-identisch zu heute — Summenblock, Selektionsnamen und Kosten inbegriffen. | verify: forge-test --run rosterSerialization
- AC5 Alle vier Wrapper sind grün.

## Out of scope

- Der Import-Weg `importRosterFromXml`: er wertet nichts aus.
- Ein Versionssprung: am Verhalten ändert sich nichts.
