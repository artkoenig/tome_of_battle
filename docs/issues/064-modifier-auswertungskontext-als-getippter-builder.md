---
status: backlog
branch:
pr:
---

# Modifier-Auswertungskontext als getippten Builder auflösen

## Intent

Der flache Kontext der Modifier-Auswertung —
`{ roster, system, selectionCounts, forceCategoryCounts, selection,
parentSelection, force, counts, parentCatalogueId }` — ist ein Datenklumpen.
Er wird an rund neun Stellen von Hand zusammengebaut, mit über die Aufrufer
driftenden Feldern, unter anderem in `rosterValidator.js` (mehrere
Constraint-Kontexte), `profileCollector.js` (`makeCtx`), `rosterCounter.js` und
`hooks/useRoster.js`. Für diese Form gibt es weder einen Typ noch einen
Builder, obwohl `QueryContext` und `EvaluationContext` für die angrenzenden
Kern-Belange bereits existieren.

Dazu kommt eine doppelte Durchreichung: `profileCollector.makeCtx` gibt seit
dem B1-Fix sowohl `counts` als auch dessen vorab extrahierte Scheiben
(`selectionCounts`, `forceCategoryCounts`) weiter — dieselben Zahlen zweimal.
Das ist nur nötig, solange ältere Flach-Feld-Leser neben dem Kern existieren,
der `counts` liest.

Gewünschtes Ergebnis: ein einziger getippter Kontext für die
Modifier-Auswertung, den alle Leser benutzen, sodass die doppelte
Durchreichung entfällt. Reiner Strukturwandel — kein Verhalten ändert sich.

Acceptance criteria:

1. Es gibt genau einen getippten Builder für den flachen
   Modifier-Auswertungskontext, und die rund neun hand-gebauten Aufbaustellen
   benutzen ihn.
2. `counts` und seine vorab extrahierten Scheiben werden nicht mehr doppelt im
   selben Kontext geführt — ein Leser-Vertrag, nicht zwei.
3. Kein Verhaltenswechsel: die Suite und die E2E-Tests bleiben grün, jeweils
   mit Kommando, Umfang und Exit-Code belegt.

## Plan

## Tasks

## Decisions

- Aus dem alten Tracker übernommen
  (`docs/issues/64-modifier-auswertungs-kontext-als-getippter-builder-datenklumpen-aufl-sen/issue.md`,
  Status `needs-triage`). Inhaltlich unverändert.
- **Herkunft:** Aufgetaucht im Gate-Review von Alt-Issue 63 (Standards-Befund
  A4 plus ein Nitpick nach den Review-Fixes). Dort bewusst zurückgestellt, um
  den Umfang der Scope-Vereinheitlichung nicht zu sprengen.

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
