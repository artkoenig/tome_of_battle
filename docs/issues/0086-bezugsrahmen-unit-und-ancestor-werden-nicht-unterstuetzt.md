---
status: done
branch: claude/86-umsetzen-y6v33w
pr: https://github.com/artkoenig/tome_of_battle/pull/172
---

# Bezugsrahmen `unit` und `ancestor` werden nicht unterstützt

## Intent

Das BSData-Wiki (*Data structure overview*, Abschnitt *Condition*) zählt
`ancestor` als Scope auf; reale Kataloge nutzen zusätzlich `unit`. In den
Fixture-Katalogen der Definitive Edition
(`src/evaluator/__fixtures__/whfb6-definitive/`): `scope="unit"` **130×**,
`scope="ancestor"` **10×**. Die Engine kennt beide nicht: `ScopeKeyword`
(`src/evaluator/model.js:109`) umfasst nur `roster/force/parent/self`; alles
andere fällt in den ID-Zweig von `resolveSharedFrame` (`src/evaluator/query.js:74`),
löst nicht auf und liefert `UNRESOLVED_SCOPE` + Zählwert 0.

Folge: Modifikatoren mit diesen Scopes feuern nie bzw. falsch. Belegtes
Beispiel (Repro aus dem Audit 2026-07-28): das Mercenaries-Idiom „Kostenaufschlag
je Modell" (`<repeat field="selections" scope="unit" childId="model"/>`) zählt
0 — alle so kodierten Pro-Modell-Kostenskalierungen rechnen stumm falsche
Kosten. Bei `lessThan`-/`notInstanceOf`-Conditions wirkt der Zählwert 0 zudem
fail-open.

Nur `primary-catalogue` (27×) ist bereits als Issue 077 erfasst; `unit` und
`ancestor` sind nirgends verzeichnet. Die Semantik laut Referenzprogramm:
`unit` = die umschließende Einheit (der nächste Vorfahre — den Knoten selbst
eingeschlossen — mit `type="unit"`); `ancestor` = die gesamte Vorfahrenkette
(laut Wiki nur mit `instanceOf`/`notInstanceOf` gültig).

Acceptance criteria:

1. Eine Query mit `scope="unit"` löst auf die umschließende Einheit auf: ein
   `repeat`/eine `condition` mit `scope="unit" childId="model"` an einer
   Option innerhalb einer Einheit zählt die Modelle dieser Einheit; der
   Mercenaries-Pro-Modell-Aufschlag rechnet die erwarteten Kosten.
2. Eine `instanceOf`-/`notInstanceOf`-Condition mit `scope="ancestor"` hält
   genau dann, wenn ein Vorfahre (bzw. keiner) auf das benannte Ziel auflöst.
3. Über den Fixture-Datensätzen entsteht für `scope="unit"` und
   `scope="ancestor"` keine `UNRESOLVED_SCOPE`-Diagnose mehr.
4. Ein weiterhin unbekanntes Scope-Schlüsselwort bleibt diagnostiziert (kein
   stilles Raten).
5. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro und Fixture-Zählung.
- **Abgrenzung:** `scope="primary-catalogue"` bleibt bei Issue 077 und ist
  hier ausdrücklich nicht Gegenstand.
- **Semantik `unit` (Default, unbeantwortet):** Zählrahmen = nächster
  Vorfahre — den Knoten selbst eingeschlossen — mit rohem `type="unit"`; bei
  einem `entryLink` zählt der rohe Typ seines transitiv aufgelösten Ziels
  (dieselbe Regel, mit der der Zählindex Typ-Schlüsselwörter führt). Ohne
  solchen Vorfahren: fail-closed `UNRESOLVED_SCOPE` + 0. `shared="false"`
  behält die engine-einheitliche Bedeutung (Bindung an den eigenen Teilbaum);
  alle 130 Fixture-Vorkommen tragen `shared="true"`.
