/**
 * **Eine Grenze im Rahmen `parent` meldet einmal je Rahmen, nicht je Kopie
 * ihres Traegers darin.**
 *
 * `scope="parent"` ist der einzige Rahmen, der die **Eltern-Auswahl des Ankers
 * selbst** benennt (`query.js`, `resolveFrame`). Die Grenze ist damit eine
 * Aussage ueber genau diesen einen Rahmen — „unter diesem Eltern-Knoten
 * hoechstens/mindestens n" —, und die Zaehlung ist die des Rahmens. Stehen
 * mehrere Kopien des Traegers als Geschwister darunter, tragen sie alle
 * dieselbe Grenze und lesen dieselbe Zahl: das Urteil ist an jedem Anker
 * identisch, die Meldung gehoert einmal in die Liste (`report.js`,
 * `dedupeParentFrameViolations`). Der Zeuge aus den Katalogdaten ist die
 * Dark-Elves-Einheit „Reaper Bolt Thrower" mit drei „Reaper Bolt Thrower team"
 * gegen deren `max 2` `ccf9-fefc-71c8-bd73` (Szenario
 * `docs/testing/parent-min-include-children-bolt-thrower`, Roster 04).
 *
 * Abgegrenzt wird die Regel nach drei Seiten, alle hier gepinnt: ein zweiter
 * Eigentuemer ist ein zweiter Rahmen und meldet erneut; ein armee- oder
 * kontingentweiter Rahmen behaelt seine Multiplizitaet (belegte Instanz-Anker,
 * `docs/evaluator-architecture.md` §4.8 — zwei Tyrants gegen eine roster-weite
 * `max 1` melden zweimal); und die Faehigkeitsdatensaetze bleiben vollstaendig
 * — entdoppelt wird allein die Meldungsliste.
 *
 * Beobachtet wird ausschliesslich ueber die Fassade (`prepareDataset` +
 * `evaluate`).
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { evaluate as evaluateDataset, prepareDataset } from '../../../../contexts/ruleengine/evaluator.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const FORCE_ID = 'force-army';
const UNIT_ID = 'entry-unit';
const TEAM_ID = 'entry-team';
const PARENT_MAX_LIMIT_ID = 'limit-team-parent-max';
const ROSTER_MAX_LIMIT_ID = 'limit-team-roster-max';

/** Wertet einen einzelnen synthetischen Katalog aus (ADR-0032: Datensatz-Form). */
function evaluate(catalogueXml, roster) {
  return evaluateDataset(prepareDataset({ catalogues: [catalogueXml] }), roster);
}

/** Die Meldungen des Berichts zu einer Grenz-Id. */
function messagesOf(report, limitId) {
  return report.violations.filter(message => message.limitId === limitId);
}

/** Die Faehigkeitsdatensaetze einer Definitions-Id. */
function capabilitiesOf(report, defId) {
  return [...report.capabilities.values()].filter(capability => capability.defId === defId);
}

/**
 * Eine Einheit mit einem Pflicht-Modell darin. Das Modell traegt die
 * uebergebenen Grenzen — die Vorgabe ist das Paar aus den Katalogdaten:
 * `max 2` im Eltern-Rahmen.
 */
function catalogueXml(teamConstraintsXml = `
  <constraint id="${PARENT_MAX_LIMIT_ID}" type="max" value="2" field="selections" scope="parent"
              shared="true" includeChildSelections="true" includeChildForces="false"/>`) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-parent-frame-dedup" name="Parent Frame Dedup Catalogue">
      <forceEntries>
        <forceEntry id="${FORCE_ID}" name="Army"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${UNIT_ID}" name="Unit" type="unit">
          <selectionEntries>
            <selectionEntry id="${TEAM_ID}" name="Team" type="model">
              <constraints>
                ${teamConstraintsXml}
              </constraints>
            </selectionEntry>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Eine Force mit je einer Einheit pro Eintrag der Liste, mit so vielen Teams darin. */
function armyWithUnits(teamCountPerUnit) {
  return {
    forces: [{
      defId: FORCE_ID,
      count: 1,
      children: teamCountPerUnit.map(teamCount => ({
        defId: UNIT_ID,
        count: 1,
        children: Array.from({ length: teamCount }, () => ({ defId: TEAM_ID, count: 1, children: [] })),
      })),
    }],
  };
}

describe('Grenze im Rahmen parent: eine Meldung je Rahmen, nicht je Traeger-Kopie', () => {
  it('meldet drei Geschwister-Kopien im selben Eltern-Rahmen genau einmal, mit der Rahmen-Zaehlung', () => {
    const report = evaluate(catalogueXml(), armyWithUnits([3]));

    const messages = messagesOf(report, PARENT_MAX_LIMIT_ID);
    expect(messages).toHaveLength(1);
    expect(messages[0].actual).toBe(3);
    expect(messages[0].bound).toBe(2);
  });

  it('meldet je Eigentuemer einmal — zwei ueberfuellte Einheiten sind zwei Rahmen', () => {
    const report = evaluate(catalogueXml(), armyWithUnits([3, 3]));

    expect(messagesOf(report, PARENT_MAX_LIMIT_ID)).toHaveLength(2);
  });

  it('meldet nur fuer den ueberfuellten Rahmen, wenn ein zweiter Eigentuemer die Grenze einhaelt', () => {
    const report = evaluate(catalogueXml(), armyWithUnits([3, 1]));

    expect(messagesOf(report, PARENT_MAX_LIMIT_ID)).toHaveLength(1);
  });

  it('laesst die Faehigkeitsdatensaetze vollstaendig: jede Kopie behaelt ihr Hoechstmass', () => {
    const report = evaluate(catalogueXml(), armyWithUnits([3]));

    const capabilities = capabilitiesOf(report, TEAM_ID);
    expect(capabilities).toHaveLength(3);
    for (const capability of capabilities) {
      expect(capability.effectiveMax).toBe(2);
      expect(capability.current).toBe(3);
      expect(capability.isBlocked).toBe(true);
    }
  });

  it('KONTROLLE: zwei verschiedene Grenzen desselben Rahmens melden weiterhin beide', () => {
    const twoParentLimits = `
      <constraint id="${PARENT_MAX_LIMIT_ID}" type="max" value="2" field="selections" scope="parent"
                  shared="true" includeChildSelections="true" includeChildForces="false"/>
      <constraint id="${PARENT_MAX_LIMIT_ID}-b" type="max" value="1" field="selections" scope="parent"
                  shared="true" includeChildSelections="true" includeChildForces="false"/>`;
    const report = evaluate(catalogueXml(twoParentLimits), armyWithUnits([3]));

    expect(messagesOf(report, PARENT_MAX_LIMIT_ID)).toHaveLength(1);
    expect(messagesOf(report, `${PARENT_MAX_LIMIT_ID}-b`)).toHaveLength(1);
  });

  it('KONTROLLE: eine roster-weite Grenze behaelt ihre Multiplizitaet — je Traeger-Kopie eine Meldung', () => {
    const rosterLimit = `
      <constraint id="${ROSTER_MAX_LIMIT_ID}" type="max" value="1" field="selections" scope="roster"
                  shared="true" includeChildSelections="true" includeChildForces="true"/>`;
    const report = evaluate(catalogueXml(rosterLimit), armyWithUnits([2]));

    const messages = messagesOf(report, ROSTER_MAX_LIMIT_ID);
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message.actual).toBe(2);
      expect(message.bound).toBe(1);
    }
  });
});
