---
status: backlog
branch:
pr:
---

# Restarbeiten an der Schichtgrenze

## Goal

Drei Kleinigkeiten, die nach dem Schichtungsumbau (0161–0172) offen blieben.
Einzeln zu klein für einen Vorgang, zusammen eine Sitzung.

**1. Die letzte warnende ADR-0037-Regel.** `daten-kein-rueckgriff` steht als
einzige der vier neuen Schichtregeln noch auf `severity: 'warn'`. Der Graph hat
null Befunde dazu — das Scharfstellen kostet nichts und verhindert den Rückfall.

**2. Ein irreführender Regelname.** `viewmodel-kein-jsx` verbietet dem ViewModel
den Import von Komponenten, nicht die Dateiendung. `rosterContexts.jsx` liegt
zulässig unter `src/ui/viewmodels/` und liest sich trotzdem wie ein Verstoß. Der
Name soll sagen, was die Regel prüft.

**3. Drei ViewModels ohne eigenen Test.** `capabilityEntries.js`,
`useBottomSheet.js` und `useRulesIndexDialog.js` sind die einzigen der Schicht
ohne Testdatei daneben; die übrigen 20 haben eine.

## Acceptance criteria

- AC1 `daten-kein-rueckgriff` hat `severity: 'error'`, und `forge-lint` bleibt grün. | verify: forge-lint
- AC2 Die Regel `viewmodel-kein-jsx` heißt nach dem, was sie prüft, und ihr Kommentar nennt ausdrücklich, dass die Dateiendung nicht gemeint ist. | verify: forge-lint
- AC3 `capabilityEntries.js`, `useBottomSheet.js` und `useRulesIndexDialog.js` haben je eine Testdatei neben sich. | verify: forge-test --run src/ui/viewmodels
- AC4 Jede Datei unter `src/ui/viewmodels/` hat eine Testdatei neben sich — die Schicht ist lückenlos. | verify: test -z "$(find src/ui/viewmodels -name '*.js*' ! -name '*.test.*' | while read f; do b="${f%.*}"; ls "$b".test.js >/dev/null 2>&1 || ls "$b".test.jsx >/dev/null 2>&1 || echo "$f"; done)"
- AC5 Alle vier Wrapper sind grün.

## Out of scope

- Neue Schichtregeln: ADR-0037 bleibt inhaltlich, wie er ist.
- Ein Versionssprung: nichts davon ist für den Nutzer sichtbar.
