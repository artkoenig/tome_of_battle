import { describe, test, expect } from 'vitest';
import { isCategoryLinkHidden, isSelectionEntryHidden } from './validator.js';

const NO_COUNTS = {};

describe('isCategoryLinkHidden — statisches hidden-Attribut', () => {
  const HQ_CATEGORY_ID = 'cat-hq';
  const roster = () => ({ catalogueId: 'cat-orcs' });
  const system = () => ({ id: 'sys-test', name: 'Test System', categoryEntries: [{ id: HQ_CATEGORY_ID, name: 'HQ' }] });

  test('ein nicht verstecktes Link bleibt sichtbar', () => {
    const link = { id: 'cl-hq', targetId: HQ_CATEGORY_ID, hidden: false };

    expect(isCategoryLinkHidden(link, system(), roster(), NO_COUNTS, NO_COUNTS)).toBe(false);
  });

  test('ein verstecktes Link bleibt versteckt', () => {
    const link = { id: 'cl-troops', targetId: 'cat-troops', hidden: true };

    expect(isCategoryLinkHidden(link, system(), roster(), NO_COUNTS, NO_COUNTS)).toBe(true);
  });
});

describe('isCategoryLinkHidden — hidden per Modifier', () => {
  const HQ_CATEGORY_ID = 'cat-hq';
  const system = () => ({ id: 'sys-test', name: 'Test System', categoryEntries: [{ id: HQ_CATEGORY_ID, name: 'HQ' }] });
  const roster = () => ({ catalogueId: 'cat-orcs' });

  const revealCondition = () => ({ field: HQ_CATEGORY_ID, type: 'greaterThan', value: 0 });
  const revealModifier = () => ({ type: 'set', field: 'hidden', value: 'false' });

  const evaluateWithHqCount = (link, hqCount) =>
    isCategoryLinkHidden(link, system(), roster(), { [HQ_CATEGORY_ID]: hqCount }, NO_COUNTS);

  test('ein direkter Modifier deckt das Link erst auf, wenn seine Bedingung greift', () => {
    const link = () => ({
      id: 'cl-mod',
      targetId: HQ_CATEGORY_ID,
      hidden: true,
      modifiers: [{ ...revealModifier(), conditions: [revealCondition()] }]
    });

    expect(evaluateWithHqCount(link(), 0)).toBe(true);
    expect(evaluateWithHqCount(link(), 1)).toBe(false);
  });

  test('ein in einer modifierGroup gekapselter Modifier wird mit seiner Gruppenbedingung gewertet', () => {
    // Regression (Issue 19, B2): vor der Umstellung auf getEffectiveModifiers
    // fielen modifierGroup-gekapselte Modifier stillschweigend unter den Tisch.
    const link = () => ({
      id: 'cl-group-mod',
      targetId: HQ_CATEGORY_ID,
      hidden: true,
      modifierGroups: [{ conditions: [revealCondition()], modifiers: [revealModifier()] }]
    });

    expect(evaluateWithHqCount(link(), 0)).toBe(true);
    expect(evaluateWithHqCount(link(), 1)).toBe(false);
  });
});

describe('isSelectionEntryHidden — Sichtbarkeit von Katalogeinträgen', () => {
  const CATALOGUE_ID = 'cat-test';
  const HORDE_FORCE_ENTRY_ID = 'fe-horde';
  const STANDARD_FORCE_ENTRY_ID = 'fe-standard';

  function createSystem() {
    return {
      id: 'sys-test',
      name: 'Test System',
      catalogues: [{
        id: CATALOGUE_ID,
        sharedSelectionEntries: [
          { id: 'unit-visible', name: 'Visible Unit', hidden: false },
          { id: 'unit-hidden', name: 'Hidden Unit', hidden: true },
          {
            id: 'unit-conditional',
            name: 'Conditional Unit',
            hidden: false,
            // Im Horde-Kontingent wird die Einheit ausgeblendet.
            modifiers: [{
              type: 'set',
              field: 'hidden',
              value: 'true',
              conditions: [{
                field: 'selections',
                scope: HORDE_FORCE_ENTRY_ID,
                value: 1.0,
                childId: 'any',
                type: 'instanceOf'
              }]
            }]
          }
        ],
        forceEntries: [{ id: HORDE_FORCE_ENTRY_ID, name: 'Troll Horde' }]
      }]
    };
  }

  const entryNamed = (system, entryId) =>
    system.catalogues[0].sharedSelectionEntries.find(entry => entry.id === entryId);

  const rosterInForce = forceEntryId => ({ catalogueId: CATALOGUE_ID, forces: [{ forceEntryId }] });

  test('respektiert das statische hidden-Attribut', () => {
    const system = createSystem();
    const roster = rosterInForce(STANDARD_FORCE_ENTRY_ID);

    expect(isSelectionEntryHidden(entryNamed(system, 'unit-visible'), system, roster, NO_COUNTS, NO_COUNTS)).toBe(false);
    expect(isSelectionEntryHidden(entryNamed(system, 'unit-hidden'), system, roster, NO_COUNTS, NO_COUNTS)).toBe(true);
  });

  test('blendet einen bedingten Eintrag nur im auslösenden Kontingent aus', () => {
    const system = createSystem();
    const standardRoster = rosterInForce(STANDARD_FORCE_ENTRY_ID);
    const hordeRoster = rosterInForce(HORDE_FORCE_ENTRY_ID);
    const conditionalEntry = entryNamed(system, 'unit-conditional');

    expect(isSelectionEntryHidden(
      conditionalEntry, system, standardRoster, NO_COUNTS, NO_COUNTS, standardRoster.forces[0]
    )).toBe(false);
    expect(isSelectionEntryHidden(
      conditionalEntry, system, hordeRoster, NO_COUNTS, NO_COUNTS, hordeRoster.forces[0]
    )).toBe(true);
  });
});
