import { describe, test, expect } from 'vitest';
import {
  calculateRosterCosts,
  getOptionDisplayCost,
  getSelectionTotalCost,
  validateRoster
} from './validator.js';
import {
  POINTS,
  UNIT_COST,
  ENTRY_ID,
  createGrimdarkSystem,
  createValidRoster
} from './__fixtures__/grimdarkSystem.js';

describe('calculateRosterCosts — Summe über das Roster', () => {
  test('summiert die Katalogkosten aller Auswahlen des Rosters', () => {
    const costs = calculateRosterCosts(createValidRoster(), createGrimdarkSystem());

    expect(costs[POINTS]).toBe(UNIT_COST.captain + UNIT_COST.tacticalSquad);
  });
});

describe('Kostenaggregation über verschachtelte Auswahlen', () => {
  // Ein kostenloser „Power Stone Wrapper" trägt den eigentlich teuren „Power Stone
  // Item" als Pflicht-Unterauswahl. Sowohl die Anzeige- als auch die Gesamtkosten
  // müssen die Unterauswahl einrechnen — sonst wirkt der Gegenstand gratis und das
  // Punktebudget seiner Gruppe greift nie.
  const NESTED_CATALOGUE_ID = 'cat-nested';
  const NESTED_FORCE_ENTRY_ID = 'force-patrol';
  const HQ_CATEGORY_ID = 'cat-hq';
  const WRAPPER_ENTRY_ID = 'item-parent';
  const STONE_ENTRY_ID = 'item-child';
  const STONE_COST = 25;
  const MAGIC_GROUP_POINTS_MAX = 30;
  const WIZARD_COST = 100;

  function createNestedSystem() {
    return {
      id: 'sys-nested',
      name: 'Nested System',
      costTypes: [{ id: POINTS, name: 'Points', defaultCostLimit: 2000 }],
      categoryEntries: [{ id: HQ_CATEGORY_ID, name: 'HQ' }],
      forceEntries: [{
        id: NESTED_FORCE_ENTRY_ID,
        name: 'Patrol Force',
        categoryLinks: [{ id: 'cl-hq', targetId: HQ_CATEGORY_ID }]
      }],
      catalogues: [{
        id: NESTED_CATALOGUE_ID,
        name: 'Nested Catalogue',
        selectionEntries: [
          { id: ENTRY_ID.general, name: 'General' },
          {
            id: 'unit-nested',
            name: 'Wizard',
            costs: [{ typeId: POINTS, value: WIZARD_COST }],
            categoryLinks: [{ targetId: HQ_CATEGORY_ID }],
            selectionEntryGroups: [{
              id: 'group-magic',
              name: 'Magic Items',
              constraints: [{
                id: 'limit-magic-pts',
                type: 'max',
                value: MAGIC_GROUP_POINTS_MAX,
                field: POINTS,
                scope: 'parent'
              }],
              selectionEntries: [{
                id: WRAPPER_ENTRY_ID,
                name: 'Power Stone Wrapper',
                costs: [{ typeId: POINTS, value: 0 }],
                selectionEntries: [{
                  id: STONE_ENTRY_ID,
                  name: 'Power Stone Item',
                  constraints: [{ id: 'con-child-min', type: 'min', value: 1, field: 'selections' }],
                  costs: [{ typeId: POINTS, value: STONE_COST }]
                }]
              }]
            }]
          }
        ]
      }]
    };
  }

  function createWrapperSelection(count) {
    return {
      id: 'sel-parent',
      selectionEntryId: WRAPPER_ENTRY_ID,
      name: 'Power Stone Wrapper',
      number: count,
      costs: [{ typeId: POINTS, value: 0 }],
      selections: [{
        id: 'sel-child',
        selectionEntryId: STONE_ENTRY_ID,
        name: 'Power Stone Item',
        number: count,
        costs: [{ typeId: POINTS, value: STONE_COST }]
      }]
    };
  }

  test('getOptionDisplayCost rechnet die Pflicht-Unterauswahl in den Anzeigepreis ein', () => {
    const displayCost = getOptionDisplayCost(createNestedSystem(), { id: WRAPPER_ENTRY_ID }, POINTS);

    expect(displayCost).toBe(STONE_COST);
  });

  test('getSelectionTotalCost summiert die Kosten der Unterauswahlen', () => {
    const totalCost = getSelectionTotalCost(createWrapperSelection(1), POINTS);

    expect(totalCost).toBe(STONE_COST);
  });

  test('das Punktebudget der Gruppe greift auf die verschachtelten Kosten', () => {
    const wrapperCount = 2;
    expect(wrapperCount * STONE_COST).toBeGreaterThan(MAGIC_GROUP_POINTS_MAX);

    const roster = {
      name: 'Nested Army',
      costLimit: 2000,
      costLimitType: POINTS,
      forces: [{
        id: 'f1',
        forceEntryId: NESTED_FORCE_ENTRY_ID,
        catalogueId: NESTED_CATALOGUE_ID,
        selections: [{
          id: 'sel-wizard',
          selectionEntryId: 'unit-nested',
          name: 'Wizard',
          number: 1,
          category: HQ_CATEGORY_ID,
          selections: [
            createWrapperSelection(wrapperCount),
            { id: 'sel-general', selectionEntryId: ENTRY_ID.general, name: 'General', number: 1 }
          ]
        }]
      }]
    };

    const errors = validateRoster(roster, createNestedSystem());

    expect(errors.some(error => error.type === 'group-points-max')).toBe(true);
  });
});

