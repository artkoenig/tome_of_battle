Status: resolved
Blocked by: None

## Description
Filtert und übersetzt die Git-Commits bereits zur Build-Zeit in `vite.config.js` und schreibt sie zusammen mit den dereferenzierten Tags in `changelog.json`.

Zusätzlich wird die aktuelle App-Version als `import.meta.env.VITE_APP_VERSION` in das `define`-Objekt der Vite-Konfiguration injiziert.

## Acceptance Criteria
- [ ] In `vite.config.js` wird `import.meta.env.VITE_APP_VERSION` mit der ermittelten Version injiziert.
- [ ] In `vite.config.js` wird `computeRelease()` angepasst, um die Liste der letzten 100 Commits via `git log --no-merges --pretty=format:%h|%s -n 100` zu laden.
- [ ] Es werden nur Commits behalten, die mit `feat` oder `fix` (auch scoped, z. B. `feat(importer):`) beginnen.
- [ ] Die Präfixe werden übersetzt: `feat` -> `Neues Feature: `, `fix` -> `Bugfix: `. Scopes werden entfernt, der erste Buchstabe der Nachricht wird großgeschrieben.
- [ ] Alle Git-Tags und ihre Commit-Hashes werden via `git show-ref --tags -d` eingelesen. Annotierte Tags (`^{}`) werden korrekt dereferenziert und überschreiben den Tag-Hash.
- [ ] Die gefilterten Commits (Array aus `{ hash, subject }`) und Tags (Array aus `{ name, hash }`) werden in `changelog.json` exportiert.
- [ ] Die Tests in `src/solver/pwa.test.js` werden angepasst und alle Tests laufen erfolgreich durch.

## Comments
