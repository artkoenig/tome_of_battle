import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

/**
 * Issue 0165, AC1 — the ViewModel of the "new roster" modal.
 *
 * The dataset description is the seam the offer comes from (ADR-0034), so it is
 * stubbed here: the point is which catalogues and forces the form offers, not
 * what the evaluator derives from a catalogue.
 */
const describeSystem = vi.fn();
vi.mock('../../../domain/evaluation/evaluationCache', () => ({
  describeSystem: (...args) => describeSystem(...args),
}));

const { useNewRosterModal } = await import('../../../ui/viewmodels/useNewRosterModal');

const SYSTEM = { id: 'sys1', name: 'Warhammer' };
const OTHER_SYSTEM = { id: 'sys2', name: 'Mordheim' };

const description = {
  catalogues: [
    { id: 'cat1', name: 'Bretonnia' },
    { id: 'lib', name: 'Bibliothek', isLibrary: true },
  ],
  creatableForces: [
    { id: 'f-general', name: 'Armee', sourceId: 'sys1' },
    { id: 'f-bret', name: 'Bretonisches Heer', sourceId: 'cat1' },
    { id: 'f-other', name: 'Fremdes Heer', sourceId: 'lib' },
    { id: 'f-hidden', name: 'Versteckt', sourceId: 'sys1', isHidden: true },
  ],
  costTypes: [{ id: 'pts', name: 'Punkte', defaultLimit: 1500 }],
};

describe('useNewRosterModal', () => {
  it('takes catalogue, force and cost limit from the first system when it opens', () => {
    describeSystem.mockReturnValue(description);
    const { result } = renderHook(() => useNewRosterModal({
      isOpen: true, systems: [SYSTEM], onCreate: vi.fn(),
    }));

    expect(result.current.systemId).toBe('sys1');
    expect(result.current.catId).toBe('cat1');
    expect(result.current.forceEntryId).toBe('f-general');
    expect(result.current.limit).toBe(1500);
    expect(result.current.name).toBe('');
  });

  it('offers only the playable catalogues and the forces of the chosen one', () => {
    describeSystem.mockReturnValue(description);
    const { result } = renderHook(() => useNewRosterModal({
      isOpen: true, systems: [SYSTEM], onCreate: vi.fn(),
    }));

    expect(result.current.selectableCatalogues.map(c => c.id)).toEqual(['cat1']);
    // The library's own force belongs to a foreign army book and is not offered.
    expect(result.current.availableForceEntries.map(f => f.id)).toEqual(['f-general', 'f-bret']);
  });

  it('resets the form when the modal is opened again', () => {
    describeSystem.mockReturnValue(description);
    const { result, rerender } = renderHook(
      ({ isOpen }) => useNewRosterModal({ isOpen, systems: [SYSTEM], onCreate: vi.fn() }),
      { initialProps: { isOpen: true } }
    );

    act(() => result.current.setName('Mein Heer'));
    act(() => result.current.setLimit(2500));
    expect(result.current.name).toBe('Mein Heer');

    rerender({ isOpen: false });
    rerender({ isOpen: true });

    expect(result.current.name).toBe('');
    expect(result.current.limit).toBe(1500);
  });

  it('keeps the entered name while the modal stays open', () => {
    describeSystem.mockReturnValue(description);
    const { result, rerender } = renderHook(
      ({ systems }) => useNewRosterModal({ isOpen: true, systems, onCreate: vi.fn() }),
      { initialProps: { systems: [SYSTEM] } }
    );

    act(() => result.current.setName('Mein Heer'));
    // A fresh identity of the system list must not discard the input.
    rerender({ systems: [{ ...SYSTEM }] });

    expect(result.current.name).toBe('Mein Heer');
  });

  it('takes the defaults of the newly chosen system', () => {
    describeSystem.mockImplementation((system) => (system?.id === 'sys2' ? null : description));
    const { result } = renderHook(() => useNewRosterModal({
      isOpen: true, systems: [SYSTEM, OTHER_SYSTEM], onCreate: vi.fn(),
    }));

    act(() => result.current.selectSystem('sys2'));

    expect(result.current.systemId).toBe('sys2');
    expect(result.current.catId).toBe('');
    expect(result.current.forceEntryId).toBe('');
  });

  it('reports the form on submit and suppresses the browser default', () => {
    describeSystem.mockReturnValue(description);
    const onCreate = vi.fn();
    const { result } = renderHook(() => useNewRosterModal({
      isOpen: true, systems: [SYSTEM], onCreate,
    }));

    act(() => result.current.setName('Mein Heer'));
    const preventDefault = vi.fn();
    act(() => result.current.submit({ preventDefault }));

    expect(preventDefault).toHaveBeenCalled();
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Mein Heer', systemId: 'sys1', catId: 'cat1', forceEntryId: 'f-general', limit: 1500,
    });
  });
});
