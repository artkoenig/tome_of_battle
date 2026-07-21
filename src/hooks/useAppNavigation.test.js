import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAppNavigation from './useAppNavigation';
import { VIEWS } from '../constants/views';

describe('useAppNavigation', () => {
  let pushStateSpy;
  let replaceStateSpy;

  beforeEach(() => {
    pushStateSpy = vi.spyOn(window.history, 'pushState');
    replaceStateSpy = vi.spyOn(window.history, 'replaceState');
  });

  afterEach(() => {
    pushStateSpy.mockRestore();
    replaceStateSpy.mockRestore();
  });

  it('startet im Heerlager ohne Auswahl', () => {
    const { result } = renderHook(() => useAppNavigation());
    expect(result.current.view).toBe(VIEWS.ROSTERS);
    expect(result.current.selectedRosterId).toBeNull();
  });

  it('legt beim Mounten einen Ausgangs-Verlaufseintrag an', () => {
    renderHook(() => useAppNavigation());
    expect(replaceStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ view: VIEWS.ROSTERS, rosterId: null }),
      ''
    );
  });

  it('schiebt bei einer neuen Ansicht einen Verlaufseintrag und aktualisiert den Zustand', () => {
    const { result } = renderHook(() => useAppNavigation());
    pushStateSpy.mockClear();

    act(() => result.current.navigate(VIEWS.BUILDER, 'roster-1'));

    expect(pushStateSpy).toHaveBeenCalledWith({ view: VIEWS.BUILDER, rosterId: 'roster-1' }, '');
    expect(result.current.view).toBe(VIEWS.BUILDER);
    expect(result.current.selectedRosterId).toBe('roster-1');
  });

  it('ersetzt den Verlaufseintrag statt zu schieben, wenn Ziel und Auswahl gleich bleiben', () => {
    const { result } = renderHook(() => useAppNavigation());
    pushStateSpy.mockClear();
    replaceStateSpy.mockClear();

    // Gleiche Ansicht, gleiche Auswahl wie der Startzustand.
    act(() => result.current.navigate(VIEWS.ROSTERS, null));

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledWith({ view: VIEWS.ROSTERS, rosterId: null }, '');
  });

  it('stellt Ansicht und Auswahl aus einem Verlaufseintrag wieder her', () => {
    const { result } = renderHook(() => useAppNavigation());

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', {
        state: { view: VIEWS.BUILDER, rosterId: 'roster-9' },
      }));
    });

    expect(result.current.view).toBe(VIEWS.BUILDER);
    expect(result.current.selectedRosterId).toBe('roster-9');
  });

  it('fällt bei einem Verlaufseintrag ohne Zustand auf das Heerlager zurück', () => {
    const { result } = renderHook(() => useAppNavigation());
    act(() => result.current.navigate(VIEWS.BUILDER, 'roster-1'));

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });

    expect(result.current.view).toBe(VIEWS.ROSTERS);
    expect(result.current.selectedRosterId).toBeNull();
  });

  it('entfernt den popstate-Listener beim Unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useAppNavigation());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    removeSpy.mockRestore();
  });
});
