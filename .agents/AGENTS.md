# Custom Agent Rules - Tome of Battle
Diese Anwendung ist zum Erstellen von Armeelisten für Tabletop-Spiele auf Grundlage von Battlescribe-Dateien.

## Debugging & Automation
* **Bug-Analyse & Vorgehen:** Bei gemeldeten Bugs, die die Fachlogik betreffen, muss **zuerst in den vorhandenen Daten** (Kataloge, Spieldaten) nach einer bereits erfassten, aber eventuell unvollständig implementierten Logik gesucht werden, bevor neuer Code geschrieben wird. Nutze für die Analyse ein Reasoning Modell, für die Umsetzung ein Flash Modell
* **Local (macOS):** `browser_subagent` / `open_browser_url` funktionieren nicht. **Nutze Puppeteer** in `src/solver/` via `run_command` (z. B. `node src/solver/my_test.js`).
* **Cloud (Linux):** Nutze `/browser` und `browser_subagent` (voll unterstützt).

## Fachlogik
* Nutze `validation_insights.md` für gesammeltes Wissen zum Battlescribe-Format. Neues Wissen trägst du selbständig in die Datei ein.
* Nutze die Daten unter `./catalogs` für den Zugriff auf die Spielsysteme und Kataloge.
* Nutze für fehlendes Wissen für die Analyse des Battlescribe-Formats die Informationen von https://github.com/BSData/catalogue-development/wiki und dazugehörige Unterseiten.
* Es sollen keine (Sub)Strings auf Englisch oder Deutsch als Schlüssel für das Parsen oder Validieren genommen werden. Ausnahme: Berechnung von Armour Save und Ward Save (AS bzw. WS).
* Es sollen keine Armeespezifischen Logiken implementiert werden, die Implementierung soll immer allgemeingültig sein.
* Erstelle bei jeder Änderung der UI-Logik, Validierungslogik oder Importlogik einen Test für das geänderte Verhalten.

## Git
* **Local (macOS):** Push zu Remote-Repositories nur bei Aufforderung.

## Testing
* Alle Unit-Tests **müssen** vor dem Task-Abschluss erfolgreich durchlaufen.

## UI/UX Reviews & Feature-Inspiration
* **Ablauf bei UI/UX Review-Anfragen:**
  1. Führe das Skript `node src/solver/generate_screenshots.js` (oder den entsprechenden Pfad) aus, um das aktuelle Interface visuell zu erfassen.
  2. Nutze die Screenshots nicht nur zur Fehleranalyse, sondern als kreatives Sprungbrett.
* **Fokus auf Benutzererlebnis & Innovation:**
    * **Redundanzen & UI-Ballast:** Suche nach redundanten Elementen. Gibt es Informationen, Icons oder Buttons, die doppelt auf dem Bildschirm angezeigt werden oder keinen echten Mehrwert bieten? Das Interface soll so schlank und fokussiert wie möglich sein.
    * **Visuelle Harmonie & Konsistenz:** Achte penibel darauf, ob Schriften (z. B. unpassende Schriftarten oder -größen) und Buttons unregelmäßig oder inkonsistent wirken (z. B. unterschiedliche Höhen, Abstände oder Stile bei eigentlich gleichwertigen Aktionen).
    * **Neue Feature-Konzepte:** Welche Funktionen fehlen dem Tool noch, um das Leben eines Tabletop-Spielers massiv zu erleichtern (sowohl bei dem Armeeaufbau als auch beim Spielen)?

## Architektur & UI Guidelines

