import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRosterState } from '../../../../ui/viewmodels/useRosterState';
import { buildStandaloneSection } from '../../../../ui/viewmodels/editor/standaloneRow';
import {
  woodElfSystem, emptyWoodElfRoster, nobleEntriesOf, GENERAL_LINK_ID, CATALOGUE_ID, PTS_ID,
} from '../../../test-utils/woodElfNobleCatalogue.js';

/**
 * Issue 0204 — "General" on the Wood Elf Noble carries max 1, and a modifier sets
 * it to 0 once the Noble holds "Battle Standard Bearer". Driven through the
 * production seam (the real report of the state node): the report names the
 * declared max next to the effective one, and the row stays a checkbox, disabled.
 */

const SYSTEM = woodElfSystem();
const ENTRIES = nobleEntriesOf(SYSTEM);

const nobleOf = (result) => result.current.roster.forces[0].selections[0];

function raisedNoble() {
  const rendered = renderHook(() => useRosterState(emptyWoodElfRoster(), SYSTEM, vi.fn()));
  act(() => { rendered.result.current.commands.raiseUnit(ENTRIES.noble, null); });
  return rendered;
}

function generalRowOf(result) {
  const noble = nobleOf(result);
  const slots = result.current.report.slots;
  const noblePath = slots.pathOfSelection(noble.id);
  const capability = slots.findChildSlot(noblePath, GENERAL_LINK_ID);
  const row = buildStandaloneSection({
    frameSelection: noble,
    path: `${noblePath}/general`,
    capability,
    option: ENTRIES.general,
    context: {
      system: SYSTEM,
      activeCatalogueId: CATALOGUE_ID,
      costTypeId: PTS_ID,
      costTypeLabel: 'pts',
      subSelectionOperations: result.current.commands.subSelectionOperations,
    },
  });
  return { capability, row };
}

describe('Issue 0204: a single-choice option a modifier caps at zero', () => {
  it('AC3: without the standard "General" is an enabled checkbox with declared and effective max 1', () => {
    const { result } = raisedNoble();

    const { capability, row } = generalRowOf(result);

    expect(capability).toMatchObject({ effectiveMax: 1, declaredMax: 1 });
    expect(row).toMatchObject({ isBinary: true, isSelectDisabled: false, isClickable: true });
  });

  it('AC1: with the standard "General" stays a checkbox, shown disabled, not a stepper', () => {
    const { result } = raisedNoble();
    act(() => { result.current.commands.subSelectionOperations.increaseCount(nobleOf(result).id, ENTRIES.bsb); });

    const { capability, row } = generalRowOf(result);

    expect(capability).toMatchObject({ effectiveMax: 0, declaredMax: 1 });
    expect(row).toMatchObject({ isBinary: true, isSelectDisabled: true, isUnavailable: true, isClickable: false });
  });
});
