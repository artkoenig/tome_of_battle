import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useRulesIndexDialog } from '../../../ui/viewmodels/useRulesIndexDialog';

/**
 * Issue 0177, AC3 — the ViewModel of the rules index dialog.
 *
 * The load guard is a timer, so the timers are faked: the point is that a
 * foreign iframe that never reports back turns into an error instead of an
 * endless spinner, and that a load arriving in time disarms that guard.
 */
const LOAD_TIMEOUT_MS = 15000;

function openDialog(onClose = () => {}) {
  return renderHook(
    props => useRulesIndexDialog(props),
    { initialProps: { isOpen: true, onClose } },
  );
}

describe('useRulesIndexDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts unloaded, without an error, and locks the document scroll', () => {
    const { result } = openDialog();

    expect(result.current.iframeLoaded).toBe(false);
    expect(result.current.loadError).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('reports an error when the iframe stays silent past the time limit', () => {
    const { result } = openDialog();

    act(() => { vi.advanceTimersByTime(LOAD_TIMEOUT_MS); });

    expect(result.current.loadError).toBe(true);
    expect(result.current.iframeLoaded).toBe(false);
  });

  it('a load in time disarms the time limit', () => {
    const { result } = openDialog();

    act(() => { result.current.handleIframeLoad(); });
    act(() => { vi.advanceTimersByTime(LOAD_TIMEOUT_MS * 2); });

    expect(result.current.iframeLoaded).toBe(true);
    expect(result.current.loadError).toBe(false);
  });

  it('an iframe error is reported at once', () => {
    const { result } = openDialog();

    act(() => { result.current.handleIframeError(); });

    expect(result.current.loadError).toBe(true);
  });

  it('retry clears the error, remounts the iframe by key and arms the guard again', () => {
    const { result } = openDialog();
    act(() => { result.current.handleIframeError(); });
    const keyBefore = result.current.reloadKey;

    act(() => { result.current.retry(); });

    expect(result.current.loadError).toBe(false);
    expect(result.current.iframeLoaded).toBe(false);
    expect(result.current.reloadKey).toBe(keyBefore + 1);

    act(() => { vi.advanceTimersByTime(LOAD_TIMEOUT_MS); });
    expect(result.current.loadError).toBe(true);
  });

  it('closing gives the document scroll back and drops a pending guard', () => {
    const { result, rerender } = openDialog();

    rerender({ isOpen: false, onClose: () => {} });

    expect(document.body.style.overflow).toBe('');

    act(() => { vi.advanceTimersByTime(LOAD_TIMEOUT_MS * 2); });
    expect(result.current.loadError).toBe(false);
  });

  it('Escape closes the dialog only while it is open', () => {
    const onClose = vi.fn();
    const { rerender } = openDialog(onClose);

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender({ isOpen: false, onClose });
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
