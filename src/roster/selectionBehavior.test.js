import { describe, it, expect } from 'vitest';
import {
  filterEntryScopedConstraints,
  isItemRepeatableWithinGroup,
  isGroupSingleChoice,
  classifyGroupItem,
  classifyStandaloneOption,
  exceedsGroupCountMax,
  wouldExceedGroupPointsLimit,
  hasGroupConstraintError,
  autofillCandidateMax
} from './selectionBehavior.js';

describe('filterEntryScopedConstraints', () => {
  const unit = { id: 'unit-1', targetId: 'unit-target', categoryLinks: [{ targetId: 'cat-hero' }] };

  it('keeps a constraint without a scope', () => {
    const constraints = [{ type: 'max', value: 1 }];
    expect(filterEntryScopedConstraints(constraints, unit)).toEqual(constraints);
  });

  it('keeps reference-frame scopes (parent/force/roster) regardless of the unit', () => {
    const constraints = [
      { type: 'max', value: 1, scope: 'parent' },
      { type: 'max', value: 2, scope: 'force' },
      { type: 'max', value: 3, scope: 'roster' }
    ];
    expect(filterEntryScopedConstraints(constraints, unit)).toEqual(constraints);
  });

  it('keeps an entry-scoped constraint that targets the unit by link id or target id', () => {
    const byLink = { type: 'max', value: 1, scope: 'unit-1' };
    const byTarget = { type: 'max', value: 1, scope: 'unit-target' };
    expect(filterEntryScopedConstraints([byLink, byTarget], unit)).toEqual([byLink, byTarget]);
  });

  it('keeps an entry-scoped constraint that targets one of the unit categories', () => {
    const byCategory = { type: 'max', value: 1, scope: 'cat-hero' };
    expect(filterEntryScopedConstraints([byCategory], unit)).toEqual([byCategory]);
  });

  it('drops an entry-scoped constraint that targets a different entry', () => {
    const foreign = { type: 'max', value: 1, scope: 'some-other-entry' };
    expect(filterEntryScopedConstraints([foreign], unit)).toEqual([]);
  });

  it('drops an entry-scoped constraint when the unit is unresolved', () => {
    const scoped = { type: 'max', value: 1, scope: 'unit-1' };
    expect(filterEntryScopedConstraints([scoped], null)).toEqual([]);
  });

  it('returns an empty array for missing constraints', () => {
    expect(filterEntryScopedConstraints(undefined, unit)).toEqual([]);
    expect(filterEntryScopedConstraints(null, unit)).toEqual([]);
  });
});

describe('isItemRepeatableWithinGroup', () => {
  const option = { id: 'opt-scroll' };
  const resolved = { id: 'opt-scroll', targetId: 'scroll-target' };
  const group = { constraints: [{ id: 'grp-max', type: 'max', value: 1 }] };

  it('is true when an increment+repeat modifier raises the group max for this item', () => {
    const groupModifiers = [
      { type: 'increment', field: 'grp-max', repeat: { childId: 'opt-scroll' } }
    ];
    expect(isItemRepeatableWithinGroup(option, resolved, group, groupModifiers)).toBe(true);
  });

  it('matches the repeat target against the resolved target id too', () => {
    const groupModifiers = [
      { type: 'increment', field: 'grp-max', repeat: { field: 'scroll-target' } }
    ];
    expect(isItemRepeatableWithinGroup(option, resolved, group, groupModifiers)).toBe(true);
  });

  it('is false when the modifier does not raise a group max constraint', () => {
    const groupModifiers = [
      { type: 'increment', field: 'unrelated', repeat: { childId: 'opt-scroll' } }
    ];
    expect(isItemRepeatableWithinGroup(option, resolved, group, groupModifiers)).toBe(false);
  });

  it('is false for a non-increment modifier or one without a repeat', () => {
    expect(isItemRepeatableWithinGroup(option, resolved, group, [
      { type: 'set', field: 'grp-max', repeat: { childId: 'opt-scroll' } }
    ])).toBe(false);
    expect(isItemRepeatableWithinGroup(option, resolved, group, [
      { type: 'increment', field: 'grp-max' }
    ])).toBe(false);
  });

  it('is false when the repeat targets a different item', () => {
    const groupModifiers = [
      { type: 'increment', field: 'grp-max', repeat: { childId: 'other-item' } }
    ];
    expect(isItemRepeatableWithinGroup(option, resolved, group, groupModifiers)).toBe(false);
  });

  it('is false when the option is unresolved', () => {
    expect(isItemRepeatableWithinGroup(option, null, group, [])).toBe(false);
  });
});

describe('isGroupSingleChoice', () => {
  it('is true for an effective max of 1 that no modifier can raise', () => {
    expect(isGroupSingleChoice(1, false)).toBe(true);
  });

  it('is false when a modifier can raise the max above 1 (armour+shield)', () => {
    expect(isGroupSingleChoice(1, true)).toBe(false);
  });

  it('is false for an unbounded group and for an effective max above 1', () => {
    expect(isGroupSingleChoice(Infinity, false)).toBe(false);
    expect(isGroupSingleChoice(2, false)).toBe(false);
  });
});

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

