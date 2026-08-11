import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Issue 0147, increment "self-scope-max-frame": **a `max` (or `min`) constraint
 * with `scope="self"` takes its own carrier selection as the counting frame
 * and counts the selections UNDERNEATH it** — with
 * `includeChildSelections="false"`, its direct children (BSData wiki,
 * `docs/battlescribe-data-format.md` §7.6: "counted are the selections
 * *beneath* the limit's carrier, not the carrier itself"; §7.5 for piece
 * count vs. node count). Mirrors the E2E scenario
 * `docs/testing/self-scope-max-house-rules`, whose rosters are named beside
 * the case each unit case below reflects.
 */

const FORCE_ID = 'force-army';
const PARENT_ID = 'entry-parent';
const CARRIER_ID = 'entry-carrier';
const SELF_MAX_LIMIT_ID = 'limit-self-max';
const SIBLING_ID = 'entry-sibling';
const CHILD_A_ID = 'entry-child-a';
const CHILD_B_ID = 'entry-child-b';
const GRANDCHILD_ID = 'entry-grandchild';
const CARRIER_MIN_ID = 'entry-carrier-min';
const SELF_MIN_LIMIT_ID = 'limit-self-min';
const CHILD_MIN_ID = 'entry-child-min';

/**
 * Ein PARENT-Eintrag mit einem CARRIER (max 1, `scope="self"`,
 * `includeChildSelections` als Parameter), der zwei Kind-Eintraege anbietet
 * — CHILD_A mit einem eigenen Enkelkind GRANDCHILD, CHILD_B ohne —, einem
 * Geschwister SIBLING, und einem zweiten Traeger CARRIER_MIN (min 1,
 * `scope="self"`) mit einem eigenen Kind CHILD_MIN.
 */
function selfScopeFrameCatalogue({ includeChildSelections = 'false' } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-self-scope-frame" name="Self Scope Frame Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${PARENT_ID}" name="Parent" type="unit">
          <selectionEntries>
            <selectionEntry id="${CARRIER_ID}" name="Carrier" type="upgrade">
              <constraints>
                <constraint id="${SELF_MAX_LIMIT_ID}" type="max" value="1" field="selections" scope="self"
                            shared="true" includeChildSelections="${includeChildSelections}"/>
              </constraints>
              <selectionEntries>
                <selectionEntry id="${CHILD_A_ID}" name="Child A" type="upgrade">
                  <selectionEntries>
                    <selectionEntry id="${GRANDCHILD_ID}" name="Grandchild" type="upgrade"/>
                  </selectionEntries>
                </selectionEntry>
                <selectionEntry id="${CHILD_B_ID}" name="Child B" type="upgrade"/>
              </selectionEntries>
            </selectionEntry>
            <selectionEntry id="${SIBLING_ID}" name="Sibling" type="upgrade"/>
            <selectionEntry id="${CARRIER_MIN_ID}" name="Carrier Min" type="upgrade">
              <constraints>
                <constraint id="${SELF_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="self"
                            shared="true" includeChildSelections="false"/>
              </constraints>
              <selectionEntries>
                <selectionEntry id="${CHILD_MIN_ID}" name="Child Min" type="upgrade"/>
              </selectionEntries>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Wertet einen einzelnen synthetischen Katalog ueber die zweistufige Fassade aus. */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Ein Kontingent, dessen PARENT-Eintrag genau die gegebenen Kinder haelt. */
function armyWithParent(parentChildren) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{ defId: PARENT_ID, count: 1, children: parentChildren }],
    }],
  };
}

/** Alle Verletzungen des Berichts zu einer Grenz-Id. */
function violationsOf(report, limitId) {
  return report.violations.filter(violation => violation.limitId === limitId);
}

