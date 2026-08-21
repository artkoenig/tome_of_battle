import React from 'react';
import { X } from 'lucide-react';
import { useBottomSheet } from '../../viewmodels/useBottomSheet';
import { useTranslation } from '../../i18n/useTranslation';

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  desktopMode = 'popover', // 'popover' or 'modal'
  containerRef = null // optional, to handle click outside
}) {
  const { t } = useTranslation();
  const { innerRef, renderedChildren, renderedTitle, activeClass, isRendered } =
    useBottomSheet({ isOpen, onClose, title, children, desktopMode, containerRef });

  if (!isRendered) return null;

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
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        {renderedChildren}
      </div>
    </>
  );
}
