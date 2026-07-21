import { describe, it, expect } from 'vitest';
import { getProfileCellClassName } from './profileCellClasses';

describe('getProfileCellClassName', () => {
  it('returns only the base class for an unmodified characteristic', () => {
    expect(getProfileCellClassName(null)).toBe('font-body');
    expect(getProfileCellClassName(undefined)).toBe('font-body');
  });

  it('marks an improved value as positive', () => {
    expect(getProfileCellClassName('positive'))
      .toBe('font-body text-success profile-cell--positive');
  });

  it('marks a worsened value as negative', () => {
    expect(getProfileCellClassName('negative'))
      .toBe('font-body text-danger profile-cell--negative');
  });

  it('marks a non-numeric change as modified', () => {
    expect(getProfileCellClassName('modified'))
      .toBe('font-body text-gold profile-cell--modified');
  });

  it('falls back to the base class for an unknown state', () => {
    expect(getProfileCellClassName('something-else')).toBe('font-body');
  });
});
