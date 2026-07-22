import { describe, test, expect } from 'vitest';
import { getEffectiveConstraintLimit } from './constraintScope.js';
import { ConstraintKind, ModifierKind } from '../parser/schema/battlescribeSchema.generated.js';

// Schema-förmige Fixtures (ADR-0003): eine Gruppen-Max-Constraint plus ein bedingter
// increment auf genau diese Constraint — das Rüstung+Schild-Muster.
const MAX_ID = 'con-armour-max';

const maxConstraint = (value = 1) => ({ id: MAX_ID, type: ConstraintKind.MAX, field: 'selections', scope: 'parent', value });

const shieldPresent = () => ({ type: 'greaterThan', field: 'selections', scope: 'parent', childId: 'shield', value: 0 });

const incrementWhenShield = () => ({
  type: ModifierKind.INCREMENT, field: MAX_ID, valueObject: 1, conditions: [shieldPresent()]
});

describe('getEffectiveConstraintLimit — normalisierter effektiver Constraint-Wert', () => {
  test('fehlende Constraint ⇒ Fallback', () => {
    expect(getEffectiveConstraintLimit(undefined, [], {}, Infinity)).toBe(Infinity);
    expect(getEffectiveConstraintLimit(null, [], {}, 0)).toBe(0);
  });

  test('Fallback ist standardmäßig 0', () => {
    expect(getEffectiveConstraintLimit(undefined, [])).toBe(0);
  });

  test('ohne Modifier ⇒ roher Constraint-Wert', () => {
    expect(getEffectiveConstraintLimit(maxConstraint(1), [], {}, Infinity)).toBe(1);
  });

  test('negativer effektiver Wert (unbeschränkt-Sentinel) ⇒ Fallback', () => {
    expect(getEffectiveConstraintLimit(maxConstraint(-1), [], {}, Infinity)).toBe(Infinity);
  });

  test('bedingter increment greift, wenn seine Bedingung im Kontext erfüllt ist (Schild gewählt)', () => {
    const ctx = { selectionCounts: { shield: 1 } };
    expect(getEffectiveConstraintLimit(maxConstraint(1), [incrementWhenShield()], ctx, Infinity)).toBe(2);
  });

  test('bedingter increment greift NICHT, solange seine Bedingung unerfüllt ist (kein Schild)', () => {
    const ctx = { selectionCounts: {} };
    expect(getEffectiveConstraintLimit(maxConstraint(1), [incrementWhenShield()], ctx, Infinity)).toBe(1);
  });
});
