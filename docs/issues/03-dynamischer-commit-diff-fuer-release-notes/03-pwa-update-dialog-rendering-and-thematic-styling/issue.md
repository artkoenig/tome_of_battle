Status: resolved
Blocked by: 02

## Description
Passt die UI des PWA-Update-Dialogs (`.update-toast` in `App.jsx`) an, um die gefilterte Änderungsliste unter dem neuen, thematisch passenden Titel anzuzeigen.

## Acceptance Criteria
- [ ] Der Titel im Update-Dialog (`.update-toast-title`) wird statisch auf "Chronik der Veränderungen" geändert.
- [ ] Der Update-Dialog ruft die gefilterten Änderungen via `getDiffChanges` ab und stellt sie als Liste dar.
- [ ] Wenn keine Änderungen vorhanden sind oder der Aufruf fehlschlägt, greift der Standard-Fallback-Text.
- [ ] Die UI-Darstellung wird überprüft und funktioniert sowohl im Desktop- als auch im mobilen Layout korrekt.

## Comments
