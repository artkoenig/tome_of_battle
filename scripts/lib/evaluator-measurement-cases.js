/**
 * Die **Messfaelle** der Aufwandsmessung: welche Katalogdaten und welche Roster
 * gemessen werden und wie sie von der Platte in die Eingaben der Fassade kommen.
 *
 * Eigenes Modul, weil zwei Messlaeufe dieselben Faelle brauchen — der in Node
 * (`measure-evaluator.js`, XML-Leser ueber jsdom) und der im echten Browser
 * (`measure-evaluator-browser.js`, nativer `DOMParser`). Nur wenn beide **exakt
 * dieselben** Faelle fahren, ist ihr Vergleich eine Aussage ueber den XML-Leser und
 * nicht ueber die Auswahl der Daten.
 *
 * Kein Produktivcode: nichts unter `src/` importiert dieses Modul.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { rosterFromRos } from '../../src/domain/evaluator/__fixtures__/rosParser.js';

/** Wurzel der E2E-Szenarien, relativ zum Projekt-Wurzelverzeichnis (dem cwd). */
const TESTING_ROOT = 'docs/testing';

/** Dateiname des Szenario-Manifests (Vertrag siehe `src/domain/evaluator/e2e.testcatalog.test.js`). */
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
 * Bewusst ausgelassen sind die Szenarien gegen `src/tests/__fixtures__/` und
 * `scripts/__fixtures__/`: gemessen wird gegen den Datenbestand, den die Engine
 * als ihren eigenen fuehrt (ADR-0030).
 */
export const MEASUREMENT_CASES = Object.freeze([
  { label: 'klein — Spielsystem + 1 Armee-Katalog', scenario: 'evaluator-bug-childid-model', roster: 'rosters/01-stone-trolls.ros' },
  { label: 'Mehrkatalog — Vampire Counts + Mercenaries', scenario: 'vampire-bloodlines', roster: 'rosters/06-lahmia-visibility-baseline.ros' },
  { label: 'groesster Datensatz — Spielsystem + 3 Armee-Kataloge', scenario: 'numeric-conditions', roster: 'rosters/greater-than-true.ros' },
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
 *
 * @param {{ label: string, scenario: string, roster: string }} measurementCase
 * @returns {{ label: string, source: string, catalogueCount: number, dataset: object, roster: object }}
 */
export function resolveCase({ label, scenario, roster }) {
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

/** Die Unterverzeichnisse eines Verzeichnisses, alphabetisch — fuer stabile Ausgabe. */
function readdirSorted(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

/** Alle Roster aller Szenarien als Messfaelle — die Uebersicht hinter `--all`. */
export function resolveAllCases() {
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
