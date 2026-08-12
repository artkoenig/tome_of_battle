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

// ── Issue 0145, "the price before recruiting matches the price after" ─────────

// A choose-one group carrying a catalogue default, one level deep inside a
// group without a min of its own — like `Wizard Level` nested inside `Magic`.
const NESTED_LIGHT_LINK_ID = 'link-nested-light';
const NESTED_HEAVY_LINK_ID = 'link-nested-heavy';
const NESTED_LIGHT_COST = 5;
const NESTED_HEAVY_COST = 9;

function createNestedChoiceSystem({ defaultSelectionEntryId }) {
  return {
    id: 'sys-generic',
    name: 'Generic System',
    costTypes: [{ id: POINTS, name: 'Points', defaultCostLimit: 2000 }],
    catalogues: [{
      id: CATALOGUE_ID,
      name: 'Generic Catalogue',
      sharedSelectionEntries: [
        { id: 'entry-nested-light', name: 'Light Weapon', costs: [{ typeId: POINTS, value: NESTED_LIGHT_COST }] },
        { id: 'entry-nested-heavy', name: 'Heavy Weapon', costs: [{ typeId: POINTS, value: NESTED_HEAVY_COST }] }
      ],
      selectionEntries: [{
        id: UNIT_ENTRY_ID,
        name: 'Adept',
        costs: [{ typeId: POINTS, value: UNIT_COST }],
        selectionEntryGroups: [{
          id: 'group-loadout',
          name: 'Loadout',
          // No min of its own — like "Magic" around "Wizard Level".
          selectionEntries: [],
          entryLinks: [],
          selectionEntryGroups: [{
            id: 'group-weapon',
            name: 'Weapon',
            defaultSelectionEntryId,
            constraints: [
              { id: 'con-weapon-min', type: 'min', value: MANDATORY_ONE, field: 'selections', scope: 'parent' },
              { id: 'con-weapon-max', type: 'max', value: MANDATORY_ONE, field: 'selections', scope: 'parent' }
            ],
            entryLinks: [
              { id: NESTED_LIGHT_LINK_ID, targetId: 'entry-nested-light', name: 'Light Weapon', type: 'selectionEntry' },
              { id: NESTED_HEAVY_LINK_ID, targetId: 'entry-nested-heavy', name: 'Heavy Weapon', type: 'selectionEntry' }
            ]
          }]
        }]
      }]
    }]
  };
}

function findNestedChoiceUnitEntry(system) {
  return system.catalogues[0].selectionEntries.find(entry => entry.id === UNIT_ENTRY_ID);
}

function recruitNestedChoiceAdept(system) {
  return createSelectionFromDef({ system, resolveEntry, entry: findNestedChoiceUnitEntry(system) });
}

describe('getOptionDisplayCost — eine verschachtelte Pflichtgruppe mit Katalog-Vorgabe (Issue 0145)', () => {
  it('rechnet die im Katalog benannte Option ein, auch eine Ebene tief verschachtelt', () => {
    const system = createNestedChoiceSystem({ defaultSelectionEntryId: NESTED_HEAVY_LINK_ID });

    const displayCost = getOptionDisplayCost(system, { id: UNIT_ENTRY_ID }, POINTS);

    expect(displayCost).toBe(UNIT_COST + NESTED_HEAVY_COST);
  });

  it('stimmt mit dem nach dem Ausheben tatsächlich anfallenden Preis überein', () => {
    const system = createNestedChoiceSystem({ defaultSelectionEntryId: NESTED_HEAVY_LINK_ID });

    const recruited = recruitNestedChoiceAdept(system);
    const actualCost = getSelectionTotalCost(recruited, POINTS, 1, { system, currentCatalogueId: CATALOGUE_ID });

    expect(recruited.selections.map(child => child.name)).toEqual(['Heavy Weapon']);
    expect(getOptionDisplayCost(system, { id: UNIT_ENTRY_ID }, POINTS)).toBe(actualCost);
  });
});

// An itemised group — two members, each with its own min, different prices.
// The estimate must sum each member's own cost, not the default option's cost
// times the group's min: the case the shared walk fixes.
const PICK_LINK_ID = 'link-pick';
const SHOVEL_LINK_ID = 'link-shovel';
const PICK_COST = 3;
const SHOVEL_COST = 7;
const ITEMIZED_GROUP_MIN = 2;

function createItemizedSystem() {
  return {
    id: 'sys-generic',
    name: 'Generic System',
    costTypes: [{ id: POINTS, name: 'Points', defaultCostLimit: 2000 }],
    catalogues: [{
      id: CATALOGUE_ID,
      name: 'Generic Catalogue',
      sharedSelectionEntries: [
        { id: 'entry-pick', name: 'Pick', costs: [{ typeId: POINTS, value: PICK_COST }] },
        { id: 'entry-shovel', name: 'Shovel', costs: [{ typeId: POINTS, value: SHOVEL_COST }] }
      ],
      selectionEntries: [{
        id: UNIT_ENTRY_ID,
        name: 'Sapper',
        costs: [{ typeId: POINTS, value: UNIT_COST }],
        selectionEntryGroups: [{
          id: 'group-tools',
          name: 'Tools',
          defaultSelectionEntryId: null,
          constraints: [
            { id: 'con-tools-min', type: 'min', value: ITEMIZED_GROUP_MIN, field: 'selections', scope: 'parent' },
            { id: 'con-tools-max', type: 'max', value: ITEMIZED_GROUP_MIN, field: 'selections', scope: 'parent' }
          ],
          entryLinks: [
            {
              id: PICK_LINK_ID, targetId: 'entry-pick', name: 'Pick', type: 'selectionEntry',
              constraints: [{ id: 'con-pick-min', type: 'min', value: MANDATORY_ONE, field: 'selections', scope: 'parent' }]
            },
            {
              id: SHOVEL_LINK_ID, targetId: 'entry-shovel', name: 'Shovel', type: 'selectionEntry',
              constraints: [{ id: 'con-shovel-min', type: 'min', value: MANDATORY_ONE, field: 'selections', scope: 'parent' }]
            }
          ]
        }]
      }]
    }]
  };
}

function findItemizedUnitEntry(system) {
  return system.catalogues[0].selectionEntries.find(entry => entry.id === UNIT_ENTRY_ID);
}

function recruitItemizedSapper(system) {
  return createSelectionFromDef({ system, resolveEntry, entry: findItemizedUnitEntry(system) });
}

describe('getOptionDisplayCost — eine itemisierte Pflichtgruppe (Issue 0145)', () => {
  it('summiert jedes Mitglied mit eigenem min, nicht Default-Option × Gruppen-min', () => {
    const system = createItemizedSystem();

    const displayCost = getOptionDisplayCost(system, { id: UNIT_ENTRY_ID }, POINTS);

    expect(displayCost).toBe(UNIT_COST + PICK_COST + SHOVEL_COST);
  });

  it('stimmt mit dem nach dem Ausheben tatsächlich anfallenden Preis überein — der Vertrag, nicht ein Sonderfall', () => {
    const system = createItemizedSystem();

    const recruited = recruitItemizedSapper(system);
    const actualCost = getSelectionTotalCost(recruited, POINTS, 1, { system, currentCatalogueId: CATALOGUE_ID });

    expect(recruited.selections.map(child => child.name).sort()).toEqual(['Pick', 'Shovel']);
    expect(getOptionDisplayCost(system, { id: UNIT_ENTRY_ID }, POINTS)).toBe(actualCost);
  });
});
