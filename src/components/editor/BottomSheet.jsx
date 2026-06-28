import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  desktopMode = 'popover', // 'popover' or 'modal'
  containerRef // optional, to handle click outside
}) {
  const innerRef = useRef(null);

  // Close on click outside for desktop popover or modal
  useEffect(() => {
    function handleClickOutside(event) {
      if (!isOpen) return;
      
      // On mobile, backdrop covers screen, so handled by backdrop onClick.
      // On desktop:
      if (window.innerWidth > 900) {
        if (desktopMode === 'popover') {
          // Check if click was outside popover and outside the container
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

  if (!isOpen) return null;

  return (
    <>
      <div className="bottomsheet-backdrop" onClick={onClose} />
      <div 
        ref={innerRef} 
        className={`gothic-bottomsheet desktop-${desktopMode}`}
      >
        <div className="bottomsheet-handle" />
        <div className="bottomsheet-header">
          <span className="bottomsheet-title">{title}</span>
          <button 
            type="button" 
            className="bottomsheet-close-btn"
            onClick={onClose}
            title="Schließen"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
