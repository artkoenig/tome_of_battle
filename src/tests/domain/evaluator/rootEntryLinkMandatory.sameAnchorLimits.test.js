/**
 * Rand von §9.9 Kriterium 3 (Issue 85, Review Runde 2): entdoppelt wird nur
 * DIESELBE Pflicht. Zwei `min`-Grenzen am SELBEN Wurzel-`selectionEntry` mit
 * gleichem Feld (`selections`) und Rahmen (`roster`), aber VERSCHIEDENEN
 * Grenzwerten (1 und 3) sind zwei verschiedene Pflichten — keine zwei
 * Kodierungen einer Pflicht. Bei leerer Armee muessen beide melden.
 *
 * Konventionen wie in `rootEntryLinkMandatory.dedupeBounds.test.js`:
 * synthetischer Minimal-Katalog, Fassade
 * `evaluate(prepareDataset({ catalogues }), roster)`, leere Armee.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../domain/evaluator/evaluator.js';
import { MessageSeverity } from '../../../domain/evaluator/model.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Wertet einen einzelnen synthetischen Katalog gegen ein Roster aus. */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

const EMPTY_ARMY = { forces: [] };

const ROOT_ENTRY_ID = 'root-ogre-bulls';
const TARGET_NAME = 'Ogerbullen';
const MIN_ONE_LIMIT_ID = 'min-one';
const MIN_THREE_LIMIT_ID = 'min-three';

describe('§9.9 Kriterium 3, Rand: zwei min-Grenzen mit gleichem Feld und Rahmen, aber verschiedenen Werten, am selben Wurzeleintrag', () => {
  const MIN_ONE = `<constraint id="${MIN_ONE_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>`;
  const MIN_THREE = `<constraint id="${MIN_THREE_LIMIT_ID}" type="min" value="3" field="selections" scope="roster"/>`;

  /** Ein Wurzel-`selectionEntry` mit den gegebenen Grenzen. */
  function catalogueWithConstraints(constraintsXml) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-same-anchor-mins" name="Same Anchor Distinct Bounds">
        <selectionEntries>
          <selectionEntry id="${ROOT_ENTRY_ID}" name="${TARGET_NAME}" type="unit">
            <constraints>
              ${constraintsXml}
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  it('leere Armee: zwei Verstoesse — min-one mit bound 1 und min-three mit bound 3, beide Ist 0', () => {
    // Vorbedingungen im selben Test: jede der beiden Grenzen feuert fuer sich
    // allein (sonst waere „zwei statt eins" unbeobachtbar bzw. truegerisch).
    const minOneOnly = evaluate(catalogueWithConstraints(MIN_ONE), EMPTY_ARMY);
    expect(minOneOnly.violations).toHaveLength(1);
    expect(minOneOnly.violations[0]).toMatchObject({ limitId: MIN_ONE_LIMIT_ID, actual: 0, bound: 1 });

    const minThreeOnly = evaluate(catalogueWithConstraints(MIN_THREE), EMPTY_ARMY);
    expect(minThreeOnly.violations).toHaveLength(1);
    expect(minThreeOnly.violations[0]).toMatchObject({ limitId: MIN_THREE_LIMIT_ID, actual: 0, bound: 3 });

    // Der eigentliche Rand: verschiedene Grenzwerte = verschiedene Pflichten.
    // Die Entdopplung ueber (Feld, Grenzart, Rahmen, Ziel-Id) darf die
    // bound-3-Meldung nicht verschlucken.
    const report = evaluate(catalogueWithConstraints(`${MIN_ONE}\n${MIN_THREE}`), EMPTY_ARMY);

    expect(report.violations).toHaveLength(2);

    const byLimitId = new Map(report.violations.map(violation => [violation.limitId, violation]));
    expect([...byLimitId.keys()].sort()).toEqual([MIN_ONE_LIMIT_ID, MIN_THREE_LIMIT_ID].sort());
    expect(byLimitId.get(MIN_ONE_LIMIT_ID)).toMatchObject({
      severity: MessageSeverity.ERROR,
      actual: 0,
      bound: 1,
    });
    expect(byLimitId.get(MIN_THREE_LIMIT_ID)).toMatchObject({
      severity: MessageSeverity.ERROR,
      actual: 0,
      bound: 3,
    });
  });
});
