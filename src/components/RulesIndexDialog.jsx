import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, WifiOff, RefreshCw } from 'lucide-react';

// A cross-origin iframe does not reliably fire `onError`, so we also guard the
// load with a timeout: if 6th.whfb.app has not signalled `onLoad` within this
// window (offline, blocked embedding, slow network), we surface a friendly error
// instead of an endless spinner.
const LOAD_TIMEOUT_MS = 15000;

export default function RulesIndexDialog({ ruleName, url, isOpen, onClose }) {
  const { t } = useTranslation();
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
          <h3 className="text-gold" style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>
            {ruleName}
          </h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            title={t('settings.close')}
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
        <div className="modal-body" style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {loadError ? (
            <div className="rules-index-error">
              <WifiOff size={32} />
              <p>{t('rulesIndex.connectionError')}</p>
              <button type="button" className="btn" onClick={handleRetry}>
                <RefreshCw size={16} /> <span>{t('rulesIndex.retry')}</span>
              </button>
            </div>
          ) : (
            <>
              {!iframeLoaded && (
                <div className="rules-index-loading">
                  <Loader2 size={32} className="spinner" />
                  <p>{t('rulesIndex.loading')}</p>
                </div>
              )}
              <div className="rules-index-iframe-wrapper">
                <iframe
                  key={reloadKey}
                  src={url}
                  title={ruleName}
                  className="rules-index-iframe"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  style={{
                    flex: 1,
                    width: '100%',
                    border: 'none',
                    display: iframeLoaded ? 'block' : 'none',
                  }}
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
