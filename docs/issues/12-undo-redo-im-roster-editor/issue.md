Status: resolved
Blocked by: None

## Description
Siehe vollständiges PRD: [docs/PRD-editor-undo-redo.md](../../PRD-editor-undo-redo.md)
und die zugehörige Architekturentscheidung [ADR 0013](../../adr/0013-generischer-undo-redo-hook.md).

Kurzfassung: Der Roster-Editor erhält Undo/Redo für alle strukturellen
Roster-Änderungen (Einheiten hinzufügen/entfernen/kopieren, Optionen/Anzahl
ändern, Name ändern). Jede Aktion ist ein eigener Undo-Schritt, die Historie ist
unbegrenzt und lebt nur im Speicher der aktiven Editor-Sitzung (kein Überstehen
von Reload/Navigation). Auslösung über zwei Toolbar-Buttons, keine Tastenkürzel.
Automatische System-Korrekturen (`syncRosterSelectionsWithSystem`) erzeugen
keinen Undo-Schritt. Scope ist ausschließlich der RosterEditor, nicht der
PlayMode.

## Acceptance Criteria
- [ ] Alle in `## Description` beschriebenen User Stories/Requirements aus dem PRD sind erfüllt
- [ ] Beide Kind-Issues sind resolved

## Comments
- Beide Kinder resolved. Undo/Redo-Mechanik (useUndoableState) + Toolbar-Buttons implementiert. Tests: 361 passed, 2 skipped. Lint: 0 errors (79 pre-existing warnings).
