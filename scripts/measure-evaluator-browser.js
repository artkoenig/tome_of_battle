/**
 * Aufwandsmessung der Reinraum-Engine **im echten Browser** — kein Produktivcode.
 *
 *   node scripts/measure-evaluator-browser.js
 *   node scripts/measure-evaluator-browser.js --repetitions=25
 *
 * ── Warum es dieses zweite Messgeraet gibt ───────────────────────────────────
 * `scripts/measure-evaluator.js` misst in Node und liest die Kataloge ueber den
 * `DOMParser` von jsdom. Der ist deutlich langsamer als der native Parser eines
 * Browsers — und das Lesen ist genau der Abschnitt, dessen Anteil ueber die Form
 * der Fassade entscheidet. Der **Anteil** ist gegen diese Verzerrung robust (jede
 * Verlangsamung des Lesers vergroessert ihn nur), der **absolute Wert** ist es
 * nicht. Diesen Lauf gibt es, damit die Millisekunden nicht allein auf jsdom
 * ruhen: er fuehrt dieselben Faelle, dasselbe Messverfahren und dieselben
 * Schwellen im Browser aus, in dem die Anwendung tatsaechlich laeuft, und stellt
 * beide Messreihen nebeneinander.
 *
 * ── Wie ────────────────────────────────────────────────────────────────────
 * Gemessen wird die Engine, nicht die Anwendung: es wird keine Seite der App
 * geladen, kein IndexedDB benutzt und nichts importiert. Statt dessen wird das
 * Messverfahren mit der Engine zu einem Buendel gepackt (Vite, dieselbe
 * Werkzeugkette wie im Produktions-Build), in einer leeren Seite ausgefuehrt und
 * mit den in Node gelesenen Katalog- und Roster-Daten gefuettert. Der Browser
 * kommt ueber den gemeinsamen Puppeteer-Setup-Pfad des Repositories
 * (`scripts/lib/e2e-harness.js`).
 *
 * Beide Laeufe rufen **dieselbe** {@link measureCase}-Funktion auf; die Ausgabe
 * pruefen laesst sich daran, dass Knotenzahl und Fixpunktausgang beider Spalten
 * uebereinstimmen muessen (`printCase` bricht sonst ab).
 */

import { JSDOM } from 'jsdom';
import { build } from 'vite';

import { DEFAULT_REPETITIONS, measureCase } from './lib/evaluator-measurement.js';
import { MEASUREMENT_CASES, resolveCase } from './lib/evaluator-measurement-cases.js';
import { printCase, printThresholdSummary } from './lib/evaluator-measurement-output.js';
import { launchBrowser, REPO_ROOT } from './lib/e2e-harness.js';

/** Der Name, unter dem das Buendel sein Messverfahren in der Seite ablegt. */
const BUNDLE_GLOBAL = 'evaluatorMeasurement';

/** Einstieg des Buendels: das Messverfahren samt der Engine, die es misst. */
const BUNDLE_ENTRY = 'scripts/lib/evaluator-measurement.js';

/** Bezeichnungen der beiden Messreihen — sie sind die Spaltenkoepfe der Ausgabe. */
const NODE_COLUMN_LABEL = 'jsdom (Node)';
const BROWSER_COLUMN_LABEL = 'nativ (Chrome)';

/**
 * Packt das Messverfahren mit der Engine zu einem einzelnen, in einer Seite
 * ausfuehrbaren Buendel. Ueber Vite, weil das die Werkzeugkette ist, mit der die
 * Anwendung auch ausgeliefert wird — gemessen wird damit Code in derselben Form,
 * in der er im Browser wirklich laeuft.
 *
 * @returns {Promise<string>} Der Quelltext des Buendels.
 */
async function bundleMeasurement() {
  const result = await build({
    root: REPO_ROOT,
    // Ohne die Projekt-Konfiguration: deren Plugins gehoeren zum Ausliefern der
    // Anwendung (Service-Worker-Version, Changelog) und haben mit dem Buendeln
    // eines Messgeraets nichts zu tun. Das Buendel besteht ohnehin nur aus
    // Engine-Modulen ohne Abhaengigkeiten.
    configFile: false,
    logLevel: 'warn',
    build: {
      write: false,
      minify: false,
      lib: { entry: BUNDLE_ENTRY, formats: ['iife'], name: BUNDLE_GLOBAL, fileName: 'measurement' },
    },
  });
  const outputs = Array.isArray(result)
    ? result.flatMap(singleBuild => singleBuild.output)
    : ('output' in result ? result.output : []);
  const bundle = outputs.find(chunk => chunk.type === 'chunk');
  if (bundle === undefined) {
    throw new Error(`Der Build von ${BUNDLE_ENTRY} hat kein ausfuehrbares Buendel geliefert.`);
  }
  return bundle.code;
}

/**
 * Misst alle Faelle im Browser. Ein einziger Seitenaufbau traegt alle Faelle: der
 * Just-in-time-Compiler waermt sich damit ueber die Faelle hinweg auf, genau wie
 * in der laufenden Anwendung.
 *
 * @param {Array<{ dataset: object, roster: object }>} cases
 * @param {{ repetitions: number }} options
 * @returns {Promise<{ summaries: object[], userAgent: string }>}
 */
async function measureInBrowser(cases, { repetitions }) {
  const bundle = await bundleMeasurement();
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(`[Browser] ${error}`));
    await page.evaluate(bundle);

    const summaries = [];
    for (const measurementCase of cases) {
      summaries.push(await page.evaluate(
        // Der Browser bekommt genau die Eingaben der Fassade — Katalog-XML als Text
        // und das schon geparste Roster —, damit er exakt dieselbe Arbeit misst wie
        // der Node-Lauf. Gelesen wird das XML drinnen, mit dem nativen DOMParser.
        (globalName, dataset, roster, runs) =>
          globalThis[globalName].measureCase(dataset, roster, { repetitions: runs }),
        BUNDLE_GLOBAL, measurementCase.dataset, measurementCase.roster, repetitions,
      ));
    }
    return { summaries, userAgent: await browser.version() };
  } finally {
    await browser.close();
  }
}

/** Liest die Aufrufoptionen. */
function parseOptions(argv) {
  const repetitionsArgument = argv.find(argument => argument.startsWith('--repetitions='));
  return {
    repetitions: repetitionsArgument === undefined ? DEFAULT_REPETITIONS : Number(repetitionsArgument.split('=')[1]),
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const cases = MEASUREMENT_CASES.map(resolveCase);

  const { summaries, userAgent } = await measureInBrowser(cases, options);

  // Erst nach dem Browser-Lauf, damit jsdom das Messgeraet des Browsers nicht
  // beeinflusst und beide Reihen dieselbe Maschine unter derselben Last sehen.
  globalThis.DOMParser = new JSDOM().window.DOMParser;

  console.log('\nReinraum-Engine — Aufwandsmessung, jsdom gegen den nativen XML-Leser');
  console.log(`Node ${process.version} / ${userAgent}, ${options.repetitions} Wiederholungen je Fall und Messreihe.`);

  const verdicts = cases.flatMap((measurementCase, index) => printCase(measurementCase, [
    { label: NODE_COLUMN_LABEL, summary: measureCase(measurementCase.dataset, measurementCase.roster, options) },
    { label: BROWSER_COLUMN_LABEL, summary: summaries[index] },
  ]));

  printThresholdSummary(verdicts);
}

main();
