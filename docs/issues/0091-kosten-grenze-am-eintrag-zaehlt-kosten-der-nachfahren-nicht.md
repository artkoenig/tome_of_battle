---
status: active
branch: claude/issues-90-abarbeiten-7ymutc
pr:
---

# Kosten-Grenze am Eintrag zählt die Kosten der Nachfahren nicht

## Intent

`docs/battlescribe-data-format.md` §7.6/§9.4: eine Grenze, deren `field` eine
Kostenart ist, begrenzt die **Summe** dieser Kosten; gezählt werden die
Auswahlen unterhalb des Trägers, und `includeChildSelections="true"` nimmt
verschachtelte Auswahlen ausdrücklich hinein.

Die Zählschicht aggregiert Beiträge aber nur unter den **eigenen** Ziel-Ids
des beitragenden Knotens (`targetsOf`, `src/evaluator/countIndex.js:107`) —
nie unter der Definitions-Id eines Vorfahren. Eine ziel-gefilterte Query
`(Rahmen, Eintrags-Id)` sieht deshalb ausschließlich die Kosten des Trägers
selbst; die Kosten seiner Kinder fehlen, egal wie die Flags stehen.

Repro (Audit 2026-07-28, gegen die echte Fassade): Held 50 pts + gewähltes
Item 60 pts; Grenze am Helden `max 100 field=<pts> scope="roster"
includeChildSelections="true"` → Ist liest 50, **kein Verstoß** — erwartet
Ist 110 gegen 100. Gruppen-verankerte Budgets treffen ihre Member zwar über
die Member-Ids, aber deren **verschachtelte** Kosten fehlen aus demselben
Grund.

Verwandt mit Issue 083 (dort: Selektions-Zählung unterhalb des Trägers), aber
eigenständig: hier geht es um die Kostensummen-Aggregation unter der
Träger-Id.

Acceptance criteria:

1. Eine Kostenart-Grenze an einem Eintrag mit `includeChildSelections="true"`
   summiert die effektiven Kosten des Trägers **und aller seiner
   Nachfahren-Auswahlen** (mal Stückzahl).
