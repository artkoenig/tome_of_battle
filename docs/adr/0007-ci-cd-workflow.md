# 0007: CI/CD Workflow

- **Status:** Accepted
- **Datum:** 2026-07-05
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Keine

## Kontext und Problemstellung

Da *Tome of Battle* eine komplexe Client-Side Webanwendung (React + Vite PWA) mit automatisierten E2E-Tests, Unit-Tests und automatischem Deployment über Vercel ist, muss sichergestellt werden, dass die Codequalität auf Haupt- und Staging-Branches kontinuierlich gewahrt bleibt. Manuelle Tests vor jedem Merge sind fehleranfällig und bremsen den Entwicklungsprozess aus. Zudem sollen wiederkehrende administrative Aufgaben (wie das Umschreiben von PR-Zielen für KI-Assistenten oder die Prüfung auf veraltete Dokumentation) automatisiert werden.

## Entscheidungsfaktoren (Drivers)

- **Zuverlässigkeit:** Nur lauffähiger und ordentlich formatierter Code darf auf `staging` und `main` gelangen.
- **Entwicklungsgeschwindigkeit:** Feedback-Schleifen müssen schnell und effizient sein (E2E-Tests sollen nicht jeden kleinen Feature-PR unnötig verzögern).
- **Dokumentationskonsistenz:** Verhinderung von veralteten Dokumentationen ("Doku-Drift") durch automatische Abgleiche.
- **Release-Automatisierung:** Automatische Versionierung und Release-Tagging im Git-Repository.

## Betrachtete Optionen

- **Option 1:** Ein einziger, großer CI-Job, der bei jedem PR und Push alle Tests (inklusive E2E) ausführt und alles blockiert, bis er fertig ist.
- **Option 2:** Aufteilung in fokussierte und bedingte Workflows (GitHub Actions) je nach Branch (`staging` vs. `main` vs. Feature-Branches) und Automatisierungszweck.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Bedarfsgerechte GitHub-Workflows)**.

Es wurden folgende vier Workflows etabliert:

### 1. CI Workflow (`.github/workflows/ci.yml`)
- **Trigger:** Läuft bei Pushes und PRs gegen `staging` und `main`.
- **Jobs:**
  - **Lint & Unit-Tests:** Führt `npm run lint` und `npx vitest run` aus. Läuft ohne Chromium-Download (`PUPPETEER_SKIP_DOWNLOAD: 'true'`) für maximale Geschwindigkeit.
  - **E2E-Tests (nur staging):** Führt `src/solver/ui.test.js` mit einem echten, frisch installierten Chromium-Browser via Puppeteer aus. Dieser Job läuft **nur** bei PRs oder Pushes gegen den `staging`-Branch, um Feature-PRs nicht unnötig auszubremsen.

### 2. Doku-Abgleich (`.github/workflows/doc-drift-check.yml`)
- **Trigger:** Läuft nach jedem Merge/Push auf den `staging`-Branch.
- **Ablauf:** Verwendet die `anthropics/claude-code-action` und das Modell `claude-opus`, um den Commit-Diff mit den Markdown-Dateien zu vergleichen. Stellt der Bot fest, dass die Dokumentation (z. B. `CLAUDE.md`, ADRs, `docs/`) veraltet ist, korrigiert er die Doku selbständig und öffnet einen neuen PR gegen `staging`.

### 3. PR-Ziel umbiegen (`.github/workflows/retarget-claude-prs.yml`)
- **Trigger:** Läuft mit Schreibrechten (`pull_request_target`), wenn ein PR von einem Branch namens `claude/*` gegen `main` geöffnet wird.
- **Ablauf:** Biegt die Ziel-Basis des PRs automatisch von `main` auf `staging` um, um den Release-Train-Prozess (Features gehen immer zuerst über Staging) einzuhalten.

### 4. Tag Release (`.github/workflows/tag-release.yml`)
- **Trigger:** Läuft nach jedem Push/Merge auf `main`.
- **Ablauf:** Führt `scripts/tag-release.js` aus, um basierend auf den vorhandenen Tags die nächste Minor-Version (vMAJOR.MINOR.0) zu generieren, erzeugt den Git-Tag und pusht diesen.

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Schnelle Feature-PRs, da die langwierigen E2E-Tests erst bei der Integration auf `staging` ausgeführt werden.
  - Automatischer Schutz vor Doku-Veraltung durch die Doku-Drift-KI.
  - Konsistente Versionierung und automatisches Release-Management.
- **Negativ:**
  - Höhere Komplexität durch mehrere verschiedene YAML-Workflow-Dateien.
  - API-Limit-Verbrauch und Token-Verwaltung für die GitHub-Workflows.
