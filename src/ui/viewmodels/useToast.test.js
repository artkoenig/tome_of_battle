import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useToast from './useToast';

const TOAST_DURATION_MS = 3000;

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startet ohne Toast', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it('zeigt eine Erfolgsmeldung als Standardtyp', () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.showToast('Gespeichert'));

    expect(result.current.toast).toEqual({ message: 'Gespeichert', type: 'success' });
  });

  it('übernimmt einen ausdrücklich gesetzten Typ', () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.showToast('Achtung', 'info'));

    expect(result.current.toast).toEqual({ message: 'Achtung', type: 'info' });
  });

  it('blendet den Fehlerkanal als Fehler-Toast ein', () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.reportError('Etwas ging schief'));

    expect(result.current.toast).toEqual({ message: 'Etwas ging schief', type: 'error' });
  });

  it('blendet den Toast nach Ablauf der Anzeigedauer wieder aus', () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.showToast('Gespeichert'));
    expect(result.current.toast).not.toBeNull();

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));

    expect(result.current.toast).toBeNull();
  });

  it('setzt den Ausblende-Timer bei einer neuen Meldung zurück', () => {
    const { result } = renderHook(() => useToast());

    act(() => result.current.showToast('Erste'));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 500));
    // Zweite Meldung kurz vor Ablauf: der Timer der ersten darf sie nicht ausblenden.
    act(() => result.current.showToast('Zweite'));
    act(() => vi.advanceTimersByTime(600));

    expect(result.current.toast).toEqual({ message: 'Zweite', type: 'success' });

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(result.current.toast).toBeNull();
  });
});
