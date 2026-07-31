/**
 * Issue 0130, Review-Runde 1/2 — ein `sortIndex` ohne eigene Grenzen loest in
 * `groupDefinitionsWithLimits`/`synthesizeGroupAnchors` (`evalTree.js`) einen
 * Gruppen-Anker aus, damit die Oberflaeche den Wert lesen kann. Das darf aber
 * nie ein Gueltigkeits-Urteil veraendern: eine grenzenlose Gruppe darf durch
 * das rein deskriptive Attribut nicht erstmals unter ihrer Id zaehlbar werden
 * (`annotateGroupMembers`), sonst aendert `sortIndex` das Ergebnis jeder
 * Bedingung/jedes Modifiers andernorts, der/das per `childId` auf dieselbe
 * Gruppen-Id verweist.
 *
 * Der Review-Fund (Runde 1): der urspruengliche Fix reagierte auf `sortIndex`
 * genau wie auf eine echte Grenze und loeste damit auch die Mitglieder-
 * Zaehlung aus. Behoben durch ein `hasLimits`-Flag, das Anker-Erzeugung
 * (immer, sobald `sortIndex` vorhanden) von Mitglieder-Zaehlung (nur bei
 * echten Grenzen) trennt. Dieser Test pinnt beide Haelften der Korrektur:
 * die grenzenlose Gruppe bleibt ungezaehlt, eine echt begrenzte Gruppe zaehlt
 * unveraendert, ob mit oder ohne zusaetzlichem `sortIndex`.
 *
 * Hebel: eine `atLeast`-Bedingung auf `childId="group-under-test"` schaltet
 * einen `increment`-Modifier auf `max-warriors` frei — feuert er (die Gruppe
 * zaehlt mind. ein Mitglied), verschwinden die Verletzungen (Grenze grosszuegig
 * angehoben); feuert er nicht (Gruppe zaehlt nicht mit), bleiben sie stehen.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FORCE_DEF_ID = 'force-main';
const WARRIOR_DEF_ID = 'entry-warrior';
const GROUP_ID = 'group-under-test';
const REFERRING_LIMIT_ID = 'max-warriors';

/** Wertet einen einzelnen synthetischen Katalog aus (ADR-0032: Datensatz-Form). */
function evaluate(catalogXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogXml] }), roster);
}

/**
 * Baut einen Katalog, dessen `max-warriors`-Grenze (max=1, scope="roster") nur
 * grosszuegig auf 11 angehoben wird, wenn `GROUP_ID` mindestens ein Mitglied
 * zaehlt (`childId`-Bedingung, `atLeast`) — der Zaehl-Zugriffspunkt, den
 * `annotateGroupMembers`/`targetsOf` bedienen. `groupConstraintsXml` traegt
 * die Gruppe selbst (leer = grenzenlos), `groupSortIndexAttr` haengt optional
 * `sortIndex="…"` an die Gruppe.
 */
function catalogXml({ groupConstraintsXml = '', groupSortIndexAttr = '' }) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-0130-anchor" name="SortIndex Group Anchor Catalogue">
      <forceEntries><forceEntry id="${FORCE_DEF_ID}" name="Main Force"/></forceEntries>
      <selectionEntries>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit">
          <constraints>
            <constraint id="${REFERRING_LIMIT_ID}" type="max" value="1" field="selections" scope="roster" includeChildSelections="false"/>
          </constraints>
          <modifiers>
            <modifier type="increment" field="${REFERRING_LIMIT_ID}" value="10">
              <conditions>
                <condition type="atLeast" field="selections" scope="roster" value="1" childId="${GROUP_ID}" includeChildSelections="true"/>
              </conditions>
            </modifier>
          </modifiers>
          <selectionEntries>
            <selectionEntry id="entry-member" name="Member" type="upgrade"/>
          </selectionEntries>
          <selectionEntryGroups>
            <selectionEntryGroup id="${GROUP_ID}" name="Group Under Test"${groupSortIndexAttr}>
              ${groupConstraintsXml}
              <selectionEntries>
                <selectionEntry id="opt-in-group" name="InGroup" type="upgrade"/>
              </selectionEntries>
            </selectionEntryGroup>
          </selectionEntryGroups>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Ein Roster mit zwei Warriors, jeder mit einem gewaehlten Gruppen-Mitglied. */
function rosterWithTwoWarriorsEachInGroup() {
  return {
    forces: [{
      defId: FORCE_DEF_ID,
      count: 1,
      children: [
        { defId: WARRIOR_DEF_ID, count: 1, children: [{ defId: 'opt-in-group', count: 1, children: [] }] },
        { defId: WARRIOR_DEF_ID, count: 1, children: [{ defId: 'opt-in-group', count: 1, children: [] }] },
      ],
    }],
  };
}

function maxWarriorsViolationCount(report) {
  return report.violations.filter(message => message.limitId === REFERRING_LIMIT_ID).length;
}

describe('Ein sortIndex ohne eigene Grenzen zaehlt die Gruppe nicht mit (Issue 0130)', () => {
  it('grenzenlose Gruppe ohne sortIndex: die per childId verweisende Bedingung feuert nie, max-warriors bleibt scharf', () => {
    const report = evaluate(catalogXml({}), rosterWithTwoWarriorsEachInGroup());

    // Ohne Anker/Zaehlung fuer die Gruppe bleibt "atLeast 1 in GROUP_ID"
    // unerfuellt, der Increment-Modifier greift nie, max=1 bleibt scharf:
    // beide Warriors (je ein Anker) verletzen sie.
    expect(maxWarriorsViolationCount(report)).toBe(2);
  });

  it('dieselbe grenzenlose Gruppe MIT sortIndex: das Ergebnis bleibt identisch — sortIndex zaehlt die Gruppe nicht mit', () => {
    const report = evaluate(
      catalogXml({ groupSortIndexAttr: ' sortIndex="1"' }),
      rosterWithTwoWarriorsEachInGroup(),
    );

    // Der Regressionsfall aus Review-Runde 1: vor der Korrektur loeste das
    // rein deskriptive sortIndex hier die Mitgliederzaehlung mit aus, die
    // Bedingung feuerte, der Modifier hob die Grenze grosszuegig an, und
    // diese Verletzungen verschwanden faelschlich.
    expect(maxWarriorsViolationCount(report)).toBe(2);
  });

  it('KONTROLLE: eine Gruppe mit einer eigenen echten Grenze zaehlt weiterhin korrekt mit, ob mit oder ohne zusaetzlichem sortIndex', () => {
    const ownGroupLimit = '<constraints><constraint id="max-in-group" type="max" value="5" field="selections" scope="parent" includeChildSelections="false"/></constraints>';

    const withoutSortIndex = evaluate(
      catalogXml({ groupConstraintsXml: ownGroupLimit }),
      rosterWithTwoWarriorsEachInGroup(),
    );
    const withSortIndex = evaluate(
      catalogXml({ groupConstraintsXml: ownGroupLimit, groupSortIndexAttr: ' sortIndex="1"' }),
      rosterWithTwoWarriorsEachInGroup(),
    );

    // Die Gruppe traegt jetzt eine echte Grenze: die childId-Bedingung feuert
    // (mind. ein Mitglied gewaehlt), der Increment-Modifier hebt max-warriors
    // grosszuegig an — in beiden Varianten identisch, das hasLimits-Flag darf
    // den echten Zaehl-Pfad nicht abschneiden.
    expect(maxWarriorsViolationCount(withoutSortIndex)).toBe(0);
    expect(maxWarriorsViolationCount(withSortIndex)).toBe(0);
  });
});
