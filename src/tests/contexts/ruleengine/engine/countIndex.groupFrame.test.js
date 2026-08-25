/**
 * **Der Gruppen-Anker ist der Zaehlrahmen seiner Gruppe.**
 *
 * Eine `selectionEntryGroup` ist im Roster kein eigener Knoten: ihre Member
 * haengen unter dem Eigentuemer, der Anker daneben. Eine Query, die **am Anker
 * selbst** gestellt wird — `scope="self"`, ebenso jedes `shared="false"` —,
 * fragt damit nach dem Bestand eines Rahmens, in dem im Baum nichts steht. Nach
 * `docs/battlescribe-data-format.md` §7.6 zaehlt eine Grenze an einer Gruppe
 * aber **ihre Mitglieder**, nicht die Gruppe („which entity should sum up all
 * `field`'s values of descendant selections of this constraint's parent entry").
 * Die Index-Schicht traegt einen Member deshalb zusaetzlich im Rahmen seines
 * Ankers bei (`evalTree.js`, `groupFrames`; `countIndex.js`).
 *
 * Beobachtet wird ausschliesslich ueber die Fassade (`prepareDataset` +
 * `evaluate`): die Autor-Meldung am Gruppen-Slot ist der Zeuge — genau die
 * Form, in der die Katalogdaten die Abfrage nutzen (Dark Elves, Gruppe „War
 * Hydras of Naggaroth" `7f4e-4b7b-fbc4-a138`: `modifier type="add"
 * field="warning"` mit `condition type="atLeast" value="1" field="selections"
 * scope="self" childId="any"`, gepinnt vom Szenario
 * `docs/testing/at-least-self-any-experimental-hydra-warning`).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { AnchorKind, MessageOrigin } from '../../../../contexts/ruleengine/engine/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FORCE_ID = 'force-army';
const UNIT_ID = 'entry-unit';
const GROUP_ID = 'group-variants';
const GROUP_MAX_LIMIT_ID = 'limit-group-max';
const MEMBER_A_ID = 'entry-member-a';
const MEMBER_B_ID = 'entry-member-b';
const MEMBER_CHILD_ID = 'entry-member-child';
const SIBLING_ID = 'entry-sibling-outside-group';
const WARNING_TEXT = 'die Gruppe haelt eine Auswahl';

/** Wertet einen einzelnen synthetischen Katalog aus (ADR-0032: Datensatz-Form). */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Der Faehigkeitsdatensatz des Gruppen-Ankers. */
function groupCapabilityOf(report) {
  for (const capability of report.capabilities.values()) {
    if (capability.defId === GROUP_ID && capability.anchorKind === AnchorKind.GROUP_ANCHOR) {
      return capability;
    }
  }
  return null;
}

/** Die Autor-Meldungen der Meldungsliste, die am Gruppen-Anker haengen. */
function groupAuthorMessagesOf(report) {
  return report.violations.filter(message =>
    message.origin === MessageOrigin.AUTHOR_MESSAGE && message.anchor.defId === GROUP_ID);
}

/**
 * Eine Einheit mit einer grenzentragenden Gruppe („waehle hoechstens zwei"),
 * deren Meldungs-Modifikator auf `atLeast <threshold>` im **eigenen** Rahmen
 * gatet — dazu ein Geschwister-Eintrag, der **nicht** Member der Gruppe ist.
 */
function catalogueXml({ threshold = 1, includeChildSelections = 'true' } = {}) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-group-frame" name="Group Frame Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
          <selectionEntries>
            <selectionEntry id="${SIBLING_ID}" name="Sibling Outside Group" type="upgrade"/>
          </selectionEntries>
          <selectionEntryGroups>
            <selectionEntryGroup id="${GROUP_ID}" name="Variants">
              <constraints>
                <constraint id="${GROUP_MAX_LIMIT_ID}" type="max" value="2" field="selections" scope="parent"
                            shared="true" includeChildSelections="false" includeChildForces="false"/>
              </constraints>
              <modifiers>
                <modifier type="add" value="${WARNING_TEXT}" field="warning">
                  <conditions>
                    <condition type="atLeast" value="${threshold}" field="selections" scope="self"
                               childId="any" shared="true" includeChildSelections="${includeChildSelections}"/>
                  </conditions>
                </modifier>
              </modifiers>
              <selectionEntries>
                <selectionEntry id="${MEMBER_A_ID}" name="Member A" type="upgrade">
                  <selectionEntries>
                    <selectionEntry id="${MEMBER_CHILD_ID}" name="Member Child" type="upgrade"/>
                  </selectionEntries>
                </selectionEntry>
                <selectionEntry id="${MEMBER_B_ID}" name="Member B" type="upgrade"/>
              </selectionEntries>
            </selectionEntryGroup>
          </selectionEntryGroups>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Eine Force mit einer Einheit, unter der die uebergebenen Auswahlen stehen. */
function armyWithUnitChildren(children) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: [{ defId: UNIT_ID, count: 1, children }],
    }],
  };
}

