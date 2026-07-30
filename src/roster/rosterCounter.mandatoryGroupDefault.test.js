import { describe, it, expect } from 'vitest';
import { resolveEntry } from './catalogResolver.js';
import { createSelectionFromDef } from './selectionFactory.js';
import { getOptionDisplayCost, getSelectionTotalCost } from './rosterCounter.js';

// Eine Pflicht-Auswahlgruppe, deren Katalog-Vorgabe (`defaultSelectionEntryId`)
// bewusst NICHT die erste Option ist: die Vorgabe ist die teurere schwere
// Rüstung, die erste Option die billige leichte. Angezeigter Preis (Kosten-
// schätzung) und tatsächlicher Preis (Fabrik) müssen dieselbe Option meinen.
const POINTS = 'cost-points';
const CATALOGUE_ID = 'cat-generic';
const UNIT_ENTRY_ID = 'entry-unit';
const LIGHT_LINK_ID = 'link-light';
const HEAVY_LINK_ID = 'link-heavy';

const UNIT_COST = 20;
const LIGHT_ARMOUR_COST = 4;
const HEAVY_ARMOUR_COST = 6;
const MANDATORY_ONE = 1;

function createSystem({ defaultSelectionEntryId }) {
  return {
    id: 'sys-generic',
    name: 'Generic System',
    costTypes: [{ id: POINTS, name: 'Points', defaultCostLimit: 2000 }],
    catalogues: [{
      id: CATALOGUE_ID,
      name: 'Generic Catalogue',
      sharedSelectionEntries: [
        { id: 'entry-light', name: 'Light Armour', costs: [{ typeId: POINTS, value: LIGHT_ARMOUR_COST }] },
        { id: 'entry-heavy', name: 'Heavy Armour', costs: [{ typeId: POINTS, value: HEAVY_ARMOUR_COST }] }
      ],
      selectionEntries: [{
        id: UNIT_ENTRY_ID,
        name: 'Champion',
        costs: [{ typeId: POINTS, value: UNIT_COST }],
        selectionEntryGroups: [{
          id: 'group-armour',
          name: 'Armour',
          defaultSelectionEntryId,
          constraints: [
            { id: 'con-armour-min', type: 'min', value: MANDATORY_ONE, field: 'selections', scope: 'parent' },
            { id: 'con-armour-max', type: 'max', value: MANDATORY_ONE, field: 'selections', scope: 'parent' }
          ],
          entryLinks: [
            { id: LIGHT_LINK_ID, targetId: 'entry-light', name: 'Light Armour', type: 'selectionEntry' },
            { id: HEAVY_LINK_ID, targetId: 'entry-heavy', name: 'Heavy Armour', type: 'selectionEntry' }
          ]
        }]
      }]
    }]
  };
}

function findUnitEntry(system) {
  return system.catalogues[0].selectionEntries.find(entry => entry.id === UNIT_ENTRY_ID);
}

function recruitChampion(system) {
  return createSelectionFromDef({ system, resolveEntry, entry: findUnitEntry(system) });
}

describe('getOptionDisplayCost — Pflichtgruppe mit Katalog-Vorgabe', () => {
  it('rechnet die vorgegebene Option ein, nicht die erste der Gruppe', () => {
    const system = createSystem({ defaultSelectionEntryId: HEAVY_LINK_ID });

    const displayCost = getOptionDisplayCost(system, { id: UNIT_ENTRY_ID }, POINTS);

    expect(displayCost).toBe(UNIT_COST + HEAVY_ARMOUR_COST);
  });

  it('nimmt ohne hinterlegte Vorgabe weiterhin die erste Option', () => {
    const system = createSystem({ defaultSelectionEntryId: null });

    const displayCost = getOptionDisplayCost(system, { id: UNIT_ENTRY_ID }, POINTS);

    expect(displayCost).toBe(UNIT_COST + LIGHT_ARMOUR_COST);
  });

  it('stimmt mit dem nach dem Ausheben tatsächlich anfallenden Preis überein', () => {
    const system = createSystem({ defaultSelectionEntryId: HEAVY_LINK_ID });

    const recruited = recruitChampion(system);
    const actualCost = getSelectionTotalCost(recruited, POINTS, 1, { system, currentCatalogueId: CATALOGUE_ID });

    expect(recruited.selections.map(child => child.name)).toEqual(['Heavy Armour']);
    expect(getOptionDisplayCost(system, { id: UNIT_ENTRY_ID }, POINTS)).toBe(actualCost);
  });
});
