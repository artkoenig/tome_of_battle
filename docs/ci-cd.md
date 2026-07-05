# CI/CD-Pipeline

Vollständige Referenz aller automatisierten Abläufe rund um das Repo. Der
Release-Train (Feature → `staging` → `main`) selbst ist in
[`docs/staging-environment.md`](./staging-environment.md) beschrieben – dieses
Dokument erklärt, **was auf GitHub Actions und Vercel dabei passiert**.

## Überblick

Es gibt zwei Systeme, die ineinandergreifen:

- **GitHub Actions** – Lint, Tests, Release-Tags und PR-Automatisierung
  (Verzeichnis `.github/workflows/`).
- **Vercel** – baut und deployt bei **jedem Push** selbst; nicht über GitHub
  Actions gesteuert. Production ist `main`, Staging der Branch `staging`, jeder
  andere Branch bekommt einen Preview-Deploy.

```
 Feature-Branch (claude/*)
        │  PR öffnen
        ▼
   [retarget-claude-prs]  Basis main → staging umbiegen
        │
        ▼
   PR gegen staging ───────────────► [CI] Lint + Unit + E2E
        │  merge                                  │
        ▼                                          ▼
     staging ──────────────────────► Vercel Staging-Deploy
        │  (Push auf staging) ──────► [doc-drift-check] Doku ↔ Code, ggf. Korrektur-PR
        │  PR staging → main (normaler Merge)
        ▼
   PR gegen main ──────────────────► [CI] Lint + Unit  (kein E2E)
        │  merge / push
        ├──────────────────────────► [tag-release] Release-Tag vX.Y.0
        └──────────────────────────► Vercel Production-Deploy + „Was ist neu"

 (unabhängig davon: GitHub-Issues ──► [issue_agent] Analyse/Umsetzung)
```

## Workflows auf einen Blick

| Workflow | Datei | Auslöser | Zweck |
|---|---|---|---|
| CI (Lint & Tests) | `.github/workflows/ci.yml` | PR/Push auf `staging`/`main` | Lint, Unit-/Component-Tests, E2E (nur staging) |
| PR-Basis umstellen | `.github/workflows/retarget-claude-prs.yml` | PR `opened` gegen `main` | `claude/*`-PRs automatisch auf `staging` umbiegen |
| Tag Release | `.github/workflows/tag-release.yml` | Push auf `main` | Release-Tag `vX.Y.0` erzeugen und pushen |
| Doku-Abgleich | `.github/workflows/doc-drift-check.yml` | Push auf `staging` | Doku gegen den gemergten Code-Diff prüfen, bei Drift Korrektur-PR öffnen |
| Issue Agent | `.github/workflows/issue_agent.yml` | Issue/Kommentar | Issues per Claude analysieren und ggf. umsetzen |

---

## 1. CI (Lint & Tests) — `ci.yml`

**Auslöser:** `pull_request` und `push` jeweils gegen `staging` und `main`.
**Concurrency:** `ci-<ref>`, `cancel-in-progress: true` — ein neuer Push auf
denselben Ref bricht den vorherigen Lauf ab.

### Job `lint-and-test` (läuft immer)

1. Checkout
2. Node 20 (mit `npm`-Cache)
3. `npm ci`
4. `npm run lint` (oxlint)
5. `npx vitest run` — Unit-/Component-Tests

Setzt `PUPPETEER_SKIP_DOWNLOAD=true`, weil dieser Job keinen Browser braucht –
das spart den Chromium-Download beim `npm ci`.

### Job `e2e` (nur Staging)

Bedingung (`if`):

```
(pull_request && base_ref == 'staging') || (push && ref == refs/heads/staging)
```

Läuft also nur, wenn ein PR **gegen `staging`** geht oder auf `staging` gepusht
wird. Schritte: Checkout → Node 20 → `npm ci` →
`npx puppeteer browsers install chrome` → `node src/solver/ui.test.js`.

