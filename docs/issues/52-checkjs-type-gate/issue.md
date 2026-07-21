Status: resolved
Type: chore
Blocked by: None

## Description
Der Produktivcode ist reines JavaScript mit JSDoc-Typdokumentation (`src/types.js`),
die aber von keinem Werkzeug geprüft wird — Widersprüche zwischen deklarierten und
tatsächlichen Typen fallen erst zur Laufzeit oder durch Zufallstreffer der Tests auf.
Der TypeScript-Compiler soll die vorhandenen JSDoc-Typen als geprüften Vertrag
durchsetzen: `tsc --noEmit` mit `checkJs` über den Produktivcode, verankert als
blockierendes CI-Gate. Kein Umstieg auf TypeScript, kein Umschreiben von Code.

Scope-Entscheidung (bestätigt): Nur Produktivcode. Testdateien (`*.test.*`,
`test-utils`) sind ausgenommen — deren ~485 Fixture-bedingte Typfehler sind
bewusst nicht Teil dieses Issues. Probe-Stand: 40 Fehler im Produktivcode über
19 Dateien.

## Acceptance Criteria
- [ ] `tsconfig.json` im Repo-Root: `allowJs` + `checkJs` + `noEmit`, erfasst `src/` und `scripts/`, schließt `*.test.*` und `test-utils` aus.
- [ ] npm-Script `typecheck` führt `tsc --noEmit` aus und läuft mit 0 Fehlern.
- [ ] Die bestehenden Typfehler im Produktivcode sind bereinigt — bevorzugt durch JSDoc-Korrekturen, keine Verhaltensänderungen.
- [ ] Der Typecheck läuft als blockierender Schritt im GitHub-CI-Workflow.
- [ ] Doku nachgezogen: CLAUDE.md-Befehlsliste und ADR 0007 (CI/CD) erwähnen das Typ-Gate.
- [ ] Lint und alle bestehenden Tests bleiben grün.

## Comments
- Umgesetzt: tsconfig.json (checkJs/allowJs/noEmit, src/ + scripts/, Tests ausgenommen), npm-Script typecheck, TypeScript 6.0.2 + @types/node als devDependencies gepinnt, 40 Typfehler im Produktivcode über JSDoc-Präzisierungen und Defaults für optionale Props bereinigt (keine Verhaltensänderung), Typecheck als blockierender CI-Schritt in ci.yml, Doku in CLAUDE.md und ADR 0007 nachgezogen. Lint, Typecheck, 1128 Unit-Tests und Puppeteer-E2E grün.
- Nach Rebase auf origin/main (App.jsx-Hook-Refactoring, Knip/dependency-cruiser-Issue) von 51 auf 52 umnummeriert; 3 neue Typfehler aus den refaktorierten Hooks behoben. Vier-Achsen-Verifikation: Standards grün (0 blockierend), Spezifikation erfüllt (alle 6 Kriterien), Tests grün (1188 Unit + E2E), Doku-Drift in README behoben.
