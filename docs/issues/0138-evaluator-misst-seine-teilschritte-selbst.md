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

## Log

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
  zieht dann einen anderen Modulgraphen als heute.
- Dass kein bestehender Test die exakte Gestalt des Report-Objekts festnagelt
  (der Researcher fand nur feldweise Zusicherungen, kein `toEqual` auf dem
  ganzen Report). Ein neues Feld hinter dem Flag träfe ohnehin nur den
  Mess-Pfad.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
