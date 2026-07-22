import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  desktopMode = 'popover', // 'popover' or 'modal'
  containerRef = null // optional, to handle click outside
}) {
  const [renderedChildren, setRenderedChildren] = useState(isOpen ? children : null);
  const [renderedTitle, setRenderedTitle] = useState(isOpen ? title : '');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeClass, setActiveClass] = useState(false);
  const innerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsTransitioning(true);
      setRenderedChildren(children);
      setRenderedTitle(title);
      
      // Force layout reflow by accessing offsetHeight to guarantee the browser
      // registers the closed state (translateY(100%)) in the DOM first.
      if (innerRef.current) {
        const _ = innerRef.current.offsetHeight;
      }

      // Small paint delay to ensure the entry transition runs reliably
      const delayTimer = setTimeout(() => {
        setActiveClass(true);
      }, 40);
      return () => clearTimeout(delayTimer);
    } else {
      setActiveClass(false);
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setRenderedChildren(null);
        setRenderedTitle('');
        setIsTransitioning(false);
      }, 300); // 300ms matches CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen, children, title]);

  // Close on click outside for desktop popover or modal
  useEffect(() => {
    function handleClickOutside(event) {
      if (!isOpen) return;
      
      if (window.innerWidth > 900) {
        if (desktopMode === 'popover') {
          if (containerRef?.current && !containerRef.current.contains(event.target)) {
            onClose();
          }
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, desktopMode, containerRef]);

  // Lock body scroll on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth <= 900) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Do not render anything if closed and not transitioning
  if (!isOpen && !isTransitioning) return null;

  return (
    <>
      <div 
        className={`bottomsheet-backdrop ${desktopMode === 'modal' ? 'desktop-modal-backdrop' : ''} ${activeClass ? 'open' : ''}`} 
        onClick={onClose} 
      />
      <div 
        ref={innerRef}
        className={`gothic-bottomsheet desktop-${desktopMode} ${activeClass ? 'open' : ''}`}
      >
        <div className="bottomsheet-handle" />
        <div className="bottomsheet-header">
          <span className="bottomsheet-title">{renderedTitle}</span>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            aria-label="Schließen"
            title="Schließen"
          >
            <X size={18} />
          </button>
        </div>
        {renderedChildren}
      </div>
    </>
  );
}
