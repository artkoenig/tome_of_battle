import { describe, it, expect } from 'vitest';
import { evaluateCondition } from './modifierEvaluator.js';

/**
 * Issue 0155 — `value` has no effect on a contingent instance check.
 *
 * BSData §7.7 / `docs/battlescribe-data-format.md` (upstream wiki: "Has no effect
 * where Type is instance of|not instance of"): only the comparison kind decides
 * whether membership or absence is demanded. The Definitive Edition writes both
 * `value="0"` and `value="1"` for the same intent, so reading the value as a second
 * negation flipped half of the real list gates.
 *
 * The counting comparison kinds are untouched: they keep reading `value` as their
 * threshold, which the last describe pins beside the changed behaviour.
 */

const FORCE_A = 'force-a';
const FORCE_B = 'force-b';
const ARCHER = 'entry-archer';

const system = {
  id: 'sys',
  forceEntries: [{ id: FORCE_A, name: 'Force A' }, { id: FORCE_B, name: 'Force B' }],
  catalogues: [{
    id: 'cat',
    selectionEntries: [{ id: ARCHER, name: 'Archer', type: 'unit' }],
  }],
};

/** Context of a modifier hanging in a roster whose single contingent is `forceEntryId`. */
const ctxInForce = (forceEntryId, extra = {}) => ({
  system,
  force: { id: 'f1', forceEntryId, catalogueId: 'cat', selections: [] },
  roster: { forces: [{ id: 'f1', forceEntryId, catalogueId: 'cat', selections: [] }] },
  ...extra,
});

/** The canonical §7.7 shape: the keyword in `scope`, the forceEntry id in `childId`. */
const canonical = (type, value) => ({
  type, value, field: 'selections', scope: 'force', childId: FORCE_A,
  shared: true, includeChildSelections: true,
});

/** The self-gated shape: the forceEntry id directly in `scope`. */
const selfGated = (type, value) => ({
  type, value, field: 'selections', scope: FORCE_A, childId: 'any',
  shared: true, includeChildSelections: false,
});

describe('Kontingent-Instanzbedingung: der value verneint nicht', () => {
  describe.each([
    ['kanonisch (scope="force", childId=<forceId>)', canonical],
    ['selbst-gegatet (scope=<forceId>)', selfGated],
  ])('%s', (_name, condition) => {
    it.each([0, 1, undefined])('instanceOf haelt im eigenen Kontingent, value=%s', (value) => {
      expect(evaluateCondition(condition('instanceOf', value), ctxInForce(FORCE_A))).toBe(true);
    });

    it.each([0, 1, undefined])('instanceOf haelt nicht im fremden Kontingent, value=%s', (value) => {
      expect(evaluateCondition(condition('instanceOf', value), ctxInForce(FORCE_B))).toBe(false);
    });

    it.each([0, 1, undefined])('notInstanceOf haelt nicht im eigenen Kontingent, value=%s', (value) => {
      expect(evaluateCondition(condition('notInstanceOf', value), ctxInForce(FORCE_A))).toBe(false);
    });

    it.each([0, 1, undefined])('notInstanceOf haelt im fremden Kontingent, value=%s', (value) => {
      expect(evaluateCondition(condition('notInstanceOf', value), ctxInForce(FORCE_B))).toBe(true);
    });

    it('liefert fuer jeden value dasselbe Ergebnis wie fuer jeden anderen', () => {
      for (const type of ['instanceOf', 'notInstanceOf']) {
        for (const forceEntryId of [FORCE_A, FORCE_B]) {
          const results = [0, 1, 2, undefined, null]
            .map(value => evaluateCondition(condition(type, value), ctxInForce(forceEntryId)));
          expect(new Set(results).size, `${type} in ${forceEntryId}`).toBe(1);
        }
      }
    });
  });
});

describe('KONTROLLE: die zaehlenden Vergleichsarten lesen ihren value unveraendert', () => {
  const counting = (type, value) => ({
    type, value, field: 'selections', scope: 'roster', childId: ARCHER,
    shared: true, includeChildSelections: true,
  });
  // Two archers in the roster — the measured quantity every case below compares against.
  const ctx = {
    system,
    force: { id: 'f1', forceEntryId: FORCE_A, catalogueId: 'cat', selections: [] },
    roster: { forces: [{ id: 'f1', forceEntryId: FORCE_A, catalogueId: 'cat', selections: [] }] },
    selectionCounts: { [ARCHER]: 2 },
  };

  it.each([
    ['atLeast', 2, true], ['atLeast', 3, false],
    ['atMost', 2, true], ['atMost', 1, false],
    ['greaterThan', 1, true], ['greaterThan', 2, false],
    ['lessThan', 3, true], ['lessThan', 2, false],
    ['equalTo', 2, true], ['equalTo', 0, false],
    ['notEqualTo', 0, true], ['notEqualTo', 2, false],
  ])('%s value=%s → %s', (type, value, expected) => {
    expect(evaluateCondition(counting(type, value), ctx)).toBe(expected);
  });
});
