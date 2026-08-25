import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../../contexts/armylist/application/mandatoryListRules.js', () => ({
  applyMandatoryListRules: vi.fn(roster => roster),
}));

import { applyMandatoryListRules } from '../../../contexts/armylist/application/mandatoryListRules.js';
import { useMandatoryListRuleAutoAdd } from '../../../ui/viewmodels/useMandatoryListRuleAutoAdd';

/**
 * Issue 0189 — the rule itself is the use case `applyMandatoryListRules`
 * (`src/tests/contexts/armylist/mandatoryListRules.test.js`, no React). What is
 * left here is the wiring: the hook hands the current report in and commits a
 * changed roster through `replaceRoster`.
 */

const ROSTER = { id: 'r1', catalogueId: 'cat', forces: [{ id: 'f1', selections: [] }] };
const SYSTEM = { id: 'sys' };
const SLOTS = { pathOfForce: forceId => `root/${forceId}` };

function renderAutoAdd(overrides = {}) {
  const props = {
    roster: ROSTER, system: SYSTEM, slots: SLOTS, isFreshRoster: true, replaceRoster: vi.fn(),
    ...overrides,
  };
  renderHook(args => useMandatoryListRuleAutoAdd(args), { initialProps: props });
  return props;
}

beforeEach(() => {
  applyMandatoryListRules.mockReset();
  applyMandatoryListRules.mockImplementation(roster => roster);
});

describe('useMandatoryListRuleAutoAdd', () => {
  it('runs the use case with the report and the fresh-roster gate', () => {
    const props = renderAutoAdd();

    expect(applyMandatoryListRules).toHaveBeenCalledWith(ROSTER, {
      system: SYSTEM, slots: SLOTS, isFreshRoster: true,
    });
    expect(props.replaceRoster).not.toHaveBeenCalled();
  });

  it('commits a changed roster through replaceRoster', () => {
    const added = { ...ROSTER, forces: [{ id: 'f1', selections: [{ id: 's1' }] }] };
    applyMandatoryListRules.mockReturnValue(added);

    const props = renderAutoAdd();

    expect(props.replaceRoster).toHaveBeenCalledTimes(1);
    expect(props.replaceRoster).toHaveBeenCalledWith(added);
  });

  it('passes the gate through as it was given', () => {
    renderAutoAdd({ isFreshRoster: false });

    expect(applyMandatoryListRules).toHaveBeenCalledWith(
      ROSTER, expect.objectContaining({ isFreshRoster: false })
    );
  });
});
