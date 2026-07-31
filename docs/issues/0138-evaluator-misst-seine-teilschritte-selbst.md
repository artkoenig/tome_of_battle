---
status: active
branch: claude/evaluator-performance-metadata-6ax5wf
pr:
---

# Evaluator misst seine Teilschritte selbst und liefert sie als Metadata

## Intent

`scripts/lib/evaluator-measurement.js` misst die Performance der Reinraum-Engine
(`src/evaluator/`), indem es die interne Pipeline von außen nachbaut: Es
importiert die nicht-exportierten Engine-Module direkt (`datasetPreparation`,
`evalTree`, `offer`, `effectiveState`, `countIndex`, `fixpoint`, `constraints`,
`budget`, `report`, `rosterBudget`, `model` — Zeilen 31–41) und ruft sie in
derselben Reihenfolge auf wie die Fassade, jeweils in ein lokales `timed()`
gewickelt. Der Dateikopf nennt den Grund selbst: „Die Fassade `evaluate` liefert
genau eine Zahl: die Gesamtdauer … also ruft `measureEvaluation` dieselben
Engine-Module in derselben Reihenfolge auf wie die Fassade."

Das ist eine zweite, unabhängig gepflegte Kopie der Pipeline-Reihenfolge. Sie
driftet, sobald die Fassade sich ändert. Das Skript weiß das und sichert sich
mit `assertMatchesFacade()` (Zeilen 287–297) über einen `reportFingerprint`-
Vergleich dagegen ab — eine Krücke, die nur existiert, weil dupliziert wird.

Diese Duplikation ist die einzige erklärte Ausnahme zur Regel „Evaluator nur
über die Fassade": `.dependency-cruiser.cjs` Zeilen 45–51 und 101–113 nennen
`EVALUATOR_MEASUREMENT = '^scripts/(lib/evaluator-measurement|measure-evaluator)'`
namentlich und nehmen es von der sonst als `error` erzwungenen Regel aus, mit der
Begründung: „seine Aufgabe ist gerade, die einzelnen Stufen der Auswertung
getrennt zu stoppen — das geht nur von innen."

Gewünschtes Verhalten: Die Engine misst ihre Teilschritte selbst und liefert das
Ergebnis als Metadata über die Fassade aus. Dann gilt die Begründung der Ausnahme
nicht mehr, und die Ausnahme kann ersatzlos entfallen.

Acceptance criteria:

1. Wenn `prepareDataset(dataset, { measure: true })` aufgerufen wird, trägt das
   zurückgegebene `PreparedDataset` die eigene Dauer der Vorbereitung als
   Metadata. Ohne das Flag ist das Rückgabeobjekt unverändert gegenüber heute.
2. Wenn `evaluate(prepared, roster, { measure: true })` aufgerufen wird, enthält
   das Ergebnis zusätzlich zum heutigen Report ein Metadata-Feld mit den drei
   Phasen, die `evaluate` tatsächlich ausführt: iterierte Auswertung
   (`buildEvalTree` + `evaluateToFixpoint` + `buildIndex`), Post-Pass
   (`attachOfferAnchors` + `extendBaseEffectiveState` + `applyAnchorPostPass`)
   und Constraints+Report (`evaluateConstraints` + `evaluateRosterBudget` +
   `buildReport`). Zusammen mit Kriterium 1 sind das genau die vier Phasen, die
   `scripts/lib/evaluator-measurement.js` heute stoppt.
3. Wenn gemessen wird, enthält die Metadata neben den Dauern auch die
   Fixpunkt-Runden (`rounds`, `converged`, Art der Nicht-Konvergenz) — die
   berechnet `evaluateToFixpoint` (`src/evaluator/fixpoint.js:91,102,156`) heute
   bereits, und die Fassade verwirft sie (`evaluator.js:182-183` destrukturiert
   sie nicht) — sowie die Knotenzahlen des Eval-Baums, die das Skript heute via
   `describeTree` selbst zählt.
