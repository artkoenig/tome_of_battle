import { describe, test, expect } from 'vitest';
import { getSelectionTotalCost } from './rosterCounter.js';
/**
 * Die Rostersumme einer Kostenart, aus denselben Knotensummen gerechnet, die
 * `getSelectionTotalCost` liefert — der frühere `calculateRosterCosts` ist mit
 * dem zweiten Auswertungspfad entfallen (Issue 0157); die App liest ihre Summe
 * aus dem Bericht.
 */
const rosterTotalOf = (roster, system, costTypeId) =>
  (roster.forces || []).reduce((forceSum, force) => {
    const currentCatalogueId = force.catalogueId || roster.catalogueId || null;
    return forceSum + (force.selections || []).reduce(
      (sum, selection) => sum + getSelectionTotalCost(selection, costTypeId, 1, {
        system, roster, currentCatalogueId
      }), 0);
  }, 0);

import {
  POINTS,
  UNIT_COST,
  ENTRY_ID,
  createGrimdarkSystem,
  createValidRoster
} from '../__fixtures__/grimdarkSystem.js';

describe('Rostersumme über getSelectionTotalCost', () => {
  test('summiert die Katalogkosten aller Auswahlen des Rosters', () => {
    const total = rosterTotalOf(createValidRoster(), createGrimdarkSystem(), POINTS);

    expect(total).toBe(UNIT_COST.captain + UNIT_COST.tacticalSquad);
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

  test('getSelectionTotalCost summiert die Kosten der Unterauswahlen', () => {
    const totalCost = getSelectionTotalCost(createWrapperSelection(1), POINTS);

    expect(totalCost).toBe(STONE_COST);
  });

  // Dass ein Gruppen-Punktebudget auf verschachtelte Kosten greift, ist eine
  // Aussage der Engine, nicht dieses Moduls: sie gehoert seit Issue 0121 in die
  // Reinraum-Suite (`src/evaluator/`, Grenzen mit measure `costSum`). Die
  // frueher hier gepinnte Solver-Validierung stirbt mit `src/solver/`.
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

  test('die Rostersumme übernimmt den skalierten Preis', () => {
    const total = rosterTotalOf(createCostModifierRoster(), createCostModifierSystem(), POINTS);

    expect(total).toBe(expectedSpearCost);
  });
});
