import { useEffect, useRef, useState } from 'react';

/**
 * ViewModel des Bottom Sheets (ADR-0038).
 *
 * Die drei Effekte des Bildschirmelements liegen hier: die Ein-/Ausblende-
 * Übergänge samt der Inhalte, die während des Ausblendens noch stehen bleiben,
 * das Schließen bei einem Klick daneben und die Scroll-Sperre auf dem Handy.
 */

// Muss zur Übergangsdauer im Stylesheet passen.
const CLOSE_TRANSITION_MS = 300;
// Kleine Verzögerung, damit der Einblende-Übergang zuverlässig läuft.
const OPEN_PAINT_DELAY_MS = 40;
const MOBILE_MAX_WIDTH = 900;

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   title: any,
 *   children: any,
 *   desktopMode?: string,
 *   containerRef?: { current: HTMLElement|null }|null,
 * }} args
 */
export function useBottomSheet({ isOpen, onClose, title, children, desktopMode = 'popover', containerRef = null }) {
  const [renderedChildren, setRenderedChildren] = useState(isOpen ? children : null);
  const [renderedTitle, setRenderedTitle] = useState(isOpen ? title : '');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeClass, setActiveClass] = useState(false);
  /** @type {import('react').RefObject<HTMLDivElement|null>} */
  const innerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsTransitioning(true);
      setRenderedChildren(children);
      setRenderedTitle(title);

      // Ein erzwungener Layout-Durchlauf (`offsetHeight`) stellt sicher, dass
      // der Browser den geschlossenen Zustand (translateY(100%)) zuerst sieht.
      if (innerRef.current) {
        const _ = innerRef.current.offsetHeight;
      }

      const delayTimer = setTimeout(() => setActiveClass(true), OPEN_PAINT_DELAY_MS);
      return () => clearTimeout(delayTimer);
    }

    setActiveClass(false);
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setRenderedChildren(null);
      setRenderedTitle('');
      setIsTransitioning(false);
    }, CLOSE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [isOpen, children, title]);

  // Klick daneben schließt das Popover auf dem Desktop.
  useEffect(() => {
    function handleClickOutside(event) {
      if (!isOpen) return;
      if (window.innerWidth <= MOBILE_MAX_WIDTH) return;
      if (desktopMode !== 'popover') return;
      if (containerRef?.current && !containerRef.current.contains(event.target)) onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, desktopMode, containerRef]);

  // Scroll-Sperre des Dokuments auf dem Handy.
  useEffect(() => {
    if (isOpen && window.innerWidth <= MOBILE_MAX_WIDTH) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = originalStyle; };
    }
    return undefined;
  }, [isOpen]);

  return {
    innerRef,
    renderedChildren,
    renderedTitle,
    activeClass,
    // Geschlossen und nicht mehr im Übergang: dann rendert das Element nichts.
    isRendered: isOpen || isTransitioning,
  };
}
