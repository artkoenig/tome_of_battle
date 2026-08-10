import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind } from './model.js';

// JSDOM provides DOMParser for the Node test run (as in the rest of the
// evaluator tests). The engine's own XML reader relies on exactly this
// primitive.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/**
 * Issue 0147, defect 2: **a limit with `childId="any"` must count its own
 * frame.** `atLeast 1 field="selections" scope="parent" childId="any"` on an
 * option reports `isHidden: true` at the empty frame, but stays that way with
 * one or two selections in the frame too — the "any" target is never counted
 * at all.
 *
 * Observed through the capability record (`capability.isHidden`) of the
 * gated option's offer anchor (as in `offer.hiddenGate.test.js`) or the
 * violation/`current` of an occupied limit (as in
 * `countIndex.costSumCarrierFrame.test.js`) — never the index directly.
 */

const FORCE_ID = 'force-army';
const UNIT_ID = 'entry-unit';
const OPTION_1_ID = 'entry-option-at-least-1';
const OPTION_2_ID = 'entry-option-at-least-2';
const OPTION_3_ID = 'entry-option-at-least-3';
const SIBLING_A_ID = 'entry-sibling-a';
const SIBLING_B_ID = 'entry-sibling-b';

/** Evaluates a single synthetic catalogue through the two-stage facade. */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** The capability record of the OFFER anchor of a definition id. */
function offerCapabilityOf(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId && capability.anchorKind === AnchorKind.OFFER_ANCHOR) {
      return capability;
    }
  }
  return null;
}

/** The capability record of a definition id, whichever anchor kind it holds — an occupied slot included. */
function capabilityOf(report, defId) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === defId) {
      return capability;
    }
  }
  return null;
}

/** A force with one unit whose children are the given definition ids. */
function armyWithUnit(childDefIds = []) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{
        defId: UNIT_ID,
        count: 1,
        children: childDefIds.map(defId => ({ defId, count: 1, children: [] })),
      }],
    }],
  };
}

// Three staggered reveal limits (atLeast 1/2/3) on `scope="parent"
// childId="any"`, plus two plain sibling options that supply the
// selections in the unit's frame.
const PARENT_ANY_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-parent-any" name="Parent Any Catalogue">
    <forceEntries>
      <forceEntry id="${FORCE_ID}" name="Army"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
        <selectionEntries>
          <selectionEntry id="${OPTION_1_ID}" name="Option At Least 1" type="upgrade" hidden="true">
            <modifiers>
              <modifier type="set" field="hidden" value="false">
                <conditions>
                  <condition type="atLeast" value="1" field="selections" scope="parent"
                             childId="any" shared="false" includeChildSelections="true"/>
                </conditions>
              </modifier>
            </modifiers>
          </selectionEntry>
          <selectionEntry id="${OPTION_2_ID}" name="Option At Least 2" type="upgrade" hidden="true">
            <modifiers>
              <modifier type="set" field="hidden" value="false">
                <conditions>
                  <condition type="atLeast" value="2" field="selections" scope="parent"
                             childId="any" shared="false" includeChildSelections="true"/>
                </conditions>
              </modifier>
            </modifiers>
          </selectionEntry>
          <selectionEntry id="${OPTION_3_ID}" name="Option At Least 3" type="upgrade" hidden="true">
            <modifiers>
              <modifier type="set" field="hidden" value="false">
                <conditions>
                  <condition type="atLeast" value="3" field="selections" scope="parent"
                             childId="any" shared="false" includeChildSelections="true"/>
                </conditions>
              </modifier>
            </modifiers>
          </selectionEntry>
          <selectionEntry id="${SIBLING_A_ID}" name="Sibling A" type="upgrade"/>
          <selectionEntry id="${SIBLING_B_ID}" name="Sibling B" type="upgrade"/>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

