import { useEffect } from 'react';

/**
 * Name of the CSS custom property that mirrors the real visible viewport
 * height. `#root` and `.empty-state-wrapper` in `index.css` consume it as their
 * primary height source, while their static `vh`/`dvh` rules remain as a
 * fallback for browsers without the VisualViewport API (or before this hook has
 * run).
 */
export const VIEWPORT_HEIGHT_PROPERTY = '--app-vh';

/**
 * Reads the current visible viewport height in CSS pixels. Prefers the
 * VisualViewport API — which reflects the area actually visible to the user and
 * shrinks/grows as mobile browser chrome (e.g. a collapsing address bar in
 * DuckDuckGo) appears and disappears — and falls back to `window.innerHeight`
 * where that API is unavailable.
 * @returns {number} visible viewport height in CSS pixels
 */
export function getVisibleViewportHeight() {
  const { visualViewport } = window;
  if (visualViewport && typeof visualViewport.height === 'number') {
    return visualViewport.height;
  }
  return window.innerHeight;
}

/**
 * Writes the current visible viewport height into
 * {@link VIEWPORT_HEIGHT_PROPERTY} on the document root, so layout rules can
 * size elements against the genuinely visible area rather than the layout
 * viewport.
 */
export function syncViewportHeightProperty() {
  const visibleHeight = getVisibleViewportHeight();
  document.documentElement.style.setProperty(
    VIEWPORT_HEIGHT_PROPERTY,
    `${visibleHeight}px`,
  );
}

/**
 * React hook that keeps {@link VIEWPORT_HEIGHT_PROPERTY} in sync with the real
 * visible viewport height for the lifetime of the mounting component. It writes
 * the property once on mount and again whenever the visual viewport resizes or
 * scrolls (both signal browser chrome collapsing/expanding) or the window
 * resizes.
 */
export default function useViewportHeight() {
  useEffect(() => {
    syncViewportHeightProperty();

    const { visualViewport } = window;
    if (visualViewport) {
      visualViewport.addEventListener('resize', syncViewportHeightProperty);
      visualViewport.addEventListener('scroll', syncViewportHeightProperty);
    }
    window.addEventListener('resize', syncViewportHeightProperty);

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', syncViewportHeightProperty);
        visualViewport.removeEventListener('scroll', syncViewportHeightProperty);
      }
      window.removeEventListener('resize', syncViewportHeightProperty);
    };
  }, []);
}
