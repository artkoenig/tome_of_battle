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

## Architektur & UI Guidelines
* **Komponenten-Kapselung:** Hilfsfunktionen (wie z. B. `getSelectedUpgrades` oder `getUpgradeDescription`) sind so lokal wie möglich in der Komponente zu halten, die sie verwendet (z. B. `UnitSelectionCard.jsx` statt zentral in `RosterEditor.jsx`), um Monolithen zu vermeiden.
* **Tooltips & Mobile:** Detail-Informationen (wie Profilwerte von Ausrüstung) sind auf dem Desktop (Breite > 900px) per Hover-Tooltip (`gothic-tooltip`) darzustellen. Auf mobilen Endgeräten (Breite <= 900px) muss zwingend ein `BottomSheet`-Modal beim Klick genutzt werden, um Platz zu sparen.
* **Context Awareness:** Beim Sammeln von Profilen und Regeln (z. B. `collectUnitProfilesAndRules`) muss immer der `catalogueId`-Kontext übergeben werden, um Konflikte zwischen Hauptsystem und Detachments zu verhindern.
* **Typografie & Schriftarten:** Verwende niemals ad-hoc inline `fontSize`- oder `fontFamily`-Styles in JSX-Komponenten. Nutze stattdessen ausschließlich die vordefinierten semantischen Text-Klassen (`.text-display`, `.text-heading`, `.text-subheading`, `.text-ui-title`, `.text-body`, `.text-label`, `.text-micro`) und die CSS-Variablen (`--fs-display` bis `--fs-micro`). Diese Klassen passen sich über Media Queries in `index.css` (Grenzlinie 900px) automatisch an Desktop- und Mobilansichten an.

