---
status: active
branch: claude/issues-letzter-pr-ma1b62
pr:
---

# Die useRoster-Attrappe abtragen

## Goal

`src/ui/hooks/useRoster.js` ist seit Issue 0162 nur noch eine Umhüllung: 51
Zeilen, die das Ergebnis von `useRosterState` flachklopfen — `report.violations`
zu `violations`, `commands.addUnit` zu `addUnit` und so fort.

Produktivnutzer: **keiner.** Importiert wird sie von genau sechs Testdateien
(`useRoster.test.js`, `.evaluator`, `.mandatoryAutoAdd`, `.costedMandatoryAutoAdd`,
`.nestedMandatoryGroups`, `.recruitCostAgreement`). `npm run knip` sieht das
nicht, weil Tests als Nutzer zählen — dieselbe Blindstelle, die Issue 0169 schon
einmal aufgeräumt hat.

Die Tests selbst sind wertvoll: sie halten das Pflicht-Auto-Hinzufügen und die
Übereinstimmung von Aushebe-Preis und angelegtem Baum fest. Sie wandern auf
`useRosterState`, die Attrappe fällt.

## Acceptance criteria

- AC1 `src/ui/hooks/useRoster.js` existiert nicht mehr. | verify: ! test -e src/ui/hooks/useRoster.js
- AC2 Die sechs Testdateien prüfen dieselben Aussagen gegen `useRosterState` und liegen neben ihm. | verify: forge-test --run useRosterState
- AC3 Keine Datei importiert das Modul mehr. | verify: ! grep -rqE "useRoster['\"]" src
- AC4 Die Zahl der grünen Tests sinkt nicht. | verify: forge-test
- AC5 Alle vier Wrapper sind grün.

## Out of scope

- `useRosterList.js` und `useRosterState.js` selbst — beide haben Produktivnutzer.
- Ein Versionssprung: Aufräumarbeit ohne Freigabegrund.
