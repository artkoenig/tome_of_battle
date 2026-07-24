import { describe, test, expect } from 'vitest';
import { isCostField } from './battlescribeConstants.js';

const system = {
  id: 'sys',
  costTypes: [{ id: 'pts', name: 'Points' }]
};

describe('isCostField', () => {
  test('a declared cost type is a cost field', () => {
    expect(isCostField('pts', system)).toBe(true);
  });
  test('selections and unknown fields are not cost fields', () => {
    expect(isCostField('selections', system)).toBe(false);
    expect(isCostField(undefined, system)).toBe(false);
    expect(isCostField('unknown', system)).toBe(false);
  });
  // No cost-type id may be assumed: `cost/@typeId` references an id the
  // catalogue author picks freely, so an id the system does not declare is an
  // unknown field — not points by virtue of being spelled `'pts'`.
  test('an undeclared field is not a cost field, however it is spelled', () => {
    const systemWithoutPoints = { id: 'sys', costTypes: [{ id: 'guid-casting-dice', name: ' Casting Dice' }] };

    expect(isCostField('pts', systemWithoutPoints)).toBe(false);
    expect(isCostField('ecfa-8486-4f6c-c249', systemWithoutPoints)).toBe(false);
  });
  test('the roster cost-limit type is a cost field even when undeclared', () => {
    const systemWithoutPoints = { id: 'sys', costTypes: [] };

    expect(isCostField('guid-points', systemWithoutPoints, { costLimitType: 'guid-points' })).toBe(true);
  });
});
