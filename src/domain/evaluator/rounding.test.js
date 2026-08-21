import { describe, it, expect } from 'vitest';
import { roundHalfUp } from './rounding.js';

// Die eine zentrale Rundungskonvention fuer Prozentgrenzen
// (docs/evaluator-architecture.md §4.7 / §5, Risiko 5).
describe('roundHalfUp (zentrale Rundungskonvention)', () => {
  it('laesst ganze Zahlen unveraendert', () => {
    expect(roundHalfUp(2)).toBe(2);
    expect(roundHalfUp(0)).toBe(0);
  });

  it('rundet bei genau .5 auf', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(0.5)).toBe(1);
  });

  it('rundet unterhalb von .5 ab und ab .5 auf', () => {
    expect(roundHalfUp(2.4)).toBe(2);
    expect(roundHalfUp(2.6)).toBe(3);
  });
});
