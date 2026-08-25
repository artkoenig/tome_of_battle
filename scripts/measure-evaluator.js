/**
 * Reproduzierbares Messverfahren fuer die Reinraum-Engine — **kein Produktivcode**.
 *
 *   node scripts/measure-evaluator.js                 # die festgelegten Grundlinien-Faelle
 *   node scripts/measure-evaluator.js --repetitions=25
 *   node scripts/measure-evaluator.js --all           # Uebersicht ueber alle E2E-Roster
 *
 * Gemessen wird an **echten Katalogdaten**: den Definitive-Edition-Katalogen unter
 * `src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/` mit Rostern aus den bestehenden
 * E2E-Szenarien unter `docs/testing/`. Nie an synthetischen Miniaturkatalogen — der
 * Aufwand der Engine haengt an der Groesse des echten Definitionsbestands.
 *
 * Ausgewiesen werden je Fall die **getrennten Anteile** Vorbereitung des Datensatzes /
 * iterierte Auswertung / Nach-Durchlauf / Grenzen und Bericht, die Knotenzahl des
 * Auswertungsbaums und der Ausgang der Fixpunktschleife. Die Schwellen, gegen die das
 * Ergebnis bewertet wird, stehen vorab fest und stehen als benannte Konstanten in
 * `scripts/lib/evaluator-measurement.js`.
 *
 * ── Was die Zahlen nicht sagen ───────────────────────────────────────────────
 * Der Lauf findet in Node statt und benutzt fuer das Lesen der Kataloge den
 * `DOMParser` von jsdom. Der ist deutlich langsamer als der native `DOMParser` eines
 * Browsers, in dem die Anwendung tatsaechlich laeuft. Der **Anteil** der Vorbereitung
 * ist damit nach oben verzerrt; belastbar ist der Vergleich derselben Messung mit
 * sich selbst — also Grundlinie gegen Nachmessung, die dieses Skript unveraendert
 * wiederholt.
 *
 * Wie gross die Verzerrung wirklich ist, misst `scripts/measure-evaluator-browser.js`:
 * es fuehrt dieselben Faelle im echten Browser aus und stellt beide Laeufe
 * nebeneinander.
 */

import { JSDOM } from 'jsdom';

import {
  DEFAULT_REPETITIONS,
  measureCase,
} from './lib/evaluator-measurement.js';
import { MEASUREMENT_CASES, resolveCase, resolveAllCases } from './lib/evaluator-measurement-cases.js';
import { printCase, printThresholdSummary } from './lib/evaluator-measurement-output.js';

// Der eigene XML-Leser der Engine nutzt das Plattform-Primitiv `DOMParser`; in Node
// stellt jsdom es bereit — dieselbe Naht, ueber die auch die Tests die Engine fahren.
globalThis.DOMParser = new JSDOM().window.DOMParser;

/** Bezeichnung der einen Messreihe dieses Laufs — die Ausgabe traegt Spalten. */
const COLUMN_LABEL = 'jsdom (Node)';

/** Liest die Aufrufoptionen. */
function parseOptions(argv) {
  const repetitionsArgument = argv.find(argument => argument.startsWith('--repetitions='));
  return {
    all: argv.includes('--all'),
    repetitions: repetitionsArgument === undefined ? DEFAULT_REPETITIONS : Number(repetitionsArgument.split('=')[1]),
  };
}

/**
 * Exitcode, wenn ein Fall die vorab festgelegte interaktive Obergrenze reisst. Die
 * Schwelle ist laut PRD ein **blockierender Befund**, also endet der Lauf nicht
 * still mit 0 — die Zahlen stehen trotzdem vollstaendig in der Ausgabe.
 */
const THRESHOLD_BREACH_EXIT_CODE = 1;

function main() {
  const options = parseOptions(process.argv.slice(2));
  const cases = options.all ? resolveAllCases() : MEASUREMENT_CASES.map(resolveCase);

  console.log('Reinraum-Engine — Aufwandsmessung');
  console.log(`Node ${process.version}, XML-Leser ueber den DOMParser von jsdom, ${options.repetitions} Wiederholungen je Fall.`);

  const verdicts = cases.flatMap(measurementCase =>
    printCase(measurementCase, [{
      label: COLUMN_LABEL,
      summary: measureCase(measurementCase.dataset, measurementCase.roster, { repetitions: options.repetitions }),
    }]));

  if (printThresholdSummary(verdicts) > 0) {
    process.exitCode = THRESHOLD_BREACH_EXIT_CODE;
  }
}

main();
