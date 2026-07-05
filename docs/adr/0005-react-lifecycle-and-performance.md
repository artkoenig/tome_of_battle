# 0005: React Lifecycle and Performance

- **Status:** Accepted
- **Datum:** 2026-07-03
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Keine

## Kontext und Problemstellung

Die Benutzeroberfläche von *Tome of Battle* muss hochgradig interaktiv sein. Spieler fügen Einheiten hinzu, passen Ausrüstungsoptionen an und sehen sofort die aktualisierten Punkte und Validierungsfehler. Bei großen Armeelisten mit tief verschachtelten Einheiten- und Upgrade-Strukturen kann es schnell zu Performance-Problemen kommen (z. B. Eingabe-Verzögerungen, blockierter UI-Thread, unnötige Re-Renders). Ebenso können asynchrone Datenbankzugriffe zu Race Conditions führen, wenn Komponenten demontiert (unmounted) werden, während Abfragen noch laufen.

## Entscheidungsfaktoren (Drivers)

- **Performance:** Flüssige UI-Interaktionen (60 FPS) selbst bei großen Armeelisten.
- **Wartbarkeit:** Vermeidung von riesigen monolithischen JSX-Dateien.
- **Stabilität:** Verhinderung von Memory Leaks, Race Conditions und Abstürzen bei schnellen Benutzerinteraktionen.

## Entscheidungsergebnis

Folgende Richtlinien für Komponentenstruktur, Performance und Lifecycle-Management werden angewendet:

### 1. Komponenten-Kapselung statt Monolithen
- Hilfsfunktionen, die nur von einer einzelnen Komponente benötigt werden (z. B. `getSelectedUpgrades` oder `getUpgradeDescription`), müssen so lokal wie möglich in dieser Komponente gehalten werden (z. B. in `UnitSelectionCard.jsx` statt zentral in `RosterEditor.jsx`).
- Dies verhindert, dass übergeordnete Komponenten (Monolithen) mit Detail-Logik überfrachtet werden und bei jeder Detail-Änderung komplett neu rendern müssen.

### 2. Context Awareness bei Datenauflösungen
- Beim Sammeln und Auflösen von Profilen und Regeln (z. B. über `collectUnitProfilesAndRules`) muss zwingend der `catalogueId`-Kontext übergeben werden.
- Dies verhindert Identifikations-Konflikte zwischen dem Hauptkatalog (z. B. Grundregeln) und Detachments/Erweiterungen, da Battlescribe-Kataloge unabhängig voneinander gleiche IDs für unterschiedliche Auswahlen verwenden können.

### 3. Keine blockierende UI bei DB-Importen
- Das Parsen und Importieren großer XML-Kataloge in die IndexedDB darf den UI-Thread nicht einfrieren.
- Der Import-Prozess muss asynchron laufen.
- Während des Imports muss ein interaktiver Lade-Indikator angezeigt werden, damit die UI reaktionsfähig bleibt.

### 4. Effizientes Querying (Data Chunking)
- Lade aus der IndexedDB stets nur die Daten, die für die aktuelle Ansicht absolut erforderlich sind.
- Im Roster-Auswahl-Bildschirm werden beispielsweise nur die Metadaten der Listen geladen, nicht die vollständigen Armeedetails aller gespeicherten Listen.

### 5. Saubere Cleanups in `useEffect`
- Jedes `useEffect`, das asynchrone Datenbankabfragen, Event-Listener (z. B. Resize-Events für die Tooltip-Berechnung) oder Timeouts/Intervalle registriert, **muss zwingend eine Cleanup-Funktion zurückgeben**.
- Dadurch werden Race Conditions (z. B. Zuweisung von DB-Ergebnissen an bereits demontierte Komponenten) und Memory Leaks zuverlässig verhindert.

### 6. UI-Struktur und View-Switching ohne Router
- Die Anwendung verzichtet auf einen externen Router (wie React Router). Die Navigation zwischen den Hauptansichten (`rosters`, `importer`, `builder`, `play`) wird als einfacher Zustand (View-Switcher) direkt in `App.jsx` verwaltet. Dies hält die PWA leichtgewichtig.

### 7. Click-to-Edit Debug-Feature
- Zur Entwicklung und Fehlersuche gibt es ein globales Debug-System. Durch Klicken auf ein `.debug-id-badge` (das nur auf localhost/privaten IPs aktiv ist) wird das `DebugEntryEditorModal` geöffnet, um Katalog-Einträge direkt im Kontext zu analysieren.


### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Die App fühlt sich extrem flüssig und reaktionsschnell an.
  - Geringere Fehleranfälligkeit bei schnellen Page-Switches.
  - Modularer und gut lesbarer Code durch klare Zuständigkeiten.
- **Negativ:** 
  - Entwickler müssen sorgfältig mit Hooks, Abhängigkeiten (`dependency arrays`) und Cleanups umgehen, was tiefere React-Kenntnisse voraussetzt.
