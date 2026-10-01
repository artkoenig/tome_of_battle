import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRosterState } from '../../../ui/viewmodels/useRosterState';
import {
  woodElfSystem, emptyWoodElfRoster, nobleEntriesOf, defIdOf, LONG_BOW_LINK_ID, BSB_LINK_ID,
} from '../../test-utils/woodElfNobleCatalogue.js';

/**
 * Issue 0203 AC2 — the removal of an option a change hid and capped at 0 belongs
 * to that change: one undo restores both. Driven through the production seam
 * (`commands.*` of the state node, the real evaluation) over the synthetic Wood
 * Elf Noble slice.
 */

const SYSTEM = woodElfSystem();
const ENTRIES = nobleEntriesOf(SYSTEM);

const nobleOf = (result) => result.current.roster.forces[0].selections[0];
const childDefIds = (result) => nobleOf(result).selections.map(defIdOf);

function raisedNoble() {
  const rendered = renderHook(() => useRosterState(emptyWoodElfRoster(), SYSTEM, vi.fn()));
  act(() => { rendered.result.current.commands.raiseUnit(ENTRIES.noble, null); });
  return rendered;
}

describe('AC2: one undo step for the trigger and the removal', () => {
  it('ticking "Battle Standard Bearer" removes the Long Bow in the same change', () => {
    const { result } = raisedNoble();
    expect(childDefIds(result)).toContain(LONG_BOW_LINK_ID);

    act(() => { result.current.commands.subSelectionOperations.increaseCount(nobleOf(result).id, ENTRIES.bsb); });

    expect(childDefIds(result)).toContain(BSB_LINK_ID);
    expect(childDefIds(result)).not.toContain(LONG_BOW_LINK_ID);
    expect(result.current.report.violations.filter(v => v.anchor?.defId === LONG_BOW_LINK_ID)).toEqual([]);
  });

  it('one undo restores both the unticked standard and the Long Bow', () => {
    const { result } = raisedNoble();
    act(() => { result.current.commands.subSelectionOperations.increaseCount(nobleOf(result).id, ENTRIES.bsb); });

    act(() => { result.current.commands.undo(); });

    expect(childDefIds(result)).not.toContain(BSB_LINK_ID);
    expect(childDefIds(result)).toContain(LONG_BOW_LINK_ID);
  });

  it('a second undo goes back past the raise, not to an intermediate state', () => {
    const { result } = raisedNoble();
    act(() => { result.current.commands.subSelectionOperations.increaseCount(nobleOf(result).id, ENTRIES.bsb); });

    act(() => { result.current.commands.undo(); });
    act(() => { result.current.commands.undo(); });

    expect(result.current.roster.forces[0].selections).toEqual([]);
  });
});
