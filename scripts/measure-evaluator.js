/**
 * Reproduzierbares Messverfahren fuer die Reinraum-Engine — **kein Produktivcode**.
 *
 *   node scripts/measure-evaluator.js                 # die festgelegten Grundlinien-Faelle
 *   node scripts/measure-evaluator.js --repetitions=25
 *   node scripts/measure-evaluator.js --all           # Uebersicht ueber alle E2E-Roster
 *
 * Gemessen wird an **echten Katalogdaten**: den Definitive-Edition-Katalogen unter
 * `src/evaluator/__fixtures__/whfb6-definitive/` mit Rostern aus den bestehenden
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
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

import { rosterFromRos } from '../src/evaluator/__fixtures__/rosParser.js';
import {
  MeasuredPhase,
  INTERACTIVE_BUDGET_MS,
  TWO_STAGE_PREPARATION_SHARE,
  DEFAULT_REPETITIONS,
  measureCase,
  assessThresholds,
} from './lib/evaluator-measurement.js';

// Der eigene XML-Leser der Engine nutzt das Plattform-Primitiv `DOMParser`; in Node
// stellt jsdom es bereit — dieselbe Naht, ueber die auch die Tests die Engine fahren.
globalThis.DOMParser = new JSDOM().window.DOMParser;

/** Wurzel der E2E-Szenarien, relativ zum Projekt-Wurzelverzeichnis (dem cwd). */
const TESTING_ROOT = 'docs/testing';

/** Dateiname des Szenario-Manifests (Vertrag siehe `src/evaluator/e2e.testcatalog.test.js`). */
const MANIFEST_FILE = 'scenario.json';

/**
 * Die Faelle der Grundlinie — bewusst festgelegt und nicht automatisch gewaehlt,
 * damit die Nachmessung dieselben Faelle wiederholt und die beiden Laeufe
 * vergleichbar bleiben. Alle drei laufen gegen die Definitive-Edition-Kataloge:
 *
 * - **klein**: Spielsystem plus *ein* Armee-Katalog, knappes Roster — der
 *   guenstigste Fall, den es an echten Daten gibt;
 * - **Mehrkatalog (Vampire Counts + Mercenaries)**: der von `design.md` ausdruecklich
 *   verlangte Fall; unter allen Szenarien zugleich der mit dem groessten
 *   Auswertungsbaum;
 * - **groesster Datensatz**: Spielsystem plus drei Armee-Kataloge. Er traegt die
 *   Bewertung gegen die interaktive Obergrenze, weil er den groessten
 *   Definitionsbestand aufbereiten muss.
 *
 * Bewusst ausgelassen sind die Szenarien gegen `src/solver/__fixtures__/` und
 * `scripts/__fixtures__/`: gemessen wird gegen den Datenbestand, den die Engine
 * als ihren eigenen fuehrt (ADR-0030).
 */
const MEASUREMENT_CASES = Object.freeze([
  { label: 'klein — Spielsystem + 1 Armee-Katalog', scenario: 'evaluator-bug-childid-model', roster: 'rosters/01-stone-trolls.ros' },
  { label: 'Mehrkatalog — Vampire Counts + Mercenaries', scenario: 'vampire-bloodlines', roster: 'rosters/06-lahmia-visibility-baseline.ros' },
  { label: 'groesster Datensatz — Spielsystem + 3 Armee-Kataloge', scenario: 'numeric-conditions', roster: 'rosters/greater-than-true.ros' },
]);

/** Klartext-Bezeichnung je gemessenem Abschnitt, in der Reihenfolge der Auswertung. */
const PHASE_LABELS = Object.freeze([
  [MeasuredPhase.PREPARATION, 'Vorbereitung des Datensatzes'],
  [MeasuredPhase.ITERATED_EVALUATION, 'Iterierte Auswertung'],
  [MeasuredPhase.POST_PASS, 'Nach-Durchlauf'],
  [MeasuredPhase.CONSTRAINTS_AND_REPORT, 'Grenzen und Bericht'],
]);

/** Liest das Manifest eines Szenarios. */
function loadManifest(scenarioName) {
  const manifestPath = join(TESTING_ROOT, scenarioName, MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    throw new Error(`Szenario "${scenarioName}" hat kein Manifest unter ${manifestPath}.`);
  }
  return { ...JSON.parse(readFileSync(manifestPath, 'utf8')), scenarioDir: join(TESTING_ROOT, scenarioName) };
}

/** Liest die im Manifest deklarierten Katalog-Dateien in den Datensatz der Fassade. */
function readDataset(datasetSpec) {
  const dataset = { catalogues: datasetSpec.catalogues.map(path => readFileSync(resolve(path), 'utf8')) };
  if (datasetSpec.gameSystem !== undefined) {
    dataset.gameSystem = readFileSync(resolve(datasetSpec.gameSystem), 'utf8');
  }
  return dataset;
}

/**
 * Loest einen Messfall zu seinen Eingaben auf. Ein Roster darf im Manifest einen
 * eigenen `dataset`-Override tragen; er ersetzt den Szenario-Standard vollstaendig.
 */
