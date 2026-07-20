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

// Enumeration helpers are mocked so materialize tests drive their behavior via
// per-entry fixture flags (__type, __primaryCat, __hidden) rather than the real
// (heavily context-dependent) primary-category / visibility logic.
vi.mock('./entryVisibility.js', () => ({
  isEntryPrimaryInCategory: (entry, categoryId) => entry.__primaryCat === categoryId,
  isSelectionEntryHidden: (entry) => !!entry.__hidden,
}));
vi.mock('./forceEntries.js', () => ({
  findForceEntryById: (system, id) => system.__forceDefs?.[id] || null,
}));

import { isListRuleEntryKind, isListRuleSelection, materializeListRules } from './listRules.js';

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

describe('materializeListRules', () => {
  // Two list rules (upgrade, primary in the rules category) and one real unit.
  const ruleA = { id: 'rA', __type: 'upgrade', __primaryCat: 'cat-rules' };
  const ruleB = { id: 'rB', __type: 'upgrade', __primaryCat: 'cat-rules' };
  const unitC = { id: 'uC', __type: 'unit', __primaryCat: 'cat-core' };

  const system = {
    catalogues: [{ id: 'cat', entryLinks: [ruleA, ruleB], selectionEntries: [unitC] }],
    __forceDefs: {
      fe: { categoryLinks: [{ targetId: 'cat-rules' }, { targetId: 'cat-core' }] },
    },
  };

  // Stand-in for useRoster.createSelectionFromDef.
  const buildSelection = (entry, categoryId) => ({
    id: `sel-${entry.id}`, entryLinkId: entry.id, category: categoryId, number: 1, selections: [],
  });

  const makeRoster = (selections) => ({
    catalogueId: 'cat',
    forces: [{ id: 'f1', forceEntryId: 'fe', catalogueId: 'cat', selections }],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEntry.mockImplementation((_system, entry) => (entry ? { id: entry.id, type: entry.__type } : null));
  });

  it('adds every missing list rule as a selection under its primary category, but no units', () => {
    const result = materializeListRules(makeRoster([]), system, buildSelection);
    expect(result).not.toBeNull();
    const sels = result.forces[0].selections;
    expect(sels.map(s => s.entryLinkId).sort()).toEqual(['rA', 'rB']);
    expect(sels.every(s => s.category === 'cat-rules')).toBe(true);
    // the real unit is never materialized here
    expect(sels.some(s => s.entryLinkId === 'uC')).toBe(false);
  });

  it('is idempotent: returns null when all list rules are already present', () => {
    const roster = makeRoster([
      { id: 's1', entryLinkId: 'rA', selections: [] },
      { id: 's2', entryLinkId: 'rB', selections: [] },
    ]);
    expect(materializeListRules(roster, system, buildSelection)).toBeNull();
  });

  it('adds only the missing rules when some are already present', () => {
    const roster = makeRoster([{ id: 's1', entryLinkId: 'rA', selections: [] }]);
    const result = materializeListRules(roster, system, buildSelection);
    expect(result).not.toBeNull();
    const refs = result.forces[0].selections.map(s => s.entryLinkId).sort();
    expect(refs).toEqual(['rA', 'rB']);
  });

  it('does not materialize a hidden list-rule entry', () => {
    const hiddenSystem = {
      catalogues: [{ id: 'cat', entryLinks: [{ ...ruleA, __hidden: true }, ruleB], selectionEntries: [] }],
      __forceDefs: system.__forceDefs,
    };
    const result = materializeListRules(makeRoster([]), hiddenSystem, buildSelection);
    expect(result.forces[0].selections.map(s => s.entryLinkId)).toEqual(['rB']);
  });

  it('returns null for a roster without forces or an unknown catalogue', () => {
    expect(materializeListRules({ forces: [] }, system, buildSelection)).toBeNull();
    expect(materializeListRules(null, system, buildSelection)).toBeNull();
    const unknownCat = makeRoster([]);
    unknownCat.forces[0].catalogueId = 'nope';
    unknownCat.catalogueId = 'nope';
    expect(materializeListRules(unknownCat, system, buildSelection)).toBeNull();
  });
});
