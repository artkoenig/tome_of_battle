import { describe, test, expect } from 'vitest';
import { DEFAULT_ROSTER_COST_LIMIT } from '../../../../contexts/armylist/model/rosterDefaults';

describe('DEFAULT_ROSTER_COST_LIMIT', () => {
  test('ist ein positives Punktelimit', () => {
    expect(DEFAULT_ROSTER_COST_LIMIT).toBeGreaterThan(0);
  });
});