### 1. CSS & Style-Konsistenz (Keine Sonderlocken)
* **Strikes Inline-Style-Verbot:** Es dürfen *keine* ad-hoc CSS-Eigenschaften (z. B. `style={{ fontSize: '14px', color: '#ff0000' }}`) in JSX-Komponenten verwendet werden.
* **Nutzung bestehender CSS-Klassen:** Änderungen an Layout, Farben, Abständen und Typografie erfolgen *ausschließlich* über bereits existierende globale CSS-Klassen oder Utility-Klassen.
* **Typografie:** Nutze ausschließlich die vordefinierten semantischen Text-Klassen (`.text-display`, `.text-heading`, `.text-subheading`, `.text-ui-title`, `.text-body`, `.text-label`, `.text-micro`) und die CSS-Variablen (`--fs-display` bis `--fs-micro`). Diese passen sich via Media Queries automatisch an Desktop- und Mobilansichten an.
* **Farb- und Design-Treue:** Verwende für Hintergründe, Rahmen und Akzente ausschließlich die im Projekt definierten Design-System-Klassen (z. B. das Gothic-/Tabletop-Thema).

### 2. Komponenten-Kapselung & Struktur
* **Lokale Hilfsfunktionen:** Hilfsfunktionen (wie z. B. `getSelectedUpgrades` oder `getUpgradeDescription`) sind so lokal wie möglich in der Komponente zu halten, die sie verwendet (z. B. `UnitSelectionCard.jsx` statt zentral in `RosterEditor.jsx`), um monolithische Files zu vermeiden.
* **Responsive Verhalten (Tooltip vs. Mobile):** Detail-Informationen (wie Profilwerte von Ausrüstung) sind auf dem Desktop (Breite > 900px) per Hover-Tooltip (`gothic-tooltip`) darzustellen. Auf mobilen Endgeräten (Breite <= 900px) muss zwingend ein `BottomSheet`-Modal beim Klick genutzt werden, um Platz zu sparen.
* **Context Awareness:** Beim Sammeln von Profilen und Regeln (z. B. `collectUnitProfilesAndRules`) muss immer der `catalogueId`-Kontext übergeben werden, um Konflikte zwischen Hauptsystem und Detachments zu verhindern.

## React / Vite & IndexedDB Best Practices

### 1. IndexedDB Architektur & State-Synchronisation
* **Datenzugriff kapseln (Repository Pattern):** Direkte Zugriffe auf die IndexedDB (z. B. via `idb` oder native API) dürfen *nicht* direkt in React-Komponenten stattfinden. Erstelle stattdessen eine Service-/Repository-Schicht (z. B. `src/services/db.js`), die saubere, asynchrone Funktionen bereitstellt.
* **Single Source of Truth:** Vermeide es, große Datenmengen (wie komplette Kataloge) redundant im React-State *und* in der IndexedDB synchron zu halten. Die DB ist die Source of Truth.
* **Custom Hooks für DB-Abfragen:** Nutze dedizierte Custom Hooks (z. B. `useCatalog(catalogId)`), um Daten aus der IndexedDB zu laden. Diese Hooks verwalten das Laden (`loading`), Fehler (`error`) und den aktuellen Zustand sauber.

### 2. Performance & Lifecycle in React
* **Vermeidung von Blocking UI beim DB-Import:** Das Parsen und Importieren großer Battlescribe-Kataloge in die IndexedDB darf nicht den UI-Thread blockieren. Nutze bei rechenintensiven Operationen Chunking oder stelle sicher, dass die UI während des asynchronen Schreibvorgangs responsive bleibt (Lade-Indikator anzeigen).
* **Effizientes Querying:** Lade aus der IndexedDB immer nur die Daten, die für die aktuelle Ansicht absolut notwendig sind (z. B. nur Metadaten für die Listenauswahl, anstatt alle Armeedetails auf einmal).
* **Cleanups in `useEffect`:** Beim Abonnieren von DB-Events oder asynchronen Abrufen in `useEffect` muss immer eine Cleanup-Funktion implementiert werden, um Race Conditions oder Speicherlecks bei unmounted Komponenten zu verhindern.

## Subagente & Monitoring
* **Monitoring Crons:** Geplante Monitoring-Crons (`Monitoring Crons Scheduled`) müssen strikt in einem Intervall von **max 3 Minuten** ausgeführt werden, um den Systemstatus und die Integrität der Hintergrund-Prozesse zeitnah zu überwachen.