describe('exceedsGroupCountMax', () => {
  const base = { effectiveGroupCountMax: 2, currentCount: 0, isRadio: false, count: 0, isGroupMaxRaisable: false };

  it('is false while below the cap', () => {
    expect(exceedsGroupCountMax({ ...base, currentCount: 1 })).toBe(false);
  });

  it('blocks adding an unselected option once the cap is reached', () => {
    expect(exceedsGroupCountMax({ ...base, currentCount: 2, count: 0 })).toBe(true);
  });

  it('does not block an already-selected option at the cap', () => {
    expect(exceedsGroupCountMax({ ...base, currentCount: 2, count: 1 })).toBe(false);
  });

  it('does not block a radio at the cap (it swaps the current choice)', () => {
    expect(exceedsGroupCountMax({ ...base, currentCount: 2, count: 0, isRadio: true })).toBe(false);
  });

  it('disables the whole group when the effective max is 0', () => {
    expect(exceedsGroupCountMax({ ...base, effectiveGroupCountMax: 0, currentCount: 0 })).toBe(true);
    expect(exceedsGroupCountMax({ ...base, effectiveGroupCountMax: 0, isRadio: true })).toBe(true);
  });

  it('never clamps a max-raisable group (armour+shield)', () => {
    expect(exceedsGroupCountMax({ ...base, effectiveGroupCountMax: 1, currentCount: 1, isGroupMaxRaisable: true })).toBe(false);
  });

  it('never clamps an unbounded group', () => {
    expect(exceedsGroupCountMax({ ...base, effectiveGroupCountMax: Infinity, currentCount: 5 })).toBe(false);
  });
});

describe('wouldExceedGroupPointsLimit', () => {
  it('is false when there is no points cap', () => {
    expect(wouldExceedGroupPointsLimit({ maxPointsLimit: Infinity, activePoints: 100, points: 50, isRadio: false, count: 0 })).toBe(false);
  });

  it('blocks adding an option that pushes the bound points over the cap', () => {
    expect(wouldExceedGroupPointsLimit({ maxPointsLimit: 100, activePoints: 80, points: 30, isRadio: false, count: 0 })).toBe(true);
  });

  it('allows an option that stays within the cap', () => {
    expect(wouldExceedGroupPointsLimit({ maxPointsLimit: 100, activePoints: 80, points: 20, isRadio: false, count: 0 })).toBe(false);
  });

  it('uses the net swap cost for an unselected radio button', () => {
    // Swapping a 40pt sibling for a 50pt option nets +10; 80+10 <= 100.
    expect(wouldExceedGroupPointsLimit({
      maxPointsLimit: 100, activePoints: 80, points: 50, isRadio: true, count: 0, selectedSiblingPoints: 40
    })).toBe(false);
    // Without the swap the raw 50 would exceed.
    expect(wouldExceedGroupPointsLimit({
      maxPointsLimit: 100, activePoints: 80, points: 50, isRadio: true, count: 0, selectedSiblingPoints: null
    })).toBe(true);
  });
});

describe('hasGroupConstraintError', () => {
  it('flags a count max that is exceeded', () => {
    expect(hasGroupConstraintError([
      { finalValue: 2, isMax: true, measuresCost: false, activeCount: 3, activePoints: 0 }
    ])).toBe(true);
  });

  it('flags a cost max that is exceeded', () => {
    expect(hasGroupConstraintError([
      { finalValue: 100, isMax: true, measuresCost: true, activeCount: 0, activePoints: 120 }
    ])).toBe(true);
  });

  it('does not flag a satisfied max', () => {
    expect(hasGroupConstraintError([
      { finalValue: 2, isMax: true, measuresCost: false, activeCount: 2, activePoints: 0 }
    ])).toBe(false);
  });

  it('ignores min constraints and unbounded (negative) values', () => {
    expect(hasGroupConstraintError([
      { finalValue: 5, isMax: false, measuresCost: false, activeCount: 10, activePoints: 0 },
      { finalValue: -1, isMax: true, measuresCost: false, activeCount: 10, activePoints: 0 }
    ])).toBe(false);
  });

  it('is false for no constraints', () => {
    expect(hasGroupConstraintError([])).toBe(false);
    expect(hasGroupConstraintError(undefined)).toBe(false);
  });
});

describe('autofillCandidateMax', () => {
  it('returns the option max when there is no tighter group max', () => {
    expect(autofillCandidateMax({ optionMax: 4, isRosterUnique: false })).toBe(4);
  });

  it('takes the tighter group max', () => {
    expect(autofillCandidateMax({ optionMax: 4, groupMax: 2, isRosterUnique: false })).toBe(2);
    expect(autofillCandidateMax({ optionMax: 2, groupMax: 5, isRosterUnique: false })).toBe(2);
  });

  it('clamps a roster-unique option to 1', () => {
    expect(autofillCandidateMax({ optionMax: 4, isRosterUnique: true })).toBe(1);
  });

  it('leaves an already-tight unique limit unchanged', () => {
    expect(autofillCandidateMax({ optionMax: 1, isRosterUnique: true })).toBe(1);
  });
});
