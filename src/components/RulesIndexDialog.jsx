import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';

export default function RulesIndexDialog({ ruleName, url, isOpen, onClose }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIframeLoaded(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content rules-index-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="text-gold" style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>
            {ruleName}
          </h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            title="Schließen"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!iframeLoaded && (
            <div className="rules-index-loading">
              <Loader2 size={32} className="spinner" />
              <p>Lade Regeltext...</p>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={url}
            title={ruleName}
            className="rules-index-iframe"
            onLoad={handleIframeLoad}
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              display: iframeLoaded ? 'block' : 'none',
            }}
            allow="clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}
