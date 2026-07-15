# Generischer Undo/Redo-Hook statt roster-spezifischer History-Logik

- **Status:** Accepted
- **Datum:** 2026-07-15
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs (falls vorhanden):** Keine

## Kontext und Problemstellung

Für das Feature "Undo/Redo im Editor" (siehe [PRD-editor-undo-redo.md](../PRD-editor-undo-redo.md)) muss der `roster`-State in `src/hooks/useRoster.js` rückgängig machbar und wiederherstellbar werden. `useRoster.js` verwaltet aktuell den Roster-State direkt über `React.useState` und enthält bereits Domänenlogik (Kostenberechnung, Validierung, Autosave, System-Synchronisation).

## Entscheidungsfaktoren (Drivers)

- **Single Responsibility:** Die Mechanik einer Undo/Redo-History (Stack-Verwaltung, `canUndo`/`canRedo`) ist generisch und unabhängig von der Roster-Domäne.
- **Testbarkeit:** Eine isolierte History-Mechanik lässt sich ohne Roster-/System-Fixtures testen.
- **Wiederverwendbarkeit:** Andere zustandsbehaftete Editoren im Projekt (z.B. zukünftige Editor-Views) könnten dieselbe Mechanik benötigen.
- **Vermeidung von Vermischung:** `useRoster.js` soll nicht zusätzlich mit History-Stack-Details wachsen, da es bereits mehrere Verantwortlichkeiten bündelt (Autosave, Validierung, Sync).

## Betrachtete Optionen

- **Option 1:** Generischer Hook `src/hooks/useUndoableState.js`, der einen beliebigen State kapselt (`{ state, setState, replace, undo, redo, canUndo, canRedo }`). `useRoster.js` nutzt ihn anstelle von `useState` für den `roster`-State.
- **Option 2:** History-Array direkt und ausschließlich in `useRoster.js` implementieren, eng verwoben mit der Roster-Domänenlogik.

## Entscheidungsergebnis

Gewählte Option: **Option 1**, weil die History-Mechanik dadurch isoliert, unabhängig testbar und potenziell wiederverwendbar bleibt, statt `useRoster.js` zusätzlich mit generischer Stack-Verwaltung zu belasten. Die Trennung folgt dem bestehenden Muster des Projekts, fachfremde Mechanik in eigene Hooks auszulagern (vgl. [ADR 0002](0002-data-flow-and-indexeddb-storage.md), Punkt 4: dedizierte Custom Hooks).

### Konsequenzen (Auswirkungen)

- **Positiv:** Klare Trennung zwischen generischer Undo-Mechanik und Roster-Domänenlogik; einfacher isolierter Unit-Test für `useUndoableState`; Wiederverwendbarkeit für zukünftige Editoren.
- **Negativ:** Ein zusätzlicher Indirektionslayer zwischen `RosterEditor` und dem eigentlichen `roster`-State.
- **Neutral:** `useRoster.js` muss die automatische System-Korrektur (`syncRosterSelectionsWithSystem`) explizit über den `replace`-Pfad (kein History-Eintrag) statt über `setState` anstoßen.

## Vor- und Nachteile der Optionen

### Option 1: Generischer Hook

- **Gut, weil** die Undo-Mechanik unabhängig von Roster-Interna getestet werden kann und `useRoster.js` nicht weiter anwächst.
- **Schlecht, weil** ein zusätzlicher Hook-Layer eingeführt wird.

### Option 2: Inline in useRoster.js

- **Gut, weil** weniger Indirektion, alles an einer Stelle.
- **Schlecht, weil** `useRoster.js` bereits mehrere Verantwortlichkeiten bündelt und mit generischer Stack-Mechanik weiter aufgebläht würde; schlechter isoliert testbar.
