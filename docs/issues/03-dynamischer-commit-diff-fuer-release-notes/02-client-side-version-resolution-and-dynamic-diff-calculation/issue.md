Status: resolved
Blocked by: 01

## Description
Implementiert im Client (`src/App.jsx`) die Logik zur Ermittlung der installierten Version und des Diffs (auszuschneidende Commits) auf Basis von Hashes aus der `changelog.json`.

## Acceptance Criteria
- [ ] In `src/App.jsx` wird die Hilfsfunktion `getDiffChanges(installedVersion, release)` implementiert.
- [ ] Die Funktion extrahiert den Hash der installierten Version (aus dem String nach dem `+` oder durch Lookup der Versionsnummer in `release.tags`).
- [ ] Sie sucht den Hash in `release.commits` und gibt alle Commits zurück, die chronologisch danach liegen (Index < gefundener Index).
- [ ] Wenn die installierte Version nicht gefunden wird, oder das Diff > 50 Commits lang ist, greift ein Fallback: Zeige die neuesten 50 Commits und füge als letzten Eintrag den Hinweis `...und weitere Einträge.` hinzu.
- [ ] Unit-Tests in `src/App.test.jsx` verifizieren die Diff-Funktionalität, Bumps, Feature-Branch-Handling und Fallbacks vollständig.

## Comments
