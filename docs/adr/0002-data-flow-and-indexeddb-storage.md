# 0002: Data Flow and IndexedDB Storage

- **Status:** Accepted
- **Datum:** 2026-06-28
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Keine

## Kontext und Problemstellung

*Tome of Battle* ist eine reine Client-Side PWA ohne Backend-Infrastruktur. Alle Daten (importierte Battlescribe-Kataloge und erstellte Armeelisten/Roster) müssen persistent im Browser des Benutzers gespeichert werden. Dafür wird IndexedDB verwendet.
Aufgrund der Größe der Battlescribe-XML-Kataloge (teilweise mehrere Megabytes) und der Komplexität der Armeestrukturen müssen der Datenzugriff, die Zustandsverwaltung (State Management) und die Speicherung performant und robust gestaltet werden. Unstrukturierte Zugriffe direkt aus React-Komponenten heraus führen zu Race Conditions, Performance-Einbrüchen (blocking UI) und schwer zu wartendem Code.

## Entscheidungsfaktoren (Drivers)

- **Datenintegrität:** Konsistenter Zustand zwischen In-Memory Roster-State und persistentem IndexedDB-Speicher.
- **Performance:** Vermeidung von Blockierungen des UI-Threads bei rechenintensiven Operationen (Import, Validierung).
- **Separation of Concerns:** Kapselung der Datenzugriffslogik zur Vermeidung von Redundanz und Spaghetti-Code.
- **Robustheit bei Updates:** Sichere Migration gespeicherter Daten bei Änderungen des Datenmodells oder App-Updates.

## Entscheidungsergebnis

Es wurde eine mehrschichtige Architektur für Datenfluss und Speicherung definiert:

### 1. Datenfluss: Battlescribe XML → IndexedDB → Roster-Zustand

1. **Import:** `Importer.jsx` ruft `src/parser/zipExtractor.js` auf (Entpacken von `.bsz`/ZIP-Dateien). Die XML-Kataloge (`.cat`/`.gst`) werden über `src/parser/xmlParser.js` in bereinigte JavaScript-Systemobjekte geparst (Kataloge, Kategorien, Profile, Regeln, Einschränkungen etc.).
2. **Datenzugriff kapseln (Repository Pattern):** Direkte Zugriffe auf die IndexedDB (mittels nativer API oder Wrappern) dürfen *nicht* in React-Komponenten stattfinden. Die Datei `src/db/database.js` dient als einzige Schnittstelle zur IndexedDB (zwei Object Stores: `systems` und `rosters`). Sie bietet Promise-basierte Wrapper für Lese- und Schreibvorgänge an.
3. **IndexedDB als Single Source of Truth:** Vermeide redundante Haltung großer Datenmengen (wie vollständige Kataloge) sowohl im React-Zustand als auch in der DB. Die IndexedDB ist die Primärquelle.
4. **Custom Hooks für DB-Abfragen:** Der Datenabruf erfolgt über dedizierte Custom Hooks (z. B. `useCatalog(catalogId)`). Diese Hooks verwalten den Ladezustand (`loading`), Fehler (`error`) und den eigentlichen Zustand. Sie bereinigen Event-Listener bei Unmount, um Memory Leaks zu vermeiden.
5. **Autosave & Validierung (Roster State):** `src/hooks/useRoster.js` verwaltet die Auswahlliste. Jede Änderung triggert eine immutable Statusänderung. Diese Änderung wird um **150ms debounced** automatisch in die IndexedDB geschrieben und parallel eine Kosten- und Validierungsberechnung über `src/solver/validator.js` angestoßen. Ausstehende Speicherungen werden beim Unmount geflusht.
6. **Migrations-Pipeline:** Beim App-Start (`App.jsx`) prüft `src/db/migrations.js` (`runSystemMigrations`) alle in der IndexedDB gespeicherten Systeme und führt bei Bedarf strukturelle Upgrades durch, um die Abwärtskompatibilität älterer Roster zu gewährleisten.
7. **Identifikation über IDs (keine Objekt-Referenzen):** Die aktuell ausgewählte Selektion im Editor wird im State nur als ID (`selectionId`) getrackt. Der konkrete Knoten wird mittels `useMemo` aus dem Roster-Baum abgeleitet. Es dürfen keine direkten Verweise auf Objekt-Instanzen im State gehalten werden (Vermeidung von Stale State).

### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Klare Trennung zwischen UI-Komponenten und Daten-Persistence.
  - Kein UI-Lag bei der Eingabe, da Schreibvorgänge und Berechnungen debounced und asynchron im Hintergrund laufen.
  - Änderungen am DB-Schema sind durch die Migrations-Pipeline isoliert und sicher.
- **Negativ:** 
  - Erhöhter Boilerplate-Code durch die Kapselung in Services und Custom Hooks statt direkter Zugriffe.
