Status: resolved
Type: fix
Blocked by: None

## Description
Die Mouseover Popups (Tooltips für Vials und Quality Gates) auf der Status-Seite (`docs/status/index.html` via `scripts/project-state/renderReport.js`) sollen so angepasst werden, dass die Schlüssel-Wert-Paare einspaltig und ohne Zeilenumbrüche dargestellt werden (`white-space: nowrap`, einspaltig und flexible Breite `width: max-content`).

## Acceptance Criteria
- [ ] Tooltip-Inhalte (Vials und Quality Gates) werden einspaltig dargestellt.
- [ ] Inschriften / Textzeilen brechen nicht um (`white-space: nowrap`).
- [ ] Tooltip-Breite passt sich dynamisch dem einspaltigen Inhalt an.
- [ ] `npm test` und `node scripts/project-state/generate.js` laufen fehlerfrei durch.

## Comments

