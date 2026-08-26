/**
 * Raender von §9.9 Kriterium 3 (Issue 85, Review-Nachtrag): „dieselbe Pflicht
 * in beiden Wurzelformen wird ueber die Ziel-Id entdoppelt — genau ein
 * Verstoss." Entdoppelt wird nur DIESELBE Pflicht; die Ziel-Id ist der
 * Schluessel, kein Freibrief:
 *
 *  1. Zwei VERSCHIEDENARTIGE Pflichten am selben Wurzeleintrag — eine
 *     Selektionszahl-Grenze (`field="selections"`) und eine Kostenart-Grenze
 *     (`field="<costTypeId>"`, §7.6) im selben Rahmen — sind zwei Pflichten:
 *     beide melden bei leerer Armee je einen Verstoss (beide `limitId`s),
 *     nicht einen.
 *  2. Bei `scope="force"` gilt die Pflicht JE Kontingent (§9.9): beide
 *     Wurzelformen derselben Pflicht werden innerhalb eines Kontingents auf
 *     einen Verstoss entdoppelt, ueber Kontingente hinweg aber nicht — zwei
 *     leere Kontingente derselben Definition ergeben genau zwei Verstoesse.
 *
 * Konventionen wie in `rootEntryLinkMandatory.test.js`: synthetische
 * Minimal-Kataloge, Fassade `evaluate(prepareDataset({ catalogues }), roster)`.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { MessageSeverity } from '../../../../contexts/ruleengine/engine/model.js';

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
const LINK_ID = 'link-ogre-bulls';
const DETACHMENT_FORCE_ID = 'force-detachment';

describe('§9.9 Kriterium 3, Rand 1: verschiedenartige Pflichten am selben Ziel werden NICHT entdoppelt', () => {
  const POINTS_ID = 'cost-points';
  const SELECTION_MIN_LIMIT_ID = 'root-min-selections';
  const COST_MIN_LIMIT_ID = 'root-min-points';
  const COST_BOUND = 200;

  /**
   * Ein Wurzel-`selectionEntry` mit den gegebenen Grenzen; die Kostenart ist im
   * Katalog deklariert (§5.3 analog, hier am Katalog wie in
   * `constraints.primaryCatalogueScope.test.js`), der Eintrag traegt `<costs>`.
   */
  function catalogueWithConstraints(constraintsXml) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-two-mins" name="Two Distinct Mandatory Bounds">
        <costTypes><costType id="${POINTS_ID}" name="pts"/></costTypes>
        <selectionEntries>
          <selectionEntry id="${ROOT_ENTRY_ID}" name="${TARGET_NAME}" type="unit">
            <costs>
              <cost name="pts" typeId="${POINTS_ID}" value="100"/>
            </costs>
            <constraints>
              ${constraintsXml}
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  const SELECTION_MIN = `<constraint id="${SELECTION_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>`;
  const COST_MIN = `<constraint id="${COST_MIN_LIMIT_ID}" type="min" value="${COST_BOUND}" field="${POINTS_ID}" scope="roster"/>`;

  it('min=1 (selections) UND Kostenart-min am selben Wurzeleintrag: zwei Verstoesse, beide limitIds', () => {
    // Vorbedingungen im selben Test: jede der beiden Grenzen feuert fuer sich
    // allein (sonst waere „zwei statt eins" unbeobachtbar bzw. truegerisch).
    const selectionOnly = evaluate(catalogueWithConstraints(SELECTION_MIN), EMPTY_ARMY);
    expect(selectionOnly.violations).toHaveLength(1);
    expect(selectionOnly.violations[0]).toMatchObject({ limitId: SELECTION_MIN_LIMIT_ID, actual: 0, bound: 1 });

    const costOnly = evaluate(catalogueWithConstraints(COST_MIN), EMPTY_ARMY);
    expect(costOnly.violations).toHaveLength(1);
    expect(costOnly.violations[0]).toMatchObject({ limitId: COST_MIN_LIMIT_ID, actual: 0, bound: COST_BOUND });

    // Der eigentliche Rand: beide Grenzen zusammen sind zwei VERSCHIEDENE
    // Pflichten am selben Ziel — die Entdopplung ueber die Ziel-Id darf sie
    // nicht auf eine Meldung zusammenziehen.
    const report = evaluate(catalogueWithConstraints(`${SELECTION_MIN}\n${COST_MIN}`), EMPTY_ARMY);

    expect(report.violations).toHaveLength(2);
    expect(report.violations.map(violation => violation.limitId).sort()).toEqual(
      [COST_MIN_LIMIT_ID, SELECTION_MIN_LIMIT_ID].sort(),
    );
    for (const violation of report.violations) {
      expect(violation).toMatchObject({ severity: MessageSeverity.ERROR, actual: 0 });
    }
  });
});

describe('§9.9 Kriterium 3, Rand 2: FORCE-Rahmen entdoppelt je Kontingent, nicht ueber Kontingente hinweg', () => {
  const ROOT_MIN_LIMIT_ID = 'root-min-ogre-bulls';
  const LINK_MIN_LIMIT_ID = 'link-min-ogre-bulls';

  // Beide Wurzelformen DERSELBEN Pflicht (`scope="force"`): der
  // Wurzel-selectionEntry traegt sie selbst, der Wurzel-entryLink zeigt auf
  // genau diesen Eintrag und traegt sie als eigene Grenze.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-dedup-force" name="Dedup Force Scope">
      <forceEntries>
        <forceEntry id="${DETACHMENT_FORCE_ID}" name="Detachment"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${ROOT_ENTRY_ID}" name="${TARGET_NAME}" type="unit">
          <constraints>
            <constraint id="${ROOT_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="force"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
      <entryLinks>
        <entryLink id="${LINK_ID}" name="${TARGET_NAME}" targetId="${ROOT_ENTRY_ID}" type="selectionEntry">
          <constraints>
            <constraint id="${LINK_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="force"/>
          </constraints>
        </entryLink>
      </entryLinks>
    </catalogue>`;

  it('zwei leere Kontingente derselben forceEntry: genau zwei Verstoesse — je Kontingent einer', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [
        { defId: DETACHMENT_FORCE_ID, count: 1, children: [] },
        { defId: DETACHMENT_FORCE_ID, count: 1, children: [] },
      ],
    });

    // Innerhalb eines Kontingents auf eine Meldung entdoppelt, ueber die
    // Kontingente hinweg nicht: zwei, nicht eins und nicht vier.
    expect(report.violations).toHaveLength(2);
    for (const violation of report.violations) {
      expect(violation).toMatchObject({ severity: MessageSeverity.ERROR, actual: 0, bound: 1 });
      expect([ROOT_MIN_LIMIT_ID, LINK_MIN_LIMIT_ID]).toContain(violation.limitId);
    }

    // Je Kontingent genau eine Meldung: die Anker-Pfade beginnen mit den beiden
    // Kontingent-Indizes 0 und 1 (Pfadform wie in `phantom.test.js`, z. B. "1/0").
    const forceIndexes = report.violations.map(violation => violation.anchor.path.split('/')[0]);
    expect(forceIndexes.sort()).toEqual(['0', '1']);
  });
});
