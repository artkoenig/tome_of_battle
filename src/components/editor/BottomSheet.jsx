import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  desktopMode = 'popover', // 'popover' or 'modal'
  containerRef // optional, to handle click outside
}) {
  const [renderedChildren, setRenderedChildren] = useState(isOpen ? children : null);
  const [renderedTitle, setRenderedTitle] = useState(isOpen ? title : '');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsTransitioning(true);
      setRenderedChildren(children);
      setRenderedTitle(title);
    } else {
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
        className={`bottomsheet-backdrop ${desktopMode === 'modal' ? 'desktop-modal-backdrop' : ''} ${isOpen ? 'open' : ''}`} 
        onClick={onClose} 
      />
      <div 
        className={`gothic-bottomsheet desktop-${desktopMode} ${isOpen ? 'open' : ''}`}
      >
        <div className="bottomsheet-handle" />
        <div className="bottomsheet-header">
          <span className="bottomsheet-title">{renderedTitle}</span>
          <button 
            type="button" 
            className="bottomsheet-close-btn"
            onClick={onClose}
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
