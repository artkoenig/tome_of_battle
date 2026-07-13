# 0007: CI/CD Workflow

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0008: Vercel Deployment and Staging Environment](0008-vercel-deployment-and-staging-environment.md)

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
  - **Lint & Unit-Tests:** Führt `npm run lint` und `npx vitest run` aus.
  - **E2E-Tests:** Führt `src/solver/ui.test.js` mit einem echten, frisch installierten Chromium-Browser via Puppeteer aus. Dies garantiert, dass `main` immer voll funktionstüchtig ist.

### 2. Doku-Abgleich (`.github/workflows/doc-drift-check.yml`)
- **Trigger:** Läuft nach jedem Merge/Push auf den `main`-Branch.
- **Ablauf:** Verwendet Claude, um den Commit-Diff mit den Markdown-Dateien zu vergleichen. Stellt der Bot fest, dass die Dokumentation veraltet ist, korrigiert er sie und öffnet einen neuen PR gegen `main`.

### 3. Vercel Deployment (`.github/workflows/deploy-vercel.yml`)
- **Trigger:** Läuft bei Pushes auf `main` sowie beim Pushen von Tags (`v*`).
- **Ablauf:** Steuert die Vercel CLI fern. Baut auf `main` reine Previews und auf Tags die echte Production-Instanz (siehe ADR 0008).

### 4. Tag Release (`.github/workflows/tag-release.yml`)
- **Trigger:** Läuft nach jedem Push/Merge auf `main`.
- **Ablauf:** Führt `scripts/tag-release.js` aus, um basierend auf den vorhandenen Tags die nächste Minor-Version zu generieren, erzeugt den Git-Tag und pusht diesen. Dieser neue Tag wiederum triggert dann den Vercel Deployment Workflow für Production!

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Sehr linearer, nachvollziehbarer Ablauf (Merge -> CI -> Tag -> Vercel Prod).
- **Negativ:**
  - Alle Tests (inklusive E2E) laufen nun auf PRs gegen `main`, was Feature-PRs leicht verzögert.