2. Das Repro aus dem Intent meldet Ist 110 gegen Grenze 100.
3. Mit `includeChildSelections="false"` gilt die dokumentierte engere Lesart
   („just `scope`'s `field`") — belegt durch einen Testfall je Flagstellung.
4. Gruppen-verankerte Kosten-Budgets (Magic-Items-Muster, §9.4) erfassen auch
   verschachtelte Kosten ihrer Member.
5. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

Die Zählschicht (`countIndex.js`) trägt einen Kostenbeitrag zusätzlich unter den
**Ziel-Ids der Vorfahren** ein, die im jeweiligen Rahmen liegen (der „Träger"):
steigt der Beitrag eines Knotens seine Vorfahrenkette hoch, sammelt er die
Ziel-Ids der durchlaufenen Vorfahren ein und wird unter jeder davon **nur mit
seinen Kostensummen** verbucht. Die Eimer-Logik (BASE/SELECTION/FORCE/BOTH)
bleibt unangetastet — der Beitrag eines Nachfahren kreuzt die
Selektionsschachtelung und landet damit im SELECTION-Eimer, sodass
`includeChildSelections` weiter entscheidet (Kriterium 3).

Weil die Ziel-Ids eines Vorfahren auch seine `memberGroupIds` enthalten, erfasst
dieselbe eine Regel das Gruppen-Muster aus §9.4 (Kriterium 4), ohne einen zweiten
Sonderweg.

## Tasks

- [x] Fallende Tests aus der Intent geschrieben (`src/evaluator/countIndex.costSumUnderCarrier.test.js`)
- [x] Kostenaufstieg unter den Träger-Ids in `countIndex.js` umgesetzt
- [x] Doku nachgezogen: `docs/battlescribe-data-format.md` §9.4,
      `docs/evaluator-architecture.md` §4.4, Modulkopf `countIndex.js`
- [x] Suite und Statik belegt (siehe Log)

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.
- **BSData-Abgleich auf Weisung des Menschen (2026-07-29):** Das
  BSData-Wiki (*Data structure overview*, Abschnitt Constraint) hat höchste
  Priorität. Es sagt: `scope` „decides which entity should sum up all
  `field`'s values of descendant selections of this constraint's parent
  entry"; ob der Träger selbst mitzählt, entscheidet der Wortlaut nicht.
  Die im Issue festgeschriebene Erwartung (Kriterium 2: Ist **110** = Träger
  50 + Kind 60) bleibt maßgeblich — sie entspricht der aufgerollten
  Kostenanzeige einer Auswahl in BattleScribe und dem ausgeführten
  Audit-Repro. §9.4 dokumentiert die Träger-inklusive Lesart jetzt explizit.
- **Nur die Kosten steigen auf, nicht die Selektionsanzahl.** Unter der Träger-Id
  steht weiterhin genau der Träger; wie viele *Auswahlen* unterhalb eines Trägers
  stehen, ist Issue 083 und wurde hier bewusst nicht mit beantwortet. Ein
  Modultest pinnt diese Trennung.
- **Eine Regel statt zweier Sonderwege.** Der Kostenanteil wird unter *jeder*
  Ziel-Id eines Vorfahren verbucht — Definitions-Id, Verweis-Ziel, roher `type`,
  Kategorie-Ids und `memberGroupIds`. Damit fällt das Gruppen-Muster aus §9.4
  (Kriterium 4) ohne eigenen Zweig heraus. Das Rahmen-Ziel `null` bleibt außen
  vor, sonst stünde derselbe Beitrag doppelt in „alles im Rahmen"; ebenso ein
  Ziel, unter dem der Knoten ohnehin selbst zählt.
- **Die Flag-Semantik bleibt unangetastet.** Der Beitrag eines Nachfahren kreuzt
  die Selektionsschachtelung und landet im SELECTION-Eimer:
  `includeChildSelections="false"` liest weiter die engere Lesart („just
  `scope`'s `field`", Kriterium 3), `true` nimmt die verschachtelten Kosten
  hinein (Kriterien 1/2/4). Für Kriterium 4 heißt das: das Gruppen-Budget erfasst
  die verschachtelten Member-Kosten bei `includeChildSelections="true"`; bei
  `false` bleibt es bei den Kosten der Member selbst. Beide Stellungen sind
  getestet.
- **Der Träger zählt seine eigenen Kosten mit.** Kriterium 2 verlangt Ist 110 =
  50 (Held) + 60 (Gegenstand). §7.6 formuliert dagegen „gezählt werden die
  Auswahlen *unterhalb* des Trägers, nicht der Träger selbst" — die Engine zählt
  den Träger unter seiner eigenen Id seit jeher mit, und das Kriterium bestätigt
  diese Lesart für Kostensummen. Nicht geändert, nur festgehalten.

## Log

- **Tests zuerst:** 10 Fälle geschrieben, `npx vitest run
  src/evaluator/countIndex.costSumUnderCarrier.test.js` → 4 rot / 6 grün (rot
  genau die vier neuen Aussagen: Repro 110, Stückzahl-Skalierung,
  Index-Aggregation, Gruppen-Budget; grün die Wächter der engeren Lesart).
- **Nach der Umsetzung:** dieselbe Datei 10/10 grün.
- **Regression:** `npx vitest run src/evaluator` → 54 Dateien, 719 Tests, Exit 0
  (Basis vorher: 53 Dateien, 709 Tests). Die realen Manifest-Szenarien inklusive
  `violation-classification/04-magic-items-cost-sum` (125 gegen 100) bleiben
  unverändert.
- **Statik:** `npm run lint` (oxlint) Exit 0, `npm run typecheck` (tsc --noEmit)
  Exit 0.
- **Aufwand:** `node scripts/measure-evaluator.js`, Zeile „bei wiederverwendetem
  Datensatz": mit Änderung 5,7/9,4/10,7 ms gegen 7,1/15,6/17,3 ms ohne — im
  Rauschen, keine messbare Verschlechterung. (Der Exitcode 1 des Skripts ist
  vorbestehend und betrifft den Katalog-Vorlauf, nicht die Auswertung.)
- **Beobachtung (nicht aus dieser Änderung):** ein Suite-Lauf unter Last war rot
  mit 3 Fehlern in `e2e.testcatalog.test.js`. Absichtlich reproduziert (16
  CPU-Brenner auf 4 Kernen): „Test timed out in 5000ms" in genau dieser Datei —
  die realen Katalog-Szenarien liegen mit bis zu 4,0 s knapp unter Vitests
  5-s-Vorgabe. Vorbestehende Last-Flakiness, kein fachlicher Fehlschlag; gehört
  in ein eigenes Issue (Timeout heraufsetzen oder Vorlauf teilen).
  → Als Issue 0107 abgelegt (2026-07-29).
- **Review-Runde 1 (frischer Kontext, 2026-07-29):** 2 Befunde, beide mit
  Repro. (1) Fällt der Bezugsrahmen mit dem Träger zusammen (`scope="self"`
  oder `shared="false"`), gate `includeChildSelections="false"` nicht: der
  Beitrag des direkten Kindes landet im BASE-Eimer (`countIndex.js`
  Klettersprung am ersten nicht-unmittelbaren Rahmen, `crossedSelection`
  noch false) — Ist 110 statt 50; mit Enkel 110 statt 50/150 (Hybrid).
  Verletzt Kriterium 3 und widerspricht dem in §9.4 ergänzten Satz.
  (2) Testlücke genau dort: die Wächter-Tests prüfen nur Rahmen oberhalb
  des Trägers. — Doppelzählungen gezielt gesucht, keine gefunden; Suite im
  Wiederholungslauf 54 Dateien / 719 Tests Exit 0 (Erstlauf: 1× 0107-Flake);
  Lint/Typecheck Exit 0. **Triage: beide fixen** (innerhalb der Absicht) —
  Test-Author schreibt die fehlenden Fälle, Implementer macht sie grün ohne
  sie zu ändern, danach Review-Runde 2 gegen die ganze Absicht.
- **Befund-Trend:** Kriterium 3: 1 Befund (Runde 1); Testlücke ohne
  Kriteriums-Verstoß: 1. Übrige Kriterien: 0. Summe Runde 1: 2.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja: die fünf Kriterien beschreiben genau
  eine Stelle — die Kostensummen-Aggregation unter der Träger-Id in
  `countIndex.js`. Kein Bedarf, Query- oder Constraint-Schicht anzufassen.
- **What surprised me?** §7.6 sagt „nicht der Träger selbst", das Repro in der
  Intent erwartet aber 110 = Träger + Nachfahre. Die Kriterien gehen vor; die
  Engine zählte den Träger ohnehin schon mit (siehe Decisions).
- **What am I assuming without having verified it?** Dass die Eimer-Logik die
  Flag-Semantik trägt, ohne dass ich sie anfassen muss — vor der Umsetzung durch
  die zwei „engere Lesart"-Tests geprüft, die von Anfang an grün waren.

### Before the PR

- **Does this match what was asked?** Ja — alle fünf Kriterien belegt, jedes mit
  mindestens einem ausführbaren Fall an der echten Fassade.
- **What surprised me?** Alle 100+ Kostenart-Grenzen der eingefrorenen
  Fixture-Kataloge stehen auf `scope="parent"`, fast alle mit
  `includeChildSelections="false"` — die Änderung greift in den realen Daten
  daher nur an wenigen Stellen, was das Ausbleiben jeder Szenario-Abweichung
  erklärt.
- **What am I assuming without having verified it?** Dass die weite Lesart auch
  für Kategorie-Ziele erwünscht ist (die Kosten eines Nachfahren zählen jetzt
  auch unter der Kategorie-Id seines Vorfahren). In den Fixture-Katalogen gibt es
  keine kategorie-verankerte Kostengrenze, die Annahme ist dort also folgenlos —
  belegt durch die Auszählung aller `<constraint>`-Vorkommen mit Kostenart-Feld.

## Retro

