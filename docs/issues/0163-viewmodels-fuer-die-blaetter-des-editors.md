---
status: done
branch: claude/new-session-065uhx
pr: 255
---

# ViewModels für die Blätter des Editors

## Goal
Die vier am tiefsten durchgereichten Bausteine bekommen ihr ViewModel nach
ADR-0038. Damit endet die Durchreichung von `capabilities` (heute 14 Dateien) und
`pathBySelectionId` (11 Dateien) an ihrem Ursprung — die Blätter holen sich, was
sie anzeigen, selbst aus dem Bericht.

## Acceptance criteria
- AC1 `src/viewmodels/editor/` enthält `useUnitCard`, `useOptionGroup`, `useSelectionConfigurator` und `useUnitChips`, jedes mit eigener `renderHook`-Testdatei. | verify: forge-test --run src/viewmodels
- AC2 `capabilities` und `pathBySelectionId` kommen in `UnitSelectionCard.jsx`, `OptionGroup.jsx`, `SelectionConfigurator.jsx` und `UnitChips.jsx` weder als Prop noch als Import vor. | verify: forge-lint
- AC3 `OptionGroup` hat höchstens 8 Props (heute 22), `UnitSelectionCard` höchstens 6 (heute 15), `SelectionConfigurator` höchstens 6 (heute 13). | verify: forge-test --run src/components
- AC4 `editor/unitCardValidation.js` und `editor/optionNesting.js` sind in ihren ViewModels aufgegangen; nichts importiert sie mehr, und die Dateien sind gelöscht. | verify: forge-lint
- AC5 Der namensbasierte Regel-Lookup `getOptionDescription` in `SelectionConfigurator.jsx` entfällt ersatzlos; die Beschreibung kommt aus `capability.infoElements` (ADR-0034). Ein Test hält fest, dass zwei gleichnamige Regeln aus verschiedenen Katalogen nicht mehr verwechselt werden. | verify: forge-test --run src/viewmodels
- AC6 Was auf dem Bildschirm steht, ist unverändert: die vorhandenen Komponententests laufen ohne inhaltliche Anpassung ihrer Erwartungen. | verify: forge-test --run src/components
- AC7 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Die Sektionen und Hüllen — Issues 0164 und 0165.
- Das Scharfstellen der Regeln — Issue 0166.
- Ein Versionssprung: die Anzeige ändert sich nicht.
