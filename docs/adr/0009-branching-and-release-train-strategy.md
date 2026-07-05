# 0009: Branching and Release Train Strategy

- **Status:** Accepted
- **Datum:** 2026-07-05
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** [ADR 0001: Record Architecture Decisions](0001-record-architecture-decisions.md), [ADR 0007: CI/CD Workflow](0007-ci-cd-workflow.md), [ADR 0008: Vercel Deployment and Staging Environment](0008-vercel-deployment-and-staging-environment.md)

## Kontext und Problemstellung

Bei der gemeinsamen Entwicklung durch menschliche Entwickler und KI-Assistenten müssen Änderungen strukturiert integriert werden. Ein direkter Commit auf `main` birgt das Risiko von ungetesteten Fehlern im Live-Betrieb. Zudem wird eine automatisierte Release-Versionierung und Changelog-Generierung angestrebt, die eine lesbare und saubere Git-Historie voraussetzt.

## Entscheidungsfaktoren (Drivers)

- **Qualitätssicherung:** Jedes Feature muss vor dem Live-Gang auf Staging getestet werden.
- **Transparenz:** Nachvollziehbare Versions-Historie und automatisierte Generierung von Changelogs.
- **Feature-Isolation:** Saubere Trennung von in Entwicklung befindlichen Features.

## Betrachtete Optionen

- **Option 1 (GitHub Flow):** Features werden direkt in `main` gemerged. Releases erfolgen manuell oder ad-hoc.
- **Option 2 (Release Train mit Staging-Branch):** Ein Release Train Modell mit einem stabilen Zwischenschritt (`staging`) vor der Veröffentlichung auf `main`.

## Entscheidungsergebnis

Gewählte Option: **Option 2 (Release Train mit Staging-Branch)**.

Der Integrations- und Veröffentlichungsprozess folgt diesen verbindlichen Schritten:

```
feature/xyz ──PR (Squash-Merge)──▶ staging ──(Testen auf Staging-URL)──▶ PR (Normaler Merge)──▶ main
```

### 1. Branch-Struktur
- **Feature-Branches:** Entwicklung neuer Features oder Bugfixes erfolgt auf isolierten Branches (z. B. `claude/feature-name` oder `feat/feature-name`).
- **`staging`:** Sammelbecken für fertig entwickelte Features. Dient dem manuellen Testen und QA.
- **`main`:** Enthält ausschließlich den produktiven, stabilen und freigegebenen Code-Stand.

### 2. Integration in `staging` (Squash-Merge)
- Feature-PRs werden grundsätzlich gegen den Branch `staging` geöffnet (automatisch korrigiert bei `claude/*`-Branches, siehe [ADR 0007](0007-ci-cd-workflow.md)).
- Beim Zusammenführen in `staging` wird **zwingend ein Squash-Merge** durchgeführt.
- **Vorteil:** Die gesamte Historie eines Features wird zu einem einzigen, sauberen Commit zusammengefasst. Der PR-Titel wird dabei als Commit-Subject übernommen.

### 3. Promotion nach `main` (Normaler Merge-Commit)
- Um die gesammelten Features von Staging auf Production zu mergen, wird ein PR von **`staging` nach `main`** geöffnet.
- **WICHTIG:** Dieser PR darf **NICHT gesquasht** werden! Es muss ein **normaler Merge-Commit** durchgeführt werden.
- **Grund:** Die automatisierte Changelog-Generierung auf `main` liest alle einzelnen Commit-Subjects seit dem letzten Release-Tag aus. Ein Squash-Merge würde alle Features der gesamten Staging-Phase zu einer einzigen, unleserlichen Changelog-Zeile zusammenfassen.
- Die Commit-Subjects auf `main` werden direkt in der Benutzeroberfläche unter "Was ist neu" angezeigt. Daher müssen alle Feature-Commits aussagekräftig und benutzerfreundlich auf Deutsch formuliert sein.

---

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Garantierte Stabilität, da kein Code ungeprüft auf Production landet.
  - Saubere und lesbare Git-Historie durch selektives Squashen.
  - Vollautomatisch befüllter "Was ist neu"-Changelog.
- **Negativ:**
  - Disziplin beim Mergen erforderlich (kein versehentlicher Squash bei Staging-Promotions).
  - Mehraufwand durch zweistufiges Mergen bei schnellen Hotfixes.
