# 0008: Vercel Deployment via CLI

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0007: CI/CD Workflow](0007-ci-cd-workflow.md), [ADR 0009: Branching and Release Train Strategy](0009-branching-and-release-train-strategy.md)

## Kontext und Problemstellung

Die native Vercel-GitHub-Integration deployt den Default-Branch (`main`) immer zwingend als "Production" (auf den Live-Domains). Wir möchten jedoch, dass `main` lediglich eine Vorschau (Preview) ist, während erst explizite Git-Tags (`v1.x.x`) das Production-Deployment auslösen sollen. Dies lässt sich nicht über Vercels native GitHub-Integration abbilden.

## Entscheidungsfaktoren (Drivers)

- **Kontrolle:** Exakte Kontrolle, wann ein Production-Deploy stattfindet (nur bei getaggten Releases).
- **Kosteneffizienz:** Keine Deployments für jeden winzigen Commit auf unzähligen Feature-Branches.
- **Transparenz:** Visuelle Unterscheidung der Vorschau-Umgebung von der Live-App.

## Betrachtete Optionen

- **Option 1:** Dummy-Branch als Production in Vercel konfigurieren und `main` manuell mergen.
- **Option 2:** Vercel GitHub-Integration abschalten und stattdessen Vercel CLI über eigene GitHub Actions Workflows steuern.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Vercel CLI per GitHub Action)**.

Folgende Richtlinien und Mechanismen wurden etabliert:

### 1. Umgebungs-Mapping & CLI-Steuerung
Die automatische Git-Integration in Vercel ist deaktiviert. Deployments laufen komplett über den GitHub Workflow `deploy-vercel.yml` unter Verwendung der Vercel CLI:
- **Pushes auf Feature-Branches:** Lösen **kein** Deployment aus.
- **Branch `main`:** Löst ein Vercel **Preview** Deployment aus.
- **Git Tags (`v*`):** Lösen ein Vercel **Production** Deployment aus (mit Parameter `--prod`).

### 2. Visuelle Umgebungserkennung (Badge)
Da Vercel CLI die Umgebungsvariablen (`VERCEL_ENV`) korrekt injiziert, kann der React-Client diese auslesen:
- Ist die gebaute Umgebung `preview` (also `main`), blendet die App ein `VORSCHAU`-Badge ein.
- Ist die gebaute Umgebung `production` (getaggter Release), bleibt das UI unmarkiert.

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Absolute Kontrolle über Production-Releases über Git-Tags.
  - Einsparung von Build-Minuten, da reine Feature-Branches nicht mehr auf Vercel gebaut werden.
- **Negativ:**
  - Erfordert das Hinterlegen der Vercel-Tokens (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) in den GitHub Secrets.
