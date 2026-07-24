import { describe, test, expect } from 'vitest';
import { aggregateRosterCategoryCounts, computeRosterCounts } from './validator.js';
import {
  POINTS,
  CATEGORY_ID,
  FORCE_ENTRY_ID,
  createGrimdarkSystem
} from './__fixtures__/grimdarkSystem.js';

const EXPECTED_SINGLE_COUNT = 1;

describe('computeRosterCounts — Kategoriezählung je Kontingent', () => {
  test('zählt eine Einheit nur einmal, wenn zwei categoryLinks auf dieselbe Kategorie zeigen', () => {
    const CATALOGUE_ID = 'cat-marines';
    const FORCE_ID = 'f1';
    const system = createGrimdarkSystem();
    system.catalogues = [{
      id: CATALOGUE_ID,
      name: 'Space Marines',
      selectionEntries: [{
        id: 'unit-captain',
        name: 'Space Marine Captain',
        costs: [{ typeId: POINTS, value: 100 }],
        categoryLinks: [
          { targetId: CATEGORY_ID.hq, primary: true },
          { targetId: CATEGORY_ID.hq, primary: false } // Doppelter Link auf dieselbe Kategorie
        ]
      }]
    }];

    const roster = {
      name: 'De-dup Captain',
      costLimit: 2000,
      costLimitType: POINTS,
      forces: [{
        id: FORCE_ID,
        forceEntryId: FORCE_ENTRY_ID,
        catalogueId: CATALOGUE_ID,
        selections: [{
          id: 'sel-cap',
          selectionEntryId: 'unit-captain',
          name: 'Space Marine Captain',
          number: 1,
          costs: [{ typeId: POINTS, value: 100 }]
        }]
      }]
    };

    const { categoryCounts } = computeRosterCounts(roster, system);

    expect(categoryCounts[FORCE_ID][CATEGORY_ID.hq]).toBe(EXPECTED_SINGLE_COUNT);
  });

  test('zählt eine Unterauswahl nicht erneut, wenn sie dieselbe Primärkategorie trägt wie ihr Elternteil', () => {
    // Modelle innerhalb einer Einheit tragen häufig dieselbe Primärkategorie wie die
    // Einheit selbst. Zählte der Solver sie mit, sprengte jede Mehrmodell-Einheit
    // sofort die Kategorielimits ihres Kontingents.
    const NESTED_CATALOGUE_ID = 'cat-nested';
    const NESTED_FORCE_ID = 'f-nested';
    const SPECIAL_CATEGORY_ID = 'cat-special';
    const CHILD_MODEL_COUNT = 2;

    const system = createGrimdarkSystem();
    system.catalogues = [{
      id: NESTED_CATALOGUE_ID,
      name: 'Nested Category Test',
      selectionEntries: [{
        id: 'parent-unit',
        name: 'Parent Unit',
        categoryLinks: [{ targetId: SPECIAL_CATEGORY_ID, primary: true }],
        selectionEntries: [{
          id: 'child-model',
          name: 'Child Model',
          categoryLinks: [{ targetId: SPECIAL_CATEGORY_ID, primary: true }]
        }]
      }]
    }];

    const roster = {
      name: 'Nested Category',
      costLimit: 2000,
      costLimitType: POINTS,
      forces: [{
        id: NESTED_FORCE_ID,
        forceEntryId: FORCE_ENTRY_ID,
        catalogueId: NESTED_CATALOGUE_ID,
        selections: [{
          id: 'sel-parent',
          selectionEntryId: 'parent-unit',
          name: 'Parent Unit',
          number: 1,
          selections: [{
            id: 'sel-child',
            selectionEntryId: 'child-model',
            name: 'Child Model',
            number: CHILD_MODEL_COUNT
          }]
        }]
      }]
    };

    const { categoryCounts } = computeRosterCounts(roster, system);

    expect(categoryCounts[NESTED_FORCE_ID][SPECIAL_CATEGORY_ID]).toBe(EXPECTED_SINGLE_COUNT);
  });
});

describe('aggregateRosterCategoryCounts — roster-weite Kategoriesumme (SSOT)', () => {
  const SHARED_CATEGORY_ID = 'cat-shared';
  const CORE_CATEGORY_ID = 'cat-core';
  const ELITE_CATEGORY_ID = 'cat-elite';
  const FORCE_A = 'f-a';
  const FORCE_B = 'f-b';

  test('summiert eine kontingentübergreifend geteilte Kategorie, statt das letzte Kontingent gewinnen zu lassen', () => {
    // Dieselbe Kategorie ist in beiden Kontingenten belegt (2 bzw. 3). Der frühere
    // Spread-Overwrite (`{...acc, ...c}`) hätte den Wert des ersten Kontingents vom
    // zweiten überschrieben und 3 statt 6 geliefert — eine Unterzählung.
    const perForce = {
      [FORCE_A]: { [SHARED_CATEGORY_ID]: 2, [CORE_CATEGORY_ID]: 1 },
      [FORCE_B]: { [SHARED_CATEGORY_ID]: 4, [ELITE_CATEGORY_ID]: 5 }
    };

    const rosterWide = aggregateRosterCategoryCounts(perForce);

    expect(rosterWide[SHARED_CATEGORY_ID]).toBe(6);
    expect(rosterWide[CORE_CATEGORY_ID]).toBe(1);
    expect(rosterWide[ELITE_CATEGORY_ID]).toBe(5);
  });

  test('ein Ein-Kontingent-Roster bleibt unverändert (Summe == Overwrite bei einem Kontingent)', () => {
    const perForce = { [FORCE_A]: { [SHARED_CATEGORY_ID]: 2, [CORE_CATEGORY_ID]: 1 } };

    expect(aggregateRosterCategoryCounts(perForce)).toEqual({
      [SHARED_CATEGORY_ID]: 2,
      [CORE_CATEGORY_ID]: 1
    });
  });

  test('leere/fehlende Eingabe ergibt eine leere Tabelle', () => {
    expect(aggregateRosterCategoryCounts(undefined)).toEqual({});
    expect(aggregateRosterCategoryCounts({})).toEqual({});
  });
});