Der Puppeteer-E2E packt `public/catalogs/whfb6/*` zu einer ZIP, startet einen
Vite-Server auf Port 5175 und spielt Import → Roster bauen → Play als vollen
Smoke-Test durch. Er ist bewusst **nicht** im `main`-Zweig, damit die schnelle
Feedback-Schleife für Promotion-PRs (`staging → main`) nicht durch den langsamen
Browser-Lauf ausgebremst wird – auf Staging wurde ja bereits E2E-getestet.

> **Lokal:** `npm test` führt Unit-Tests **und** den E2E aus
> (`vitest run && node src/solver/ui.test.js`).

---

## 2. PR-Basis umstellen — `retarget-claude-prs.yml`

**Auslöser:** `pull_request_target`, `types: [opened]`, `branches: [main]`.
**Bedingung:** Head-Branch beginnt mit `claude/`.
**Permissions:** `pull-requests: write`.

Claude-Code öffnet Auto-PRs immer gegen den Default-Branch (`main`). Dieser
Workflow setzt die Basis eines frisch geöffneten `claude/*`-PRs per API auf
`staging` und hinterlässt einen kurzen Hinweis-Kommentar (best-effort, in
`try/catch` – schlägt der Kommentar fehl, bleibt das Umbiegen erfolgreich).

**Warum `pull_request_target` statt `pull_request`:** Er läuft mit Definition und
Token des **Basis-Branches**, greift daher auch für Feature-Branches, die vor
diesem Workflow entstanden, und hat Schreibrechte auf den PR. Das ist hier
ungefährlich, weil **kein PR-Code ausgecheckt oder ausgeführt** wird – es läuft
ausschließlich `actions/github-script` gegen die GitHub-API.

**Nur `opened`:** Wer die Basis danach bewusst wieder auf `main` stellt (echter
Hotfix-PR), wird nicht erneut überschrieben.

**Grenze:** Der Workflow ändert nur die *Basis*, er rebased nicht. Läuft `main`
mal vor `staging`, kann ein umgebogener PR einen fremden Commit mitzeigen – dann
den Feature-Branch einmalig auf `staging` rebasen. Aktiv wird der Workflow erst,
sobald er selbst auf `main`/`staging` liegt (`pull_request_target` nutzt die
Version aus dem Basis-Branch).

---

## 3. Tag Release — `tag-release.yml`

**Auslöser:** `push` auf `main`.
**Permissions:** `contents: write`.
**Concurrency:** `tag-release-main`, `cancel-in-progress: false` (Tag-Läufe
dürfen sich nicht gegenseitig abbrechen).

Schritte: Checkout mit **voller Historie + Tags** (`fetch-depth: 0`,
`fetch-tags: true`) → Node 20 → Git-Identität als `github-actions[bot]` →
`node scripts/tag-release.js`.

`scripts/tag-release.js` ist die **einzige** Stelle mit Push-Rechten für Tags.
Sie leitet über `resolveVersion` (`scripts/versioning.js`) den nächsten
**Minor**-Tag `vMAJOR.MINOR.0` ab und pusht ihn. Idempotent: Ist HEAD bereits
getaggt, passiert nichts. `AUTO_TAG_NO_PUSH=1` hält den Tag lokal (Tests).

**Zusammenspiel mit Vercel:** Vercels Build leitet dieselbe Version **read-only**
aus den Tags ab (`versionPlugin` in `vite.config.js`) und schreibt
`changelog.json`. Weil beide `resolveVersion` nutzen und ein bereits auf HEAD
liegender Tag wiederverwendet statt neu hochgezählt wird, stimmen Vercel und der
CI-Tagger immer überein – egal, wer zuerst läuft. Der Update-Toast der App holt
`changelog.json` frisch und zeigt „Was ist neu". **Major** wird nur manuell
gesetzt.

> **Changelog = Commit-Subjects seit dem letzten Release-Tag.** Deshalb jedes
> Commit-Subject auf `main` als deutschen Endnutzer-Satz formulieren – es landet
> wörtlich im „Was ist neu"-Toast. Beim Promoten `staging → main` **kein Squash**
> (sonst wird alles zu einer Changelog-Zeile).

