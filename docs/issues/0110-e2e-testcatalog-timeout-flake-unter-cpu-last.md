---
status: done
branch:
pr:
---

# `e2e.testcatalog.test.js` flackert unter CPU-Last am 5-s-Timeout

## Intent

Unter CPU-Last (belegte Kerne, z. B. parallele Agent-Läufe) fällt
`npx vitest run src/evaluator` sporadisch rot: in
`src/evaluator/e2e.testcatalog.test.js` laufen einzelne Szenario-Tests in
`Test timed out in 5000ms`. Ursache-Befund aus dem Lauf zu Issue 0091
(2026-07-29): das langsamste Real-Katalog-Szenario braucht unbelastet ~4,0 s
gegen vitests 5-s-Default — die Reserve ist zu knapp. Reproduziert wurde der
Flake gezielt mit 16 CPU-Burnern auf 4 Kernen (3 Timeouts); vier unbelastete
Läufe danach waren grün. Vorbestehend, nicht durch die Änderung aus 0091
entstanden.

Ein Test, der nur unter Last kippt, ist kein Fakt per Exit-Code mehr: er
macht die Suite als Gate unzuverlässig.

Acceptance criteria:

1. Die Szenario-Tests in `e2e.testcatalog.test.js` haben ein ausreichendes
   Zeitbudget (oder sind so beschleunigt), dass die dokumentierte
   Last-Reproduktion (CPU-Überbuchung) keinen Timeout mehr erzeugt.
2. Ein unbelasteter Lauf `npx vitest run src/evaluator` bleibt grün — mit
   Kommando, Umfang und Exit-Code belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Nebenbefund des Implementer-Laufs zu Issue 0091 (2026-07-29),
  dort außerhalb der Absicht und deshalb nur gemeldet, nicht behoben.

## Log

- 2026-08-12 — Closed as a duplicate. Issue 0137 states the same defect (the
  evaluator E2E cases run against vitest's implicit 5 s default) with a sharper
  criterion set, including "the applicable limit is written down". The work
  continues there; nothing about this file is stale except its separate
  existence.

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
