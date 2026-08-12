---
status: done
branch:
pr:
---

# `scope="force"`-Zählung verschachtelter Vorkommen ist unentschieden

## Intent

Issue 083 hat entschieden: eine geteilte, eintragsverankerte Grenze mit
`scope="roster"` zählt **alle** Vorkommen ihres Eintrags im Roster, auch
verschachtelte, unabhängig von `includeChildSelections="false"` (bsdata-Doku
§7.6: unangekreuzt heißt „just `scope`'s `field`", nicht „nichts"). Die
Umsetzung (`countingFlagsOf`, `src/evaluator/constraints.js`) ist bewusst auf
`scope="roster"` verengt.

Das `scope="force"`-Analogon bleibt damit stumm: eine geteilte max-1-Grenze an
einem shared Entry, `includeChildSelections="false"`, zwei verschachtelte
Vorkommen unter zwei Helden in **einem** Kontingent → kein Verstoß
(reproduziert in Review-Runde 1 von Issue 083; Repro-Skript
`repro-force.mjs` im Scratchpad jener Session, Minimal-Katalog, druckt
„silent").

Ob die Referenz diese Vorkommen zählt, entscheidet die zitierte Wiki-Stelle
nicht — sie spricht wörtlich von *„in roster in total"*. Die Fachfrage ist
also offen und muss vor einer Implementierung entschieden werden (Datenbeleg
aus realen Katalogen oder Referenzverhalten, wie bei Issue 077/079).

Acceptance criteria:

1. Die Fachfrage ist entschieden und mit Beleg dokumentiert (bsdata-Doku
   und/oder Decisions dieses Issues): zählt eine geteilte, eintragsverankerte
   `scope="force"`-Grenze mit `includeChildSelections="false"` verschachtelte
   Vorkommen im Kontingent?
2. Die Engine folgt der Entscheidung; der Repro-Fall aus Review-Runde 1 von
   Issue 083 verhält sich entsprechend (feuert oder schweigt — je nach
   Entscheidung, mit Test).
3. Die Evaluator-Suite (inkl. E2E-Runner) bleibt grün — mit Kommando, Umfang
   und Exit-Code belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Beyond-Criteria-Fund der Review-Runde 1 von Issue 083
  (2026-07-29), mit ausgeführtem Repro gegen die echte Fassade. Bewusst nicht
  im 083-Lauf gefixt: außerhalb dessen Intents, und die Fachfrage ist offen.

## Log

- 2026-08-12 — Closed: decided and implemented elsewhere. `countingFlagsOf`
  (`src/evaluator/constraints.js:91-98`) now treats `scope="force"` like
  `scope="roster"` — a shared, entry-anchored limit counts the nested
  occurrences of its entry inside the contingent regardless of
  `includeChildSelections="false"`, and the code comment carries the reason
  (§7.6, "unchecked means just scope's field"). The review-round-1 repro of
  issue 083 is pinned by `src/evaluator/constraints.forceScopeNestedOccurrences.test.js`,
  which arrived with PR #204 during the coverage campaign. Verified on
  2026-08-12: `npx vitest run src/evaluator` → 92 files, 1689 tests, exit 0.

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
