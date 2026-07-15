Status: resolved
Blocked by: None

## Description
Ein generischer, wiederverwendbarer History-Hook kapselt Undo/Redo-Mechanik für
einen beliebigen State (siehe [ADR 0013](../../../adr/0013-generischer-undo-redo-hook.md)):
`{ state, setState, replace, undo, redo, canUndo, canRedo }`. `setState` legt den
bisherigen Zustand auf den Undo-Stack und leert den Redo-Stack; `replace`
aktualisiert den Zustand ohne die Historie zu verändern.

Der Roster-State-Hook nutzt diesen Hook für seinen `roster`-State statt eines
einfachen State-Mechanismus. Alle bestehenden Roster-Mutationen (Einheit
hinzufügen/entfernen/kopieren, Unter-Selektionen ändern, Roster-Name ändern)
laufen über `setState` und sind dadurch rückgängig/wiederherstellbar. Die
bestehende automatische Korrektur, die das Roster bei Inkonsistenzen mit dem
System repariert, läuft stattdessen über `replace` und erzeugt bewusst **keinen**
Undo-Schritt. Rückgängig gemachte/wiederhergestellte Zustände lösen den
bestehenden Autosave-Mechanismus aus wie jede andere Änderung.

Diese Issue liefert noch keine sichtbare UI – Verhalten wird auf Ebene des
Roster-State-Hooks verifiziert.

## Acceptance Criteria
- [ ] Ein Undo nach einer Roster-Änderung (Hinzufügen/Entfernen/Kopieren einer Einheit, Ändern einer Unter-Selektion, Ändern des Roster-Namens) stellt exakt den vorherigen Roster-Zustand wieder her
- [ ] Ein Redo nach einem Undo stellt exakt den Zustand vor dem Undo wieder her
- [ ] Eine neue Roster-Änderung nach einem Undo verwirft die vorherige Redo-Historie
- [ ] Die Historie ist unbegrenzt (keine Kappung der Anzahl Schritte innerhalb der Sitzung)
- [ ] Die automatische System-Korrektur des Rosters erzeugt keinen eigenen Undo-Schritt und ist selbst nicht per Undo rückgängig machbar
- [ ] Nach Undo/Redo wird der resultierende Roster-Zustand wie jede andere Änderung automatisch gespeichert (Autosave)
- [ ] `canUndo`/`canRedo` spiegeln korrekt wider, ob eine Historie in die jeweilige Richtung existiert

## Comments
- Generischer useReducer-basierter Hook src/hooks/useUndoableState.js (state, setState, replace, undo, redo, canUndo, canRedo) implementiert und in useRoster.js für den roster-State integriert. Alle Mutationen (addUnit/removeUnit/copyUnit/updateSubSelection/updateRosterName) laufen über setState (undoable); die automatische syncRosterSelectionsWithSystem-Korrektur läuft über replace (kein Undo-Schritt). Undo/Redo triggern den bestehenden Autosave-Mechanismus unverändert. Tests: useUndoableState.test.js (11 Tests) + neue Undo/Redo-Tests in useRoster.test.js (11 Tests). Gesamte Suite grün bis auf einen vorbestehenden, unabhängigen Fehler in PlayMode.test.jsx (React is not defined in GothicTooltip.jsx), der nicht durch diese Änderung verursacht wurde.
