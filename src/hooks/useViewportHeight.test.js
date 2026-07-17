import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useViewportHeight, {
  VIEWPORT_HEIGHT_PROPERTY,
  getVisibleViewportHeight,
  syncViewportHeightProperty,
} from './useViewportHeight';

const RESIZE_EVENT = 'resize';
const SCROLL_EVENT = 'scroll';

// Minimal fake of the VisualViewport API: records event listeners and lets a
// test change the reported height and emit an event, mirroring a mobile browser
// whose chrome (address bar) collapses/expands.
function createFakeVisualViewport(initialHeight) {
  const listenersByType = {};
  return {
    height: initialHeight,
    addEventListener(type, callback) {
      listenersByType[type] = listenersByType[type] || [];
      listenersByType[type].push(callback);
    },
    removeEventListener(type, callback) {
      listenersByType[type] = (listenersByType[type] || []).filter(
        (registered) => registered !== callback,
      );
    },
    emit(type) {
      (listenersByType[type] || []).forEach((callback) => callback());
    },
    listenerCount(type) {
      return (listenersByType[type] || []).length;
    },
  };
}

function defineWindowProperty(name, value) {
  Object.defineProperty(window, name, { configurable: true, value });
}

function readViewportHeightProperty() {
  return document.documentElement.style.getPropertyValue(VIEWPORT_HEIGHT_PROPERTY);
}

describe('useViewportHeight utilities', () => {
  let originalVisualViewport;
  let originalInnerHeight;

  beforeEach(() => {
    originalVisualViewport = window.visualViewport;
    originalInnerHeight = window.innerHeight;
    document.documentElement.style.removeProperty(VIEWPORT_HEIGHT_PROPERTY);
  });

  afterEach(() => {
    defineWindowProperty('visualViewport', originalVisualViewport);
    defineWindowProperty('innerHeight', originalInnerHeight);
    document.documentElement.style.removeProperty(VIEWPORT_HEIGHT_PROPERTY);
  });

  describe('getVisibleViewportHeight', () => {
    it('prefers the VisualViewport height when the API is available', () => {
      defineWindowProperty('visualViewport', createFakeVisualViewport(640));

      expect(getVisibleViewportHeight()).toBe(640);
    });

    it('falls back to window.innerHeight when VisualViewport is unavailable', () => {
      defineWindowProperty('visualViewport', undefined);
      defineWindowProperty('innerHeight', 900);

      expect(getVisibleViewportHeight()).toBe(900);
    });
  });

  describe('syncViewportHeightProperty', () => {
    it('writes the visible viewport height as a pixel value', () => {
      defineWindowProperty('visualViewport', createFakeVisualViewport(512));

      syncViewportHeightProperty();

      expect(readViewportHeightProperty()).toBe('512px');
    });
  });

  describe('useViewportHeight hook', () => {
    it('sets the custom property to the current visible height on mount', () => {
      defineWindowProperty('visualViewport', createFakeVisualViewport(600));

      renderHook(() => useViewportHeight());

      expect(readViewportHeightProperty()).toBe('600px');
    });

    it('updates the custom property when the visual viewport resizes', () => {
      const fakeVisualViewport = createFakeVisualViewport(600);
      defineWindowProperty('visualViewport', fakeVisualViewport);

      renderHook(() => useViewportHeight());
      expect(readViewportHeightProperty()).toBe('600px');

      fakeVisualViewport.height = 812;
      fakeVisualViewport.emit(RESIZE_EVENT);

      expect(readViewportHeightProperty()).toBe('812px');
    });

    it('updates the custom property when the visual viewport scrolls', () => {
      const fakeVisualViewport = createFakeVisualViewport(600);
      defineWindowProperty('visualViewport', fakeVisualViewport);

      renderHook(() => useViewportHeight());

      fakeVisualViewport.height = 720;
      fakeVisualViewport.emit(SCROLL_EVENT);

      expect(readViewportHeightProperty()).toBe('720px');
    });

    it('detaches all visual viewport listeners on unmount', () => {
      const fakeVisualViewport = createFakeVisualViewport(600);
      defineWindowProperty('visualViewport', fakeVisualViewport);

      const { unmount } = renderHook(() => useViewportHeight());
      expect(fakeVisualViewport.listenerCount(RESIZE_EVENT)).toBe(1);
      expect(fakeVisualViewport.listenerCount(SCROLL_EVENT)).toBe(1);

      unmount();

      expect(fakeVisualViewport.listenerCount(RESIZE_EVENT)).toBe(0);
      expect(fakeVisualViewport.listenerCount(SCROLL_EVENT)).toBe(0);
    });

    it('still sets the property when VisualViewport is unavailable', () => {
      defineWindowProperty('visualViewport', undefined);
      defineWindowProperty('innerHeight', 480);

      renderHook(() => useViewportHeight());

      expect(readViewportHeightProperty()).toBe('480px');
    });
  });
});