4. Wenn `prepareDataset` und `evaluate` ohne `{ measure: true }` aufgerufen
   werden, verhalten sie sich exakt wie heute: gleicher Rückgabewert, kein
   Metadata-Feld, keine `performance.now()`-Aufrufe auf dem Normalpfad. Ein Test
   weist das nach.
5. `scripts/lib/evaluator-measurement.js` importiert kein Modul aus
   `src/evaluator/` mehr außer der Fassade `src/evaluator/evaluator.js`. Es liest
   alle Phasendauern, Runden und Knotenzahlen aus der Metadata.
6. Die Ausnahme `EVALUATOR_MEASUREMENT` ist aus `.dependency-cruiser.cjs`
   entfernt (beide Stellen: Zeilen 45–51 und 101–113), und `npm run depcruise`
   läuft ohne neuen Fehler durch. Das ist der maschinelle Nachweis, dass nichts
   mehr nachgebaut wird.
7. `assertMatchesFacade()` und `reportFingerprint` sind aus
   `scripts/lib/evaluator-measurement.js` entfernt, soweit sie allein die Drift
   zwischen Nachbau und Fassade absicherten — es gibt keinen Nachbau mehr, gegen
   den zu sichern wäre.
8. `node scripts/measure-evaluator.js` und `node scripts/measure-evaluator-browser.js`
   laufen weiter und geben dieselben Größen aus wie heute (vier Phasen,
   Gesamtdauer, Runden, Knotenzahlen, Schwellenwert-Urteil). Aufwärm-Läufe, die
   15 Wiederholungen, der Median, die Schwellenwerte (`INTERACTIVE_BUDGET_MS = 100`,
   `TWO_STAGE_PREPARATION_SHARE = 0.5`) und die Ausgabeformatierung bleiben im
   Skript — das ist Mess-Politik, nicht Sache der Engine. Exitcode 1 bei
   gerissener 100-ms-Schwelle bleibt erhalten.
9. Die gemessenen Zahlen bleiben in derselben Größenordnung wie die heutige
   Grundlinie; insbesondere bleibt der Anteil der Vorbereitung an der Gesamtdauer
   im Bereich, den ADR-0036 (Zeilen 89–108) zitiert. Die Instrumentierung darf
   die Messung nicht selbst verfälschen.
10. `src/evaluation/evaluationCache.js` bleibt unverändert: Es setzt das Flag
    nie, reicht kein Metadata-Feld durch, und weder `AppEvaluation` noch
    `EMPTY_RESULT` bekommen neue Felder. Die App sieht von dieser Änderung nichts.
11. `docs/evaluator-architecture.md` (Leitprinzip 1, „Eine reine Funktion …
    Keine Seiteneffekte") und die JSDoc der Fassade (`src/evaluator/evaluator.js`,
    `@returns` in Zeile 112) sind nachgezogen: Sie benennen das Opt-in-Flag als
    ausdrückliche Ausnahme und halten fest, dass die Reinheit für den Normalpfad
    weiter gilt. Keine neue ADR.
12. `npx vitest run src/evaluator` läuft grün (die Änderung berührt
    `src/evaluator/`, `scripts/` und Doks — nach CLAUDE.md genügt die
    Evaluator-Suite, sofern `src/evaluation/` unberührt bleibt, was Kriterium 10
    fordert). `npm run lint` und `npm run typecheck` laufen ohne neue Befunde.

## Plan

## Tasks

## Decisions

**Mess-Modus: Opt-in-Flag.** Die Messung läuft nicht bei jedem
`evaluate()`-Aufruf mit, sondern nur bei `{ measure: true }`. Begründung: kein
`performance.now()`-Overhead bei jeder echten Roster-Auswertung in der App; die
dokumentierte Reinheit von `evaluate()` bleibt für alle bestehenden Aufrufer
unangetastet. Verworfen: „immer an" (Overhead im App-Betrieb, und „gleicher
Input → exakt gleicher Output" gälte nicht mehr) sowie eine separate Funktion
`evaluateWithTiming()`. Quelle: Antwort des Menschen im Interview.

