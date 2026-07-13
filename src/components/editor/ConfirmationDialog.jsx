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
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={isDanger ? { borderColor: 'var(--color-danger)' } : {}}
      >
        <div className="modal-header" style={isDanger ? { borderBottomColor: 'rgba(166, 28, 28, 0.3)' } : {}}>
          <h3 className={isDanger ? 'text-danger' : 'text-gold'} style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>{title}</h3>
          <button 
            type="button" 
            className="modal-close" 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-dim)', 
              cursor: 'pointer',
              fontSize: '18px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '16px 0 24px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-parchment)', fontSize: 'var(--fs-body)', margin: 0 }}>
            {message}
          </p>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'center', borderTop: 'none', padding: 0 }}>
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
