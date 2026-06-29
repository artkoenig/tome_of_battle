# Custom Agent Rules - Tome of Battle
Diese Anwendung ist zum Erstellen von Armeelisten für Tabletop-Spiele auf Grundlage von Battlescribe-Dateien.

## Browser Debugging & Automation
* **Local (macOS):** `browser_subagent` / `open_browser_url` funktionieren nicht. **Nutze Puppeteer** in `src/solver/` via `run_command` (z. B. `node src/solver/my_test.js`).
* **Cloud (Linux):** Nutze `/browser` und `browser_subagent` (voll unterstützt).

## Fachlogik
* Nutze die Daten unter ./catalogs für den Zugriff auf die Spielsysteme und Kataloge
* Nutze für die Analyse des Battlescribe-Formats die Informationen von https://github.com/BSData/catalogue-development/wiki und dazugehörige Unterseiten
* Es sollen keine (Sub)Strings auf Englisch oder Deutsch als Schlüssel für das Parsen oder Validieren genommen werden
## Git Push
* **Local (macOS):** Kein automatischer Push zu Remote-Repositories.

## Testing
* Bei jeder Änderung der Geschäftslogik prüfe ob sie durch Unit-Tests abgedeckt ist. Schreibe einen neuen, wenn nicht.
* Alle Unit-Tests **müssen** vor dem Task-Abschluss erfolgreich durchlaufen.