- **Semantik `ancestor` (Default, unbeantwortet):** kein Zählrahmen, sondern —
  wie `primary-catalogue` — eine Mitgliedschaftsprüfung, hier über die
  gesamte **strikte** Vorfahrenkette (reale Knoten, Kontingente
  eingeschlossen, die definitionslose Wurzel ausgenommen). Ergebnis ist die
  Zahl der passenden Vorfahren; ein Vorfahre passt, wenn die Ziel-Id unter
  den Zielen liegt, unter denen er auch im Zählindex zählbar wäre
  (Definitions-Id, Link-Ziel-Id, effektive Kategorien, roher Typ). Die Flags
  (`shared`, `includeChild…`) sind ohne Wirkung — eine Vorfahrenkette wird
  durch eine Instanz nicht enger. Nur `field="selections"` ist gültig;
  anderes Feld → `UNSUPPORTED_FIELD` (wie `primary-catalogue`). Beleg aus
  den Fixtures: alle 10 Vorkommen sind `instanceOf`-Conditions, und **alle
  10 `childId`s benennen Kategorie-Ids** („Characters", „Battle standard
  bearer", „Slaanesh [DARK ELVES]") — eine reine Definitions-Id-Prüfung
  ginge an den realen Daten vorbei, die Prüfung braucht die effektiven
  Kategorien der Vorfahren.
- **Umsetzungsort:** `ScopeKeyword` und `ScopeKind` wachsen um `UNIT` und
  `ANCESTOR` (die Obermengen-Invariante der Einordnung bleibt dadurch
  bestehen); die Auflösung sitzt ausschließlich im Query-Primitiv
  (`query.js`), das dafür zusätzlich die Effektiv-Werte (`effective`) im
  Query-Kontext braucht — beide Aufrufer (`constraints.js`, `modifiers.js`)
  haben sie bereits zur Hand.
- **`unit`-Diagnose nur an realen Knoten (Triage der Implementierer-Abweichung
  1, angenommen):** 7 der 10 VC-Fixture-Diagnosen entstehen an synthetischen
  Angebots-Ankern auf Armee-Ebene (verstecktes Entry „Spells of the Lore of
  Necromancy" direkt unter dem Kontingent — dort gibt es keine umschließende
  Einheit, und der Anker steht für keine reale Auswahl). An synthetischen
  Knoten (`isPhantom`) entfällt bei unauflösbarem `unit`-Rahmen die
  Diagnose; der Zählwert bleibt fail-closed 0. Analogie: Angebots-Anker
  erzeugen auch keine Verletzungen (`isReportableAnchorKind`). An realen
  Knoten bleibt die Diagnose (von der Messlatte gepinnt).
- **Obsoleter Scope-Wächter aus Issue 077 entfernt (Triage der
  Implementierer-Abweichung 2, angenommen):**
  `query.primaryCatalogueScope.test.js` trug einen als „Issue 0086 ist NICHT
  Gegenstand" markierten Platzhalter-Pin (`scope="unit"` bleibt unaufgelöst),
  der Kriterium 1 per Konstruktion widerspricht — jede Umsetzung bricht ihn
  zwingend. Der Block ist entfernt; sein bleibendes Anliegen (unbekanntes
  Schlüsselwort bleibt diagnostiziert) pinnt Kriterium 4 in
  `query.unitScope.test.js`. Kein Messlatten-Test wurde verändert.
- **Geerbter roter Test ist nicht Gegenstand:** Der vorbestehende Fehlschlag
  in `countIndex.costSumUnderCarrier.test.js` (fällt identisch am
  Branchpunkt `b67e93c`) ist als Issue 0112 gefiled und wartet auf seinen
  eigenen Run.

## Log

- **2026-07-29, Test-Autor (Unit-Tests):** Drei neue Testdateien aus dem
  Intent — `query.unitScope.test.js` (Kriterien 1+4: Rahmen = eigene Einheit,
  Selbst-Einschluss, entryLink-Typ-Erbschaft, fail-closed ohne Einheit,
  Mercenaries-Idiom durch die Fassade), `query.ancestorScope.test.js`
  (Kriterium 2: Basis- und effektive Kategorien, Definitions-Id, strikte
  Kette, Flags wirkungslos, `unsupportedField` bei Kostenart-Feld),
  `evaluator.unitAncestorFixture.test.js` (Kriterium 3 an echten
  Fixture-Katalogen; per Probelauf belegt: heute 10× `unresolvedScope`
  `unit` + 1× `ancestor` im VC-Roster, 1× `unit` im Ogre+Mercenaries-Repro).
  Rot-Beleg: `npx vitest run` über die drei Dateien — 26 Tests, 17 rot
  (Assertion-Fehler aus fehlendem Scope-Support, keine Harness-Fehler),
  9 grün (Bestands-Pins), Exit-Code 1.
