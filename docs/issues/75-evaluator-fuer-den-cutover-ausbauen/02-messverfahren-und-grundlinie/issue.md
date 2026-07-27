Status: resolved
Type: refactor
Blocked by: [01]

## Description

Die PRD stellt die Caching-Entscheidung bewusst zurueck und macht eine Messung
zur Abnahmebedingung. Dieser Slice baut das Messverfahren und nimmt die
**Grundlinie am heutigen, kleinen Auswertungsbaum** auf.

Die Reihenfolge ist das Fragile daran: laeuft die Messung erst nach Slice 05,
ist der Vergleichswert unwiederbringlich weg. Deshalb steht sie hier und nicht
am Ende.

## Acceptance Criteria
- [ ] Es gibt ein reproduzierbares Verfahren, das an echten Katalogdaten misst, wie lange eine Auswertung braucht — mit getrennt ausgewiesenem Anteil fuer die Vorbereitung des Datensatzes, die iterierte Auswertung und den Nach-Durchlauf.
- [ ] Das Verfahren meldet zusaetzlich, wie die Fixpunktschleife ausgegangen ist (Rundenzahl, ggf. Zykluslaenge).
- [ ] Die Grundlinie am heutigen Stand ist aufgenommen und im Issue festgehalten, sodass Slice 08 dagegen vergleichen kann.
- [ ] Die Schwellen stehen vorab fest und sind dokumentiert: 100 ms fuer eine interaktive Auswertung; uebersteigt der Vorbereitungsanteil 50 %, faellt die Fassade zweistufig aus.
- [ ] Das Verfahren ist kein Produktivcode und wird nicht mit ausgeliefert.

## Comments
- **Grundlinie der Aufwandsmessung — aufgenommen VOR dem gewachsenen Auswertungsbaum (Baustein 5).**

  **Verfahren:** `node scripts/measure-evaluator.js` (kein Produktivcode, liegt unter
  `scripts/`, wird nicht ausgeliefert). Es ruft dieselben Engine-Module in derselben
  Reihenfolge auf wie die Fassade, misst die Abschnitte getrennt und gleicht seinen
  Bericht danach gegen `evaluate` ab — weicht er ab, bricht der Lauf ab, statt eine
  andere Pipeline zu messen. Je Fall 3 Warmläufe und 15 gemessene Läufe; ausgewiesen
  ist der Median. Node v22.22.2, XML-Lesen über den DOMParser von jsdom.

  **Daten:** die echten Definitive-Edition-Kataloge unter
  `src/evaluator/__fixtures__/whfb6-definitive/`, Roster aus den bestehenden
  E2E-Szenarien unter `docs/testing/`. Die drei Fälle sind fest verdrahtet
  (`MEASUREMENT_CASES`), damit die Nachmessung in Baustein 8 exakt dieselben wiederholt.

  | Fall | Roster | Knoten (real/synth.) | Fixpunkt | Vorbereitung | Iterierte Auswertung | Nach-Durchlauf | Grenzen+Bericht | Gesamt |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | klein: Spielsystem + 1 Armee-Katalog | `evaluator-bug-childid-model/01-stone-trolls.ros` | 23 (6/17) | konvergiert, 2 Runden | 362,1 ms (99,7 %) | 1,3 ms (0,4 %) | 0,0 ms | 0,1 ms | **363,1 ms** |
  | Mehrkatalog: Vampire Counts + Mercenaries | `vampire-bloodlines/06-lahmia-visibility-baseline.ros` | 49 (5/44) | konvergiert, 2 Runden | 843,0 ms (99,8 %) | 1,4 ms (0,2 %) | 0,0 ms | 0,3 ms | **845,0 ms** |
  | größter Datensatz: Spielsystem + 3 Armee-Kataloge | `numeric-conditions/greater-than-true.ros` | 42 (3/39) | konvergiert, 1 Runde | 955,3 ms (99,9 %) | 1,0 ms (0,1 %) | 0,0 ms | 0,3 ms | **956,6 ms** |

  **Ausgang der Fixpunktschleife:** alle drei Fälle konvergieren (2/2/1 Runden, harte
  Obergrenze 5). Keine Oszillation, also keine Zykluslänge. Die Schleife meldet ihren
  Ausgang seit dieser Scheibe selbst (`evaluateToFixpoint` liefert `rounds`/`converged`);
  Oszillation und erschöpftes Rundenbudget trennt erst Baustein 3, dann trägt die
  Diagnose auch die Zykluslänge.

  **Nach-Durchlauf = 0,0 ms, und das ist kein Messfehler:** am heutigen Stand gibt es ihn
  nicht — alle synthetischen Anker entstehen in Baumphase 1 und laufen in der
  Fixpunktschleife mit, ihr Aufwand steckt also in „Iterierte Auswertung". Genau
  deshalb wird die Phase trotzdem getrennt geführt: erst der Vergleich „(b) heute" gegen
  „(b)+(c) nach Baustein 5" belegt, dass der Nach-Durchlauf den Zuwachs des Angebots aus
  der Schleife heraushält.

  **Schwellen (vorab festgelegt, dokumentiert als benannte Konstanten in
  `scripts/lib/evaluator-measurement.js`):** interaktive Obergrenze 100 ms je vollständiger
  Auswertung; Vorbereitungsanteil über 50 % ⇒ zweistufige Fassade.

  **Urteil der Grundlinie:** die interaktive Obergrenze ist in allen drei Fällen gerissen
  (363–957 ms) — blockierender Befund. Der Vorbereitungsanteil liegt bei 99,7–99,9 %, also
  weit über 50 %: die Messung spricht klar für die **zweistufige** Fassade. Entschieden
  wird das in Baustein 8, nach der Nachmessung.

  **Was die Zahlen nicht sagen:** gemessen wird in Node mit dem DOMParser von jsdom, der
  deutlich langsamer ist als der native DOMParser eines Browsers. Der absolute Wert der
  Vorbereitung ist damit nach oben verzerrt, ihr Anteil ebenso. Belastbar ist der
  Vergleich derselben Messung mit sich selbst — Grundlinie gegen Nachmessung, die
  dasselbe Skript unverändert wiederholt. Die Rangfolge der Anteile ist von der Verzerrung
  unberührt: die iterierte Auswertung liegt bei 1,0–1,4 ms und damit drei Größenordnungen
  unter dem Vorlauf.
- Umgesetzt: `scripts/measure-evaluator.js` (CLI) auf `scripts/lib/evaluator-measurement.js` (Messlogik, modulgetestet) — misst die vier Abschnitte einer Auswertung getrennt, zaehlt die Baumknoten und meldet den Ausgang der Fixpunktschleife; dafuer liefert `evaluateToFixpoint` jetzt `rounds`/`converged`. Die Grundlinie steht als eigener Kommentar in diesem Issue.