**Granularität: die vier heutigen Phasen.** Gemessen werden genau die Spans, die
`scripts/lib/evaluator-measurement.js` heute stoppt: Vorbereitung, iterierte
Auswertung, Post-Pass, Constraints+Report. Begründung: direkt vergleichbar mit
der bestehenden Grundlinie und mit den Zahlen, die ADR-0036 zitiert; kleinster
Umbau ohne Aussagenverlust. Verworfen: alle ~9 Einzelschritte einzeln, und eine
geschachtelte Phasen-plus-Schritte-Struktur. Quelle: Antwort des Menschen im
Interview.

**Metadata-Inhalt: Zeiten + Fixpunkt-Runden + Knotenzahlen.** Alles, was das
Skript heute extern rekonstruiert, kommt künftig aus der Engine. Begründung: nur
so entfällt jeder Grund, interne Module von außen anzufassen, und die
depcruise-Ausnahme kann ersatzlos gestrichen werden. `rounds`/`converged` werden
ohnehin schon intern berechnet und heute nur verworfen. Verworfen: „nur die
Zeiten" — dann bliebe das Skript auf interne Module angewiesen und die Ausnahme
müsste bleiben. Quelle: Antwort des Menschen im Interview.

**Vorbereitung: `prepareDataset` misst sich ebenfalls selbst.** Die Vorbereitung
ist ein eigener Fassaden-Aufruf, nicht Teil von `evaluate()` (zweistufige Fassade
aus Issue 75, Baustein 08), macht laut ADR-0036 aber 99,1–99,5 % der Gesamtdauer
aus. Beide Fassaden-Funktionen bekommen dasselbe Opt-in. Begründung: die Messung
liegt dann restlos innen, das Skript braucht keinen eigenen Zeitnehmer mehr.
Verworfen: das Skript stoppt die Vorbereitung weiterhin selbst — wäre unkritisch,
da `prepareDataset` öffentlich ist, aber die Messung wäre nicht vollständig
innen. Quelle: Antwort des Menschen im Interview.

**Nutzerkreis: nur die Mess-Skripte.** Die Metadata existiert allein für
`scripts/measure-evaluator*.js`. `src/evaluation/evaluationCache.js` setzt das
Flag nie und reicht nichts durch; `AppEvaluation` und `EMPTY_RESULT` bleiben
unverändert. Begründung: kleinster Blast Radius, kein neues Feld für einen noch
nicht bestellten Nutzen. Verworfen: das Feld schon jetzt für eine spätere
Diagnose-Ansicht der App durchreichen. Quelle: Antwort des Menschen im Interview.

**Dokumentation: bestehende Doks nachziehen, keine neue ADR.**
`docs/evaluator-architecture.md` und die JSDoc der Fassade werden angepasst; es
entsteht kein neuer ADR-Eintrag. Begründung: weniger Zeremonie für eine Änderung,
die in der App niemand sieht. Verworfen: eine eigene ADR, und „gar nichts
dokumentieren" — dann stünde die Ausnahme zum Reinheits-Leitprinzip nirgends
erklärt. Quelle: Antwort des Menschen im Interview.

**Gestalt der Metadata: die heutige Struktur des Skripts, unverändert
übernommen.** Der `test-author` war blockiert, weil Feldnamen und Verschachtelung
in den Kriterien offen sind. Leitgedanke der Antwort: Die Engine erzeugt genau
das, was das Skript heute selbst zusammenbaut — dann wird das Skript zum reinen
Leser statt zum Nachbauer. Festgelegt:

- Feldname `measurement`, gleich auf dem Bericht und auf dem vorbereiteten Griff.
- `report.measurement = { phases: { iteratedEvaluation, postPass, constraintsAndReport },
  fixpoint: { rounds, converged, nonConvergence }, tree: { total, real, synthetic, byAnchorKind } }`.
  Kein `totalMs` in der Engine — Summenbildung ist Mess-Politik und bleibt im
  Skript (Kriterium 8).
