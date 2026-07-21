import React from 'react';
import { X } from 'lucide-react';

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  isDanger = false
}) {
  if (!isOpen) return null;

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
            className="modal-close modal-close--flush"
            onClick={onClose}
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
            {cancelLabel}
          </button>
          <button 
            type="button" 
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