- **2026-07-29, E2E-Autor (Black-Box):** Zwei Szenarien unter `docs/testing/`
  aus den Katalogdaten — `unit-scope-per-model-cost` (Mercenaries Heavy
  Cavalry: Barding kostet je Modell +2; Total 105 gegen Limit 100 feuert,
  Limit 110 klammert nach oben) und `ancestor-scope-instance-of` (VC:
  Chariot-Obergrenze sinkt als Charakter-Reittier — Treffer beim Großvater;
  Steed of Slaanesh bleibt ohne Slaanesh-Vorfahren bei max 0). Beide
  erwarten die Abwesenheit von `unresolvedScope` für den jeweiligen Rahmen.
  Auftrags-Vorschlag O&G verworfen: der dortige Modifikator zeigt auf eine
  nirgends existierende Constraint-Id (hängender Verweis) — im Szenario-README
  dokumentiert. Testkatalog um beide Einträge ergänzt (126 → 130 Roster).
  Rot-Beleg: `npx vitest run src/evaluator/e2e.testcatalog.test.js -t <name>`
  — je Szenario 2 rot, Exit-Code 1.
- **2026-07-29, Implementierer:** Messlatte grün — 26/26 Unit-Tests
  (`npx vitest run` über die drei neuen Dateien, Exit 0), beide
  E2E-Szenarien grün (je 2 Roster, Exit 0). Gesamt
  `npx vitest run src/evaluator`: 59 Dateien, 765 Tests, 764 grün, **1 rot
  geerbt** (`countIndex.costSumUnderCarrier.test.js`; fällt identisch am
  Branchpunkt `b67e93c`, per stash/checkout belegt — als Issue 0112 gefiled,
  nicht Gegenstand dieses Runs). `npm run lint` Exit 0, `npm run typecheck`
  Exit 0. ~~`node scripts/measure-evaluator.js` Exit 0~~ — **Korrektur nach
  Review-Runde 1:** der Exit-Code ist auf dieser Umgebung 1 (die 100-ms-
  Schwelle reißt am Vorbereitungsanteil, ~99 % Katalog-Vorlauf), und zwar
  identisch am Branchpunkt `b67e93c` — geerbt/umgebungsbedingt, nicht vom
  Diff. Die inhaltliche Aussage bleibt: Auswertung bei wiederverwendetem
  Datensatz 4–11 ms, der O(Tiefe)-Ancestor-Walk ist unkritisch.
  Umgesetzt: `ScopeKeyword`/`ScopeKind` + `UNIT`/`ANCESTOR` (model.js),
  `unit`-Rahmen in `resolveSharedFrame` und `resolveAncestor` vor der
  Indexarbeit (query.js), `targetsOf` aus countIndex.js exportiert (eine
  Quelle der Wahrheit für die Vorfahren-Ziele), `effective` in den
  Query-Kontext (constraints.js/modifiers.js reichen durch).
