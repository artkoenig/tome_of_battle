Status: needs-triage
Type: refactor
Blocked by: None

## Description

Herkunft: Standards-Review (Achse A) zu Issue 35.

**Geruch (Data Clump / Shotgun Surgery):** Dieselbe Gruppe von ~10 Werten reist
gemeinsam an jede Editor-Kindkomponente — `system`, `activeCatalogue`, `roster`,
`force`, `costTypeLabel`, `costLimitType`, `selectionCounts`, `addUnit`,
`removeUnit`, `updateSubSelection`, `onShowRule`. In `RosterEditor.jsx` taucht
dieses Bündel viermal auf (an `CategoryUnitAdder`, `ListRuleChecklist` und zwei
`UnitSelectionCard`-Aufrufe). Kommt ein Wert hinzu, muss er an jeder Aufrufstelle
einzeln eingefädelt werden.

**Empfohlene Behebung:** Das Bündel als ein benanntes Konzept fassen — ein
`editorContext`-Objekt oder ein echtes React-`Context`
(`<EditorProvider>` + `useEditorContext()`), das die Kinder sich selbst holen,
statt es Feld für Feld durchzureichen.

**Blast-Radius (bewusst als eigenes Issue abgetrennt):** betrifft `RosterEditor.jsx`,
`UnitSelectionCard.jsx`, `CategoryUnitAdder.jsx`, `SelectionConfigurator.jsx`,
`ListRuleChecklist.jsx` — editorweit, unabhängig von den Listenregeln.
Vorbestehendes Muster; nicht durch Issue 35 verursacht, dort nur fortgeführt.

## Acceptance Criteria
- [ ]

## Comments