function resolveCase({ label, scenario, roster }) {
  const manifest = loadManifest(scenario);
  const rosterCase = manifest.rosters.find(entry => entry.file === roster);
  if (rosterCase === undefined) {
    throw new Error(`Szenario "${scenario}" kennt kein Roster "${roster}".`);
  }
  const datasetSpec = rosterCase.dataset ?? manifest.dataset;
  return {
    label,
    source: `${scenario}/${roster}`,
    catalogueCount: datasetSpec.catalogues.length + (datasetSpec.gameSystem === undefined ? 0 : 1),
    dataset: readDataset(datasetSpec),
    roster: rosterFromRos(join(manifest.scenarioDir, roster)),
  };
}

/** Alle Roster aller Szenarien als Messfaelle — die Uebersicht hinter `--all`. */
function resolveAllCases() {
  const seen = new Set();
  const cases = [];
  for (const scenario of readdirSorted(TESTING_ROOT)) {
    if (!existsSync(join(TESTING_ROOT, scenario, MANIFEST_FILE))) continue;
    for (const rosterCase of loadManifest(scenario).rosters) {
      const key = `${scenario}/${rosterCase.file}`;
      if (seen.has(key)) continue; // dasselbe Roster steht in manchen Manifesten mehrfach
      seen.add(key);
      cases.push(resolveCase({ label: rosterCase.description ?? rosterCase.file, scenario, roster: rosterCase.file }));
    }
  }
  return cases;
}

/** Die Unterverzeichnisse eines Verzeichnisses, alphabetisch — fuer stabile Ausgabe. */
function readdirSorted(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

/** Formatiert eine Dauer auf zehntel Millisekunden. */
function formatMs(durationMs) {
  return `${durationMs.toFixed(1)} ms`.padStart(10);
}

/** Formatiert einen Anteil als Prozentwert. */
function formatShare(share) {
  return `${(share * 100).toFixed(1)} %`.padStart(8);
}

/** Der Ausgang der Fixpunktschleife im Klartext. */
function formatFixpoint({ rounds, converged }) {
  return converged
    ? `konvergiert nach ${rounds} Runde(n)`
    : `nicht konvergiert (Rundenobergrenze nach ${rounds} Runden erreicht)`;
}

/** Die synthetischen Knoten nach ihrer Definitionsart, als eine Zeile. */
function formatSyntheticBreakdown(syntheticByDefinitionKind) {
  return [...syntheticByDefinitionKind.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `${kind}=${count}`)
    .join(', ');
}

/** Gibt das Ergebnis eines Falls aus und liefert dessen Schwellen-Urteil zurueck. */
function printCase(measurementCase, summary) {
  const { tree, fixpoint, phases, totalMs, preparationShare } = summary;
  const verdict = assessThresholds(summary);

  console.log(`\nFall: ${measurementCase.label}`);
  console.log(`  Quelle:    ${measurementCase.source} (${measurementCase.catalogueCount} Katalogdatei(en))`);
  console.log(
    `  Knoten:    ${tree.total} gesamt — ${tree.real} real, ${tree.synthetic} synthetisch` +
      (tree.synthetic > 0 ? ` (${formatSyntheticBreakdown(tree.syntheticByDefinitionKind)})` : ''),
  );
  console.log(`  Fixpunkt:  ${formatFixpoint(fixpoint)}`);
  console.log(`  Dauer (Median ueber ${summary.repetitions} Laeufe):`);
  for (const [phase, label] of PHASE_LABELS) {
    console.log(`    ${label.padEnd(30)}${formatMs(phases[phase])}${formatShare(phases[phase] / totalMs)}`);
  }
  console.log(`    ${'Gesamt'.padEnd(30)}${formatMs(totalMs)}`);
  console.log(
    `  Schwellen: interaktive Obergrenze ${INTERACTIVE_BUDGET_MS} ms → ` +
      `${verdict.withinInteractiveBudget ? 'eingehalten' : 'GERISSEN'}; Vorbereitungsanteil ` +
      `${formatShare(preparationShare).trim()} (Schwelle: mehr als ${TWO_STAGE_PREPARATION_SHARE * 100} %) → Fassade ${verdict.facadeShape}`,
  );
  return verdict;
}

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

  const verdicts = cases.map(measurementCase =>
    printCase(measurementCase, measureCase(measurementCase.dataset, measurementCase.roster, { repetitions: options.repetitions })),
  );

  const breaching = verdicts.filter(verdict => !verdict.withinInteractiveBudget).length;
  console.log('');
  if (breaching === 0) {
    console.log(`Alle ${verdicts.length} Faelle bleiben unter der interaktiven Obergrenze von ${INTERACTIVE_BUDGET_MS} ms.`);
    return;
  }
  console.log(
    `BLOCKIERENDER BEFUND: ${breaching} von ${verdicts.length} Faellen reissen die interaktive Obergrenze von ` +
      `${INTERACTIVE_BUDGET_MS} ms. Der Wert ist mit dem DOMParser von jsdom gemessen und im Browser vermutlich ` +
      'niedriger — die Groessenordnung des Vorbereitungsanteils bleibt davon unberuehrt.',
  );
  process.exitCode = THRESHOLD_BREACH_EXIT_CODE;
}

main();
