# Custom Agent Rules - Tome of Battle
Diese Anwendung ist zum Erstellen von Armeelisten für Tabletop-Spiele auf Grundlage von Battlescribe-Dateien.

## Browser Debugging & Automation
* **Local (macOS):** `browser_subagent` / `open_browser_url` funktionieren nicht. **Nutze Puppeteer** in `src/solver/` via `run_command` (z. B. `node src/solver/my_test.js`).
* **Cloud (Linux):** Nutze `/browser` und `browser_subagent` (voll unterstützt).

## Fachlogik
* Nutze validation_insights.md für gesammeltes Wissen zum Battlescribe-Format. Neues Wissen trägst du selbständig in die Datei ein
* Nutze die Daten unter ./catalogs für den Zugriff auf die Spielsysteme und Kataloge
* Nutze für fehlendes Wissen für die Analyse des Battlescribe-Formats die Informationen von https://github.com/BSData/catalogue-development/wiki und dazugehörige Unterseiten
* Es sollen keine (Sub)Strings auf Englisch oder Deutsch als Schlüssel für das Parsen oder Validieren genommen werden. Ausnahme: Berechnung von Armour Save und Ward Save (AS bzw. WS)
* Es sollen keine Armeespezifischen Logiken implementiert werden, die implementierung soll immer allgemeingültig sein
* Erstelle bei jeder Änderung der UI-Logik, Validierungslogik oder Importlogik einen Test für das geänderte Verhalten

## Git 
* **Local (macOS):** Push zu Remote-Repositories nur bei Aufforderung.

## Testing
* Alle Unit-Tests **müssen** vor dem Task-Abschluss erfolgreich durchlaufen.
