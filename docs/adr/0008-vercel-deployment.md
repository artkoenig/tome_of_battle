# 0008: Native Vercel Integration

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0007: CI/CD Workflow](0007-ci-cd-workflow.md), [ADR 0009: Branching and Release Strategy (Trunk-based)](0009-branching-and-release-train-strategy.md), [ADR 0019: Manuelle Versionierung und Release-Freigabe](0019-manuelle-versionierung-und-release-freigabe.md), [ADR 0025: GitHub-Pages-Quelle auf Actions](0025-pages-quelle-auf-github-actions-mit-jekyll-build.md)

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

### 2. Visuelle Umgebungserkennung (Badge) — entfernt
Der Build-Prozess (`scripts/deployEnv.js`) bestimmt weiterhin, ob ein Build
`production` oder `preview` ist. Das dafür ursprünglich eingeführte
`VORSCHAU`-Badge im Header wurde jedoch wieder entfernt (siehe
[ADR 0019](0019-manuelle-versionierung-und-release-freigabe.md)):
Nicht-`main`-Builds sind stattdessen über den Hash-Zusatz an der angezeigten
Versionsnummer (`<Version>+<Kurz-Hash>`) erkennbar, ohne ein separates
UI-Element.

**Nachtrag ([ADR 0021](0021-preview-badge-laufzeit-hostname-erkennung.md)):**
Diese Begründung galt für die Unterscheidung nach Branch, nicht nach
ausgelieferter Domain — ein `main`-Build läuft seit ADR 0019 sowohl auf der
Vercel-Branch-Alias-URL als auch (nach manuellem Promoten) auf der echten
Produktions-Domain, ohne dass der Hash-Suffix das unterscheiden kann. Für
diesen Fall wurde ein Preview-Badge wieder eingeführt, das zur Laufzeit den
Hostname vergleicht.

### 3. Abgrenzung zu GitHub Pages

Seit [ADR 0025](0025-pages-quelle-auf-github-actions-mit-jekyll-build.md)
veröffentlicht das Repository zusätzlich über **GitHub Pages** — den
Zustandsbericht und den `docs/`-Baum. Das berührt diese Entscheidung nicht:

- **Vercel liefert die Anwendung aus.** Nur hier gelten *Deployment*, *Release*
  und *Production* im Sinne des Glossars (`CONTEXT.md`).
- **Pages liefert Projektdokumentation aus** — nie ein Build der Anwendung. Die
  Pages-Veröffentlichung ist weder ein Deployment noch ein Release; sie hat kein
  Freigabe-Gate, weil sie nichts freizugeben hat.

Die beiden Wege sind vollständig entkoppelt: kein Pages-Lauf beeinflusst ein
Vercel-Deployment und umgekehrt.

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Extrem einfaches Setup ohne zusätzliche Pipeline-Schritte oder Secrets.
  - Vercel übernimmt die gesamte Orchestrierung nativ.
- **Negativ:**
  - *(Ursprünglich, bis [ADR 0019](0019-manuelle-versionierung-und-release-freigabe.md)):* Pushes auf `main` waren sofort live, ohne Freigabeschranke. Seit ADR 0019 wird jedes Production-Deployment erst durch manuelles Promoten live geschaltet — eine solide Testabdeckung in der CI bleibt trotzdem unerlässlich, da sie vor dem Promoten die einzige automatisierte Absicherung ist.
