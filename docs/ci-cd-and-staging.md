# CI/CD & Staging-Umgebung

Dieses Dokument beschreibt die Betriebsabläufe rund um Deployments, die Staging-Umgebung und die CI/CD-Pipelines. Die zugrundeliegenden technischen Entscheidungen sind in [ADR 0006: Testing and Automation](adr/0006-testing-and-automation.md) und [ADR 0007: CI/CD Workflow](adr/0007-ci-cd-workflow.md) dokumentiert.

---

## 1. Deployment-Modell (Vercel)

Die Anwendung ist eine reine Client-Side PWA. Vercel baut und deployt das Projekt bei jedem Push automatisch:

- **Branch `main`** → **Production** (Live-App unter der Haupt-Domain).
- **Branch `staging`** → feste **Staging-URL** (Branch-Alias von Vercel).
- **Jeder andere Branch/PR** → automatischer **Preview-Deploy** mit dynamischer URL.

### Staging-Badge & Erkennung
Auf Staging- und Vorschau-Umgebungen zeigt die App oben links einen Badge (`STAGING` bzw. `VORSCHAU`). Auf Production und im lokalen Entwicklungsbetrieb bleibt der Badge unsichtbar.
- Die Erkennung erfolgt im Build-Prozess (`scripts/deployEnv.js`), der `VERCEL_TARGET_ENV` ausliest und als `import.meta.env.VITE_DEPLOY_ENV` bereitstellt.
- Da Staging unter einer eigenen URL läuft, sind die IndexedDB-Datenbanken (importierte Kataloge, Roster) vollständig von der Live-App isoliert.

---

## 2. Der Release-Train (Workflow)

Neue Features und Fehlerbehebungen werden über einen Release-Train von der Entwicklung bis auf Production überführt:

```
feature/xyz ──PR (Squash)──▶ staging ──(Testen auf Staging-URL)──▶ PR (Merge)──▶ main ──▶ Production
```

### Schritt 1: Feature-Entwicklung
- Feature-Branch erstellen und lokal testen.

### Schritt 2: PR gegen `staging`
- PR gegen den Branch `staging` öffnen (wird durch GitHub Actions automatisch auf `staging` umgebogen, falls der PR fälschlicherweise gegen `main` gerichtet war).
- Der PR wird nach erfolgreichem CI-Lauf **per Squash-Merge** in `staging` integriert. Das sorgt dafür, dass jedes Feature als genau ein Commit in der Historie auftaucht.

### Schritt 3: Testen auf Staging
- Die Änderungen auf der stabilen Staging-URL testen (die URL ist im Vercel-Dashboard oder als PR-Kommentar zu finden).

### Schritt 4: Promotion nach `main`
- Um die Änderungen live zu schalten, wird ein PR von **`staging` nach `main`** geöffnet.
- **WICHTIG:** Dieser PR darf **NICHT gesquasht** werden! Es muss ein **normaler Merge-Commit** durchgeführt werden, da die Versions- und Changelog-Generierung auf `main` die einzelnen Commit-Betreffs seit dem letzten Tag ausliest.

---

## 3. GitHub Actions Pipelines

Die GitHub Actions automatisieren Qualitätssicherung und Releases. Technische Details zu den Workflows findest du in [ADR 0007](adr/0007-ci-cd-workflow.md).

| Workflow | Trigger | Aufgabe |
| :--- | :--- | :--- |
| **CI (Lint & Tests)** | PR/Push auf `staging` / `main` | Führt Linting (`oxlint`) und Unit-Tests aus. Bei PRs/Pushes gegen `staging` wird zusätzlich der Puppeteer-E2E-Smoke-Test ausgeführt. |
| **PR-Basis umstellen** | PR geöffnet gegen `main` | Biegt PRs von `claude/*`-Branches automatisch auf `staging` um. |
| **Doku-Abgleich (Drift)** | Push auf `staging` | Gleicht den geänderten Code-Diff mit der Dokumentation ab und öffnet bei Abweichungen automatisch einen Korrektur-PR. |
| **Tag Release** | Push auf `main` | Taggt die Version automatisch als neuen Minor-Release-Tag (`vMAJOR.MINOR.0`) im Git-Repository. |
| **Issue Agent** | Issue / Kommentar | Analysiert gemeldete Issues via Claude und setzt sie bei Freigabe um. |

---

## 4. Lokale Befehle (Spickzettel)

| Aktion | Befehl | Beschreibung |
| :--- | :--- | :--- |
| **Dev-Server** | `npm run dev` | Startet den lokalen Vite-Entwicklungsserver mit Hot Module Replacement (HMR). |
| **Build erstellen** | `npm run build` | Erstellt das Produktions-Bundle und generiert eine neue Service-Worker-Cacheversion sowie die `changelog.json`. |
| **Lokal testen** | `npm test` | Führt nacheinander alle Unit-Tests (Vitest) und den Puppeteer-E2E-Smoke-Test aus. |
| **Einzelne Tests** | `npx vitest run <path>` | Führt gezielt eine einzelne Testdatei aus. |
| **UI-Debugging** | `node scripts/debug_ui.js` | Führt ein interaktives Puppeteer-Debugging auf macOS aus. |
| **Screenshots** | `node scripts/generate_screenshots.js` | Erzeugt Screenshots der aktuellen Benutzeroberfläche zur Review. |