describe('Aufdeck-Grenze mit scope="parent" childId="any": der leere Rahmen bleibt versteckt', () => {
  it('haelt die Option versteckt, solange der Elternrahmen keine Auswahl haelt', () => {
    const report = evaluate(PARENT_ANY_CATALOGUE_XML, armyWithUnit([]));

    expect(offerCapabilityOf(report, OPTION_1_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, OPTION_1_ID).isHidden).toBe(true);
  });

  it('deckt dieselbe Option auf, sobald der Elternrahmen eine Auswahl haelt', () => {
    const report = evaluate(PARENT_ANY_CATALOGUE_XML, armyWithUnit([SIBLING_A_ID]));

    expect(offerCapabilityOf(report, OPTION_1_ID).isHidden).toBe(false);
  });

  it('haelt die Option weiterhin aufgedeckt, wenn der Elternrahmen zwei Auswahlen haelt — atLeast bleibt atLeast', () => {
    const report = evaluate(PARENT_ANY_CATALOGUE_XML, armyWithUnit([SIBLING_A_ID, SIBLING_B_ID]));

    expect(offerCapabilityOf(report, OPTION_1_ID).isHidden).toBe(false);
  });

  it('deckt bei genau einer Auswahl im Elternrahmen exakt die erste von drei gestaffelten Grenzen auf', () => {
    const report = evaluate(PARENT_ANY_CATALOGUE_XML, armyWithUnit([SIBLING_A_ID]));

    // Der Rahmen zaehlt sich unter dem "any"-Ziel nicht selbst mit, und die drei
    // Optionen sind unausgewaehlte Angebots-Anker, die nie mitzaehlen — die
    // Sibling-Auswahl allein bringt den Rahmen auf 1.
    expect(offerCapabilityOf(report, OPTION_1_ID).isHidden).toBe(false);
    expect(offerCapabilityOf(report, OPTION_2_ID).isHidden).toBe(true);
    expect(offerCapabilityOf(report, OPTION_3_ID).isHidden).toBe(true);
  });
});

