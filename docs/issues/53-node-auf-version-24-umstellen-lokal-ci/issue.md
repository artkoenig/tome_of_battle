Status: claimed
Type: chore
Blocked by: None

## Description
`npm run depcruise` schlägt lokal fehl: dependency-cruiser 18.1.0 unterstützt
Node 25 nicht (`engines: "^22||^24||>=26"`), lokal läuft aber Node 25.1.0. Die
GitHub-Workflows pinnen ebenfalls `node-version: 25`, dort fällt der Fehler
nur nicht auf, weil der depcruise-Schritt in `ci.yml` bewusst `continue-on-error`
ist (warn-only, siehe Kommentar dort).

Umstellung auf Node 24 (aktuelle LTS-Linie) in CI und lokal, plus Verankerung
der Node-Version im Projekt (`package.json` `engines` + `.nvmrc`), damit
lokal/CI künftig nicht wieder auseinanderlaufen.

## Acceptance Criteria
- [ ] `.github/workflows/ci.yml`: beide `node-version`-Vorkommen auf `24`
- [ ] `.github/workflows/issue_agent.yml`: `node-version` auf `'24'`
- [ ] `package.json`: `engines.node` auf die 24er-Linie gesetzt
- [ ] `.nvmrc` mit `24` angelegt
- [ ] Lokale aktive Node-Version ist 24.x (via Homebrew)
- [ ] `npm run depcruise` läuft lokal ohne den Node-Versionsfehler durch

## Comments
