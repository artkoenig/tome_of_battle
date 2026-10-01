import { describe, it, expect } from 'vitest';

import {
  withoutUnreachableSelections, settleSelectionReachability,
} from '../../../../contexts/armylist/application/unreachableSelections.js';
import { raiseUnit } from '../../../../contexts/armylist/application/raiseUnit.js';
import { changeOptionCount } from '../../../../contexts/armylist/application/subSelectionUseCases.js';
import { evaluateAppRoster } from '../../../../contexts/ruleengine/readmodel/index.js';
import {
  woodElfSystem, emptyWoodElfRoster, nobleEntriesOf, defIdOf,
  LONG_BOW_LINK_ID, BSB_LINK_ID, SPEAR_ID, SHIELD_ID,
} from '../../../test-utils/woodElfNobleCatalogue.js';

/**
 * Issue 0203 — eine Option, die eine Aenderung zugleich versteckt und auf Max 0
 * deckelt, faellt mit dieser Aenderung weg. Gefahren gegen den echten Bericht
 * (`evaluateAppRoster`) ueber einem Ausschnitt des Waldelfen-Katalogs.
 */

const SYSTEM = woodElfSystem();
const ENTRIES = nobleEntriesOf(SYSTEM);

const slotsOf = (roster) => evaluateAppRoster(SYSTEM, roster).slots;
const violationsOf = (roster) => evaluateAppRoster(SYSTEM, roster).violations;
const nobleOf = (roster) => roster.forces[0].selections[0];
const childDefIds = (roster) => nobleOf(roster).selections.map(defIdOf);

/** Die Editor-Aenderung "Option um `delta` verschieben", samt Bereinigung. */
function change(roster, optionDefinition, delta) {
  const changed = changeOptionCount(roster, {
    unitSelectionId: nobleOf(roster).id, optionDefinition, countDelta: delta,
    system: SYSTEM, slots: slotsOf(roster),
  });
  return settleSelectionReachability(changed, { system: SYSTEM, previousRoster: roster });
}

/** Ein ausgehobener Adliger mit Speer und Schild. */
function raisedNoble() {
  const empty = emptyWoodElfRoster();
  const { roster } = raiseUnit(empty, {
    entry: ENTRIES.noble, categoryId: null, targetForceId: null, system: SYSTEM, slots: slotsOf(empty),
  });
  return change(change(roster, ENTRIES.spear, 1), ENTRIES.shield, 1);
}

const aboutDef = (roster, defId) =>
  violationsOf(roster).filter(violation => violation.anchor?.defId === defId);

describe('Vorbedingung: der Adlige traegt den Langbogen nach dem Ausheben', () => {
  it('der Langbogen ist durch sein Min 1 gesetzt, Speer und Schild sind gewaehlt', () => {
    const roster = raisedNoble();
    expect(childDefIds(roster)).toEqual(expect.arrayContaining([LONG_BOW_LINK_ID, SPEAR_ID, SHIELD_ID]));
    expect(aboutDef(roster, LONG_BOW_LINK_ID)).toEqual([]);
  });
});

describe('AC1: "Battle Standard Bearer" versteckt den Langbogen und deckelt ihn auf 0', () => {
  it('der Langbogen faellt mit dem Ankreuzen weg', () => {
    const roster = change(raisedNoble(), ENTRIES.bsb, 1);
    expect(childDefIds(roster)).toContain(BSB_LINK_ID);
    expect(childDefIds(roster)).not.toContain(LONG_BOW_LINK_ID);
  });

  it('der Bericht traegt weder Max-Verletzung noch Versteckt-Meldung fuer ihn', () => {
    const roster = change(raisedNoble(), ENTRIES.bsb, 1);
    expect(aboutDef(roster, LONG_BOW_LINK_ID)).toEqual([]);
  });

  it('ohne Bereinigung stuenden genau diese Meldungen im Bericht (Gegenprobe)', () => {
    const before = raisedNoble();
    const unpruned = changeOptionCount(before, {
      unitSelectionId: nobleOf(before).id, optionDefinition: ENTRIES.bsb, countDelta: 1,
      system: SYSTEM, slots: slotsOf(before),
    });
    expect(childDefIds(unpruned)).toContain(LONG_BOW_LINK_ID);
    const origins = aboutDef(unpruned, LONG_BOW_LINK_ID).map(violation => violation.origin);
    expect(origins).toEqual(expect.arrayContaining(['hiddenSelection', 'derivedLimit']));
  });
});

