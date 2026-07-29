---
status: active
branch: claude/113-umsetzen-uda71x
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

- **Kein neuer Test vom test-author** (default, unanswered): Der rote Test für
  Kriterium 1 existiert bereits (`countIndex.costSumUnderCarrier.test.js`,
  Issue-091-Test „liest nur die Kosten des Traegers"), Kriterium 2 ist durch
  `constraints.carrierDescendants.test.js` gepinnt (alle Issue-083-Fixtures
  nutzen `field="selections"`). Ein Duplikat schriebe denselben Test noch einmal.
- **Fix-Ort**: `countingFlagsOf` (`src/evaluator/constraints.js`) hebt
  `includeChildSelections` nur noch für Grenzen mit
  `field.kind === SELECTION_COUNT` an — die Issue-083-Regel sprach von
  Selektions-Grenzen; für Kostenart-Grenzen gilt §7.6 „just scope's field"
  (Issue 091) unverändert.

## Log

- Rot reproduziert auf dem frischen Branch (von `origin/main`, b7cf2d6):
  `npx vitest run src/evaluator/countIndex.costSumUnderCarrier.test.js` →
  1 failed | 9 passed, exakt der im Intent beschriebene Test (Ist 110 statt 50
  gegen Grenze 100 — die Kostenart-Grenze zählt den Nachfahren mit).
- Fix umgesetzt: eine Zeile Guard in `countingFlagsOf`
  (`limit.field?.kind !== CountedFieldKind.SELECTION_COUNT` → hingeschriebene
  Flags), Doku-Kommentar der Funktion entsprechend erweitert.
- Erster voller Lauf `npx vitest run src/evaluator`: 1 failed | 743 passed —
  der Fehler war der bekannte 5-s-Timeout-Flake aus Issue 0110
  (`primary-catalogue-scope`, Roster 01), nicht diese Änderung; isolierter
  Lauf der Datei grün (126 passed).
- Belege per Exit-Code: `npx vitest run src/evaluator` → 59 Dateien,
  744 Tests, exit 0. `npm run lint` (oxlint) → exit 0. `npm run typecheck`
  (tsc --noEmit) → exit 0.

## Checkpoints

### Before implementation

- Does this match what was asked? Ja — Intent beschreibt Ursache und Fix-Ort
  präzise; die Reproduktion bestätigt die Analyse (die Anhebung in
  `countingFlagsOf` greift auch bei `COST_SUM`-Feldern).
- What surprised me? Nichts Wesentliches; die Analyse aus dem 0085-Lauf traf
  exakt zu.
- What am I assuming without having verified it? Dass keine weitere Stelle
  (z. B. `query.js`/`countIndex.js`) dieselbe Anhebung dupliziert — wird durch
  den vollständigen Evaluator-Lauf (Kriterium 3) abgesichert.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
