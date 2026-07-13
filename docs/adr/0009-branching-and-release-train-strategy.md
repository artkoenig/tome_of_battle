# 0009: Branching and Release Strategy (Trunk-based)

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0001: Record Architecture Decisions](0001-record-architecture-decisions.md), [ADR 0007: CI/CD Workflow](0007-ci-cd-workflow.md), [ADR 0008: Native Vercel Integration](0008-vercel-deployment.md)

## Kontext und Problemstellung

Die frühere "Release Train"-Strategie mit einem dezidierten `staging`-Branch hat sich als zu schwerfällig erwiesen. Entwickler mussten zweistufig mergen (erst auf Staging, dann auf Main), was den Workflow verlangsamte. Eine simplere Trunk-based Strategie (GitHub Flow) mit automatisiertem Deployment über Tags ist flüssiger.

## Entscheidungsfaktoren (Drivers)

- **Entwicklungsgeschwindigkeit:** Direkter Pfad von Feature zu Hauptzweig.
- **Einfachheit:** Weniger Branches bedeuten weniger Konflikte und kognitive Last.
- **Klarheit im Deployment:** `main` entspricht stets einer testbaren Vorabversion, während Releases explizit getaggt werden.

## Betrachtete Optionen

- **Option 1 (Release Train):** Mit separatem `staging`-Branch.
- **Option 2 (GitHub Flow / Trunk-based):** Features fließen direkt in `main`. Releases werden über Git-Tags gesteuert.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (GitHub Flow / Trunk-based)**.

Der Integrations- und Veröffentlichungsprozess folgt nun diesen verbindlichen Schritten:

```
feature/xyz ──PR (Squash-Merge)──▶ main (Live) ──▶ git tag vX.Y.Z (Changelog)
```

### 1. Branch-Struktur
- **Feature-Branches:** Entwicklung neuer Features oder Bugfixes erfolgt auf isolierten Branches (z. B. `claude/feature-name` oder `feat/feature-name`).
- **`main`:** Der Trunk. Alle PRs werden hierhin gemerged. Er spiegelt stets die produktive Live-Version wider.
- Einen speziellen `staging`-Branch gibt es nicht mehr.

### 2. Integration in `main` (Squash-Merge)
- Feature-PRs werden grundsätzlich gegen `main` geöffnet.
- Beim Zusammenführen in `main` wird **zwingend ein Squash-Merge** durchgeführt.
- **Grund:** Die automatisierte Changelog-Generierung auf `main` liest alle einzelnen Commit-Subjects seit dem letzten Release-Tag aus. Ein Squash-Merge pro Feature sorgt für saubere, lesbare Release Notes unter "Was ist neu".

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Viel schnellerer Ablauf ohne lästige Doppel-Merges.
  - Vercel-Previews auf Feature-PRs geben sofortiges Feedback vor dem Live-Gang.
- **Negativ:**
  - Code auf `main` muss immer release-fähig sein, da `main` direkt live geschaltet wird.