describe('AC3: nur beide Bedingungen zusammen entfernen', () => {
  it('der nur versteckte Speer (Max 1) bleibt liegen', () => {
    const roster = change(raisedNoble(), ENTRIES.bsb, 1);
    expect(childDefIds(roster)).toContain(SPEAR_ID);
    expect(slotsOf(roster).slotOfSelection(
      nobleOf(roster).selections.find(s => defIdOf(s) === SPEAR_ID)
    )).toMatchObject({ isHidden: true, effectiveMax: 1 });
  });

  it('der nur auf 0 gedeckelte, sichtbare Schild bleibt liegen', () => {
    const roster = change(raisedNoble(), ENTRIES.bsb, 1);
    expect(childDefIds(roster)).toContain(SHIELD_ID);
    expect(slotsOf(roster).slotOfSelection(
      nobleOf(roster).selections.find(s => defIdOf(s) === SHIELD_ID)
    )).toMatchObject({ isHidden: false, effectiveMax: 0 });
  });
});

describe('AC4: Abwaehlen des Ausloesers legt den Langbogen wieder an', () => {
  it('der Langbogen entsteht wieder, genau einmal, im selben Schritt wie das Abwaehlen', () => {
    const roster = change(change(raisedNoble(), ENTRIES.bsb, 1), ENTRIES.bsb, -1);

    expect(childDefIds(roster)).not.toContain(BSB_LINK_ID);
    expect(childDefIds(roster).filter(defId => defId === LONG_BOW_LINK_ID)).toHaveLength(1);
  });

  it('der Bericht traegt keine offene Min-Verletzung fuer ihn', () => {
    const roster = change(change(raisedNoble(), ENTRIES.bsb, 1), ENTRIES.bsb, -1);
    const longBow = nobleOf(roster).selections.find(s => defIdOf(s) === LONG_BOW_LINK_ID);

    expect(aboutDef(roster, LONG_BOW_LINK_ID)).toEqual([]);
    expect(slotsOf(roster).slotOfSelection(longBow))
      .toMatchObject({ isHidden: false, effectiveMin: 1, effectiveMax: 1, current: 1 });
  });

  it('ein schon vorher offenes Min (geladenes Roster) bleibt offen', () => {
    const raised = raisedNoble();
    const loaded = {
      ...raised,
      forces: [{
        ...raised.forces[0],
        selections: [{
          ...nobleOf(raised),
          selections: nobleOf(raised).selections.filter(s => defIdOf(s) !== LONG_BOW_LINK_ID),
        }],
      }],
    };
    const roster = change(loaded, ENTRIES.spear, -1);

    expect(childDefIds(roster)).not.toContain(LONG_BOW_LINK_ID);
    expect(aboutDef(roster, LONG_BOW_LINK_ID).map(violation => violation.origin)).toContain('derivedLimit');
  });
});

describe('Nur die ausloesende Aenderung zaehlt', () => {
  it('ein schon vorher unerreichbarer Langbogen (geladenes Roster) bleibt liegen', () => {
    const before = raisedNoble();
    const loaded = changeOptionCount(before, {
      unitSelectionId: nobleOf(before).id, optionDefinition: ENTRIES.bsb, countDelta: 1,
      system: SYSTEM, slots: slotsOf(before),
    });
    const roster = change(loaded, ENTRIES.spear, -1);
    expect(childDefIds(roster)).toContain(LONG_BOW_LINK_ID);
  });

  it('gibt dasselbe Roster-Objekt zurueck, wenn sich an der Erreichbarkeit nichts aenderte', () => {
    const roster = raisedNoble();
    expect(settleSelectionReachability(roster, { system: SYSTEM, previousRoster: roster })).toBe(roster);
  });

  it('ohne System bleibt das Roster unveraendert', () => {
    const roster = raisedNoble();
    expect(withoutUnreachableSelections(roster, { system: null, previousRoster: null })).toBe(roster);
  });
});