- `MeasuredPhase` (heute `scripts/lib/evaluator-measurement.js:72`) zieht in die
  Engine und wird von der Fassade re-exportiert: es benennt die Phasen der
  Engine, also gehört es dorthin. `describeTree`
  (`scripts/lib/evaluator-measurement.js:122-132`) ebenso — es liest
  `node.anchorKind` und `AnchorKind` aus `model.js`, beides engine-intern.
- Der vorbereitete Griff trägt `measurement` als eigene Eigenschaft, die **nur**
  im gemessenen Fall existiert:
  `prepared.measurement = { phases: { preparation } }`. Ungemessen gibt es sie
  gar nicht, damit bleibt `Object.keys(prepared)` leer und der bestehende Pin in
  `evaluator.preparedDataset.test.js` unberührt.
- `rounds` und `converged` heißen genau so (Kriterium 3 nennt sie wörtlich);
  `nonConvergence` ist die ganze Diagnose wie heute, `null` bei Konvergenz.

Quelle: Vorgabe, vom Menschen nicht gefragt — die Metadata ist laut
Entscheidung 5 nur für die Mess-Skripte sichtbar, also weder nach außen wirkend
noch unumkehrbar.

**Kriterium 6 greift weiter als Kriterium 5.** Der Ausnahme-Ausdruck
`^scripts/(lib/evaluator-measurement|measure-evaluator)` ist ein Präfix und deckt
zwei Geschwister mit: `evaluator-measurement-cases.js:17` importiert
`src/evaluator/__fixtures__/rosParser.js`, `evaluator-measurement-output.js:14`
importiert `DiagnosticKind` aus `src/evaluator/model.js` — obwohl Kriterium 5 nur
`evaluator-measurement.js` nennt. Auflösung, ohne die Fassade für Produktivcode
zu verbreitern: Die Fassade re-exportiert `DiagnosticKind`. Der Bericht trägt
diese Werte ohnehin in seinen Diagnosen; sie zu benennen gehört zu seinem
Ausgabe-Vertrag.

Kriterium 6 bleibt damit wörtlich erfüllt: `EVALUATOR_MEASUREMENT` fällt
ersatzlos, und `npm run depcruise` läuft durch. Quelle: Vorgabe, vom Menschen
nicht gefragt.

**Korrektur nach Review-Runde 1:** Die ursprüngliche Fassung dieser Entscheidung
behauptete, *beide* Geschwister würden zu Fehlern, und ordnete deshalb zusätzlich
eine `__fixtures__`-Ausnahme auf der `to`-Seite der depcruise-Regel an. Das war
falsch: `.dependency-cruiser.cjs` wirft `(^|/)__fixtures__/` bereits global über
`options.exclude` aus dem Graphen, der Import kommt dort nie an. Die Ausnahme war
toter Konfigurationscode, den kein Kriterium verlangt hat — sie ist entfernt,
`npm run depcruise` läuft unverändert durch. Load-bearing ist allein der
`DiagnosticKind`-Re-Export.

## Log

**Die Drift ist bereits eingetreten — das Skript ist heute kaputt.** Beim
Aufnehmen der Grundlinie für Kriterium 9 (`node scripts/measure-evaluator.js`
auf dem unveränderten Stand, Branch enthält nur diese Issue-Datei) bricht das
Skript im dritten Messfall mit Exitcode 1 ab — nicht an der 100-ms-Schwelle,
sondern an seiner eigenen Drift-Prüfung:

> Die nachgebildete Pipeline des Messverfahrens weicht von der Fassade
> `evaluate` ab. Die Messung waere wertlos — gleiche zuerst
> `scripts/lib/evaluator-measurement.js` an `src/evaluator/evaluator.js` an.

