import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useBottomSheet } from '../../../ui/viewmodels/useBottomSheet';

/**
 * Issue 0177, AC3 — the ViewModel of the bottom sheet.
 *
 * The three effects are timed and window-width dependent, so the timers are
 * faked and `window.innerWidth` is set per case: the point is what the sheet
 * still renders while it closes, when the outside click fires and when the
 * document scroll lock is held.
 */
const CLOSE_TRANSITION_MS = 300;
const OPEN_PAINT_DELAY_MS = 40;

function setWidth(width) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
}

describe('useBottomSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setWidth(1200);
    document.body.style.overflow = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the contents at once and turns the open class on after the paint delay', () => {
    const { result } = renderHook(() => useBottomSheet({
      isOpen: true, onClose: () => {}, title: 'Options', children: 'body',
    }));

    expect(result.current.renderedChildren).toBe('body');
    expect(result.current.renderedTitle).toBe('Options');
    expect(result.current.activeClass).toBe(false);

    act(() => { vi.advanceTimersByTime(OPEN_PAINT_DELAY_MS); });

    expect(result.current.activeClass).toBe(true);
    expect(result.current.isRendered).toBe(true);
  });

  it('keeps the contents standing through the close transition and renders nothing after it', () => {
    const { result, rerender } = renderHook(
      props => useBottomSheet(props),
      { initialProps: { isOpen: true, onClose: () => {}, title: 'Options', children: 'body' } },
    );
    act(() => { vi.advanceTimersByTime(OPEN_PAINT_DELAY_MS); });

    rerender({ isOpen: false, onClose: () => {}, title: 'Options', children: 'body' });

    expect(result.current.activeClass).toBe(false);
    expect(result.current.renderedChildren).toBe('body');
    expect(result.current.isRendered).toBe(true);

    act(() => { vi.advanceTimersByTime(CLOSE_TRANSITION_MS); });

    expect(result.current.renderedChildren).toBeNull();
    expect(result.current.renderedTitle).toBe('');
    expect(result.current.isRendered).toBe(false);
  });

  it('closes on a click beside the popover on the desktop', () => {
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const outside = document.createElement('button');
    document.body.append(outside);

    renderHook(() => useBottomSheet({
      isOpen: true, onClose, title: '', children: null, containerRef: { current: container },
    }));

    act(() => { container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(onClose).not.toHaveBeenCalled();

    act(() => { outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(onClose).toHaveBeenCalledTimes(1);

    container.remove();
    outside.remove();
  });

  it('ignores the outside click on the phone, where the sheet is not a popover', () => {
    setWidth(500);
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);

    renderHook(() => useBottomSheet({
      isOpen: true, onClose, title: '', children: null, containerRef: { current: container },
    }));

    act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });

    expect(onClose).not.toHaveBeenCalled();
    container.remove();
  });

  it('locks the document scroll on the phone only, and gives it back on close', () => {
    setWidth(500);
    const { rerender, unmount } = renderHook(
      props => useBottomSheet(props),
      { initialProps: { isOpen: true, onClose: () => {}, title: '', children: null } },
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender({ isOpen: false, onClose: () => {}, title: '', children: null });
    expect(document.body.style.overflow).not.toBe('hidden');

    unmount();

    setWidth(1200);
    renderHook(() => useBottomSheet({ isOpen: true, onClose: () => {}, title: '', children: null }));
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
