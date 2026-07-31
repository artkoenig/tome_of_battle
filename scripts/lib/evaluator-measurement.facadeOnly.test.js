/**
 * Kriterium 5 aus Issue 0138: Das Messverfahren spielt die Pipeline der Engine
 * nicht mehr nach, sondern liest die Phasendauern, die Fixpunkt-Runden und die
 * Knotenzahlen aus der Metadata der Fassade.
 *
 * Der maschinelle Nachweis dafuer ist ein Blick auf die Importe von
 * `evaluator-measurement.js`: greift es noch in ein engine-internes Modul
 * (`datasetPreparation`, `evalTree`, `offer`, `effectiveState`, `countIndex`,
 * `fixpoint`, `constraints`, `budget`, `report`, `rosterBudget`, `model`), gibt
 * es den Nachbau noch — und mit ihm den Grund fuer die depcruise-Ausnahme
 * `EVALUATOR_MEASUREMENT`, die Kriterium 6 ersatzlos streicht.
 *
 * Dieser Test steht bewusst neben `evaluator-measurement.test.js` in einer
 * eigenen Datei: er prueft nicht das Verhalten des Messgeraets, sondern seine
 * Naht zur Engine.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Vitest laeuft mit cwd = Repo-Wurzel; `import.meta.url` ist in der
// jsdom-Umgebung keine file://-URL und daher hier nicht nutzbar
// (dieselbe Konvention wie `scripts/release-lockfile.test.js`).
const MEASUREMENT_MODULE = join(process.cwd(), 'scripts/lib/evaluator-measurement.js');

/** Die einzige legale Aussenschnittstelle der Reinraum-Engine (ADR-0030). */
const FACADE_SUFFIX = 'src/evaluator/evaluator.js';

/**
 * Alle Modul-Angaben einer Datei: statische `import`/`export … from`-Angaben und
 * dynamische `import(…)`-Angaben.
 */
function moduleSpecifiersOf(source) {
  const specifiers = [];
  const fromClause = /\bfrom\s*['"]([^'"]+)['"]/g;
  const bareImport = /\bimport\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g;
  for (const pattern of [fromClause, bareImport]) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return [...new Set(specifiers)];
}

/** Die Modul-Angaben, die in die Engine zeigen. */
function evaluatorSpecifiersOf(source) {
  return moduleSpecifiersOf(source).filter(specifier => specifier.includes('src/evaluator/'));
}

describe('evaluator-measurement.js: nur ueber die Fassade', () => {
  it('importiert kein engine-internes Modul mehr — allein `src/evaluator/evaluator.js`', () => {
    const source = readFileSync(MEASUREMENT_MODULE, 'utf8');

    const internal = evaluatorSpecifiersOf(source).filter(specifier => !specifier.endsWith(FACADE_SUFFIX));

    expect(
      internal,
      'Das Messverfahren greift noch von innen in die Engine — dann gibt es den Nachbau der Pipeline noch.',
    ).toEqual([]);
  });

  it('greift die Engine ueber die Fassade ab, statt sie gar nicht mehr zu benutzen', () => {
    const source = readFileSync(MEASUREMENT_MODULE, 'utf8');

    // Gegenprobe zum Test darueber: die leere Liste interner Importe darf nicht
    // dadurch entstehen, dass das Messgeraet die Engine ueberhaupt nicht mehr ruft.
    expect(evaluatorSpecifiersOf(source).filter(specifier => specifier.endsWith(FACADE_SUFFIX))).toHaveLength(1);
  });
});
