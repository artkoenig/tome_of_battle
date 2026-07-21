import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, WifiOff, RefreshCw } from 'lucide-react';

// A cross-origin iframe does not reliably fire `onError`, so we also guard the
// load with a timeout: if 6th.whfb.app has not signalled `onLoad` within this
// window (offline, blocked embedding, slow network), we surface a friendly error
// instead of an endless spinner.
const LOAD_TIMEOUT_MS = 15000;

export default function RulesIndexDialog({ ruleName, url, isOpen, onClose }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const timeoutRef = useRef(null);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    timeoutRef.current = setTimeout(() => setLoadError(true), LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false);
      setLoadError(false);
      document.body.style.overflow = 'hidden';
      startLoadTimeout();
    } else {
      document.body.style.overflow = '';
      setIframeLoaded(false);
      setLoadError(false);
      clearLoadTimeout();
    }
    return () => {
      document.body.style.overflow = '';
      clearLoadTimeout();
    };
  }, [isOpen, startLoadTimeout, clearLoadTimeout]);

  const handleIframeLoad = useCallback(() => {
    clearLoadTimeout();
    setLoadError(false);
    setIframeLoaded(true);
  }, [clearLoadTimeout]);

  const handleIframeError = useCallback(() => {
    clearLoadTimeout();
    setLoadError(true);
  }, [clearLoadTimeout]);

  const handleRetry = useCallback(() => {
    setIframeLoaded(false);
    setLoadError(false);
    setReloadKey((key) => key + 1);
    startLoadTimeout();
  }, [startLoadTimeout]);

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
          <h3 className="text-gold font-serif">
            {ruleName}
          </h3>
          <button
            type="button"
            className="modal-close modal-close--flush"
            onClick={onClose}
            title="Schließen"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body rules-index-body">
          {loadError ? (
            <div className="rules-index-error">
              <WifiOff size={32} />
              <p>Keine Verbindung zu 6th.whfb.app</p>
              <button type="button" className="btn" onClick={handleRetry}>
                <RefreshCw size={16} /> <span>Erneut versuchen</span>
              </button>
            </div>
          ) : (
            <>
              {!iframeLoaded && (
                <div className="rules-index-loading">
                  <Loader2 size={32} className="spinner" />
                  <p>Lade Regeltext...</p>
                </div>
              )}
              <div className="rules-index-iframe-wrapper">
                <iframe
                  key={reloadKey}
                  src={url}
                  title={ruleName}
                  className={`rules-index-iframe${iframeLoaded ? ' is-loaded' : ''}`}
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  allow="clipboard-write"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
