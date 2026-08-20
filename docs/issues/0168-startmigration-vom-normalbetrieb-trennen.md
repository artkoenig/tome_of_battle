---
status: backlog
branch:
pr:
---

# Startmigration vom Normalbetrieb trennen

## Goal
Ein Navigationsklick parst keine Kataloge mehr. Heute ruft `App.jsx` an fünf
Stellen `loadAllData()`, und `db/migrations.js` führt `reprocessStoredSystem`
ohne jeden Versionsmarker aus — ein vollständiger Neu-Parse aller gespeicherten
Kataloge im Dauerbetrieb, der zugleich die identitätsbasierte Auswertungs-Cache
entwertet.

## Acceptance criteria
- AC1 Ein gespeichertes System trägt den Parser-Stand, mit dem es erzeugt wurde; `reprocessStoredSystem` läuft nur, wenn dieser Stand vom aktuellen abweicht. | verify: forge-test --run src/db
- AC2 Die DB-Migration, die den Marker nachträgt, folgt ADR-0002 und ist für ein System ohne Marker getestet — es wird genau einmal neu geparst, danach nie wieder. | verify: forge-test --run src/db
- AC3 Startlauf und Wiedereintritt sind getrennte Aufrufe; ein Wechsel zwischen zwei Ansichten löst keinen Katalog-Neu-Parse und keine Neu-Auswertung aus. Ein Test zählt die Parse-Aufrufe über einen Ansichtswechsel: null. | verify: forge-test --run src/components
- AC4 Der Auswertungs-Cache trifft über einen Ansichtswechsel hinweg: derselbe Bericht, dieselbe Objektidentität. | verify: forge-test --run src/evaluation
- AC5 Ein Katalog-Abgleich im Hintergrund funktioniert unverändert und aktualisiert die Anzeige weiterhin. | verify: forge-test --run src/services
- AC6 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope
- Die Form der persistierten Daten jenseits des Markers.
- Ein Versionssprung: **Patch** — der Ansichtswechsel wird für Benutzer spürbar schneller.
