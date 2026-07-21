Status: ready-for-agent
Type: chore
Blocked by: None

## Description

Führt **Knip** als dateiübergreifende Analyse für ungenutzte Dateien, Exports,
Typen und `package.json`-Abhängigkeiten ein. Motiviert durch wiederkehrende
Befunde wie „geparst, aber nie ausgewertet" (Issue 50 K2) und die Aufräum-Arbeit
in 39/43, die oxlint pro Datei prinzipiell nicht sieht.

Umfang dieser Scheibe:
- Knip als devDependency ergänzen.
- Konfiguration soweit nötig: Entry-Points (Vite-Einstieg/`index.html`,
  Test-Setups, `scripts/**`) definieren, damit legitime Nutzer nicht als tote
  Enden gelten.
- Falschmeldungs-Quellen ausschließen: `.worktrees/**`, `**/.claude/**`,
  generierte Dateien unter `src/parser/schema/**`, Fixtures
  (`**/__fixtures__/**`). Testdateien (`*.test.js(x)`) und `scripts/**` zählen
  als legitime Verwender von Exports.
- npm-Script `knip` (konsistent zu `lint` benannt).
- In `.github/workflows/ci.yml`, Job `lint-and-test`, ein Step **nach** dem
  Lint-Step mit `continue-on-error: true` (warn-only): sichtbar im Log, nicht
  blockierend.

Ausdrücklich **nicht** Teil: die von Knip gefundenen Befunde beheben (eigene
Folge-Issues).

## Acceptance Criteria
- [ ] `npm run knip` läuft ohne Konfigurationsfehler durch.
- [ ] Kein Report-Eintrag stammt aus `.worktrees/`, `.claude/`, `__fixtures__/`
      oder `src/parser/schema/` (keine Falschmeldungen aus ignorierten Bereichen).
- [ ] Testdateien und `scripts/**` erzeugen keine „unused export"-Falschmeldungen
      für Symbole, die sie tatsächlich verwenden.
- [ ] CI-Job `lint-and-test` enthält einen Knip-Step nach dem Lint-Step, der bei
      Befunden **nicht** fehlschlägt (`continue-on-error: true`).
- [ ] Verbleibende echte Befunde sind unverändert gelassen (nicht in diesem Issue
      behoben).

## Comments
