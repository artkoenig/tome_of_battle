---
status: active
branch: claude/new-session-065uhx
pr:
---

# ViewModels für die Sektionen des Editors

## Goal
Die Sektionsebene folgt dem Muster: Kontingent, Kategorie, Aushebe-Angebot,
Listenregel-Checkliste, Auffüll-Vorschläge, Seitenleiste und Prüf-Panel rechnen
nicht mehr im Render, sondern in einem ViewModel. Das Aushebe-Angebot, heute in
einer Map-Schleife in `CategoryUnitAdder` aufgebaut, wird dabei zum ersten Mal für
sich testbar.

## Acceptance criteria
- AC1 `src/viewmodels/editor/` enthält `useForceSection`, `useCategorySection`, `useRecruitOffer`, `useListRuleChecklist`, `useAutoFillSuggestions`, `useRosterSidebar` und `useValidationPanel`, jedes mit eigener `renderHook`-Testdatei. | verify: forge-test --run src/viewmodels
- AC2 `CategoryUnitAdder.jsx` enthält keine Ableitung mehr: kein Filtern, kein Sortieren, kein Auflösen eines Katalog-Eintrags im Render — es bildet eine fertige Liste auf Markup ab. | verify: forge-test --run src/components
- AC3 `ForceEditorSection` hat höchstens 6 Props (heute 20), `RosterCategorySection` höchstens 6 (heute 18), `ListRuleChecklist` höchstens 5 (heute 15). | verify: forge-test --run src/components
- AC4 `editor/costBudgets.js` ist in `useRosterSidebar` aufgegangen und gelöscht; `evaluation/listRuleGroups.js`, `armyWideSelectorSlots.js` und `violationStats.js` werden nur noch aus ViewModels aufgerufen, nicht mehr aus Komponenten. | verify: forge-lint
- AC5 Die Sichtbarkeitsregel einer Kategorie-Sektion (beide Bericht-Antworten am Kontingent-Slot, siehe `.claude/rules/areas/ui.md`) liegt in `useCategorySection` und ist dort direkt getestet — auch der Fall „versteckter Anker, nichts ausgewählt". | verify: forge-test --run src/viewmodels
- AC6 Was auf dem Bildschirm steht, ist unverändert. | verify: forge-test --run src/components
- AC7 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Die Hüllen — Issue 0165.
- Der Schreibpfad: `useRoster`-Kommandos bleiben, wie Issue 0162 sie hinterlässt.
- Ein Versionssprung.
