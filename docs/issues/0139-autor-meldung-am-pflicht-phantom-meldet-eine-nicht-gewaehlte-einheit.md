---
status: done
branch: claude/vampire-list-error-message-ym9w2p
pr: https://github.com/artkoenig/tome_of_battle/pull/194
---

# Eine Autor-Meldung am Pflicht-Phantom meldet eine gar nicht gewählte Einheit

## Intent

Eine **leere** Vampire-Counts-Liste ist laut Panel ungültig und trägt die
Fehlermeldung `Please enable "Allow special characters?"` — zweimal sogar
(Anker „Heinrich Kemmler (WD#309-UK)" und „Krell, King of Wights (WD#309-UK)").
Die Meldung ist irreführend: die Einstellung wird für eine gültige Liste nicht
gebraucht, und die beiden Sonderfiguren stehen gar nicht in der Liste.

Reproduktion (echte Definitive-Edition-Fixtures, leeres VC-Kontingent
`docs/testing/vampire-counts/rosters/01-empty-force.ros`): der Bericht enthält
neben den vier erwarteten Pflicht-Verstößen (Bloodlines, The Laws of Undeath,
General, Core) zwei Meldungen der Herkunft `authorMessage`, beide am Anker
`mandatoryPhantom`.

Ursache — die Kette im Katalog (`Vampire Counts (6th definitive edition).cat`,
Z. 10756–10807 für Kemmler, analog für Krell):

1. Kemmler trägt eine eigene Grenze `<constraint type="min" value="0"
   scope="force" id="8461-…">`. Der Wert 0 ist keine Pflicht; ein Modifier hebt
   ihn nur unter „Army of the Lichemaster" auf 1.
2. `synthesizeMandatoryPhantoms` (`src/evaluator/evalTree.js`) prüft mit
   `hasMinLimit` allein **Art und Bezugsrahmen** der Grenze, nicht ihren Wert —
   und muss das auch, weil ein Modifier den Wert erst während der
   Fixpunktschleife anheben kann. Also entsteht für Kemmler in jedem
   VC-Kontingent ein Pflicht-Phantom, auch wenn er nirgends Pflicht ist.
3. Am selben Eintrag hängt `<modifier type="add" field="error" value="Please
   enable &quot;Allow special characters?&quot;">` mit der Bedingung „weniger
   als eine Auswahl `8923-5946-7b10-8957` im Kontingent". In der leeren Liste
   hält sie — die Meldung landet am Phantom.
4. `report.js` (`authorViolationsOf`) filtert nur den **Angebots**-Anker aus der
   Meldungsliste (`isReportableAnchorKind`). Das Phantom bleibt drin, seine
   Autor-Meldung erscheint als blockierender Fehler und sperrt „Spielen".

Die Begründung, die für den Angebots-Anker bereits im Code steht — „eine Meldung
an einer nicht gewählten Option spräche über etwas, das gar nicht in der Liste
steht" — gilt für ein Pflicht-Phantom genauso: es ist der Anker für eine
**abwesende** Definition. BattleScribe selbst wertet die Modifier eines nicht
gewählten Eintrags nie aus; es kennt kein Phantom, also zeigt es dort auch keine
Autor-Meldung. Der eigentliche Zweck des Phantoms — die unerfüllte Pflicht — wird
weiterhin als abgeleitete Meldung (`derivedLimit`) berichtet; nur der
Katalog-Fließtext am abwesenden Eintrag entfällt.

Acceptance criteria:

1. Eine Autor-Meldung (`origin: authorMessage`), die an einem Anker der Art
   `mandatoryPhantom` hängt, erscheint **nicht** in der Meldungsliste
   (`violations`) — unabhängig von ihrem Schweregrad und davon, ob am selben
   Phantom eine Pflicht-Grenze feuert.
2. Der Fähigkeitsdatensatz des Phantoms (`capabilities`) führt dieselbe Meldung
   weiterhin unverändert — genau wie beim Angebots-Anker, damit die Oberfläche
   sie am Slot zeigen kann, wenn sie will.
3. Autor-Meldungen an allen anderen Ankerarten — insbesondere am belegten Slot
   (`occupied`) — erscheinen unverändert in der Meldungsliste.
4. Abgeleitete Meldungen (`origin: derivedLimit`) am Pflicht-Phantom bleiben
   unverändert; die unerfüllte Pflicht wird weiterhin gemeldet.
5. Die leere Vampire-Counts-Liste (`docs/testing/vampire-counts/rosters/01-empty-force.ros`,
   Definitive-Edition-Fixtures) trägt keine Meldung `Please enable "Allow
   special characters?"` mehr und behält ihre vier Pflicht-Verstöße.

## Plan

Eine Stelle: `authorViolationsOf` in `src/evaluator/report.js` filtert zusätzlich
zum Angebots-Anker den `mandatoryPhantom`-Anker aus. Das Prädikat gehört neben
`isReportableAnchorKind` in `src/evaluator/model.js`, weil es dieselbe Frage für
eine andere Meldungsherkunft beantwortet.

## Tasks

- [x] Regressionstest `src/evaluator/report.authorMessageAnchors.test.js`
      (synthetischer Katalog für die Kriterien 1–4, echte Fixtures für 5)
- [x] Filter in `report.js`/`model.js`
- [x] `npx vitest run src/evaluator`

## Decisions

- **Alle** Pflicht-Phantome, nicht nur die ohne feuernde Pflicht. Ein Phantom
  mit tatsächlich unerfüllter Pflicht meldet diese als `derivedLimit`; die
  Autor-Meldung daneben wäre trotzdem eine Aussage über etwas, das nicht in der
  Liste steht, und BattleScribe zeigt sie dort ebenso wenig. Die feinere Regel
  („nur unterdrücken, wenn keine Pflicht feuert") koppelte die Meldungsliste an
  die Grenzen-Ergebnisse, ohne einen Fall zu retten, den das Referenzprogramm
  kennt.
- Die Phantom-Synthese bleibt unangetastet: `hasMinLimit` darf den Wert einer
  `min`-Grenze nicht prüfen, weil ein Modifier ihn erst in der Fixpunktschleife
  anhebt (genau Kemmlers Fall unter „Army of the Lichemaster").

## Log

- 2026-08-12 — Closed: merged as PR #194 (`ead1c10`). Bookkeeping only; the
  status line was never flipped.

- Gemeldet vom Maintainer: „eine leere Armeeliste der Vampire zeigt mir die
  Fehlermeldung 'Please enable "Allow special characters?"' — das ist
  irreführend, denn diese Einstellung wird für eine valide Liste nicht
  benötigt."

## Checkpoints

### Before implementation

Kriterien 1–5 vor der Implementierung geschrieben; der Test
`src/evaluator/report.authorMessageAnchors.test.js` lief zuerst rot
(6 von 9 Faellen), die drei gruenen sind Kontrollfaelle, die gruen bleiben
mussten.

### Before the PR

- `npx vitest run src/evaluator` — 75 Dateien, 945 Faelle, Exit 0 (enthaelt den
  manifest-getriebenen E2E-Runner ueber `docs/testing/`).
- `npm test` — 273 Dateien, 2845 Faelle, Exit 0, plus die Puppeteer-App-E2E
  („ALL UI TESTS PASSED").
- `npm run lint` — Exit 0; keine Warnung in einer geaenderten Datei.
- `npm run typecheck` — Exit 0.
- `npm run depcruise` — 0 Fehler (1 vorbestehende Warnung: Zyklus in
  `src/roster/modifierEvaluator.js`, unberuehrt).
- Gegenprobe in der echten App (Wegwerf-Skript auf dem E2E-Harness, mit den
  Definitive-Edition-Katalogen, leere VC-Liste, 2000 Punkte): vorher 5
  blockierende Meldungen inkl. zweimal „Please enable …", nachher 3 — nur die
  echten Pflichten Bloodlines, General, 3 × Core.

## Retro