describe('Kostenmodifier mit parent-bezogener Wiederholung', () => {
  // „Spears" kosten 1 Punkt je Modell der Einheit. Der increment-Modifier wiederholt
  // sich über die Zahl der Geschwistermodelle, statt einen Festpreis zu tragen.
  const COST_MODIFIER_CATALOGUE_ID = 'cat-cost-mod';
  const MODEL_ENTRY_ID = 'model-orc';
  const SPEARS_ENTRY_ID = 'upgrade-spears';
  const MODEL_COUNT = 10;
  const COST_PER_MODEL = 1;

  function createCostModifierSystem() {
    return {
      id: 'sys-cost-mod',
      catalogues: [{
        id: COST_MODIFIER_CATALOGUE_ID,
        sharedSelectionEntries: [{
          id: 'unit-boyz',
          name: 'Orc Boyz',
          selectionEntries: [
            {
              id: MODEL_ENTRY_ID,
              name: 'Orc Boy',
              type: 'model',
              constraints: [{ type: 'min', value: MODEL_COUNT }]
            },
            {
              id: SPEARS_ENTRY_ID,
              name: 'Spears',
              type: 'upgrade',
              modifiers: [{
                type: 'increment',
                field: POINTS,
                value: String(COST_PER_MODEL.toFixed(1)),
                repeat: {
                  field: 'selections',
                  scope: 'parent',
                  childId: MODEL_ENTRY_ID,
                  value: 1,
                  repeats: 1
                }
              }],
              costs: [{ typeId: POINTS, value: 0 }]
            }
          ]
        }]
      }]
    };
  }

  function createCostModifierRoster() {
    return {
      catalogueId: COST_MODIFIER_CATALOGUE_ID,
      costLimit: 2000,
      costLimitType: POINTS,
      forces: [{
        id: 'force-1',
        catalogueId: COST_MODIFIER_CATALOGUE_ID,
        selections: [{
          id: 'sel-boyz',
          selectionEntryId: 'unit-boyz',
          number: 1,
          selections: [
            { id: 'sel-orc', selectionEntryId: MODEL_ENTRY_ID, number: MODEL_COUNT },
            { id: 'sel-spears', selectionEntryId: SPEARS_ENTRY_ID, number: 1, costs: [{ typeId: POINTS, value: 0 }] }
          ]
        }]
      }]
    };
  }

  const expectedSpearCost = MODEL_COUNT * COST_PER_MODEL;

  test('getOptionDisplayCost skaliert den Anzeigepreis mit der Modellzahl', () => {
    const system = createCostModifierSystem();
    const roster = createCostModifierRoster();
    const spearsOption = system.catalogues[0].sharedSelectionEntries[0].selectionEntries[1];

    const displayCost = getOptionDisplayCost(system, spearsOption, POINTS, {
      roster,
      system,
      selectionCounts: { [MODEL_ENTRY_ID]: MODEL_COUNT },
      forceCategoryCounts: {},
      selection: null,
      parentSelection: roster.forces[0].selections[0],
      parentCatalogueId: COST_MODIFIER_CATALOGUE_ID
    });

    expect(displayCost).toBe(expectedSpearCost);
  });

  test('calculateRosterCosts übernimmt den skalierten Preis in die Rostersumme', () => {
    const rosterCosts = calculateRosterCosts(createCostModifierRoster(), createCostModifierSystem());

    expect(rosterCosts[POINTS]).toBe(expectedSpearCost);
  });
});
