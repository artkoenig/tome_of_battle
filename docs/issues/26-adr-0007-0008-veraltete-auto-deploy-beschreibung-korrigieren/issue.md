Status: resolved
Type: chore
Blocked by: None

## Description
Seit der Nutzer das automatische Vercel-Deployment bei Push auf `main`
manuell abgeschaltet hat (Releases laufen jetzt über manuelles Promoten,
siehe [ADR 0019](../../adr/0019-manuelle-versionierung-und-release-freigabe.md)),
sind zwei ADRs sachlich falsch:

- [ADR 0008](../../adr/0008-vercel-deployment.md): Titel/Entscheidungsergebnis
  beschreiben "Push auf `main` löst ein Production-Deployment aus (Live-App)"
  als aktuellen Zustand — stimmt nicht mehr.
- [ADR 0007](../../adr/0007-ci-cd-workflow.md) §3: wiederholt dieselbe
  Behauptung im Kontext des CI/CD-Workflows.

Diese Korrektur ist rein dokumentarisch (keine Code-Änderung) und
unabhängig vom bereits umgesetzten main-issue 20
(manueller-release-und-versionierungs-workflow) — sie wäre auch ohne dieses
Feature fällig, weil sie einen bereits vollzogenen, externen Konfigurationswechsel
in Vercel nachzieht.

### Solution
Beide ADRs werden auf den tatsächlichen Zustand korrigiert: Push auf `main`
löst weiterhin ein Production-**Deployment** aus (Vercel baut), aber keine
automatische **Freigabe** mehr — die Production-Domain wird erst durch
manuelles Promoten in Vercel aktualisiert. Die ursprüngliche
Entscheidungshistorie (warum 2026-07-13 auf native Integration umgestellt
wurde) bleibt erhalten; nur die inzwischen überholten Tatsachenbehauptungen
werden präzisiert bzw. als überholt markiert.

### Out of Scope
- Erneute Grundsatzentscheidung zwischen Auto-Deploy und manuellem Promoten
  (bereits getroffen, siehe ADR 0019).
- Code-/Workflow-Änderungen.

## Acceptance Criteria
- [x] ADR 0008 beschreibt Push-auf-`main` korrekt als "Deployment ausgelöst,
      aber keine automatische Freigabe/Promotion mehr".
- [x] ADR 0007 §3 wird entsprechend angepasst, keine widersprüchliche
      Aussage mehr zwischen den beiden ADRs.
- [x] Ursprüngliche Entscheidungshistorie (Datum, Optionen, Begründung von
      2026-07-13) bleibt erhalten, nur die überholten Tatsachenbehauptungen
      werden korrigiert.

## Comments
- ADR 0007 Paragraph 3 und ADR 0008 Abschnitt 1 sowie die Negativ-Konsequenz korrigiert: Push auf main loest weiterhin ein Deployment aus, aber keine automatische Freigabe mehr (seit ADR 0019, manuelles Promoten). Entscheidungshistorie beider ADRs unveraendert erhalten, nur die ueberholten Tatsachenbehauptungen korrigiert. Rein dokumentarisch, keine Code-Aenderung. Hinweis: referenziert ADR 0019, das erst mit PR #63 nach main gelangt - dieser PR sollte daher nach PR #63 gemerged werden (oder nach dessen Merge rebased werden).
