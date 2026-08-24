import { describe, it, expect } from 'vitest';
import { classifyGroupItem, classifyStandaloneOption } from '../../../../ui/viewmodels/editor/selectionBehavior.js';

describe('classifyGroupItem', () => {
  const base = {
    minLimit: 0, maxLimit: Infinity, hasMaxConstraint: false,
    isCollective: false, isRepeatableByGroupModifier: false, groupSingleChoice: false
  };

  it('marks a fixed min===max option as mandatory', () => {
    const result = classifyGroupItem({ ...base, minLimit: 1, maxLimit: 1, hasMaxConstraint: true });
    expect(result.isMandatory).toBe(true);
  });

  it('renders a single-choice group item as a radio, but never a repeatable item', () => {
    expect(classifyGroupItem({ ...base, groupSingleChoice: true }).isRadio).toBe(true);
    expect(classifyGroupItem({ ...base, groupSingleChoice: true, isRepeatableByGroupModifier: true }).isRadio).toBe(false);
  });

  it('treats an explicit max>1 as multi-select', () => {
    const result = classifyGroupItem({ ...base, hasMaxConstraint: true, maxLimit: 3 });
    expect(result.isExplicitlyMulti).toBe(true);
    expect(result.isBinary).toBe(false);
  });

  it('treats a repeatable item as multi-select even inside a max=1 group', () => {
    const result = classifyGroupItem({ ...base, hasMaxConstraint: true, maxLimit: 1, isRepeatableByGroupModifier: true, groupSingleChoice: true });
    expect(result.isExplicitlyMulti).toBe(true);
    expect(result.isBinary).toBe(false);
  });

  it('treats a min>0 option without an explicit max as a multi-select quantity stepper', () => {
    const result = classifyGroupItem({ ...base, minLimit: 2 });
    expect(result.hasQuantitySignal).toBe(true);
    expect(result.isExplicitlyMulti).toBe(true);
    expect(result.isBinary).toBe(false);
  });

  it('treats a plain optional upgrade (no min, no max) as binary', () => {
    const result = classifyGroupItem({ ...base });
    expect(result.isExplicitlyMulti).toBe(false);
    expect(result.isBinary).toBe(true);
  });

  it('treats an explicit max===1 option as binary', () => {
    const result = classifyGroupItem({ ...base, hasMaxConstraint: true, maxLimit: 1 });
    expect(result.isBinary).toBe(true);
  });

  it('treats a collective upgrade as a quantity stepper (multi), not binary', () => {
    const result = classifyGroupItem({ ...base, isCollective: true });
    expect(result.hasQuantitySignal).toBe(true);
    expect(result.isExplicitlyMulti).toBe(true);
    expect(result.isBinary).toBe(false);
  });

  it('an unmet mandatory row is not yet met', () => {
    const result = classifyGroupItem({ ...base, minLimit: 1, maxLimit: 1, hasMaxConstraint: true, isMandatoryUnmet: true });
    expect(result.isMandatory).toBe(true);
    expect(result.isMandatoryMet).toBe(false);
  });

  it('a satisfied mandatory row (isMandatoryUnmet: false) is met', () => {
    const result = classifyGroupItem({ ...base, minLimit: 1, maxLimit: 1, hasMaxConstraint: true, isMandatoryUnmet: false });
    expect(result.isMandatory).toBe(true);
    expect(result.isMandatoryMet).toBe(true);
  });

  it('defaults to met when a caller omits isMandatoryUnmet (a caller that cannot say keeps the lock)', () => {
    const result = classifyGroupItem({ ...base, minLimit: 1, maxLimit: 1, hasMaxConstraint: true });
    expect(result.isMandatoryMet).toBe(true);
  });

  it('a non-mandatory row the report flags unmet is not mandatory, and its stepper/binary classification does not move', () => {
    const withoutFlag = classifyGroupItem({ ...base, minLimit: 1, maxLimit: 3, hasMaxConstraint: true });
    const result = classifyGroupItem({ ...base, minLimit: 1, maxLimit: 3, hasMaxConstraint: true, isMandatoryUnmet: true });
    expect(result.isMandatory).toBe(false);
    expect(result.isMandatoryMet).toBe(false);
    expect(result.isRadio).toBe(withoutFlag.isRadio);
    expect(result.isBinary).toBe(withoutFlag.isBinary);
    expect(result.isExplicitlyMulti).toBe(withoutFlag.isExplicitlyMulti);
    expect(result.hasQuantitySignal).toBe(withoutFlag.hasQuantitySignal);
  });
});

describe('classifyStandaloneOption', () => {
  it('marks min===max (min>0) as mandatory', () => {
    expect(classifyStandaloneOption({ minLimit: 1, maxLimit: 1 })).toEqual({ isMandatory: true, isBinary: true, isMandatoryMet: true });
  });

  it('marks max===1 as binary', () => {
    expect(classifyStandaloneOption({ minLimit: 0, maxLimit: 1 })).toEqual({ isMandatory: false, isBinary: true, isMandatoryMet: true });
  });

  it('is neither mandatory nor binary for an unbounded max', () => {
    expect(classifyStandaloneOption({ minLimit: 0, maxLimit: Infinity })).toEqual({ isMandatory: false, isBinary: false, isMandatoryMet: true });
  });

  it('an unmet mandatory row is not yet met', () => {
    const result = classifyStandaloneOption({ minLimit: 1, maxLimit: 1, isMandatoryUnmet: true });
    expect(result.isMandatory).toBe(true);
    expect(result.isMandatoryMet).toBe(false);
  });

  it('a satisfied mandatory row (isMandatoryUnmet: false) is met', () => {
    const result = classifyStandaloneOption({ minLimit: 1, maxLimit: 1, isMandatoryUnmet: false });
    expect(result.isMandatory).toBe(true);
    expect(result.isMandatoryMet).toBe(true);
  });

  it('defaults to met when a caller omits isMandatoryUnmet (a caller that cannot say keeps the lock)', () => {
    const result = classifyStandaloneOption({ minLimit: 1, maxLimit: 1 });
    expect(result.isMandatoryMet).toBe(true);
  });

  it('a non-mandatory row the report flags unmet is not mandatory, and its binary classification does not move', () => {
    const withoutFlag = classifyStandaloneOption({ minLimit: 1, maxLimit: 3 });
    const result = classifyStandaloneOption({ minLimit: 1, maxLimit: 3, isMandatoryUnmet: true });
    expect(result.isMandatory).toBe(false);
    expect(result.isMandatoryMet).toBe(false);
    expect(result.isBinary).toBe(withoutFlag.isBinary);
  });
});

