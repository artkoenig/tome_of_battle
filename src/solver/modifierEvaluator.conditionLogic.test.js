import { describe, test, expect } from 'vitest';
import { evaluateCondition, evaluateConditionGroup } from './validator.js';
import { POINTS } from './__fixtures__/grimdarkSystem.js';

const EMPTY_ROSTER = () => ({ costLimit: 1000, costLimitType: POINTS, forces: [] });

describe('evaluateConditionGroup — logische Verknüpfungen', () => {
  const PRESENT_UNIT_ID = 'unit-a';
  const ABSENT_UNIT_ID = 'unit-b';
  const UNKNOWN_UNIT_ID = 'unit-c';

  const evaluateGroup = group => evaluateConditionGroup(group, {
    roster: EMPTY_ROSTER(),
    selectionCounts: { [PRESENT_UNIT_ID]: 2, [ABSENT_UNIT_ID]: 0 },
    forceCategoryCounts: {}
  });

  const isPresent = field => ({ field, type: 'greaterThan', value: 0 });

  test('or ist wahr, sobald eine Teilbedingung zutrifft', () => {
    expect(evaluateGroup({
      type: 'or',
      conditions: [isPresent(PRESENT_UNIT_ID), isPresent(ABSENT_UNIT_ID)]
    })).toBe(true);
  });

  test('or ist falsch, wenn keine Teilbedingung zutrifft', () => {
    expect(evaluateGroup({
      type: 'or',
      conditions: [isPresent(ABSENT_UNIT_ID), isPresent(UNKNOWN_UNIT_ID)]
    })).toBe(false);
  });

  test('not ist wahr, wenn die eingeschlossene Bedingung falsch ist', () => {
    expect(evaluateGroup({ type: 'not', conditions: [isPresent(ABSENT_UNIT_ID)] })).toBe(true);
  });

  test('not ist falsch, wenn die eingeschlossene Bedingung zutrifft', () => {
    expect(evaluateGroup({ type: 'not', conditions: [isPresent(PRESENT_UNIT_ID)] })).toBe(false);
  });

  test('and ist wahr, wenn alle Teilbedingungen zutreffen', () => {
    expect(evaluateGroup({
      type: 'and',
      conditions: [
        isPresent(PRESENT_UNIT_ID),
        { type: 'notEqualTo', field: ABSENT_UNIT_ID, value: 1 }
      ]
    })).toBe(true);
  });
});

describe('evaluateCondition — Alias-Vergleichstypen', () => {
  const THRESHOLD = 3;
  const withCount = count => ({ selectionCounts: { selections: count } });

  test('atLeast verhält sich wie >=', () => {
    const condition = { type: 'atLeast', field: 'selections', value: THRESHOLD };

    expect(evaluateCondition(condition, withCount(THRESHOLD))).toBe(true);
    expect(evaluateCondition(condition, withCount(THRESHOLD + 1))).toBe(true);
    expect(evaluateCondition(condition, withCount(THRESHOLD - 1))).toBe(false);
  });

  test('atMost verhält sich wie <=', () => {
    const condition = { type: 'atMost', field: 'selections', value: THRESHOLD };

    expect(evaluateCondition(condition, withCount(THRESHOLD))).toBe(true);
    expect(evaluateCondition(condition, withCount(THRESHOLD - 1))).toBe(true);
    expect(evaluateCondition(condition, withCount(THRESHOLD + 1))).toBe(false);
  });
});

describe('evaluateCondition — instanceOf und seine Negation', () => {
  // `instanceOf` prüft, ob die Auswahl in einem Roster des genannten Kontingents steht.
  const HORDE_FORCE_ENTRY_ID = 'fe-horde';
  const OTHER_FORCE_ENTRY_ID = 'fe-standard';
  const ANY_CHILD = 'any';

  function createSystem() {
    return {
      id: 'sys-notinstance',
      catalogues: [{
        id: 'cat-test',
        sharedSelectionEntries: [{ id: 'unit-visible', name: 'Visible Unit', hidden: false }],
        forceEntries: [{ id: HORDE_FORCE_ENTRY_ID, name: 'Troll Horde' }]
      }]
    };
  }

  const condition = type => ({ type, field: 'selections', scope: HORDE_FORCE_ENTRY_ID, childId: ANY_CHILD, value: 1.0 });

  const evaluateInForce = (conditionType, forceEntryId) => evaluateCondition(condition(conditionType), {
    system: createSystem(),
    selection: { id: 'sel-unit', selectionEntryId: 'unit-visible' },
    roster: { forces: [{ forceEntryId }] }
  });

  test('instanceOf trifft im passenden Kontingent zu, notInstanceOf nicht', () => {
    expect(evaluateInForce('instanceOf', HORDE_FORCE_ENTRY_ID)).toBe(true);
    expect(evaluateInForce('notInstanceOf', HORDE_FORCE_ENTRY_ID)).toBe(false);
  });

  test('instanceOf trifft in einem fremden Kontingent nicht zu, notInstanceOf schon', () => {
    expect(evaluateInForce('instanceOf', OTHER_FORCE_ENTRY_ID)).toBe(false);
    expect(evaluateInForce('notInstanceOf', OTHER_FORCE_ENTRY_ID)).toBe(true);
  });
});
