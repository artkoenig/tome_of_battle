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

// The shared enumeration helper is mocked so state/category tests drive behavior
// via per-entry fixture flags (__type, __primaryCat, __hidden, __name,
// __constraints, __children) rather than the real (heavily context-dependent)
// primary-category / visibility logic.
vi.mock('./entryVisibility.js', () => ({
  collectPrimaryCategoryEntries: (system, catalogue, categoryId) => {
    const pools = [
      ...(catalogue?.selectionEntries || []),
      ...(catalogue?.entryLinks || []),
      ...(catalogue?.sharedSelectionEntries || []),
    ];
    const seen = new Set();
    const out = [];
    for (const entry of pools) {
      if (entry.__primaryCat !== categoryId) continue;
      if (entry.__hidden) continue;
      const resolved = {
        id: entry.id,
        type: entry.__type,
        name: entry.__name,
        constraints: entry.__constraints,
        selectionEntries: entry.__children,
      };
      if (seen.has(resolved.id)) continue;
      seen.add(resolved.id);
      out.push({ entry, resolved });
    }
    return out;
  },
}));

import { isListRuleEntryKind, isListRuleSelection, isListRuleCategory, collectListRuleStates, resolveListRuleGroup } from './listRules.js';

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

describe('collectListRuleStates', () => {
  // A plain switch, a container (with sub-options), a non-binary rule (max>1) and a
  // real unit — all primary in the same rules category.
  const ruleSwitch = { id: 'rSwitch', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Allow special characters?' };
  const ruleContainer = {
    id: 'rContainer', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Campaign rules',
    __children: [{ id: 'child-opt' }],
  };
  const ruleMulti = {
    id: 'rMulti', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Detachments',
    __constraints: [{ type: 'max', value: 3, scope: 'roster' }],
  };
  const unitC = { id: 'uC', __type: 'unit', __primaryCat: 'cat-rules', __name: 'Some Unit' };
  const catalogue = { entryLinks: [ruleSwitch, ruleContainer, ruleMulti], selectionEntries: [unitC] };

  const makeForce = (selections) => ({ id: 'f1', catalogueId: 'cat', selections });
  const roster = { catalogueId: 'cat' };

  beforeEach(() => {
    vi.clearAllMocks();
    // A roster selection references its rule by resolved id (entryLinkId === resolved id here).
    mockFindEntryInSystem.mockImplementation((_system, id) => ({ id }));
    mockResolveEntry.mockImplementation((_system, entry) => (entry ? { id: entry.id } : null));
  });

  it('enumerates every list rule of the category, unchecked, when none are present', () => {
    const states = collectListRuleStates({}, catalogue, 'cat-rules', { roster, force: makeForce([]) });
    expect(states.map(s => s.resolvedId)).toEqual(['rSwitch', 'rContainer', 'rMulti']);
    expect(states.every(s => s.checked === false)).toBe(true);
    expect(states.every(s => s.selection === null)).toBe(true);
    expect(states.map(s => s.name)).toEqual(['Allow special characters?', 'Campaign rules', 'Detachments']);
  });

  it('marks a rule checked (with its present selection) when a selection references it', () => {
    const force = makeForce([{ id: 'sel-1', entryLinkId: 'rSwitch', selections: [] }]);
    const states = collectListRuleStates({}, catalogue, 'cat-rules', { roster, force });
    const sw = states.find(s => s.resolvedId === 'rSwitch');
    expect(sw.checked).toBe(true);
    expect(sw.selection.id).toBe('sel-1');
    expect(states.find(s => s.resolvedId === 'rContainer').checked).toBe(false);
  });

  it('classifies a plain switch as binary and a max>1 rule as non-binary (data-driven)', () => {
    const states = collectListRuleStates({}, catalogue, 'cat-rules', { roster, force: makeForce([]) });
    expect(states.find(s => s.resolvedId === 'rSwitch').isBinary).toBe(true);
    expect(states.find(s => s.resolvedId === 'rMulti').isBinary).toBe(false);
  });

  it('flags a container rule (carrying sub-options) via isContainer', () => {
    const states = collectListRuleStates({}, catalogue, 'cat-rules', { roster, force: makeForce([]) });
    expect(states.find(s => s.resolvedId === 'rContainer').isContainer).toBe(true);
    expect(states.find(s => s.resolvedId === 'rSwitch').isContainer).toBe(false);
  });

  it('excludes non-list-rule (unit) entries of the category', () => {
    const states = collectListRuleStates({}, catalogue, 'cat-rules', { roster, force: makeForce([]) });
    expect(states.some(s => s.resolvedId === 'uC')).toBe(false);
  });

  it('returns an empty list for a category with no primary entries', () => {
    expect(collectListRuleStates({}, catalogue, 'cat-none', { roster, force: makeForce([]) })).toEqual([]);
  });
});

describe('isListRuleCategory', () => {
  const ruleA = { id: 'rA', __type: 'upgrade', __primaryCat: 'cat-rules' };
  const ruleB = { id: 'rB', __type: 'upgrade', __primaryCat: 'cat-rules' };
  const unitC = { id: 'uC', __type: 'unit', __primaryCat: 'cat-core' };
  const catalogue = { entryLinks: [ruleA, ruleB], selectionEntries: [unitC] };

  it('is true when every primary entry of the category is a list rule', () => {
    expect(isListRuleCategory({}, catalogue, 'cat-rules', {})).toBe(true);
  });

  it('is false for a unit category', () => {
    expect(isListRuleCategory({}, catalogue, 'cat-core', {})).toBe(false);
  });

  it('is false for a category with no primary entries', () => {
    expect(isListRuleCategory({}, catalogue, 'cat-none', {})).toBe(false);
  });
});

describe('resolveListRuleGroup', () => {
  // A pure rules category and a mixed one (unit + rule) sharing the same catalog.
  const ruleA = { id: 'rA', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Allow experimental rules?' };
  const ruleB = { id: 'rB', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Campaign rules' };
  const ruleC = { id: 'rC', __type: 'upgrade', __primaryCat: 'cat-mixed', __name: 'A Rule' };
  const unitU = { id: 'uU', __type: 'unit', __primaryCat: 'cat-mixed', __name: 'Some Unit' };
  const catalogue = { entryLinks: [ruleA, ruleB, ruleC], selectionEntries: [unitU] };

  const roster = { catalogueId: 'cat' };
  const makeForce = (selections) => ({ id: 'f1', catalogueId: 'cat', selections });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindEntryInSystem.mockImplementation((_system, id) => ({ id }));
    // Selections resolve to a typed entry; the fixture encodes the type in the id
    // prefix ('u…' = unit, otherwise upgrade) so isListRuleSelection can classify.
    mockResolveEntry.mockImplementation((_system, entry) =>
      entry ? { id: entry.id, type: entry.id.startsWith('u') ? 'unit' : 'upgrade' } : null
    );
  });

  it('classifies a still-empty category as a group when all primary entries are list rules, and yields their states', () => {
    const { isListRuleGroup, states } = resolveListRuleGroup({}, catalogue, 'cat-rules', { roster, force: makeForce([]) });
    expect(isListRuleGroup).toBe(true);
    expect(states.map(s => s.resolvedId)).toEqual(['rA', 'rB']);
    expect(states.every(s => s.checked === false)).toBe(true);
  });

  it('does not classify a mixed category (units + rules) as a group, and returns no states', () => {
    const { isListRuleGroup, states } = resolveListRuleGroup({}, catalogue, 'cat-mixed', { roster, force: makeForce([]) });
    expect(isListRuleGroup).toBe(false);
    expect(states).toEqual([]);
  });

  it('judges a non-empty category by its selections — all list rules make it a group, and the present rule is checked', () => {
    const force = makeForce([{ id: 'sel-1', category: 'cat-rules', entryLinkId: 'rA' }]);
    const { isListRuleGroup, states } = resolveListRuleGroup({}, catalogue, 'cat-rules', { roster, force });
    expect(isListRuleGroup).toBe(true);
    expect(states.find(s => s.resolvedId === 'rA').checked).toBe(true);
    expect(states.find(s => s.resolvedId === 'rB').checked).toBe(false);
  });

  it('is not a group when a present selection is a real unit', () => {
    const force = makeForce([{ id: 'sel-u', category: 'cat-mixed', entryLinkId: 'uU' }]);
    const { isListRuleGroup, states } = resolveListRuleGroup({}, catalogue, 'cat-mixed', { roster, force });
    expect(isListRuleGroup).toBe(false);
    expect(states).toEqual([]);
  });
});
