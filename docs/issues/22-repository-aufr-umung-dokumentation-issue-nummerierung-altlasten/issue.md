Status: resolved
Type: chore
Blocked by: None

## Description
Ein Repository-Audit hat mehrere unabhängige Aufräum-Punkte ergeben, gruppiert
in drei Themen: kaputte/veraltete Dokumentation, eine Nummerierungs-Inkonsistenz
im Issue-Tracker sowie nicht mehr benötigte bzw. fehlplatzierte Dateien.

1. **`CLAUDE.md` ist ein toter Symlink.** Root-`CLAUDE.md` ist als Git-Symlink
   (Mode 120000) auf den absoluten, maschinenspezifischen Pfad
   `/Users/artkoenig/.agents/AGENTS.md` getrackt. Außerhalb dieses einen Mac
   (jede Cloud-Session, jeder andere Contributor, CI) ist der Link tot. Die
   realen Projektregeln liegen bereits in `.agents/AGENTS.md`. README.md
   verlinkt auf `CLAUDE.md` als Contributor-Guide.
2. **Doppelte Hauptnummern unter `docs/issues/`.** `15`, `17` (3×), `19`, `20`
   sind mehrfach vergeben. Alle betroffenen Issues sind `resolved`, daher
   funktional unschädlich, aber inkonsistent mit der Tracker-Konvention
   eindeutiger, aufsteigender Präfixe.
3. **Root-`PRD.md` ist veraltet.** Beschreibt ein Deployment-Cleanup, das
   bereits vollständig umgesetzt ist (ADR-0008 schon umbenannt, `EnvBadge.jsx`
   entfernt, kein `deploy-vercel.yml`, kein Staging-Branch mehr). Nirgends
   verlinkt, enthält Pfade zum alten Repo-Namen `army_builder`.
4. **`docs/PRD-collapsible-play-profiles.md` ohne zugehöriges Issue.** Anders
   als die übrigen vier `docs/PRD-*.md`-Dateien wird sie von keinem `issue.md`
   referenziert, obwohl das Feature umgesetzt ist (`PlayUnitDetails.jsx`,
   Commit `843d00e`).
5. **ADR-Index unvollständig.** `docs/adr/README.md` listet ADRs nur bis 0018;
   `0019-manuelle-versionierung-und-release-freigabe.md` fehlt in der
   Übersichtstabelle.
6. **`.antigravity/config.json` ist getrackt trotz `.gitignore`.** Wurde vor
   der Ignore-Regel committet; enthält eine persönliche Konfiguration eines
   fremden KI-Tools ohne Projektbezug.
7. **Scratch-/Debug-Dateien in `src/solver/`.**
   - `debugBigUns.js` — nirgends importiert, referenziert einen nicht mehr
     existierenden Pfad (`./catalogs/...`, seit ADR-0014 extern ausgelagert).
   - `screenshot_fonts.js` — funktionsloser Puppeteer-Stub, nirgends
     referenziert, gehört ohnehin eher nach `scripts/`.
   - `test_maneaters_scratch.test.js` — läuft bei jedem `npm test` mit (nicht
     in `vitest.config.js` ausgeschlossen), enthält aber keine echte
     Assertion, nur `console.log`-Debug-Ausgaben.

## Acceptance Criteria
- [ ] `CLAUDE.md` verweist relativ auf `.agents/AGENTS.md` (oder enthält die
      Inhalte direkt) und ist in jeder Umgebung lesbar.
- [ ] Root-`PRD.md` ist entfernt (Inhalt ist umgesetzt und sonst nirgends
      referenziert).
- [ ] `docs/adr/README.md` listet ADR-0019.
- [ ] `.antigravity/config.json` ist nicht mehr getrackt.
- [ ] `debugBigUns.js`, `screenshot_fonts.js` und
      `test_maneaters_scratch.test.js` sind entfernt; `npm test` läuft
      weiterhin grün.
- [ ] Die doppelten Hauptnummern unter `docs/issues/` sind entweder bereinigt
      oder bewusst als historisch belassen dokumentiert (Entscheidung liegt
      beim Nutzer).

## Comments
- Vier-Achsen-Verifikation (/testing) durchlaufen: Standards (oxlint gruen, 6 vorbestehende Code-Smell-Funde ausserhalb des Scopes), Spezifikation (alle Akzeptanzkriterien erfuellt, 1 harmloser Nebenfund package-lock.json-Versionsfeld), Tests (Vitest 61/61 Dateien, 646/646 gruen; Puppeteer-E2E-Flakiness nachweislich umgebungsbedingt, reproduziert identisch auf frischem origin/main ohne diesen Diff), Docs (0 Funde, vollstaendig konsistent). Keine blockierenden Befunde.
