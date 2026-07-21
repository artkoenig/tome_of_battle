# 0007: CI/CD Workflow

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0008: Native Vercel Integration](0008-vercel-deployment.md), [ADR 0019: Manuelle Versionierung und Release-Freigabe](0019-manuelle-versionierung-und-release-freigabe.md)

## Kontext und Problemstellung

Da *Tome of Battle* eine komplexe Client-Side Webanwendung (React + Vite PWA) mit automatisierten E2E-Tests und Unit-Tests ist, muss sichergestellt werden, dass die Codequalität auf dem Haupt-Branch kontinuierlich gewahrt bleibt.

## Entscheidungsfaktoren (Drivers)

- **Zuverlässigkeit:** Nur lauffähiger und ordentlich formatierter Code darf auf `main` gelangen.
- **Automatisierung:** Automatisiertes Deployment und automatische Doku-Aktualisierungen entlasten Entwickler.

## Betrachtete Optionen

- **Option 1:** Ein einziger, monolithischer CI-Job.
- **Option 2:** Aufteilung in fokussierte und bedingte Workflows.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Bedarfsgerechte GitHub-Workflows)**.

Nach der Umstellung auf eine Trunk-based Strategie bestehen folgende Workflows:

### 1. CI Workflow (`.github/workflows/ci.yml`)
- **Trigger:** Läuft bei Pushes und PRs gegen `main`.
- **Jobs:**
  - **Lint & Unit-Tests:** Führt `npm run lint`, `npm run typecheck` (TypeScript-Prüfung der JSDoc-Typen im Produktivcode via `tsc --noEmit` mit `checkJs`; Testdateien sind über die `tsconfig.json` ausgenommen) und `npx vitest run` aus.
  - **E2E-Tests:** Führt `src/solver/ui.test.js` mit einem echten, frisch installierten Chromium-Browser via Puppeteer aus. Dies garantiert, dass `main` immer voll funktionstüchtig ist.

### 2. Doku-Abgleich (`.github/workflows/doc-drift-check.yml`)
- **Trigger:** Läuft nach jedem Merge/Push auf den `main`-Branch.
- **Ablauf:** Verwendet Claude, um den Commit-Diff mit den Markdown-Dateien zu vergleichen. Stellt der Bot fest, dass die Dokumentation veraltet ist, korrigiert er sie und öffnet einen neuen PR gegen `main`.

### 3. Vercel Deployment (Nativ via Vercel GitHub-App)
- **Trigger:** Automatisch bei Pushes auf beliebigen Zweigen.
- **Ablauf:** Vercel übernimmt das Bauen nativ. Pushes auf `main` erzeugen ein
  Production-Deployment, das seit [ADR 0019](0019-manuelle-versionierung-und-release-freigabe.md)
  erst durch manuelles Promoten live geschaltet wird. Pushes auf
  Feature-Branches erzeugen Preview-URLs (siehe ADR 0008).

### 4. GitHub-Issue-Triage (`.github/workflows/issue_agent.yml`)
- **Trigger:** `issues: opened` und `issue_comment: created`.
- **Ablauf:** `scripts/github_issue_agent.py` prüft bei jedem Issue-Event zuerst, ob das Issue bereits das Label `needs-attention` trägt — falls ja, bricht es sofort ab, ohne die Gemini-API aufzurufen (das Label ist ein einmaliges, nie wieder entferntes Terminal-Signal: sobald gesetzt, reagiert der Agent auf dieses Issue nicht mehr). Andernfalls bewertet es automatisch (kein Freigabe-Gate mehr nötig, da nur noch kommentiert/gelabelt wird) über einen Gemini-API-Call (`gemini-3.1-flash-lite`, Free Tier), ob ein Report klar genug ist. Ist er unklar, postet/editiert das Skript einen Kommentar mit Rückfragen (bestehende Single-Comment-Konvention). Ist er klar und wirkt wie ein plausibler Bug oder gut formulierter Feature-Request, wird das Label `needs-attention` gesetzt. Kein Kategorie-/Prioritäts-/Aufwands-/Duplikat-Labeling.
- **Abgrenzung:** Dieser Workflow implementiert **nicht** und öffnet **keine PRs**; er legt auch **kein** lokales main-issue an — GitHub-Issue-Triage und der lokale `docs/issues/`-Tracker bleiben vollständig getrennte Systeme. Die Workflow-Permissions umfassen nur `issues: write` (kein `contents`/`pull-requests`).

### 5. Auto-Tag bei Versions-Bump (`.github/workflows/tag-on-version-bump.yml`)
- **Trigger:** Läuft bei jedem Push auf `main`.
- **Ablauf:** Vergleicht das `version`-Feld in `package.json` mit dem Vorgänger-Commit. Hat es sich geändert, erstellt und pusht der Workflow den Tag `v<version>` mit dem workflow-eigenen `GITHUB_TOKEN` (`permissions: contents: write`). Existiert der Tag bereits, bricht der Lauf ohne Fehler ab (idempotent).
- **Hintergrund:** Ersetzt den manuellen Tag-Push-Schritt aus [ADR 0019](0019-manuelle-versionierung-und-release-freigabe.md), der aus Cloud-Sessions (Claude Code on the web) heraus strukturell nicht zuverlässig funktioniert — deren Session-gebundener Git-Relay-Token erlaubt Branch-Pushes und PR-Merges, lehnt direkte Tag-Pushes aber unabhängig von GitHub-Repo-Einstellungen mit HTTP 403 ab. Die Versionsentscheidung selbst bleibt manuell (siehe ADR 0019); automatisiert wird nur der mechanische Tag-Push danach.

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Sehr linearer, nachvollziehbarer Ablauf (Merge -> CI -> Native Vercel Deploy).
  - Die GitHub-Issue-Triage läuft ohne Freigabe-Overhead und ohne API-Kosten (Gemini Free Tier statt Anthropic), da sie nur reversible Aktionen (Kommentar, Label) ausführt.
- **Negativ:**
  - Alle Tests (inklusive E2E) laufen nun auf PRs gegen `main`, was Feature-PRs leicht verzögert.
  - Ein als `needs-attention` markiertes GitHub-Issue führt zu keinem automatischen Folgeschritt — der Maintainer muss selbst entscheiden, ob und wann daraus ein lokales main-issue wird; die beiden Systeme sind bewusst nicht verknüpft.
