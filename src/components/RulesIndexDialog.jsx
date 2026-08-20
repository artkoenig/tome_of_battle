import React from 'react';
import { X, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { useRulesIndexDialog } from '../viewmodels/useRulesIndexDialog';
import { useTranslation } from '../i18n/useTranslation';

export default function RulesIndexDialog({ ruleName, url, isOpen, onClose }) {
  const { t } = useTranslation();
  const { iframeLoaded, loadError, reloadKey, handleIframeLoad, handleIframeError, retry } =
    useRulesIndexDialog({ isOpen, onClose });

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
            className="dialog-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body rules-index-body">
          {loadError ? (
            <div className="rules-index-error">
              <WifiOff size={32} />
              <p>{t('rulesDialog.noConnection')}</p>
              <button type="button" className="btn" onClick={retry}>
                <RefreshCw size={16} /> <span>{t('common.retry')}</span>
              </button>
            </div>
          ) : (
            <>
              {!iframeLoaded && (
                <div className="rules-index-loading">
                  <Loader2 size={32} className="spinner" />
                  <p>{t('rulesDialog.loading')}</p>
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
