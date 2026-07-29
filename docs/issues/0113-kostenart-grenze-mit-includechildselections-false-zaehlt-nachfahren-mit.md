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
- **Versions-Bump korrigiert auf 1.9.2** (default, unanswered): `main` trägt
  seit dem 0086-Merge selbst 1.9.1 — der Bump dieses Issues wäre ein No-op
  gewesen und der Tag-Workflow hätte nicht gefeuert. Patch-Bump auf dem
  gemergten Stand: 1.9.1 → 1.9.2.
- **Fix-Ort (Fassung 1, revidiert)**: `countingFlagsOf` hebt
  `includeChildSelections` nur noch für `SELECTION_COUNT`-Grenzen an. Von der
  CI widerlegt: der Guard ließ verschachtelte Träger-Vorkommen einer
  Kostenart-Grenze ganz aus der Summe fallen (0 statt Eigenkosten) — Verstoß
  gegen §9.4 („Ein Träger mit eigenen Kosten bringt diese in seine Summe
  ein"), sichtbar geworden an den frisch gemergten Issue-0086-Tests.
- **Fix-Ort (Fassung 2, gilt)**: Die zwei Bedeutungen des Flags werden
  getrennt. Der Zählindex führt die unter die Träger-Id **aufgestiegenen**
  Nachfahren-Kosten getrennt von den Eigen-Beiträgen (`climbedCostSums`,
  `countIndex.js`) mit eigenem Lese-Gate `includeClimbedCosts` (Default:
  `includeChildSelections`). Die 083-Anhebung in `countingFlagsOf` gilt wieder
  für **alle** Messgrößen (Vorkommens-Tiefe des Trägers), hält dabei aber
  `includeClimbedCosts` auf dem **hingeschriebenen** Flag fest — Eigen-Kosten
  jedes Vorkommens zählen (083/§9.4), Nachfahren-Kosten nur mit
  hingeschriebenem `true` (091/§7.6). Quelle: §7.6/§9.4 des Handbuchs plus die
  Issue-0086-Testlage; `docs/evaluator-architecture.md` §4.4 entsprechend
  korrigiert.

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
- **Überraschung (Stopp-Signal, nach dem PR):** CI am PR rot — `main` war
  nach Branch-Start um Issue 0086 (unit/ancestor-Scopes, PR #172)
  weitergewandert; 8 der neuen 0086-Tests fallen mit dem Fassung-1-Guard.
  Diagnose: die 0086-Tests beobachten ihre Modifikatoren über eine
  Kostenart-Grenze `scope="roster"` an **verschachtelten** Einträgen (Default
  `includeChildSelections=false`); der Guard ließ dort auch die
  **Eigen**-Kosten des Trägers aus der Summe fallen (Ist 0). Der Fassung-1-Fix
  war für Top-Level-Träger korrekt, für verschachtelte unterschossen —
  Entscheidung revidiert (siehe Decisions, Fassung 2), `origin/main` in den
  Branch gemergt.
- Fassung 2 umgesetzt (`countIndex.js`: getrenntes `climbedCostSums`-Fach +
  drittes `get`-Flag; `query.js`: Gate durchgereicht; `constraints.js`:
  Anhebung wieder feld-unabhängig, Gate auf hingeschriebenem Flag). Neuer
  Pin-Test für den zuvor ungedeckten Fall „verschachtelter Träger MIT
  Nachfahren" in `countIndex.costSumUnderCarrier.test.js` (weder 0 noch
  Nachfahren-Summe — genau die Eigen-Kosten). Architektur-Doku §4.4
  korrigiert (der alte Schlusssatz beschrieb das unterschossene Verhalten).
- Belege per Exit-Code nach Fassung 2: `npx vitest run src/evaluator` →
  774 Tests, exit 0 (inkl. der 8 zuvor roten 0086-Tests).
  `npm run lint` → exit 0. `npm run typecheck` → exit 0.
  `node scripts/measure-evaluator.js` → exit 0.
- Review-Runde 2 (frischer Kontext, ganzer Intent, nach Fassung 2):
  **0 Befunde**. Eigenständig verifiziert: 774/774 exit 0, Lint/Typecheck/
  Messung exit 0; eigene Probe für den testfreien Rand „verschachtelter
  Träger mit Mehrfach-Vorkommen" (count 2 → Eigen-Summe 100, keine
  Verletzung; count 3 → 150, Verletzung — nie die Nachfahren-Summe 210);
  Conditions/Repeats und Budget-Regel bit-identisch zu vorher (Default-Gate
  bzw. `null`-Ziel ohne aufgestiegene Kosten); Prozent-Nenner, `scope=self`,
  `shared=false`, Gruppen-/Force-/Kategorie-Anker und BOTH-Eimer geprüft und
  verhaltensgleich. Triage: nichts zu fixen.

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
- **Nachtrag nach dem CI-Lauf:** Der Ein-Zeilen-Fix (Fassung 1) bestand
  Review-Runde 1, weil der einzige rote Test einen Top-Level-Träger prüfte —
  der verschachtelte Fall war nirgends gepinnt und fiel erst durch die frisch
  gemergten 0086-Tests auf. Zwei Lehren: (1) vor dem PR `origin/main` noch
  einmal fetchen und die Suite auf dem Merge-Stand fahren — der PR-CI-Lauf
  prüft den Merge, der lokale Lauf nur den Branch; (2) bei einer Flag-Semantik
  mit zwei Lesarten die Ränder beider Lesarten pinnen (hier: Träger
  verschachtelt vs. top-level), nicht nur den Fall aus dem Bug-Report. Beides
  Arbeitsweise, kein Regel-Defekt.
