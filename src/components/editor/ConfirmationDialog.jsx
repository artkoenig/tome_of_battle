import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {() => void} props.onConfirm
 * @param {string} props.title
 * @param {import('react').ReactNode} props.message
 * @param {string} [props.confirmLabel] Fallback: übersetztes `common.confirm`.
 * @param {string} [props.cancelLabel] Fallback: übersetztes `common.cancel`.
 * @param {boolean} [props.isDanger]
 */
export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDanger = false
}) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content${isDanger ? ' modal-content--danger' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-header${isDanger ? ' modal-header--danger' : ''}`}>
          <h3 className={`font-serif ${isDanger ? 'text-danger' : 'text-gold'}`}>{title}</h3>
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
        <div className="modal-body confirmation-dialog-body">
          <p className="confirmation-dialog-message">
            {message}
          </p>
        </div>
        <div className="modal-footer confirmation-dialog-footer">
          <button 
            type="button" 
            className="btn" 
            onClick={onClose}
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
