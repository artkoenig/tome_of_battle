import { describe, test, expect } from 'vitest';
import {
  isPercentConstraint,
  formatConstraintLimit
} from './constraintScope.js';

describe('isPercentConstraint', () => {
  test('true for the schema-valid percentValue flag', () => {
    expect(isPercentConstraint({ type: 'max', percentValue: true })).toBe(true);
  });
  test('true for the legacy percent pseudo-type', () => {
    expect(isPercentConstraint({ type: 'percent' })).toBe(true);
  });
  test('false for a plain absolute min/max constraint', () => {
    expect(isPercentConstraint({ type: 'max', percentValue: false })).toBe(false);
    expect(isPercentConstraint({ type: 'min' })).toBe(false);
  });
});

describe('formatConstraintLimit', () => {
  test('renders an absolute constraint value unchanged', () => {
    expect(formatConstraintLimit(3, { type: 'max' })).toBe('3');
  });

  test('appends a percent sign for a percentValue constraint', () => {
    expect(formatConstraintLimit(25, { type: 'max', percentValue: true })).toBe('25 %');
  });

  test('appends a percent sign for the legacy percent pseudo-type', () => {
    expect(formatConstraintLimit(50, { type: 'percent' })).toBe('50 %');
  });

  test('treats a missing constraint as absolute', () => {
    expect(formatConstraintLimit(7, undefined)).toBe('7');
  });
});
