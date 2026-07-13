# PRD: Dynamischer Commit-Diff für Release Notes

## Problem Statement / Bug Description
Bisher zeigt der Update-Dialog der PWA nur die Änderungen (Commits) des allerletzten einzelnen Releases an. Wenn ein Nutzer mehrere Versionen überspringt, sieht er die dazwischen liegenden Änderungen nicht. Zudem werden alle Git-Commits ungefiltert und unübersetzt angezeigt, was auch rein technische Beschreibungen (z. B. `chore:`, `refactor:`, `docs:`) für Endnutzer sichtbar macht.

## Solution
Die `changelog.json` wird so erweitert, dass sie die Historie der letzten 100 Commits und aller bekannten Semver-Tags enthält. Diese Commits werden bereits während des Builds gefiltert (nur `feat` und `fix`) und benutzerfreundlich auf Deutsch übersetzt.
Der PWA-Update-Dialog auf dem Client gleicht die installierte Version mit den Daten in `changelog.json` ab, ermittelt den zugehörigen Commit-Hash und zeigt dynamisch genau die Liste der übersetzten Commits an, die seit der installierten Version hinzugekommen sind.

## User Stories / Requirements
1. Als **Nutzer der App** möchte ich beim Erscheinen eines Updates eine Auflistung aller funktionalen Änderungen sehen, die seit meiner aktuell installierten Version hinzugekommen sind, um den Nutzen des Updates zu verstehen.
2. Als **Nutzer der App** möchte ich nur lesbare und relevante Einträge sehen (Features und Fehlerbehebungen), ohne technische Details wie Refactoring oder Dokumentations-Updates.
3. Als **Nutzer einer sehr alten Version** möchte ich, falls meine installierte Version mehr als 50 Commits zurückliegt oder nicht in der Historie gefunden wird, die neuesten 50 Änderungen sehen sowie den Hinweis, dass weitere Änderungen vorhanden sind.

## Technical Decisions
- **Affected Modules:**
  - `vite.config.js`: Generierung der erweiterten `changelog.json` zur Build-Time und Injektion der aktuellen App-Version via `import.meta.env.VITE_APP_VERSION`.
  - `src/App.jsx`: Abgleich der installierten Version mit der Commit-Historie zur Runtime und Darstellung der gefilterten Änderungen im PWA-Update-Dialog.
- **Technical Clarifications / Architectural Decisions:**
  - **Build-Time-Filterung:** Der Build-Prozess filtert Commits, die nicht mit `feat` oder `fix` beginnen, heraus. Er übersetzt `feat:` in `Neues Feature:` und `fix:` in `Bugfix:` und kapitalisiert den ersten Buchstaben der Beschreibung.
  - **Git-Tag-Dereferenzierung:** Annotationen bei Git-Tags werden aufgelöst (`git show-ref --tags -d`), um die tatsächlichen Commit-Hashes für den Abgleich zu erhalten.
  - **Client-Side-Diff:** Der Client vergleicht den Hash seiner installierten Version (aus `import.meta.env.VITE_APP_VERSION` bzw. über Tag-Mapping) mit dem Commit-Verlauf in `changelog.json` und schneidet die Liste der anzuzeigenden Commits ab.
- **API Contracts / Data Models:**
  - `changelog.json` Format:
    ```json
    {
      "version": "v1.5.0",
      "date": "2026-07-13",
      "changes": ["Fallback-Änderung 1", "Fallback-Änderung 2"],
      "commits": [
        { "hash": "c0ffee1", "subject": "Neues Feature: Gothic-Design für Dialoge" },
        { "hash": "f8239f9", "subject": "Bugfix: Roster-Import korrigiert" }
      ],
      "tags": [
        { "name": "v1.5.0", "hash": "c0ffee1" },
        { "name": "v1.4.0", "hash": "e45e488" }
      ]
    }
    ```

## Testing Decisions
- **Modules to Test:**
  - PWA-Build-Plugin und Release-Skript (Build-Zeit-Logik).
  - PWA-Update-Komponente in `App.jsx` (Laufzeit-Logik).
- **Test Interfaces (Seams):**
  - Unit-Test `src/solver/pwa.test.js` verifiziert das Format der erzeugten `changelog.json`.
  - Unit-Test `src/App.test.jsx` simuliert das `pwa-update-available`-Event mit verschiedenen installierten Versionen (Bumps, Feature-Branches und Fallbacks) und überprüft die gerenderten Texte im Dialog.

## Out of Scope
- Historie von mehr als 100 Commits (wird zur Build-Zeit auf 100 begrenzt, Client zeigt maximal 50 an).
- Automatisches Pushen von Git-Tags zur Build-Zeit (wird weiterhin durch CI-Workflows geregelt).
