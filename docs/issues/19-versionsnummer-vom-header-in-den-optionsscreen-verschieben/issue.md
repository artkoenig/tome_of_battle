Status: resolved
Type: refactor
Blocked by: None

## Description
Die App-Versionsnummer wird aktuell im Header neben dem Logo angezeigt. Sie
soll dort entfernt und stattdessen im Options-/Einstellungsscreen angezeigt
werden, damit der Header aufgeräumter wirkt. Die Versionsnummer bleibt
weiterhin für den Nutzer auffindbar, nur an anderer Stelle.

## Acceptance Criteria
- [ ] Im Header ist keine Versionsnummer mehr sichtbar.
- [ ] Im Options-/Einstellungsscreen ist die aktuelle Versionsnummer sichtbar.
- [ ] Die angezeigte Versionsnummer stimmt weiterhin mit der zur Build-Zeit
      gesetzten App-Version überein (keine hartkodierte oder falsche Version).
- [ ] Bestehende Tests für Header und Einstellungsscreen sind angepasst bzw.
      grün.

## Comments