/** Eine Auswahl ohne Unter-Auswahlen. */
function selection(defId, children = []) {
  return { defId, count: 1, children };
}

describe('Gruppen-Anker als Zaehlrahmen: scope="self" mit childId="any" zaehlt die Member der Gruppe', () => {
  it('haengt die Autor-Meldung an die Gruppe, sobald sie ein Mitglied haelt', () => {
    const report = evaluate(catalogueXml(), armyWithUnitChildren([selection(MEMBER_A_ID)]));

    expect(groupCapabilityOf(report)).not.toBeNull();
    expect(groupCapabilityOf(report).authorMessages).toEqual([
      { severity: 'warning', text: WARNING_TEXT },
    ]);
    expect(groupAuthorMessagesOf(report)).toHaveLength(1);
  });

  it('schweigt bei leerer Gruppe — die Zaehlung im eigenen Rahmen steht auf 0', () => {
    const report = evaluate(catalogueXml(), armyWithUnitChildren([]));

    expect(groupCapabilityOf(report)).not.toBeNull();
    expect(groupCapabilityOf(report).authorMessages).toEqual([]);
    expect(groupAuthorMessagesOf(report)).toHaveLength(0);
  });

  it('schweigt weiterhin, wenn allein ein Geschwister ausserhalb der Gruppe im Eigentuemer-Rahmen steht', () => {
    // Der Rahmen ist die Gruppe, nicht der Eigentuemer: ein `scope="parent"`
    // oder `scope="unit"` wuerde dieses Geschwister mitzaehlen.
    const report = evaluate(catalogueXml(), armyWithUnitChildren([selection(SIBLING_ID)]));

    expect(groupCapabilityOf(report).authorMessages).toEqual([]);
  });

  it('meldet auch bei zwei Mitgliedern genau einmal — atLeast wird von einem Ueberlauf nicht falsch', () => {
    const report = evaluate(
      catalogueXml(),
      armyWithUnitChildren([selection(MEMBER_A_ID), selection(MEMBER_B_ID)]),
    );

    expect(groupCapabilityOf(report).authorMessages).toHaveLength(1);
    expect(groupAuthorMessagesOf(report)).toHaveLength(1);
  });
});

describe('Gruppen-Anker als Zaehlrahmen: die Zaehl-Flags wirken wie im Eigentuemer-Rahmen', () => {
  it('zaehlt eine Auswahl unter einem Mitglied mit includeChildSelections="true" mit', () => {
    // Schwelle 2, aber nur EIN Mitglied — erst dessen eigenes Kind bringt den
    // Gruppen-Rahmen auf 2.
    const report = evaluate(
      catalogueXml({ threshold: 2, includeChildSelections: 'true' }),
      armyWithUnitChildren([selection(MEMBER_A_ID, [selection(MEMBER_CHILD_ID)])]),
    );

    expect(groupCapabilityOf(report).authorMessages).toHaveLength(1);
  });

  it('zaehlt dieselbe Auswahl mit includeChildSelections="false" NICHT mit', () => {
    const report = evaluate(
      catalogueXml({ threshold: 2, includeChildSelections: 'false' }),
      armyWithUnitChildren([selection(MEMBER_A_ID, [selection(MEMBER_CHILD_ID)])]),
    );

    expect(groupCapabilityOf(report).authorMessages).toEqual([]);
  });
});

describe('Gruppen-Anker als Zaehlrahmen: Kontrollen, die der Fix nicht brechen darf', () => {
  it('KONTROLLE: die gruppen-eigene Grenze (scope="parent", Ziel = Gruppen-Id) zaehlt weiterhin ihre Member', () => {
    const report = evaluate(
      catalogueXml(),
      armyWithUnitChildren([selection(MEMBER_A_ID), selection(MEMBER_B_ID)]),
    );

    // Zwei Member gegen `max 2` — eingehalten, und der Stand steht am Slot.
    expect(groupCapabilityOf(report).current).toBe(2);
    expect(report.violations.find(message => message.limitId === GROUP_MAX_LIMIT_ID)).toBeUndefined();
  });

  it('KONTROLLE: dieselbe Grenze feuert beim dritten Member — der Gruppen-Rahmen ersetzt sie nicht', () => {
    const report = evaluate(
      catalogueXml(),
      armyWithUnitChildren([
        selection(MEMBER_A_ID),
        selection(MEMBER_B_ID),
        selection(MEMBER_A_ID),
      ]),
    );

    const violations = report.violations.filter(message => message.limitId === GROUP_MAX_LIMIT_ID);
    expect(violations).toHaveLength(1);
    expect(violations[0].actual).toBe(3);
    expect(violations[0].bound).toBe(2);
  });

  it('KONTROLLE: ein Geschwister ausserhalb der Gruppe zaehlt auch in der gruppen-eigenen Grenze nicht mit', () => {
    const report = evaluate(
      catalogueXml(),
      armyWithUnitChildren([selection(SIBLING_ID), selection(MEMBER_A_ID)]),
    );

    expect(groupCapabilityOf(report).current).toBe(1);
  });
});
