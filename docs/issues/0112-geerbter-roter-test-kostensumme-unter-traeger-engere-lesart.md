---
status: done
branch: claude/offene-issues-phkdw5
pr: https://github.com/artkoenig/tome_of_battle/pull/176
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

- **Der Test hatte recht; entschieden und behoben durch Issue 0113** (Quelle:
  Issue 0113, Decisions; BSData-Doku §7.6/§9.4). Die engere Lesart gilt für
  die unter die Träger-Id aufgestiegenen Nachfahren-Kosten: sie zählen nur
  mit hingeschriebenem `includeChildSelections="true"` (§7.6), während die
  Eigen-Kosten jedes Träger-Vorkommens immer zählen (§9.4). Umgesetzt in
  PR #173 (`climbedCostSums` / `includeClimbedCosts` im Zählindex), gemerged
  als `cadf81d`. Dieses Issue war zeitgleich mit 0113 gefiled und ist durch
  dessen Merge gegenstandslos — kein eigener Code-Change nötig.
- **Kein test-author, kein implementer** (default, unanswered): Es gibt
  nichts zu bauen; der Run dieses Issues besteht aus Verifikation und
  Tracker-Eintrag.

## Log

- 2026-07-29: Verifikation auf `claude/offene-issues-phkdw5` (= `main`-Stand
  `3e3ad6d`, enthält PR #173): `npx vitest run
  src/evaluator/countIndex.costSumUnderCarrier.test.js` — 11 Tests, Exit 0
  (Kriterium 2). `npx vitest run src/evaluator` — 64 Dateien, 809 Tests,
  Exit 0 (Kriterium 3). Der im Intent beschriebene rote Test reproduziert
  nicht mehr.
- 2026-07-29: Review-Runde 1 (frischer Kontext, Diff `5eec822` gegen Intent):
  keine Findings. Alle zitierten Quellen (0113-Decisions, §7.6/§9.4,
  `cadf81d`) tragen die Behauptungen; beide Kriterien-Kommandos vom Reviewer
  reproduziert (11/11 bzw. 809/809, Exit 0), zusätzlich `npm run lint` und
  `npm run typecheck` Exit 0. Eine Unschärfe unterhalb der Finding-Schwelle
  („zeitgleich gefiled" — tatsächlich zwei Runs, vier Minuten auseinander)
  bleibt stehen. Nebenbefund außerhalb des Intents, an den Menschen: doppelt
  vergebene Issue-Nummern 0110/0112/0115/0116 (vorbestehend auf `main`).
- 2026-07-29: Nebenbefund auf Zuruf des Menschen behoben (gleicher Branch,
  gleicher PR): die vier später committeten Duplikate auf freie Nummern
  umbenannt — force-scope → 0117, min-Grenze-Wurzel-Gruppe → 0118,
  effektiv-versteckte-Auswahl → 0119, scopeKind-E2E-Beleg → 0120; die
  Nummern-Verweise in 083 und 0088 nachgezogen. Dieses Issue behält 0112,
  da alle bestehenden Verweise (0086/0087/0088, PR #176) es meinen.

## Checkpoints

### Before implementation

- Does this match what was asked? Ja — „112 umsetzen", per Rückfrage auf
  dieses Issue (roter Test Kostensumme) aufgelöst.
- What surprised me? Der rote Test war schon grün: Issue 0113 hat den Befund
  zwischen Filing und diesem Run behoben.
- What am I assuming without having verified it? Nichts Offenes — beide
  Kriterien-Kommandos selbst gelaufen, Doku-Stellen §7.6/§9.4 nachgelesen.

### Before the PR

- Does this match what was asked? Ja — alle drei Kriterien erfüllt: Ent-
  scheidung belegt (aus 0113), beide Test-Kommandos Exit 0.
- What surprised me? Nichts weiter; der Run war reine Verifikation.
- What am I assuming without having verified it? Dass 0113s Doku-Begründung
  vollständig ist — stichprobenhaft gegen §7.6/§9.4 geprüft, nicht neu
  hergeleitet.

## Retro

- Was im Weg stand: nichts Technisches — der eigentliche Stolperstein war
  die doppelt vergebene Nummer 0112, die eine Rückfrage kostete, bevor der
  Run starten konnte. Ursache: parallele Sessions haben gleichzeitig
  nummeriert (betrifft auch 0110/0115/0116).
- Was sich ändern sollte: die Duplikat-Nummern im Backlog auf freie Nummern
  umbenennen (eigener kleiner Run); fürs Filing wäre eine Kollisionsregel im
  `issue`-Skill denkbar — Vorschlag gehört ins metis-Repo, falls es wieder
  passiert.
- Gut funktioniert: erst reproduzieren, dann bauen — die Verifikation zeigte
  sofort, dass 0113 den Befund schon behoben hatte, und der Run blieb ein
  reiner Tracker-Eintrag statt eines Doppel-Fixes.
