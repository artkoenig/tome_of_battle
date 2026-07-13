# PRD: Vereinfachung des Deployments und Bereinigung der Staging-Umgebung

## Problem Statement / Bug Description
- Die Codebasis enthält veraltete Kommentare, Code-Logiken (z. B. in `scripts/deployEnv.js`) und Testfälle, die sich auf eine nicht mehr existierende `staging`-Umgebung beziehen.
- Es existiert weiterhin ein lokaler (und eventuell entfernter) `staging`-Git-Branch, obwohl das Projekt bereits auf ein Trunk-based Deployment umgestellt wurde ([ADR 0009](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0009-branching-and-release-train-strategy.md)).
- Der Vercel-CLI-basierte GitHub Workflow (`deploy-vercel.yml`) verkompliziert das Deployment unnötig (erfordert Vercel-Token-Secrets in GitHub und steuert das Deployment manuell über Git-Tags für Production und `main` für Previews). Dies soll auf die native Vercel-GitHub-Integration zurückgeführt werden.
- Die Dokumentation für ADR 0008 ([0008-vercel-deployment-and-staging-environment.md](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0008-vercel-deployment-and-staging-environment.md)) trägt einen veralteten Dateinamen und beschreibt das CLI-basierte bzw. das staging-basierte Deployment, was aktualisiert werden muss.

## Solution
- Rückstandslose Bereinigung aller Erwähnungen der `staging`-Umgebung aus Kommentaren und Code-Dateien.
- Löschung des lokalen und remote vorhandenen `staging`-Git-Branches.
- Entfernung des GitHub Workflows `.github/workflows/deploy-vercel.yml`. Das Deployment wird wieder nativ von Vercel übernommen (Pushes auf `main` deployen direkt nach Production; Feature-Branches erzeugen Preview-Deployments).
- Anpassung von `scripts/deployEnv.js` und `scripts/deployEnv.test.js`, sodass der `main`-Branch standardmäßig als `production` eingestuft wird.
- Umbenennung des ADR-Dokuments `0008-vercel-deployment-and-staging-environment.md` in `0008-vercel-deployment.md` und Aktualisierung aller Querverweise im Projekt. Das ADR wird aktualisiert, um die native GitHub-Integration von Vercel zu dokumentieren.

## User Stories / Requirements
1. **Als Entwickler** möchte ich, dass keine Code-Stellen oder Kommentare mehr auf eine `staging`-Umgebung verweisen, um Fehlinterpretationen bei der lokalen Entwicklung oder Fehlersuche zu vermeiden.
2. **Als Release-Manager** möchte ich, dass der obsolete `staging`-Zweig im Git-Repository gelöscht ist, damit die Historie und die Branch-Übersicht übersichtlich bleiben.
3. **Als Administrator** möchte ich keine Vercel-Secrets in GitHub Actions pflegen müssen, sondern dass Vercel das Deployment nativ und sicher über seine GitHub-App steuert.
4. **Als Architektur-Chronist** möchte ich, dass die ADRs das native Vercel-Deployment akkurat beschreiben und richtig verlinkt sind.

## Technical Decisions
- **Betroffene Module & Pfade:**
  - [deployEnv.js](file:///Users/artkoenig/Workspace/army_builder/scripts/deployEnv.js): Zurücksetzen auf die Logik, bei der der Branch-Name `main` zu `production` führt. Entfernung von ungenutzten Branch-Mapping-Logiken.
  - [deployEnv.test.js](file:///Users/artkoenig/Workspace/army_builder/scripts/deployEnv.test.js): Hinzufügen von Tests für `branch: 'main' -> production` und Bereinigung aller `staging`-Testfälle.
  - [EnvBadge.jsx](file:///Users/artkoenig/Workspace/army_builder/src/components/EnvBadge.jsx): Überarbeitung des JSDoc-Kommentars.
  - [index.css](file:///Users/artkoenig/Workspace/army_builder/src/index.css): Bereinigung des CSS-Kommentars.
  - [vite.config.js](file:///Users/artkoenig/Workspace/army_builder/vite.config.js): Bereinigung des Kommentars zur Deploy-Umgebung.
  - **Dokumentations-Dateien:**
    - [0008-vercel-deployment-and-staging-environment.md](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0008-vercel-deployment-and-staging-environment.md) wird in `0008-vercel-deployment.md` umbenannt und inhaltlich auf die native Vercel-Integration (main -> prod) umgeschrieben.
    - Aktualisierung der Verweise in [README.md](file:///Users/artkoenig/Workspace/army_builder/docs/adr/README.md), [0007-ci-cd-workflow.md](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0007-ci-cd-workflow.md) und [0009-branching-and-release-train-strategy.md](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0009-branching-and-release-train-strategy.md).
- **Entfernte Dateien:**
  - [deploy-vercel.yml](file:///.github/workflows/deploy-vercel.yml) [DELETE]
  - [tag-release.yml](file:///.github/workflows/tag-release.yml) [DELETE]
  - [tag-release.js](file:///Users/artkoenig/Workspace/army_builder/scripts/tag-release.js) [DELETE]
- **Git-Aktionen:**
  - Lokale Löschung: `git branch -D staging`
  - Remote Löschung: `git push origin --delete staging`

## Testing Decisions
- **Zu testende Module:**
  - `scripts/deployEnv.js` (Unit-Tests).
- **Test-Schnittstellen (Seams):**
  - `resolveDeployEnv` Funktion in [deployEnv.test.js](file:///Users/artkoenig/Workspace/army_builder/scripts/deployEnv.test.js).
  - Ausführung des gesamten Test-Suites (`npm test`).

## Out of Scope
- Einrichtung eines anderen automatischen Tagging-Mechanismus. Tags werden fortan manuell gesetzt, wenn neue Versionen deklariert werden sollen.
