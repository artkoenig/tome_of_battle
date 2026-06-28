# Custom Agent Rules - Tome of Battle

## Browser Debugging & Automation
* **Local (macOS):** `browser_subagent` / `open_browser_url` funktionieren nicht. **Nutze Puppeteer** in `src/solver/` via `run_command` (z. B. `node src/solver/my_test.js`).
* **Cloud (Linux):** Nutze `/browser` und `browser_subagent` (voll unterstützt).

## Fachlogik
* Es sollen keine (Sub)Strings auf Englisch oder Deutsch als Schlüssel für das Parsen oder Validieren genommen werden
## Git Push
* **Local (macOS):** Kein automatischer Push zu Remote-Repositories.

## Testing
* Bei jeder Änderung der Geschäftslogik prüfe ob sie durch Unit-Tests abgedeckt ist. Schreibe einen neuen, wenn nicht.
* Alle Unit-Tests **müssen** vor dem Task-Abschluss erfolgreich durchlaufen.