Betroffen ist `numeric-conditions/rosters/greater-than-true.ros` („groesster
Datensatz — Spielsystem + 3 Armee-Kataloge"), laut
`scripts/lib/evaluator-measurement-cases.js:35-37` ausgerechnet der Fall, der
„die Bewertung gegen die interaktive Obergrenze trägt". Der Nachbau liefert dort
11 Verstöße / 321 Capabilities / 359 infoElements, die Fassade 7 / 183 / 143;
der Nachbau erzeugt zusätzlich acht `unresolvedScope`-Diagnosen und zwei
`authorMessage`-Verstöße, die die Fassade nicht kennt.

Damit ist die Begründung dieser Issue keine Vorsorge mehr, sondern ein Befund:
die zweite Kopie der Pipeline ist auseinandergelaufen, und das Messverfahren
produziert für seinen wichtigsten Fall seit unbekannter Zeit gar keine Zahlen
mehr.

Folgen für die Kriterien — keine Änderung der Absicht, die Kriterien bleiben
wortgleich:
- Kriterium 9: Eine belastbare Grundlinie gibt es nur für die ersten beiden
  Fälle (siehe unten). Für den dritten existiert heute keine, gegen die
  verglichen werden könnte; nach dem Umbau liefert er erstmals wieder Zahlen.
- Kriterium 8: „läuft weiter" ist für den dritten Fall heute falsch. Nach dem
  Umbau muss er wieder durchlaufen — das ist eine Verbesserung, keine
  Regression.

Grundlinie vor der Änderung (Median über 15 Läufe, jsdom/Node, dieser Container):

| Fall | Vorbereitung | Iterierte Auswertung | Nach-Durchlauf | Grenzen+Bericht | Gesamt | wiederverwendet | Knoten | Runden |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| klein | 404.5 ms (99.0 %) | 1.6 ms (0.4 %) | 1.6 ms (0.4 %) | 2.1 ms (0.5 %) | 408.7 ms | 4.2 ms | 142 | 2, konvergiert |
| Mehrkatalog | 1009.3 ms (99.1 %) | 2.3 ms (0.2 %) | 3.3 ms (0.3 %) | 5.1 ms (0.5 %) | 1018.2 ms | 8.9 ms | 349 | 2, konvergiert |
| groesster Datensatz | — | — | — | — | — | — | — | Abbruch (Drift) |

Die absoluten Zahlen sind containerabhängig; für Kriterium 9 zählt der Anteil
der Vorbereitung (99.0 / 99.1 %) und die Größenordnung der übrigen Phasen.

**Review-Runde 1 — frischer Kontext, drei Befunde, kein verletztes Kriterium.**
Der Reviewer hat elf der zwölf Kriterien als erfüllt bestätigt und Kriterium 9
als *der Sache nach erfüllt, mit Vorbehalt* — siehe die Zahlen weiter unten. Die
Fakten sind per Exitcode belegt: `npx vitest run src/evaluator` (73 Dateien, 924 Tests) 0,
`npx vitest run scripts/lib` (3 Dateien, 22 Tests) 0, `npx vitest run` (264
Dateien, 2751 Tests) 0, `node e2e/ui.test.js` 0, `npm run lint` 0,
`npm run typecheck` 0, `npm run depcruise` 0 (449 Module, 0 Fehler),
`node scripts/measure-evaluator.js` 1 (100-ms-Schwelle gerissen, wie in der
Grundlinie), `node scripts/measure-evaluator-browser.js` 0.

Triage der drei Befunde:

1. *Die `__fixtures__`-Ausnahme ist unerreichbar, und der Datensatz behauptet das
   Gegenteil.* Verletzt kein Kriterium, aber der Diff trug Konfiguration, die
   kein Kriterium verlangt hat, und der Datensatz begründete sie mit einer
   widerlegten Prämisse. **Sofort behoben:** Ausnahme entfernt, Entscheidung
   korrigiert (siehe Korrektur oben). `npm run depcruise` danach erneut 0
   Fehler, Exitcode 0. Die Dokumentationsregel deckt das: der Diff hatte die
   Aussage selbst falsch gemacht.
2. *Kriterium 2 ist in seiner Phasen-Zusammensetzung unbewiesen.* Der Reviewer
   hat gezeigt, dass `buildIndex` aus seiner Phase herausgezogen werden kann,
   ohne dass ein einziger Test rot wird — genau die stille Drift, gegen die
   diese Issue antritt. Der Code ist korrekt, der Beweis fehlt. **An den
   `test-author` zurückgegeben**, mit der Auflage, den Test unter genau dieser
   Mutation rot zu sehen.
3. *Kriterium 3 deckt nur eine der beiden Nichtkonvergenz-Arten ab.*
   `ROUND_BUDGET_EXHAUSTED` lässt sich aus `NON_CONVERGENCE_KINDS` löschen, ohne
   dass ein Test bricht. Ebenfalls an den `test-author` zurückgegeben, zusammen
   mit der beim Umbau verlorenen Abdeckung von `groupAnchor`/`categoryAnchor` in
   den Knotenzahlen.

Befunde 2 und 3 sind Beweislücken zu den Kriterien 2 und 3 selbst, keine
Fremdkörper — deshalb werden sie in diesem Diff geschlossen und nicht als eigene
Issue abgelegt. **Beide sind erledigt und in Runde 2 nachgeprüft:** der Reviewer
hat seine eigenen Mutationen erneut angewandt und beide Tests rot gesehen.

Was der Reviewer außerhalb der Kriterien vermerkt hat, ohne Handlungsbedarf:
`src/evaluator/measurement.js` landet im Produktionsbündel (die App setzt das
Flag nie, also verhaltensneutral); die Fassade exportiert mit `DiagnosticKind`
einen zweiten Namen mehr, den künftig auch App-Code importieren dürfte;
`measurement.attachTo` mutiert das frisch gebaute Berichtsobjekt, was ein
späteres Einfrieren des Berichts ausschließt.

**Messung nach der Änderung — der Beleg für Kriterium 9.** Median über 15 Läufe,
jsdom/Node, derselbe Container wie die Grundlinie:

| Fall | Vorbereitung | Iterierte Auswertung | Nach-Durchlauf | Grenzen+Bericht | Gesamt | Knoten | Runden |
| --- | --- | --- | --- | --- | --- | --- | --- |
| klein | 386.1 ms (98.6 %) | 1.6 ms | 1.7 ms | 1.8 ms | 391.6 ms | 142 | 2 |
| Mehrkatalog | 1007.0 ms (98.8 %) | 2.3 ms | 3.2 ms | 4.2 ms | 1018.9 ms | 349 | 2 |
| groesster Datensatz | 1115.1 ms (99.6 %) | 1.4 ms | 1.5 ms | 1.7 ms | 1119.3 ms | 183 | 1 |

Knotenzahlen und Runden sind identisch zur Grundlinie. Die Summe der drei
Auswertungsphasen ist *niedriger* als vorher (5.1 statt 5.3 ms; 9.7 statt
10.7 ms) — die Instrumentierung bläht also nicht auf, was sie misst. Der dritte
Fall liefert erstmals überhaupt Zahlen.

**Vorbehalt, offen ausgesprochen:** ADR-0036:105-106 nennt für den Anteil der
Vorbereitung die Spanne 99,1–99,5 %. Zwei der drei Fälle liegen jetzt mit 98.6 %
und 98.8 % knapp darunter. Verursacht hat das nicht diese Änderung: die
Grundlinie *vor* dem Diff lag auf diesem Container schon bei 99.0 % und 99.1 %,
also am unteren Rand oder darunter, und die gemessenen Phasen sind gesunken statt
gestiegen. Es ist Streuung der Parse-Zeit dieses Containers. Kriterium 9 fragt
nach der Größenordnung, und die stimmt; die wörtliche Spanne der ADR tut sie
nicht. Ob die ADR-Zahlen nachgemessen gehören, ist eine eigene Frage und keine
dieser Issue — hier steht sie, damit sie nicht verlorengeht.

**Review-Runde 2 — derselbe Kontext fortgesetzt, zwei Befunde, kein verletztes
Kriterium.** Trend 3 → 2. Der Reviewer hat alle drei Befunde aus Runde 1 als
geschlossen nachgewiesen (Mutationen erneut angewandt, Tests jetzt rot) und
bestätigt: `npx vitest run src/evaluator` 74 Dateien / 936 Tests exit 0,
`npx vitest run` 265 Dateien / 2763 Tests exit 0, lint 0, typecheck 0, depcruise
0 Fehler bei 450 Modulen. E2E und Messläufe nicht erneut gefahren, weil seit
Runde 1 kein Byte an Engine oder Skript geändert wurde.

1. *Der Datensatz belegte Kriterium 9 nicht und überzeichnete Runde 1.* Die
   Zahlen nach der Änderung standen nirgends im Diff, und der Log behauptete,
   alle zwölf Kriterien seien bestätigt — der Vorbehalt zu Kriterium 9 fehlte.
   **Sofort behoben:** Zahlen und Vorbehalt stehen jetzt oben, die Behauptung ist
   korrigiert, die Befunde 2 und 3 sind als erledigt markiert.
2. *`evaluator.measurementPhaseComposition.test.js` hängt still an der
   Modul-Isolation.* Unter `npx vitest run src/evaluator --no-isolate` sind die
   Engine-Module schon un-gemockt geladen, die Sonde wird nie eingebaut, und
   neun Tests melden „der Schritt liegt ausserhalb" — sie beschuldigen die
   Engine, obwohl nur die Sonde fehlt. Andere Dateien werden nicht verfälscht.
   **An den `test-author` zurückgegeben**, um die Voraussetzung im Dateikopf zu
   benennen (und, wenn billig, den Fehlschlag selbst sprechen zu lassen).

Zur Abwägung der zwei Fragen, die ich dem Reviewer gestellt hatte: Die
`vi.mock`-Kopplung an die Modulstruktur hält er für die richtige Art von
Kopplung — jeder Weg, sie zu brechen, schlägt laut fehl statt still
durchzugehen; der Preis ist ein Fehlalarm bei harmlosem Umbau, die sichere
Richtung. Die 40-ms-Sonde hat er unter Last geprüft: zwölf Läufe der Datei
parallel zur vollen Suite auf einer ausgelasteten Vier-Kern-Maschine, zwölfmal
grün. Und das Rundenbudget-Fixture scheitert laut statt still, wenn jemand
`MAX_FIXPOINT_ROUNDS` anhebt — die Kontrollzusicherung prüft die Diagnose selbst
statt der Konstanten.

Eine Anmerkung des Reviewers habe ich übernommen: die verlorene
`describeTree`-Abdeckung steht oben fälschlich unter „ohne Handlungsbedarf" — sie
ist repariert, nicht geduldet. Neu vermerkt, ohne Handlungsbedarf: die
Phasen-Sonde kostet rund 0,45 s absichtliche Wartezeit pro Lauf der
Evaluator-Suite (34,6 s → 35,7 s).

## Checkpoints

### Before implementation

**Does this match what was asked?** Ja. Der Mensch hat verlangt, dass der
Evaluator die Performance seiner Einzelteile selbst misst und als Metadata im
Ergebnis ausliefert, statt dass ein externes Skript ihn dafür nachbaut. Genau
das beschreiben die Kriterien 1–5; Kriterium 6 macht den Wegfall des Nachbaus
maschinell nachweisbar. Die sechs Entscheidungen hat er im Interview einzeln
bestätigt, die Kriterien anschließend freigegeben.

**What surprised me?**
- Die Vorbereitung (`prepareDataset`) liegt gar nicht in `evaluate()`, sondern
  ist ein eigener Fassaden-Aufruf — und macht laut ADR-0036 99,1–99,5 % der
  Gesamtdauer aus. Von den vier gemessenen Phasen liegt also genau die
  teuerste außerhalb der Funktion, um die es hier vordergründig geht.
- `evaluateToFixpoint` berechnet `rounds`/`converged` längst und die Fassade
  destrukturiert sie schlicht nicht — die Metadata gibt es intern also
  teilweise schon, sie wird nur weggeworfen.
- Der 100-ms-Schwellenwert steht in keiner ADR, nur als Konstante im Skript
  und in der Issue-Historie zu Issue 75. Ein `design.md`, auf das Kommentare
  als Quelle verweisen, existiert im Repo nicht mehr.
- Das Skript sichert seinen eigenen Nachbau mit `assertMatchesFacade()` gegen
  Drift ab — es weiß also, dass die Duplikation gefährlich ist.

**What am I assuming without having verified it?**
- Dass die Instrumentierung die Messwerte nicht selbst nennenswert verschiebt.
  Kriterium 9 prüft das; falls doch, ist die Form der Instrumentierung falsch
  gewählt und nicht die Absicht.
- Dass `scripts/measure-evaluator-browser.js` weiterhin sauber bündelt, wenn
  `evaluator-measurement.js` nur noch die Fassade importiert. Der Vite-Build
  zieht dann einen anderen Modulgraphen als heute. *(Nachträglich bestätigt: der
  Reviewer hat das Skript in Runde 1 gefahren — Exitcode 0, Chrome/150, beide
  Spalten gedruckt.)*
- Dass kein bestehender Test die exakte Gestalt des Report-Objekts festnagelt
  (der Researcher fand nur feldweise Zusicherungen, kein `toEqual` auf dem
  ganzen Report). Ein neues Feld hinter dem Flag träfe ohnehin nur den
  Mess-Pfad.

### Before the PR

**Does this match what was asked?** Ja. Verlangt war, dass der Evaluator die
Performance seiner Einzelteile selbst misst und als Metadata im Ergebnis
ausliefert, statt dass ein externes Skript ihn nachbaut. Der Nachbau ist weg:
`scripts/lib/evaluator-measurement.js` importiert nur noch die Fassade, die
Drift-Prüfung ist mangels Nachbau gegenstandslos geworden, und die
depcruise-Ausnahme, die den Nachbau erlaubte, ist ersatzlos gestrichen — was
`npm run depcruise` mit Exitcode 0 belegt. Die vier Phasen, Runden und
Knotenzahlen kommen aus der Engine. Die App ist unberührt.

**What surprised me?**
- Die Drift war keine Möglichkeit, sondern Tatsache. Der wichtigste Messfall
  lieferte seit unbekannter Zeit gar keine Zahlen mehr, weil der Nachbau an der
  eigenen Prüfung scheiterte. Er läuft jetzt wieder.
- Die `__fixtures__`-Ausnahme, die ich angeordnet hatte, war wirkungslos: die
  Konfiguration wirft `__fixtures__` schon global aus dem Graphen. Ich hatte eine
  Prämisse als Tatsache in den Datensatz geschrieben, die ein einzelner Lauf
  widerlegt.
- Mein eigener Datensatz überzeichnete die erste Review-Runde: „alle zwölf
  Kriterien bestätigt", obwohl der Reviewer bei Kriterium 9 ausdrücklich einen
  Vorbehalt angebracht hatte. Der Reviewer hat das gefunden, nicht ich.
- Beide Beweislücken, die Runde 1 fand, waren Lücken in *Tests*, nicht im Code —
  die Umsetzung war jedes Mal richtig, nur unbewiesen.

**What am I assuming without having verified it?**
- Dass der Unterschied zur ADR-0036-Spanne (98.6/98.8 % gegen 99,1–99,5 %)
  Container-Streuung ist und nicht die Instrumentierung. Belege dafür: die
  Grundlinie vor dem Diff lag hier schon bei 99.0/99.1 %, und die gemessenen
  Auswertungsphasen sind gesunken statt gestiegen. Ein Gegenbeweis wäre eine
  Messung auf anderer Hardware; die habe ich nicht.
- Dass die `vi.mock`-Kopplung der Phasen-Sonde an die Modulstruktur beim nächsten
  harmlosen Umbau als Fehlalarm auffällt und nicht als echter Befund
  missverstanden wird. Der Reviewer hält die Richtung für die sichere; geprüft
  ist sie nicht.
- Dass niemand die Metadata künftig doch in der App braucht. Fällt das an, ist
  Entscheidung 5 neu zu treffen, nicht diese Umsetzung zu reparieren.

## Retro
