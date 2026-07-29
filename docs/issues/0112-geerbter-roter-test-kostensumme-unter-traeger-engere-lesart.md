---
status: backlog
branch:
pr:
---

# Geerbter roter Test: Kostensummen-Grenze feuert trotz `includeChildSelections="false"`

## Intent

Die Evaluator-Suite ist auf dem aktuellen `main`-Stand nicht grün: in
`src/evaluator/countIndex.costSumUnderCarrier.test.js` schlägt der Fall
„engere Lesart `includeChildSelections=false`" fehl — die Kosten-Grenze
liest Ist 110, obwohl sie laut Test nicht feuern dürfte. Der Befund ist
**vorbestehend**: er fällt identisch am Branchpunkt `b67e93c` (vor allen
Issue-086-Commits), belegt im Run von Issue 0086 (Log, 2026-07-29), und
stammt vermutlich aus dem Umfeld von Issue 083 (PR #169, Doppelverweis-
Grenzen).

Repro: `npx vitest run src/evaluator/countIndex.costSumUnderCarrier.test.js`
auf `main` — Exit-Code 1.

Zu klären ist zuerst die Fachfrage, dann der Fix: gilt die engere Lesart
(„just `scope`'s `field`", BSData §7.6) für die unter die Träger-Id
aufgestiegenen Kostenanteile (Issue 091), oder ist der Test veraltet?

Acceptance criteria:

1. Es ist entschieden und im Issue belegt, welche Seite recht hat — der
   Test (die engere Lesart unterdrückt die aufgestiegenen Kostenanteile)
   oder die heutige Zählung; die Entscheidung ist aus der BSData-Doku
   bzw. den Katalogdaten begründet.
2. `npx vitest run src/evaluator/countIndex.costSumUnderCarrier.test.js`
   endet mit Exit-Code 0 — durch Fix der Zählung oder begründete
   Korrektur des Tests, je nach Entscheidung aus Kriterium 1.
3. `npx vitest run src/evaluator` ist insgesamt grün (Exit-Code 0).

## Plan

## Tasks

## Decisions

## Log

- 2026-07-29 — Bisect im Run von Issue 0102 (Implementer): grün bei
  `872eb8a`, rot ab `17ec346` — PR #169 (Issue 083, „Count constraint
  selections below the carrier") hat die Regression eingeführt. Die
  Vermutung aus dem Intent ist damit bestätigt.

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
