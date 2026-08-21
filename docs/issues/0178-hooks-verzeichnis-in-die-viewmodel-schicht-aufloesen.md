---
status: active
branch: claude/issues-letzter-pr-ma1b62
pr:
---

# Das hooks-Verzeichnis in die ViewModel-Schicht auflösen

## Goal

Nach dem Schichtungsumbau (0161–0172) und dem Abtragen der `useRoster`-Attrappe
(0175) steht `src/ui/hooks/` als letztes Verzeichnis der Oberfläche neben
`src/ui/viewmodels/`, ohne dass die Trennung eine Bedeutung trägt. ADR-0037
kennt drei Schichten — UI, Fachlogik, Daten — und nennt `src/ui/hooks/` nur in
einer Fußnote: der Kommentar in `.dependency-cruiser.cjs` hält ausdrücklich
fest, dass das Verzeichnis „in der ADR-Tabelle nicht eigens steht, aber zur UI
gehört". Zwei Verzeichnisse für eine Schicht sind eine Grenze, die niemand
prüfen kann.

Was übrig ist, sind zehn Module:

```
241  useRosterList.js       <- ui/App.jsx
163  useAppData.js          <- ui/App.jsx
 96  usePwaLifecycle.js     <- ui/App.jsx
 95  usePlayState.js        <- ui/viewmodels/usePlayRoster.js
 71  useUndoableState.js    <- ui/viewmodels/useRosterState.js
 68  useViewportHeight.js   <- ui/App.jsx
 65  useAppNavigation.js    <- ui/App.jsx
 40  useToast.js            <- ui/App.jsx
 32  persistenceFailure.js  <- ui/hooks/usePlayState.js, ui/viewmodels/useRosterState.js
 21  useRuleUrl.js          <- ui/components/editor/{UnitChips,RuleChipIcon}.jsx,
                                ui/viewmodels/{useRosterEditor,usePlayRoster}.js
```

Vier davon werden schon heute ausschließlich aus `src/ui/viewmodels/` heraus
benutzt — sie liegen im falschen Verzeichnis. Der Rest hängt an `App.jsx` und
ist damit genau das, was die Schicht beschreibt: Ableitung und Zustandsführung
für eine Komponente. Dass `useBottomSheet.js` — reine Bedienmechanik ohne jede
Fachlogik — bereits unter `src/ui/viewmodels/` liegt, ist der Präzedenzfall:
die Schicht nimmt auch das Kleine auf.

Wo ein Modul nur einen Nutzer hat und für sich genommen nichts aussagt, wird es
mit ihm zusammengelegt statt umgezogen. Kandidaten sind `useUndoableState` in
`useRosterState` und `persistenceFailure` in seine beiden Nutzer; ob das trägt,
entscheidet die Umsetzung an der Datei — mit einem Modul unter 300 Zeilen als
Grenze (Issue 0176) und einer eigenen Testdatei daneben (Issue 0177) als
Bedingung. Ein Zusammenlegen, das eine Datei über 300 Zeilen treibt oder eine
Testaussage verliert, findet nicht statt: dann wird umgezogen.

`src/ui/hooks/CLAUDE.md` beschreibt die Testkonventionen des Verzeichnisses
(englische Testtitel, der Produktionsnaht-Aufbau mit echtem Katalog-XML). Diese
Konventionen gelten weiter und gehören in die Suite-Doku des Zielverzeichnisses,
nicht in den Papierkorb.

## Acceptance criteria

- AC1 `src/ui/hooks/` existiert nicht mehr. | verify: ! test -e src/ui/hooks
- AC2 Keine Datei verweist noch auf den alten Pfad — weder im Code noch in Doku, ADR oder depcruise-Konfiguration. | verify: ! grep -rq 'ui/hooks' src docs .dependency-cruiser.cjs .claude
- AC3 Jedes verbliebene Modul liegt unter `src/ui/viewmodels/` und hat eine Testdatei neben sich; keine Datei der Schicht ist länger als 300 Zeilen. | verify: forge-test --run src/ui/viewmodels
- AC4 Die Testkonventionen aus `src/ui/hooks/CLAUDE.md` stehen in der Suite-Doku von `src/ui/viewmodels/`; die Area-Notiz `.claude/rules/areas/viewmodels.md` nennt keinen `hooks`-Pfad mehr.
- AC5 Die Zahl der grünen Tests sinkt nicht, und keine Testaussage entfällt beim Zusammenlegen. | verify: forge-test
- AC6 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope

- Inhaltliche Änderungen an den Modulen: dies ist ein Umzug mit Zusammenlegungen, keine Umschreibung. Undo-Verhalten, Autosave-Verzögerung und PWA-Lebenszyklus bleiben, wie sie sind.
- Die Direktkanten von `useAppData` und `useRosterList` nach `src/data/db/` — sie sind Gegenstand der Datenfassade (Issue 0167), nicht dieses Umzugs.
- Neue Schichtregeln über die aus ADR-0037 hinaus.
- Ein Versionssprung: der Nutzer sieht keinen Unterschied.
