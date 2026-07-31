import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same isolation style as listRules.test.js's `resolveListRuleGroup` describe
// block: catalogResolver and entryVisibility are mocked so this file drives
// `buildListRuleStates`' new `mandatory` field (Issue 0138, contract 3) via
// per-entry fixture flags, without depending on the real resolver/visibility
// machinery. Kept in its own file (rather than folded into
// listRules.mandatoryPredicate.test.js) because that file needs the REAL,
// unmocked catalogResolver.js/entryVisibility.js for
// findMissingMandatoryListRuleSelections — vi.mock is file-scoped and hoisted,
// so the two styles cannot coexist in one file.
const mockFindEntryInSystem = vi.fn((_system, entryId) => ({ id: entryId }));
const mockResolveEntry = vi.fn();

vi.mock('./catalogResolver.js', () => ({
  findEntryInSystem: (...args) => mockFindEntryInSystem(...args),
  resolveEntry: (...args) => mockResolveEntry(...args),
}));

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
        constraints: entry.__constraints || [],
        costs: entry.__costs || [],
        selectionEntries: entry.__children,
      };
      if (seen.has(resolved.id)) continue;
      seen.add(resolved.id);
      out.push({ entry, resolved });
    }
    return out;
  },
}));

import { resolveListRuleGroup } from './listRules.js';

describe('resolveListRuleGroup — mandatory field on each state (Issue 0138, contract 3)', () => {
  const roster = { catalogueId: 'cat' };
  const emptyForce = { id: 'f1', catalogueId: 'cat', selections: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindEntryInSystem.mockImplementation((_system, id) => ({ id }));
  });

  it('marks a state mandatory when its resolved entry satisfies the mandatory-list-rule shape (AC1)', () => {
    const mandatoryRule = {
      id: 'r-mandatory', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'The Laws of Undeath',
      __constraints: [{ id: 'c1', type: 'min', value: 1, scope: 'force' }], __costs: [],
    };
    const catalogue = { entryLinks: [mandatoryRule] };

    const { states } = resolveListRuleGroup({}, catalogue, 'cat-rules', { roster, force: emptyForce });

    expect(states.find(s => s.resolvedId === 'r-mandatory').mandatory).toBe(true);
  });

  it('marks a state not mandatory when its own min is 0 — a real opt-in switch (AC1 boundary)', () => {
    const optionalRule = {
      id: 'r-optional', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Allow experimental rules?',
      __constraints: [{ id: 'c1', type: 'min', value: 0, scope: 'force' }], __costs: [],
    };
    const catalogue = { entryLinks: [optionalRule] };

    const { states } = resolveListRuleGroup({}, catalogue, 'cat-rules', { roster, force: emptyForce });

    expect(states.find(s => s.resolvedId === 'r-optional').mandatory).toBe(false);
  });

  it('marks a state not mandatory when it carries its own follow-on choice (a container), even with min>=1 (AC2)', () => {
    const containerRule = {
      id: 'r-container', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Bloodlines',
      __constraints: [{ id: 'c1', type: 'min', value: 1, scope: 'force' }], __costs: [],
      __children: [{ id: 'child-1', name: 'Bloodline of Clan Necrarch' }],
    };
    const catalogue = { entryLinks: [containerRule] };

    const { states } = resolveListRuleGroup({}, catalogue, 'cat-rules', { roster, force: emptyForce });

    expect(states.find(s => s.resolvedId === 'r-container').mandatory).toBe(false);
  });

  // Written for Issue 0138's AC2 clause "ein kostenpflichtiger Wurzeleintrag
  // wird nicht automatisch gesetzt"; superseded by Issue 0140 criterion 1, which
  // drops the cost condition from `isUnconditionalMandatoryListRule` outright.
  // The `mandatory` flag derives from that same predicate, so a costed,
  // container-free min>=1 entry now yields `mandatory: true` — and the checklist
  // renders it as a locked, auto-checked row, per Issue 0138 AC5 unchanged.
  it('marks a state mandatory when it is container-free with min>=1, costs or not (Issue 0140 AC1)', () => {
    const costedRule = {
      id: 'r-costed', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Ogre Bulls',
      __constraints: [{ id: 'c1', type: 'min', value: 1, scope: 'force' }],
      __costs: [{ typeId: 'pts', value: 120 }],
    };
    const catalogue = { entryLinks: [costedRule] };

    const { states } = resolveListRuleGroup({}, catalogue, 'cat-rules', { roster, force: emptyForce });

    expect(states.find(s => s.resolvedId === 'r-costed').mandatory).toBe(true);
  });

  it('AC6 (first half): a hidden entry — mandatory-shaped or not — never produces a state at all', () => {
    // Pre-existing collectPrimaryCategoryEntries behaviour (unchanged by this
    // issue): hidden entries never reach buildListRuleStates in the first
    // place, so a mandatory-eligible entry that is currently hidden simply
    // has no row — nothing new to disable/hide once it re-hides itself.
    const hiddenMandatoryRule = {
      id: 'r-hidden-mandatory', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'Army of Sylvania',
      __constraints: [{ id: 'c1', type: 'min', value: 1, scope: 'force' }], __costs: [], __hidden: true,
    };
    const visibleRule = {
      id: 'r-visible', __type: 'upgrade', __primaryCat: 'cat-rules', __name: 'The Laws of Undeath',
      __constraints: [{ id: 'c1', type: 'min', value: 1, scope: 'force' }], __costs: [],
    };
    const catalogue = { entryLinks: [hiddenMandatoryRule, visibleRule] };

    const { states } = resolveListRuleGroup({}, catalogue, 'cat-rules', { roster, force: emptyForce });

    expect(states.map(s => s.resolvedId)).toEqual(['r-visible']);
  });
});
