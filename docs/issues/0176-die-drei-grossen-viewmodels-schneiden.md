---
status: backlog
branch:
pr:
---

# Die drei großen ViewModels schneiden

## Goal

Die ViewModel-Schicht hat die Komponenten entlastet — die Komponenten-Schicht
schrumpfte von 5796 auf 3450 Zeilen —, aber ein Teil der Last ist nur gewandert.
Drei Dateien tragen 36 % der Schicht:

```
515  viewmodels/editor/useSelectionConfigurator.js
463  viewmodels/useRosterState.js
415  viewmodels/useImporter.js
```

`useSelectionConfigurator` ist damit fast so groß wie die Komponente, die er
entlastet hat (vorher 599 Zeilen). Ein ViewModel, das man nicht am Stück liest,
verschiebt das Problem, statt es zu lösen.

Die Schnitte sind absehbar:

- `useSelectionConfigurator` bündelt mindestens drei Fragen — die Profil-Tabellen
  (`:169`), die Rollen-Gruppen (`:290`) und die Kostenanzeige (`:192`). Jede
  davon ist ein eigenes, testbares Stück.
- `useRosterState` mischt Zustandsführung (Undo, Autosave, Katalog-Abgleich) mit
  den Schreib-Kommandos. Die Kommandos hängen nur am Bericht und am Roster, nicht
  am Zustandsapparat.
- `useImporter` führt den Import-Ablauf und die Anzeige seiner Zwischenstände.

## Acceptance criteria

- AC1 Keine Datei unter `src/ui/viewmodels/` ist länger als 300 Zeilen. | verify: test -z "$(find src/ui/viewmodels -name '*.js*' ! -name '*.test.*' -exec wc -l {} + | awk '$2!="total" && $1>300{print $2}')"
- AC2 Jedes neu entstandene Modul hat eine eigene Testdatei neben sich. | verify: forge-test --run src/ui/viewmodels
- AC3 Die Props der zugehörigen Komponenten ändern sich nicht; kein Bericht-Feld wandert zurück in die Komponenten-Schicht. | verify: forge-lint
- AC4 Anzeige und Verhalten sind unverändert — dieselben Testaussagen, nur neu verteilt; die Zahl der grünen Tests sinkt nicht. | verify: forge-test
- AC5 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope

- Neue Ableitungen oder Anzeigefelder: dies ist ein reiner Schnitt.
- `useRosterState`s Undo-Verhalten und die 150-ms-Autosave-Verzögerung bleiben, wie sie sind.
- Ein Versionssprung: der Nutzer sieht keinen Unterschied.
