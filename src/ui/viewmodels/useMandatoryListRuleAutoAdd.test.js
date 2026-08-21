import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../domain/evaluation/mandatoryListRules', () => ({
  findMissingMandatoryListRules: vi.fn(() => []),
}));
vi.mock('./capabilityEntries', () => ({
  findCapabilityEntry: vi.fn(capability => ({ id: capability.defId, name: capability.defId })),
}));

import { findMissingMandatoryListRules } from '../../domain/evaluation/mandatoryListRules';
import { useMandatoryListRuleAutoAdd } from './useMandatoryListRuleAutoAdd';

/**
 * Issue 0176 — the fresh-roster auto-add of mandatory list rules, cut out of
 * `useRosterState`. What the report reports is mocked here; what this hook does
 * with it — the gate, the already carried entries, the army-wide claim across
 * forces and the write through `replaceRoster` — is the subject.
 */

const SYSTEM = { id: 'sys' };

function slotsStub() {
  return { pathOfForce: forceId => `slot:${forceId}` };
}

function missing(defId, resolvedId = defId) {
  return { entry: { id: defId, name: defId }, defId, resolvedId, categoryId: null, mandatoryMembers: [] };
}

function renderAutoAdd(overrides = {}) {
  const props = {
    roster: { id: 'r1', catalogueId: 'cat', forces: [{ id: 'f1', selections: [] }] },
    system: SYSTEM,
    slots: slotsStub(),
    isFreshRoster: true,
    replaceRoster: vi.fn(),
    ...overrides,
  };
  renderHook(args => useMandatoryListRuleAutoAdd(args), { initialProps: props });
  return props;
}

beforeEach(() => {
  findMissingMandatoryListRules.mockReset();
  findMissingMandatoryListRules.mockReturnValue([]);
});

describe('useMandatoryListRuleAutoAdd', () => {
  it('adds the missing mandatory rule to a fresh roster', () => {
    findMissingMandatoryListRules.mockReturnValue([missing('rule-1')]);
    const props = renderAutoAdd();

    expect(props.replaceRoster).toHaveBeenCalledTimes(1);
    const [written] = props.replaceRoster.mock.calls[0];
    expect(written.forces[0].selections).toEqual([
      expect.objectContaining({ name: 'rule-1', selectionEntryId: 'rule-1' }),
    ]);
  });

  it('leaves an existing roster untouched', () => {
    findMissingMandatoryListRules.mockReturnValue([missing('rule-1')]);
    const props = renderAutoAdd({ isFreshRoster: false });

    expect(props.replaceRoster).not.toHaveBeenCalled();
    expect(findMissingMandatoryListRules).not.toHaveBeenCalled();
  });

  it('writes nothing when the report reports no missing rule', () => {
    const props = renderAutoAdd();

    expect(props.replaceRoster).not.toHaveBeenCalled();
  });

  it('skips a rule the force already carries', () => {
    findMissingMandatoryListRules.mockReturnValue([missing('rule-1')]);
    const props = renderAutoAdd({
      roster: {
        id: 'r1',
        catalogueId: 'cat',
        forces: [{ id: 'f1', selections: [{ id: 's1', selectionEntryId: 'rule-1', selections: [] }] }],
      },
    });

    expect(props.replaceRoster).not.toHaveBeenCalled();
  });

  it('claims an army-wide rule once across the forces of one pass', () => {
    findMissingMandatoryListRules.mockImplementation((_slots, _path, { skipResolvedIds }) =>
      skipResolvedIds.has('rule-1') ? [] : [missing('rule-1')]);
    const props = renderAutoAdd({
      roster: {
        id: 'r1',
        catalogueId: 'cat',
        forces: [{ id: 'f1', selections: [] }, { id: 'f2', selections: [] }],
      },
    });

    const [written] = props.replaceRoster.mock.calls[0];
    expect(written.forces[0].selections).toHaveLength(1);
    expect(written.forces[1].selections).toHaveLength(0);
  });

  it('asks the report for each force at its own slot path', () => {
    renderAutoAdd({
      roster: {
        id: 'r1',
        catalogueId: 'cat',
        forces: [{ id: 'f1', selections: [] }, { id: 'f2', selections: [] }],
      },
    });

    expect(findMissingMandatoryListRules.mock.calls.map(call => call[1]))
      .toEqual(['slot:f1', 'slot:f2']);
  });
});
