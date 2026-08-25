/**
 * Wahrheitswert-Tests jedes `ConditionKind`-Vergleichs (`COMPARATORS`,
 * `modifiers.js`). Slice 01 hebt das Bedingungs-Vokabular auf die kanonischen
 * SSOT-Namen: `lessThan`/`greaterThan`/`equalTo` statt der alten Kurzformen, neu
 * `notEqualTo`; `atLeast`/`atMost` unveraendert; `instanceOf`/`notInstanceOf`
 * als Mitgliedschafts-Praedikate (`value` nicht schwellwertig).
 */

import { describe, it, expect } from 'vitest';
import { ConditionKind } from '../../../../contexts/ruleengine/engine/model.js';
import { COMPARATORS } from '../../../../contexts/ruleengine/engine/modifiers.js';

/** Wendet den Vergleich einer Bedingungs-Art auf (Ist, Soll) an. */
function evaluateComparator(kind, actual, expected) {
  return COMPARATORS[kind](actual, expected);
}

describe('COMPARATORS: numerische Schwellenwert-Vergleiche', () => {
  it('lessThan haelt nur unter dem Sollwert', () => {
    expect(evaluateComparator(ConditionKind.LESS_THAN, 1, 2)).toBe(true);
    expect(evaluateComparator(ConditionKind.LESS_THAN, 2, 2)).toBe(false);
  });

  it('greaterThan haelt nur ueber dem Sollwert', () => {
    expect(evaluateComparator(ConditionKind.GREATER_THAN, 3, 2)).toBe(true);
    expect(evaluateComparator(ConditionKind.GREATER_THAN, 2, 2)).toBe(false);
  });

  it('equalTo haelt nur bei Gleichheit', () => {
    expect(evaluateComparator(ConditionKind.EQUAL_TO, 2, 2)).toBe(true);
    expect(evaluateComparator(ConditionKind.EQUAL_TO, 3, 2)).toBe(false);
  });

  it('notEqualTo haelt genau bei Ungleichheit', () => {
    expect(evaluateComparator(ConditionKind.NOT_EQUAL_TO, 3, 2)).toBe(true);
    expect(evaluateComparator(ConditionKind.NOT_EQUAL_TO, 2, 2)).toBe(false);
  });

  it('atLeast und atMost schliessen den Sollwert ein', () => {
    expect(evaluateComparator(ConditionKind.AT_LEAST, 2, 2)).toBe(true);
    expect(evaluateComparator(ConditionKind.AT_LEAST, 1, 2)).toBe(false);
    expect(evaluateComparator(ConditionKind.AT_MOST, 2, 2)).toBe(true);
    expect(evaluateComparator(ConditionKind.AT_MOST, 3, 2)).toBe(false);
  });
});

describe('COMPARATORS: Mitgliedschafts-Praedikate (value nicht schwellwertig)', () => {
  it('instanceOf haelt bei Anwesenheit (actual > 0), unabhaengig vom Sollwert', () => {
    expect(evaluateComparator(ConditionKind.INSTANCE_OF, 1, 5)).toBe(true);
    expect(evaluateComparator(ConditionKind.INSTANCE_OF, 0, 5)).toBe(false);
  });

  it('notInstanceOf haelt bei Abwesenheit (actual === 0), unabhaengig vom Sollwert', () => {
    expect(evaluateComparator(ConditionKind.NOT_INSTANCE_OF, 0, 1)).toBe(true);
    expect(evaluateComparator(ConditionKind.NOT_INSTANCE_OF, 2, 1)).toBe(false);
  });
});