---

## 4. Doku-Abgleich — `doc-drift-check.yml`

**Auslöser:** `push` auf `staging`.
**Permissions:** `contents: write`, `pull-requests: write`.
**Concurrency:** `doc-drift-staging`, `cancel-in-progress: false`.
**Secret:** `ANTHROPIC_API_KEY`.

Nach jedem Merge in den Staging-Zweig prüft `anthropics/claude-code-action@v1`
den gemergten Diff (`git diff <before>..<after>`) gegen die Dokumentation
(`CLAUDE.md`, `docs/`, `README*`, erklärende Kommentare in `.github/workflows/*`
und `vite.config.js`). Der **Code ist die Quelle der Wahrheit**: War eine
Code-Änderung gewollt und beschreibt eine Doku dadurch etwas Veraltetes, wird die
Doku angepasst. Es wird ausschließlich Dokumentation geändert, nie Code.

Bei gefundenem Drift öffnet der Lauf einen eigenen **Korrektur-PR** gegen
`staging` (Branch `docs/sync-staging-<sha>`) – kein Direkt-Commit. Passt bereits
alles, passiert nichts. Läuft der Korrektur-PR später auf `staging` ein, startet
der Workflow erneut, findet konsistente Docs und ist ein No-op – der Ablauf ist
damit **selbstbegrenzend**.

---

## 5. Issue Agent — `issue_agent.yml`

**Auslöser:** `issues: [opened]` und `issue_comment: [created]` (Kommentare des
`github-actions[bot]` werden ausgeschlossen, um Schleifen zu vermeiden).
**Permissions:** `issues: write`, `contents: write`, `pull-requests: write`.

Schritte: Checkout (volle Historie) → Python 3.11 + Node 22 →
`pip install anthropic PyGithub` und `npm ci` → `scripts/github_issue_agent.py`
(analysiert das Issue, Output `should_implement`) → bei `should_implement == true`
`anthropics/claude-code-action@v1` mit dem generierten Prompt
(`--model claude-opus-4-8 --max-turns 40`).

**Benötigte Secrets:** `ANTHROPIC_API_KEY`, `GITHUB_TOKEN` (Standard-Token von
Actions).

---

## Deployment (Vercel)

Läuft **außerhalb** von GitHub Actions – Vercel baut bei jedem Push:

- `main` → **Production** (Live-App), wird getaggt und veröffentlicht.
- `staging` → feste **Staging-URL** (Branch-Alias), kein Release-Tag.
- jeder andere Branch/PR → automatischer **Preview** mit eigener URL.

Die Umgebung wird im Build erkannt (`scripts/deployEnv.js`, bevorzugt
`VERCEL_TARGET_ENV`) und als `import.meta.env.VITE_DEPLOY_ENV` bereitgestellt; auf
Staging/Preview zeigt die App einen Umgebungs-Badge. Details in
[`docs/staging-environment.md`](./staging-environment.md).

## Secrets & Permissions (Kurzreferenz)

| Workflow | Permissions | Secrets |
|---|---|---|
| `ci.yml` | Default (read) | – |
| `retarget-claude-prs.yml` | `pull-requests: write` | – (Standard-`GITHUB_TOKEN`) |
| `doc-drift-check.yml` | `contents`, `pull-requests: write` | `ANTHROPIC_API_KEY` |
| `tag-release.yml` | `contents: write` | – (Standard-`GITHUB_TOKEN`) |
| `issue_agent.yml` | `issues`, `contents`, `pull-requests: write` | `ANTHROPIC_API_KEY` |

## Lokale Entsprechungen

| CI-Schritt | Lokal |
|---|---|
| Lint | `npm run lint` |
| Unit-/Component-Tests | `npx vitest run` |
| E2E (Puppeteer) | `node src/solver/ui.test.js` |
| Alles zusammen | `npm test` |
| Produktions-Build (inkl. `changelog.json`) | `npm run build` |