- **2026-07-29, Review-Runde 1 (frischer Kontext):** Fakten selbst
  etabliert — `npx vitest run src/evaluator` 764/765 grün (einziger
  Fehlschlag = geerbter 0112-Fall), `npm run lint` Exit 0, `npm run
  typecheck` Exit 0, `npm run depcruise` 0 Errors. Alle fünf Kriterien
  inhaltlich erfüllt; Messlatte des Test-Autors nachweislich unverändert
  (`git diff 890aa2f...HEAD` über die drei Dateien leer). Zwei Befunde:
  (1) Log-Fakt „measure-evaluator Exit 0" reproduziert nicht — tatsächlich
  Exit 1, identisch am Branchpunkt (geerbt/umgebungsbedingt; Repro:
  `node scripts/measure-evaluator.js`, 2× wiederholt). **Triage: behoben** —
  Log-Eintrag oben korrigiert. (2) Kriterium 5 dem Wortlaut nach nicht
  erfüllt (Suite-Exit 1) — alleinige Ursache ist der geerbte 0112-Fall,
  keine Regression aus dem Diff. **Triage: als dokumentierte
  Wortlaut-Abweichung ausgewiesen** (Decisions „Geerbter roter Test ist
  nicht Gegenstand"), kein Fix in diesem Run.
- **Waiver Wiederholungs-Review:** Der einzige Fix aus Runde 1 berührt
  ausschließlich den Tracker-Eintrag (Log-Korrektur), keine Datei, um die
  es in den Kriterien geht — die Wiederholung der Review entfällt nach der
  Rulebook-Ausnahme; hiermit protokolliert.

## Checkpoints

### Before implementation

- Does this match what was asked? — Ja. Die fünf Kriterien sind präzise und
  falsifizierbar; die Semantik-Entscheidungen oben füllen nur die zwei
  Lücken, die der Intent offen lässt (Selbst-Einschluss bei `unit`,
  Matching-Regel bei `ancestor`), als dokumentierte Defaults.
- What surprised me? — (a) Alle 10 `ancestor`-Vorkommen zielen auf
  **Kategorie-Ids**, nicht auf Eintrags-Ids — die Vorfahrenprüfung muss die
  effektiven Kategorien lesen. (b) Der Zählindex kann Typ-Schlüsselwörter
  (`model`, `unit`) längst als Ziele zählen — für `scope="unit"` fehlt
  wirklich nur die Rahmen-Auflösung, keine Index-Erweiterung.
- What am I assuming without having verified it? — (a) `ancestor` schließt
  den Knoten selbst aus (Wortlaut „Vorfahrenkette"); (b) die Flags sind bei
  `ancestor` wirkungslos; (c) in den Fixture-Rostern liegen alle
  `scope="unit"`-Querys tatsächlich innerhalb einer Einheit, sodass
  Kriterium 3 erfüllbar ist. Alle drei prüfen die Tests gegen echte
  Katalogdaten nach.

### Before the PR

- Does this match what was asked? — Ja. Beide Bezugsrahmen sind im
  Query-Primitiv umgesetzt und von einer Messlatte gedeckt, die vor der
  Implementierung rot war (26 Unit-Tests + 4 E2E-Roster); der Review aus
  frischem Kontext bestätigt alle fünf Kriterien inhaltlich, Kriterium 5
  mit der protokollierten Wortlaut-Abweichung (geerbter 0112-Fall).
- What surprised me? — (a) Die Test-Autor-Annahme „alle unit-Querys liegen
  in einer Einheit" war für 7 Angebots-Anker-Fälle falsch — daraus wurde
  die protokollierte Diagnose-Unterdrückung an synthetischen Knoten.
  (b) Der Implementierer-Fakt „measure-evaluator Exit 0" hielt der
  Review-Reproduktion nicht stand (umgebungsbedingt Exit 1, auch am
  Branchpunkt) — Beleg dafür, dass die Review-Regel „Fakten selbst
  etablieren" ihren Zweck erfüllt.
- What am I assuming without having verified it? — Dass die Mid-Runden-
  Lesart der effektiven Kategorien im Ancestor-Walk (Fixpunkt) keinen
  realen Katalog zum Schwingen bringt; der Reviewer fand dafür kein Repro,
  und eine echte Schwingung würde als OSCILLATION-Diagnose laut, nicht
  still.

## Retro

- **Was im Weg stand:** (a) Ein Platzhalter-Pin aus Issue 077 behauptete
  aktiv „`unit` bleibt unaufgelöst" — ein Test, der Nicht-Unterstützung als
  Soll festschreibt, kollidiert zwingend mit dem Nachfolge-Issue, das genau
  diese Unterstützung baut. Lehre: solche Abgrenzungen als Backlog-Verweis
  im Kommentar festhalten, nicht als Assertion. (b) Der Implementierer-Fakt
  „measure-evaluator Exit 0" hielt der Review-Reproduktion nicht stand —
  die Schwelle reißt umgebungsabhängig am Katalog-Vorlauf (~99 % der
  Messzeit), auch am Branchpunkt. Die Review-Regel „Fakten selbst
  etablieren" hat den Widerspruch gefangen; das Skript selbst wäre
  robuster, wenn es Vorbereitungs- und Auswertungszeit getrennt gegen die
  Schwelle hielte.
- **Was gut funktionierte:** Die Rollentrennung trug den Run — der
  Test-Autor fand mit Annahme (c) eine echte Datenlage-Überraschung
  (Angebots-Anker ohne Einheit), der Implementierer meldete seine zwei
  Abweichungen offen zur Triage statt sie still einzubauen, der Reviewer
  zählte die Fixture-Zahlen selbst nach. Die vorab im Issue festgehaltenen
  Semantik-Decisions machten Test-Autor und Implementierer ohne Rückfragen
  konsistent.
- **Regelvorschlag:** keiner — kein Rulebook-Punkt hat gefeuert oder
  gefehlt.