describe('scope="self"-Grenze am Traeger: der Rahmen ist die eigene Auswahl, gezaehlt werden die Kinder darunter', () => {
  it('feuert bei zwei direkten Kindern des Traegers mit Ist 2 gegen Grenze 1 (spiegelt Roster 01)', () => {
    const report = evaluate(selfScopeFrameCatalogue(), armyWithParent([
      {
        defId: CARRIER_ID,
        count: 1,
        children: [
          { defId: CHILD_A_ID, count: 1, children: [] },
          { defId: CHILD_B_ID, count: 1, children: [] },
        ],
      },
    ]));

    expect(violationsOf(report, SELF_MAX_LIMIT_ID)).toMatchObject([{ actual: 2, bound: 1 }]);
  });

  it('feuert bei einem einzelnen Kind-Knoten mit Stueckzahl 2 ebenfalls mit Ist 2 gegen Grenze 1 — Stueckzahl, nicht Knotenzahl (spiegelt Roster 06)', () => {
    const report = evaluate(selfScopeFrameCatalogue(), armyWithParent([
      {
        defId: CARRIER_ID,
        count: 1,
        children: [{ defId: CHILD_A_ID, count: 2, children: [] }],
      },
    ]));

    expect(violationsOf(report, SELF_MAX_LIMIT_ID)).toMatchObject([{ actual: 2, bound: 1 }]);
  });

  it('bleibt bei genau einem Kind still (spiegelt Roster 02/03 — verbietet, den eigenen Bestand des Traegers mitzuzaehlen)', () => {
    const report = evaluate(selfScopeFrameCatalogue(), armyWithParent([
      {
        defId: CARRIER_ID,
        count: 1,
        children: [{ defId: CHILD_A_ID, count: 1, children: [] }],
      },
    ]));

    expect(violationsOf(report, SELF_MAX_LIMIT_ID)).toHaveLength(0);
  });

  it('bleibt ohne Kinder still, auch wenn der Traeger selbst mit Stueckzahl 2 gewaehlt ist — der Traeger zaehlt sich nicht selbst', () => {
    // Eine Lesart, die den eigenen Bestand des Traegers mitzaehlte, meldete
    // hier faelschlich Ist 2 (siehe die verworfene Lesart in
    // countIndex.frameOwnAnyTarget.test.js, die dieser Fall ersetzt).
    const report = evaluate(selfScopeFrameCatalogue(), armyWithParent([
      { defId: CARRIER_ID, count: 2, children: [] },
    ]));

    expect(violationsOf(report, SELF_MAX_LIMIT_ID)).toHaveLength(0);
  });

  it('bleibt still, wenn der PARENT zwei direkte Kinder haelt aber der Traeger selbst nur eins — der Eltern-Rahmen ist nicht der Zaehl-Rahmen (spiegelt Roster 05)', () => {
    const report = evaluate(selfScopeFrameCatalogue(), armyWithParent([
      {
        defId: CARRIER_ID,
        count: 1,
        children: [{ defId: CHILD_A_ID, count: 1, children: [] }],
      },
      { defId: SIBLING_ID, count: 1, children: [] },
    ]));

    expect(violationsOf(report, SELF_MAX_LIMIT_ID)).toHaveLength(0);
  });

  it('bleibt mit includeChildSelections="false" bei einem Enkelkind still — nur die direkten Kinder zaehlen', () => {
    const roster = armyWithParent([
      {
        defId: CARRIER_ID,
        count: 1,
        children: [{
          defId: CHILD_A_ID,
          count: 1,
          children: [{ defId: GRANDCHILD_ID, count: 1, children: [] }],
        }],
      },
    ]);

    const report = evaluate(selfScopeFrameCatalogue({ includeChildSelections: 'false' }), roster);

    expect(violationsOf(report, SELF_MAX_LIMIT_ID)).toHaveLength(0);
  });

  it('feuert mit includeChildSelections="true" auf denselben Baum mit Ist 2 gegen Grenze 1 — das Enkelkind zaehlt jetzt mit', () => {
    const roster = armyWithParent([
      {
        defId: CARRIER_ID,
        count: 1,
        children: [{
          defId: CHILD_A_ID,
          count: 1,
          children: [{ defId: GRANDCHILD_ID, count: 1, children: [] }],
        }],
      },
    ]);

    const report = evaluate(selfScopeFrameCatalogue({ includeChildSelections: 'true' }), roster);

    expect(violationsOf(report, SELF_MAX_LIMIT_ID)).toMatchObject([{ actual: 2, bound: 1 }]);
  });

  it('feuert eine min-Grenze im selben Rahmen ohne Kinder mit Ist 0 gegen Grenze 1', () => {
    const report = evaluate(selfScopeFrameCatalogue(), armyWithParent([
      { defId: CARRIER_MIN_ID, count: 1, children: [] },
    ]));

    expect(violationsOf(report, SELF_MIN_LIMIT_ID)).toMatchObject([{ actual: 0, bound: 1 }]);
  });

  it('bleibt dieselbe min-Grenze still, sobald der Traeger ein Kind haelt — die Zaehl-Regel gilt gleich fuer min und max', () => {
    const report = evaluate(selfScopeFrameCatalogue(), armyWithParent([
      {
        defId: CARRIER_MIN_ID,
        count: 1,
        children: [{ defId: CHILD_MIN_ID, count: 1, children: [] }],
      },
    ]));

    expect(violationsOf(report, SELF_MIN_LIMIT_ID)).toHaveLength(0);
  });
});
