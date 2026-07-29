---
status: done
branch: claude/113-umsetzen-uda71x
pr: https://github.com/artkoenig/tome_of_battle/pull/173
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
- **Versions-Bump Patch 1.9.0 → 1.9.1** (default, unanswered): Der Fix ändert
  sichtbares Validierungsverhalten (Kostenart-Grenzen feuerten fälschlich),
  also ist ein Patch-Bump fällig; der Mensch war abwesend, Vorschlag gilt als
  Default und kann am PR noch geändert werden.
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
- Review-Runde 1 (frischer Kontext, Diff gegen Intent): **0 Befunde**. Alle
  drei Kriterien mit eigenen Exit-Code-Läufen belegt (Kriterium 1: 10/10 in
  `countIndex.costSumUnderCarrier.test.js`; Kriterium 2: 11/11 in
  `constraints.carrierDescendants.test.js`; Kriterium 3: 744/744, exit 0);
  Randfälle geprüft (FORCE_COUNT fällt mit aus der Anhebung — deckungsgleich
  mit der Decision; LIMIT_VALUE ist kein Constraint-Feld; Prozent-Nenner in
  `resolveBound` nutzt die Flags direkt, vordokumentiert; Kategorie-Anker
  bleiben durch den bestehenden ENTRY-Check ausgeschlossen). Triage: nichts zu
  fixen, keine Wiederholungsrunde nötig.

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

- Does this match what was asked? Ja — alle drei Kriterien vom frischen
  Reviewer bestätigt, der Diff ist minimal (ein Guard + Doku-Kommentar),
  `main` wird damit wieder grün.
- What surprised me? Wie sauber die Kollision 083/091 auf genau eine Zeile
  zurückfällt — beide Entscheidungen bleiben vollständig intakt.
- What am I assuming without having verified it? Dass `FORCE_COUNT`-Grenzen
  (`field="forces"`) zu Recht mit aus der Anhebung fallen — kein Kriterium und
  kein realer Katalogfall entscheidet das; als Default festgehalten (der
  Reviewer fand keinen Widerspruch).

## Retro

- **Was gut lief:** Der Intent aus dem 0085-Lauf war präzise genug, dass der
  Run ohne Grilling, Plan oder neuen Test auskam — Reproduktion, Ein-Zeilen-Fix,
  Review-Runde 1 mit 0 Befunden. Der Wert des Musters „Nebenbefund sauber als
  eigenes Issue filen" hat sich hier direkt ausgezahlt.
- **Was im Weg stand:** Der 0110-Flake (5-s-Timeout unter Last) hat den ersten
  vollen Suite-Lauf rot gefärbt und einen Verifikationsumweg gekostet — genau
  das im 0110-Intent beschriebene Problem („kein Fakt per Exit-Code mehr").
  Issue 0110 sollte bald drankommen; hier keine neue Beobachtung, nur eine
  Bestätigung.
- **Regel-Anmerkung:** Invariante 2 (test-author schreibt den roten Test) war
  hier korrekt durch den bereits existierenden roten Test erfüllt — kein
  Regel-Misfire, aber der Fall „der rote Test existiert schon" könnte im
  Rulebook explizit stehen; als Vorschlag fürs `metis`-Repo mitgenommen.
