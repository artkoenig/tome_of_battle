import { describe, test, expect } from 'vitest';
import { getModifiedConstraintValue } from './validator.js';
import { POINTS } from './__fixtures__/grimdarkSystem.js';

// Ein `repeat` wiederholt den Modifier einmal je vollem Vielfachen seines
// Bezugswerts: finalValue = base + floor(bezug / repeat.value) * increment * repeat.repeats.
describe('getModifiedConstraintValue — wiederholte Modifier', () => {
  const CONSTRAINT_ID = 'con-max';
  const BASE_VALUE = 0;
  const ROSTER_COST_LIMIT = 2500;

  const constraint = () => ({ id: CONSTRAINT_ID, value: BASE_VALUE });

  const incrementRepeatedBy = (increment, repeat) => ({
    field: CONSTRAINT_ID,
    type: 'increment',
    valueObject: increment,
    repeat
  });

  const evaluate = (modifier, { roster, selectionCounts = {}, forceCategoryCounts = {} }) =>
    getModifiedConstraintValue(constraint(), [modifier], { roster, selectionCounts, forceCategoryCounts });

  test('wiederholt sich je vollem Vielfachen des Punktelimits', () => {
    const INCREMENT = 2;
    const REPEAT_EVERY_POINTS = 1000;
    const expectedRepeats = Math.floor(ROSTER_COST_LIMIT / REPEAT_EVERY_POINTS);

    const value = evaluate(
      incrementRepeatedBy(INCREMENT, { field: `limit::${POINTS}`, value: REPEAT_EVERY_POINTS, repeats: 1 }),
      { roster: { costLimit: ROSTER_COST_LIMIT, costLimitType: POINTS, forces: [] } }
    );

    expect(value).toBe(BASE_VALUE + expectedRepeats * INCREMENT);
  });

  test('wiederholt sich je vollem Vielfachen einer Auswahlanzahl', () => {
    const INCREMENT = 5;
    const REPEAT_EVERY_UNITS = 3;
    const UNIT_FIELD = 'unit-x';
    const UNIT_COUNT = 6;
    const expectedRepeats = Math.floor(UNIT_COUNT / REPEAT_EVERY_UNITS);

    const value = evaluate(
      incrementRepeatedBy(INCREMENT, { field: UNIT_FIELD, value: REPEAT_EVERY_UNITS, repeats: 1 }),
      {
        roster: { costLimit: ROSTER_COST_LIMIT, costLimitType: POINTS, forces: [] },
        selectionCounts: { [UNIT_FIELD]: UNIT_COUNT }
      }
    );

    expect(value).toBe(BASE_VALUE + expectedRepeats * INCREMENT);
  });

  test('wiederholt sich je vollem Vielfachen einer Kategorieanzahl (childId)', () => {
    const INCREMENT = 1;
    const REPEAT_EVERY_CORE_UNITS = 2;
    const CORE_CATEGORY_ID = 'cat-core';
    const CORE_COUNT = 4;
    const expectedRepeats = Math.floor(CORE_COUNT / REPEAT_EVERY_CORE_UNITS);

    const value = evaluate(
      incrementRepeatedBy(INCREMENT, { childId: CORE_CATEGORY_ID, value: REPEAT_EVERY_CORE_UNITS, repeats: 1 }),
      {
        roster: { costLimit: ROSTER_COST_LIMIT, costLimitType: POINTS, forces: [{ id: 'f1' }] },
        forceCategoryCounts: { [CORE_CATEGORY_ID]: CORE_COUNT }
      }
    );

    expect(value).toBe(BASE_VALUE + expectedRepeats * INCREMENT);
  });
});
