# 0008: Native Vercel Integration

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0007: CI/CD Workflow](0007-ci-cd-workflow.md), [ADR 0009: Branching and Release Strategy (Trunk-based)](0009-branching-and-release-train-strategy.md)

## Kontext und Problemstellung

Die Steuerung des Deployments über die Vercel CLI und eigene GitHub Actions Workflows brachte zusätzliche Komplexität mit sich und erforderte die Hinterlegung von Token-Secrets in GitHub. Wir möchten den Deployment-Prozess vereinfachen und auf die native GitHub-Integration von Vercel zurückgreifen, bei der `main` direkt produktiv geschaltet wird.

## Entscheidungsfaktoren (Drivers)

- **Einfachheit:** Keine benutzerdefinierten Deployment-Workflows oder CLI-Skripte.
- **Wartbarkeit:** Nutzung der nativen, von Vercel gepflegten GitHub-Integration.
- **Transparenz:** Visuelle Kennzeichnung von Vorschau-Umgebungen über das `VORSCHAU`-Badge.

## Betrachtete Optionen

- **Option 1:** Beibehalten des Vercel CLI-basierten Deployments via GitHub Actions (Tag-basiertes Release auf Production).
- **Option 2:** Rückkehr zur nativen Vercel-GitHub-Integration (Push auf `main` deployt direkt nach Production).

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Native Vercel-GitHub-Integration)**.

Folgende Richtlinien und Mechanismen wurden etabliert:

### 1. Umgebungs-Mapping
Das Deployment erfolgt vollautomatisch über die native Vercel-GitHub-Integration:
- **Push auf `main`:** Löst ein Production-Deployment aus (Live-App).
- **Push auf andere Branches / PRs:** Löst ein Preview-Deployment mit dynamischer URL aus.
- Der Git-Zweig `staging` wird komplett gelöscht.

### 2. Visuelle Umgebungserkennung (Badge)
Der Build-Prozess (`scripts/deployEnv.js`) bestimmt die Umgebung:
- Wenn der gebaute Branch `main` ist (oder `VERCEL_ENV` gleich `production`), wird die Umgebung als `production` eingestuft.
- Bei allen anderen Builds wird die Umgebung als `preview` eingestuft und das `VORSCHAU`-Badge wird links neben dem Logo eingeblendet.

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Extrem einfaches Setup ohne zusätzliche Pipeline-Schritte oder Secrets.
  - Vercel übernimmt die gesamte Orchestrierung nativ.
- **Negativ:**
  - Pushes auf `main` sind sofort live; es gibt keine tagbasierte Freigabeschranke mehr. Daher ist eine solide Testabdeckung in der CI unerlässlich.
