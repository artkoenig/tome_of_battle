---
status: backlog
branch:
pr:
---

# Kostenart-Grenze mit `includeChildSelections="false"` zählt Nachfahren mit

## Intent

Seit dem Merge von Issue 083 (Commit 17ec346, PR #169) ist `main` rot:
`src/evaluator/countIndex.costSumUnderCarrier.test.js` („Kostenart-Grenze am
Eintrag: `includeChildSelections="false"` bleibt bei der engeren Lesart →
liest nur die Kosten des Trägers und feuert deshalb nicht", der
Issue-091-Test) schlägt fehl — verifiziert identisch auf `origin/main`
(b67e93c) und auf dem 0085-Branch (2026-07-29, per Worktree-Gegenprobe).

Vermutete Ursache (Analyse aus dem 0085-Lauf): `countingFlagsOf`
(`src/evaluator/constraints.js:73-80`) hebt `includeChildSelections` für
geteilte, eintrags-verankerte `scope="roster"`-Grenzen an, ohne auf
`field="selections"` einzuschränken — eine **Kostenart**-Grenze mit
`includeChildSelections="false"` zählt dadurch verschachtelte Kosten mit und
widerspricht §7.6 („just scope's field", Issue 091). Kollision der
Entscheidungen aus Issue 083 und Issue 091.

Acceptance criteria:

1. Eine geteilte Kostenart-Grenze (`field="<costTypeId>"`, `scope="roster"`,
   `includeChildSelections="false"`) an einem Eintrag summiert nur die Kosten
   des Trägers, nicht die der Nachfahren (§7.6, Issue 091).
2. Das Issue-083-Verhalten (armeeweite Selektions-Grenze trifft auch
   verschachtelte Vorkommen) bleibt erhalten.
3. `npx vitest run src/evaluator` ist vollständig grün — mit Kommando, Umfang
   und Exit-Code belegt.

## Plan

## Tasks

## Decisions

## Log

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