describe('Aufdeck-Grenze mit scope="parent" childId="any": das Verschachtelungs-Flag entscheidet ueber die Tiefe', () => {
  const HOST_ID = 'entry-host';
  const NESTED_CHILD_ID = 'entry-nested-child';
  const OPTION_NEST_ID = 'entry-option-nesting-flag';

  /**
   * A unit with a reveal limit `atLeast 2` (NOT met by the direct child
   * `HOST_ID` alone) and a carrier whose own child `NESTED_CHILD_ID` only
   * counts once `includeChildSelections="true"`.
   */
  function nestingFlagCatalogue(includeChildSelections) {
    return `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-parent-any-nesting" name="Parent Any Nesting Catalogue">
        <forceEntries>
          <forceEntry id="${FORCE_ID}" name="Army"/>
        </forceEntries>
        <selectionEntries>
          <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
            <selectionEntries>
              <selectionEntry id="${OPTION_NEST_ID}" name="Option Nesting Flag" type="upgrade" hidden="true">
                <modifiers>
                  <modifier type="set" field="hidden" value="false">
                    <conditions>
                      <condition type="atLeast" value="2" field="selections" scope="parent" childId="any"
                                 shared="false" includeChildSelections="${includeChildSelections}"/>
                    </conditions>
                  </modifier>
                </modifiers>
              </selectionEntry>
              <selectionEntry id="${HOST_ID}" name="Host" type="upgrade">
                <selectionEntries>
                  <selectionEntry id="${NESTED_CHILD_ID}" name="Nested Child" type="upgrade"/>
                </selectionEntries>
              </selectionEntry>
            </selectionEntries>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
  }

  function armyWithNestedChild() {
    return {
      forces: [{
        defId: FORCE_ID,
        count: 1,
        children: [{
          defId: UNIT_ID,
          count: 1,
          children: [{
            defId: HOST_ID,
            count: 1,
            children: [{ defId: NESTED_CHILD_ID, count: 1, children: [] }],
          }],
        }],
      }],
    };
  }

  it('zaehlt eine Auswahl eine Ebene tiefer NICHT mit includeChildSelections="false" — die Grenze bleibt unerfuellt', () => {
    const report = evaluate(nestingFlagCatalogue('false'), armyWithNestedChild());

    expect(offerCapabilityOf(report, OPTION_NEST_ID).isHidden).toBe(true);
  });

  it('zaehlt dieselbe Auswahl eine Ebene tiefer mit includeChildSelections="true" mit — die Grenze wird erfuellt', () => {
    const report = evaluate(nestingFlagCatalogue('true'), armyWithNestedChild());

    expect(offerCapabilityOf(report, OPTION_NEST_ID).isHidden).toBe(false);
  });
});

describe('Aufdeck-Grenze mit scope="parent" childId="any": Kontrollen, die der Fix nicht brechen darf', () => {
  const SELF_SCOPE_ID = 'entry-self-scope';
  const SELF_SCOPE_LIMIT_ID = 'limit-self-scope';

  it('KONTROLLE: eine scope="self"-Grenze zaehlt weiterhin ihren eigenen Rahmen', () => {
    const catalogueXml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-self-scope" name="Self Scope Catalogue">
        <forceEntries>
          <forceEntry id="${FORCE_ID}" name="Army"/>
        </forceEntries>
        <selectionEntries>
          <selectionEntry id="${SELF_SCOPE_ID}" name="Self Scope" type="unit">
            <constraints>
              <constraint id="${SELF_SCOPE_LIMIT_ID}" type="max" value="1" field="selections" scope="self"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const roster = { forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: SELF_SCOPE_ID, count: 2, children: [] }] }] };

    const report = evaluate(catalogueXml, roster);

    expect(report.violations.find(violation => violation.limitId === SELF_SCOPE_LIMIT_ID)).toMatchObject({
      actual: 2,
      bound: 1,
    });
  });

  const HERO_ID = 'entry-hero';
  const OTHER_ID = 'entry-other';
  const POINTS_ID = 'cost-points';
  const HERO_PERCENT_LIMIT_ID = 'limit-hero-percent';
  const HERO_POINTS = 40;
  const OTHER_POINTS = 60;

  it('KONTROLLE: eine Prozent-Grenze auf ein Kostenfeld zieht den eigenen Beitrag des Rahmens weiterhin in den Nenner', () => {
    const catalogueXml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-percent-frame" name="Percent Frame Catalogue">
        <forceEntries>
          <forceEntry id="${FORCE_ID}" name="Army"/>
        </forceEntries>
        <selectionEntries>
          <selectionEntry id="${HERO_ID}" name="Hero" type="model">
            <costs>
              <cost name="Points" typeId="${POINTS_ID}" value="${HERO_POINTS}"/>
            </costs>
            <constraints>
              <constraint id="${HERO_PERCENT_LIMIT_ID}" type="max" value="50" field="${POINTS_ID}" scope="roster"
                          shared="true" percentValue="true" includeChildSelections="false" includeChildForces="false"/>
            </constraints>
          </selectionEntry>
          <selectionEntry id="${OTHER_ID}" name="Other" type="model">
            <costs>
              <cost name="Points" typeId="${POINTS_ID}" value="${OTHER_POINTS}"/>
            </costs>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const roster = {
      forces: [{
        defId: FORCE_ID,
        count: 1,
        children: [
          { defId: HERO_ID, count: 1, children: [] },
          { defId: OTHER_ID, count: 1, children: [] },
        ],
      }],
    };

    const report = evaluate(catalogueXml, roster);

    // Correct denominator (Hero + Other = 100): 40/100 = 40% <= 50% — no violation.
    // Excluding the frame's own contribution from the denominator (Other only
    // = 60) would give 40/60 = 66.7% — a violation that must not fire.
    expect(report.violations.find(violation => violation.limitId === HERO_PERCENT_LIMIT_ID)).toBeUndefined();
  });

  const FORCE_OPTION_ID = 'entry-force-option';

  it('KONTROLLE: scope="force" childId="any" bleibt unveraendert — ein Kontingent-Rahmen zaehlte sich nie selbst', () => {
    const catalogueXml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-force-any" name="Force Any Catalogue">
        <forceEntries>
          <forceEntry id="${FORCE_ID}" name="Army"/>
        </forceEntries>
        <selectionEntries>
          <selectionEntry id="${UNIT_ID}" name="Unit" type="unit"/>
          <selectionEntry id="${FORCE_OPTION_ID}" name="Force Option" type="unit" hidden="true">
            <modifiers>
              <modifier type="set" field="hidden" value="false">
                <conditions>
                  <condition type="atLeast" value="1" field="selections" scope="force"
                             childId="any" shared="true" includeChildSelections="true"/>
                </conditions>
              </modifier>
            </modifiers>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const roster = { forces: [{ defId: FORCE_ID, count: 1, children: [{ defId: UNIT_ID, count: 1, children: [] }] }] };

    const report = evaluate(catalogueXml, roster);

    expect(offerCapabilityOf(report, FORCE_OPTION_ID)).not.toBeNull();
    expect(offerCapabilityOf(report, FORCE_OPTION_ID).isHidden).toBe(false);
  });

  const SELF_SCOPE_NO_CHILDID_ID = 'entry-self-scope-no-childid';
  const SELF_SCOPE_NO_CHILDID_THRESHOLD = 2;

  /**
   * A hidden entry revealed by `atLeast 2 field="selections" scope="self"` —
   * no `childId` attribute at all, the exact shape that collides with
   * `childId="any"` on the same `null` target (`catalogReader.js` maps both to
   * `null`). Reveal it through the definition's own count, not a sibling's.
   */
  const SELF_SCOPE_NO_CHILDID_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-self-scope-no-childid" name="Self Scope No ChildId Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${SELF_SCOPE_NO_CHILDID_ID}" name="Self Scope No ChildId" type="unit" hidden="true">
          <modifiers>
            <modifier type="set" field="hidden" value="false">
              <conditions>
                <condition type="atLeast" value="${SELF_SCOPE_NO_CHILDID_THRESHOLD}" field="selections" scope="self"/>
              </conditions>
            </modifier>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  /** A force whose single child is the self-scope entry, selected the given number of times. */
  function armyWithSelfScopeEntry(count) {
    return {
      forces: [{
        defId: FORCE_ID,
        count: 1,
        children: [{ defId: SELF_SCOPE_NO_CHILDID_ID, count, children: [] }],
      }],
    };
  }

  it('KONTROLLE: eine Bedingung mit scope="self" und OHNE childId liest den eigenen Bestand, nicht die Konstante null', () => {
    const report = evaluate(SELF_SCOPE_NO_CHILDID_CATALOGUE_XML, armyWithSelfScopeEntry(SELF_SCOPE_NO_CHILDID_THRESHOLD));

    expect(capabilityOf(report, SELF_SCOPE_NO_CHILDID_ID)).not.toBeNull();
    expect(capabilityOf(report, SELF_SCOPE_NO_CHILDID_ID).isHidden).toBe(false);
  });

  it('KONTROLLE: dieselbe Bedingung haelt die Auswahl versteckt, solange ihr eigener Bestand die Grenze verfehlt', () => {
    const report = evaluate(
      SELF_SCOPE_NO_CHILDID_CATALOGUE_XML,
      armyWithSelfScopeEntry(SELF_SCOPE_NO_CHILDID_THRESHOLD - 1),
    );

    expect(capabilityOf(report, SELF_SCOPE_NO_CHILDID_ID).isHidden).toBe(true);
  });
});
