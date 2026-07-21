import { describe, test, expect } from 'vitest';
import { DEFAULT_ROSTER_COST_LIMIT, createInitialGameState } from './rosterDefaults';

describe('DEFAULT_ROSTER_COST_LIMIT', () => {
  test('ist ein positives Punktelimit', () => {
    expect(DEFAULT_ROSTER_COST_LIMIT).toBeGreaterThan(0);
  });
});

describe('createInitialGameState', () => {
  test('beginnt in Runde 1 ohne Punkte und ohne Wunden', () => {
    expect(createInitialGameState()).toEqual({ round: 1, vp: 0, cp: 0, wounds: {} });
  });

  test('liefert je Aufruf eine eigene Instanz, damit Wunden nicht geteilt werden', () => {
    const first = createInitialGameState();
    const second = createInitialGameState();

    first.wounds['sel-1'] = 3;

    expect(second.wounds).toEqual({});
    expect(second).not.toBe(first);
  });
});
