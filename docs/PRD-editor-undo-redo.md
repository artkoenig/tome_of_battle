# PRD: Undo/Redo im Roster-Editor

## Problem Statement

Im `RosterEditor` (Zusammenstellung der Armeeliste) sind alle Änderungen sofort und unwiderruflich wirksam – jede hinzugefügte/entfernte/kopierte Einheit, jede Options- oder Anzahländerung wird per Autosave (150ms debounced, siehe [ADR 0002](adr/0002-data-flow-and-indexeddb-storage.md)) direkt in IndexedDB geschrieben. Es gibt keine Möglichkeit, eine versehentliche Änderung rückgängig zu machen, außer die Änderung manuell zu invertieren. Das erhöht das Risiko von Frustration und Datenverlust bei Fehlbedienung, insbesondere bei destruktiven Aktionen wie dem Entfernen einer Einheit.

## Solution

Der `RosterEditor` erhält eine klassische Undo/Redo-Funktion für alle strukturellen Änderungen am Roster (Einheiten hinzufügen/entfernen/kopieren, Optionen/Anzahl ändern, Name ändern). Jede einzelne Nutzeraktion erzeugt genau einen Undo-Schritt (kein Zusammenfassen schnell aufeinanderfolgender Aktionen). Die Historie ist unbegrenzt und lebt ausschließlich im Speicher der aktiven Editor-Sitzung – sie überdauert weder einen Seiten-Reload noch das Verlassen des Editors. Zwei Buttons in der Editor-Toolbar lösen Undo/Redo aus; Tastenkürzel sind nicht Teil dieses Umfangs.

Die Undo-Mechanik wird als generischer, wiederverwendbarer Hook implementiert (siehe [ADR 0013](adr/0013-generischer-undo-redo-hook.md)), den `useRoster.js` für seinen `roster`-State nutzt.

## User Stories / Requirements

1. **Als Nutzer** möchte ich **eine versehentliche Änderung am Roster rückgängig machen können**, damit ich Fehlbedienungen (z.B. falsches Entfernen einer Einheit) ohne manuellen Aufwand korrigieren kann.
2. **Als Nutzer** möchte ich **eine rückgängig gemachte Änderung wiederherstellen können (Redo)**, falls ich mich beim Undo geirrt habe.
3. **Als Nutzer** möchte ich **Undo/Redo über Buttons in der Toolbar auslösen**, die erkennbar deaktiviert sind, wenn keine Aktion verfügbar ist – konsistent zur Touch-/Mobile-Bedienbarkeit der App (PWA).
4. **Als Nutzer** erwarte ich, dass **jede einzelne Aktion (z.B. jeder Klick auf "+") ein eigener Undo-Schritt ist**, damit das Verhalten vorhersehbar bleibt.
5. **Als Nutzer** erwarte ich, dass **automatische System-Korrekturen** (z.B. Bereinigung nach einem Katalog-Update) **nicht** Teil der Undo-Historie sind, damit ich nicht versehentlich eine notwendige Datenkorrektur rückgängig mache und einen inkonsistenten Zustand herstelle.
6. **Als Nutzer** erwarte ich, dass **rückgängig gemachte/wiederhergestellte Zustände wie jede andere Änderung automatisch gespeichert werden** (bestehender Autosave-Mechanismus), damit der IndexedDB-Stand konsistent mit dem sichtbaren Zustand bleibt.

## Technical Decisions

- **Affected Modules:**
  - `src/hooks/useUndoableState.js` *(neu)* – generischer History-Stack-Hook.
  - `src/hooks/useRoster.js` – nutzt `useUndoableState` für den `roster`-State; exponiert `undo`, `redo`, `canUndo`, `canRedo`.
  - `src/components/RosterEditor.jsx` – neue Undo/Redo-Buttons in der Toolbar.

- **Technical Clarifications / Architectural Decisions:**
  - Siehe [ADR 0013](adr/0013-generischer-undo-redo-hook.md) für die Entscheidung, die History-Mechanik in einem generischen Hook statt inline in `useRoster.js` zu kapseln.
  - Die automatische Korrektur durch `syncRosterSelectionsWithSystem` (bestehender Effekt in `useRoster.js`) darf keinen Undo-Schritt erzeugen; sie ersetzt den aktuellen Stand ohne Historieneintrag.
  - Eine neue Nutzeraktion nach einem Undo verwirft die verworfene Redo-Historie (Standardverhalten, kein separates Requirement).
  - Die aktuell ausgewählte Selektion (`selectedSelectionId`) ist kein Teil der Undo-Historie; sie bleibt UI-Session-State und wird weiterhin per ID aus dem jeweils aktuellen Roster-Baum abgeleitet (bestehendes Muster, siehe [ADR 0002](adr/0002-data-flow-and-indexeddb-storage.md), Punkt 7). Existiert die ausgewählte ID im wiederhergestellten Zustand nicht mehr, wird analog zum bestehenden Verhalten keine Selektion angezeigt.
  - Scope ist ausschließlich der `RosterEditor` (Listen-Bearbeitung). Der `PlayMode` (Spielansicht) ist explizit nicht Teil dieses Features.

- **API Contracts / Data Models:**
  - `useUndoableState(initialState)` → `{ state, setState(updater), replace(updater), undo(), redo(), canUndo: boolean, canRedo: boolean }`.
    - `setState` verhält sich wie das `setState` von `React.useState` (Wert oder Updater-Funktion), legt aber zusätzlich den bisherigen Zustand auf den Undo-Stack und leert den Redo-Stack.
    - `replace` aktualisiert den Zustand identisch, ohne die Historie zu verändern.
  - `useRoster(...)` gibt zusätzlich zu den bestehenden Werten `undo`, `redo`, `canUndo`, `canRedo` zurück.

## Testing Decisions

- **Modules to Test:**
  - `useUndoableState` (neu)
  - `useRoster` (Erweiterung bestehender Tests)
  - `RosterEditor` (Erweiterung bestehender Tests)

- **Test Interfaces (Seams):**
  - `useUndoableState`: direkter Hook-Test (`renderHook`) – prüft `setState`/`undo`/`redo`/`canUndo`/`canRedo`-Semantik sowie, dass `replace` keinen Undo-Schritt erzeugt und den Redo-Stack nicht leert.
  - `useRoster`: bestehende Testdatei `useRoster.test.js` – prüft, dass `addUnit`/`removeUnit`/`copyUnit`/die Operationen aus `subSelectionOperations`/`updateRosterName` per `undo`/`redo` rückgängig/wiederherstellbar sind, und dass die automatische `syncRosterSelectionsWithSystem`-Korrektur keinen Undo-Schritt erzeugt.
  - `RosterEditor`: bestehende Testdatei `RosterEditor.test.jsx` – prüft Rendering, disabled-State und Klick-Verdrahtung der Undo/Redo-Buttons.

## Out of Scope

- **PlayMode:** Undo/Redo für Spielansicht-Zustände (z.B. Lebenspunkte) ist nicht Teil dieses Features.
- **Tastenkürzel:** Strg+Z/Strg+Umschalt+Z o.ä. werden in diesem Umfang nicht implementiert.
- **Persistenz der Historie:** Die Undo/Redo-Historie wird nicht in IndexedDB gespeichert und übersteht weder Reload noch Navigation weg vom Editor.
- **Zusammenfassen (Coalescing) schnell aufeinanderfolgender Aktionen:** Jede Aktion bleibt ein eigener, unabhängiger Undo-Schritt.
- **Begrenzung der Historienlänge:** Kein Limit für die Anzahl der Undo-Schritte innerhalb einer Sitzung.
