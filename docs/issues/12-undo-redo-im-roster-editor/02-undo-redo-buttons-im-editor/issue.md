Status: ready-for-agent
Blocked by: [01]

## Description
Der Roster-Editor erhält zwei Buttons in der Toolbar (Undo und Redo), die die in
[Issue 01](../01-undo-redo-mechanik-f-r-den-roster-state/issue.md) bereitgestellte
Mechanik auslösen. Jeder Button ist deaktiviert, wenn in die jeweilige Richtung
keine Historie verfügbar ist (kein Undo möglich bzw. kein Redo möglich). Die
Buttons sind auch auf Touch-/Mobilgeräten bedienbar (PWA). Tastenkürzel sind
nicht Teil dieser Issue.

## Acceptance Criteria
- [ ] Undo- und Redo-Button sind in der Editor-Toolbar sichtbar
- [ ] Direkt nach dem Öffnen eines Rosters (keine Änderung vorgenommen) sind beide Buttons deaktiviert
- [ ] Nach einer Roster-Änderung ist der Undo-Button aktiviert, der Redo-Button weiterhin deaktiviert
- [ ] Klick auf Undo macht die letzte Änderung sichtbar rückgängig und aktiviert den Redo-Button
- [ ] Klick auf Redo stellt die Änderung sichtbar wieder her
- [ ] Ist keine weitere Undo-Historie vorhanden, ist der Undo-Button wieder deaktiviert (analog für Redo)

## Comments
