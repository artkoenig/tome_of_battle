# 0008: Native Vercel Integration

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0007: CI/CD Workflow](0007-ci-cd-workflow.md), [ADR 0009: Branching and Release Strategy (Trunk-based)](0009-branching-and-release-train-strategy.md), [ADR 0019: Manuelle Versionierung und Release-Freigabe](0019-manuelle-versionierung-und-release-freigabe.md)

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

### 1. Umgebungs-Mapping — Freigabe seit ADR 0019 manuell
Vercel baut weiterhin automatisch bei jedem Push über die native
GitHub-Integration:
- **Push auf `main`:** Löst ein Production-**Deployment** aus, aber seit
  [ADR 0019](0019-manuelle-versionierung-und-release-freigabe.md) **keine
  automatische Freigabe mehr**. Die Production-Domain wird erst durch
  manuelles Promoten des gewünschten Deployments in Vercel aktualisiert.
- **Push auf andere Branches / PRs:** Löst weiterhin ein Preview-Deployment
  mit dynamischer URL aus.
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
  - *(Ursprünglich, bis [ADR 0019](0019-manuelle-versionierung-und-release-freigabe.md)):* Pushes auf `main` waren sofort live, ohne Freigabeschranke. Seit ADR 0019 wird jedes Production-Deployment erst durch manuelles Promoten live geschaltet — eine solide Testabdeckung in der CI bleibt trotzdem unerlässlich, da sie vor dem Promoten die einzige automatisierte Absicherung ist.
