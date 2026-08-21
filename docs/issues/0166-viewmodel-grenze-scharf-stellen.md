---
status: done
branch: claude/new-session-065uhx
pr: 255
---

# ViewModel-Grenze scharf stellen

## Goal
Was die Issues 0162 bis 0165 aufgeräumt haben, kann nicht zurückfallen: die
ViewModel-Regeln aus ADR-0038 werden blockierend, und die Module, die durch den
Umbau ohne Aufrufer geblieben sind, verschwinden.

## Acceptance criteria
- AC1 `.dependency-cruiser.cjs` führt `viewmodel-kein-jsx`, `komponente-kein-bericht` und `viewmodel-keine-datenschicht` mit `severity: 'error'`; ein absichtlich eingefügter Verstoß lässt `forge-lint` fehlschlagen. | verify: forge-lint
- AC2 `.oxlintrc.json` verbietet `useEffect` und `useMemo` unter `src/components/**` mit derselben Testdatei-Ausnahme wie die übrigen Regeln. | verify: forge-lint
- AC3 `npm run knip` meldet keinen der beim Umbau verwaisten Helfer mehr; die verbliebenen toten Exporte aus `roster/selectionBehavior.js`, die nur noch Tests kennen, sind samt ihren Tests gelöscht. | verify: forge-lint
- AC4 `.claude/rules/areas/ui.md` beschreibt das Muster: ViewModel neben UI, welche Hooks wo erlaubt sind, und dass eine neue Komponente ohne ViewModel-Paar eine unvollständige Änderung ist. | verify: forge-lint
- AC5 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Neue ViewModels.
- Die Kostenanzeige-Doppelung — Issue 0158.
- Ein Versionssprung.
