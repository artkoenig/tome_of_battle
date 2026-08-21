/**
 * Ein **wiederholter `set` waechst nicht** (Issue 0095).
 *
 * `docs/battlescribe-data-format.md` §7.7, Kasten „Ein wiederholter `set`
 * waechst nicht": `set` schreibt einen Wert, und denselben Wert ein zweites Mal
 * zu schreiben aendert nichts — genau darin unterscheidet er sich von
 * `increment`/`decrement`/`multiply`, deren Wirkung der Wiederholungsfaktor
 * vervielfacht. Upstream ist der Fall nicht entschieden (das Wiki sagt zum
 * `repeat` nur, er lasse den Modifier „multiple times" greifen), die
 * Projektentscheidung steht in §7.7 und §15.
 *
 * Gepinnt wird das **kanonische `.gst`-Beispiel** aus §7.7: die Core-Obergrenze
 * der Force „Standard" traegt `set value="6"` mit `<repeat>` je 1000 Punkte des
 * Roster-Budgets (in den ergofang-Fixture-Daten ist es die Core-**Untergrenze**,
 * dieselbe Konstruktion). Ihr effektiver Wert ist bei **jedem** Budget ab 5000
 * exakt 6 — nicht 6 + eins je weitere 1000. Gefahren wird an den echten Fixture-Daten
 * (`src/shared/__fixtures__/whfb6/`), damit der Test dieselbe Konstruktion sieht, ueber
 * die die Doku spricht.
 */

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GST = 'src/shared/__fixtures__/whfb6/Warhammer Fantasy Battle 6th edition.gst';
const CAT = 'src/shared/__fixtures__/whfb6/Ogre Kingdoms.cat';
const PTS = 'ecfa-8486-4f6c-c249';
const STANDARD_FORCE = '7d9d-6c8d-4ea0-b7ad';
const CORE_CATEGORY = '64bf-efb4-9978-26df';

const prepared = prepareDataset({
  gameSystem: readFileSync(GST, 'utf8'),
  catalogues: [readFileSync(CAT, 'utf8')],
});

/** Das effektive Mindestmass des Core-Kategorie-Slots bei diesem Budget. */
function coreMinAt(budget) {
  const report = evaluate(prepared, {
    costLimits: [{ costTypeId: PTS, value: budget }],
    forces: [{ defId: STANDARD_FORCE, count: 1, children: [] }],
  });
  const slot = [...report.capabilities.values()]
    .find(capability => capability.targetDefId === CORE_CATEGORY || capability.defId === CORE_CATEGORY);
  return slot?.effectiveMin ?? null;
}

describe('`set` mit `<repeat>` ist idempotent (Issue 0095)', () => {
  it('haelt die Core-Untergrenze ab 5000 Punkten konstant, statt je 1000 zu wachsen', () => {
    const atFiveThousand = coreMinAt(5000);

    expect(atFiveThousand).not.toBeNull();
    expect(coreMinAt(6000)).toBe(atFiveThousand);
    expect(coreMinAt(8000)).toBe(atFiveThousand);
    expect(coreMinAt(11000)).toBe(atFiveThousand);
  });

  it('laesst die Staffel unterhalb der `set`-Schwelle unberuehrt', () => {
    // Unterhalb 5000 greift der `set` nicht; dort steigt die Grenze ueber die
    // `increment`-Modifikatoren der Staffel — der Test haelt nur fest, dass die
    // beiden Wege sich unterscheiden, nicht die konkreten Zahlen der Staffel.
    expect(coreMinAt(1000)).toBeLessThan(coreMinAt(5000));
  });
});
