import { describe, it, expect, vi, beforeEach } from 'vitest';

// Isolate the classification logic from the (heavy) catalog resolver: the
// resolver has its own tests, here we only assert how listRules interprets a
// resolved entry's `type`.
const mockFindEntryInSystem = vi.fn((_system, entryId) => ({ id: entryId }));
const mockResolveEntry = vi.fn();

vi.mock('./catalogResolver.js', () => ({
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  resolveEntry: (...args) => mockResolveEntry(...args),
}));

import { isListRuleEntryKind, isListRuleSelection } from './listRules.js';

describe('isListRuleEntryKind', () => {
  it('classifies only the upgrade type as a list rule', () => {
    expect(isListRuleEntryKind('upgrade')).toBe(true);
  });

  it('does not classify battlefield entities (unit, model) as list rules', () => {
    expect(isListRuleEntryKind('unit')).toBe(false);
    expect(isListRuleEntryKind('model')).toBe(false);
  });

  it('does not classify an unknown or missing type as a list rule', () => {
    expect(isListRuleEntryKind(undefined)).toBe(false);
    expect(isListRuleEntryKind(null)).toBe(false);
    expect(isListRuleEntryKind('category')).toBe(false);
  });
});

describe('isListRuleSelection', () => {
  const system = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindEntryInSystem.mockImplementation((_system, entryId) => ({ id: entryId }));
  });

  it('recognizes a root selection whose resolved entry type is upgrade', () => {
    mockResolveEntry.mockReturnValue({ id: 'r', type: 'upgrade' });
    const selection = { id: 'sel-rule', entryLinkId: 'el-rule' };
    expect(isListRuleSelection(system, selection, 'cat-1')).toBe(true);
  });

  it('does not recognize a real unit (type unit) as a list rule', () => {
    mockResolveEntry.mockReturnValue({ id: 'r', type: 'unit' });
    const selection = { id: 'sel-unit', entryLinkId: 'el-unit' };
    expect(isListRuleSelection(system, selection, 'cat-1')).toBe(false);
  });

  it('resolves via selectionEntryId when no entryLinkId is present', () => {
    mockResolveEntry.mockReturnValue({ id: 'r', type: 'upgrade' });
    const selection = { id: 'sel-rule', selectionEntryId: 'se-rule' };
    expect(isListRuleSelection(system, selection, 'cat-1')).toBe(true);
    expect(mockFindEntryInSystem).toHaveBeenCalledWith(system, 'se-rule', 'cat-1');
  });

  it('returns false when the entry cannot be resolved', () => {
    mockResolveEntry.mockReturnValue(null);
    const selection = { id: 'sel-x', entryLinkId: 'el-x' };
    expect(isListRuleSelection(system, selection, 'cat-1')).toBe(false);
  });

  it('returns false for a nullish selection or one without an entry reference', () => {
    expect(isListRuleSelection(system, null, 'cat-1')).toBe(false);
    expect(isListRuleSelection(system, { id: 'no-ref' }, 'cat-1')).toBe(false);
    expect(mockResolveEntry).not.toHaveBeenCalled();
  });
});
