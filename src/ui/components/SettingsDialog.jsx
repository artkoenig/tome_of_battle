import React from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useTranslation } from '../i18n/useTranslation';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../i18n/constants';

// Global settings dialog, opened from the header gear icon. Reads and writes the
// whfb6 linking setting through the settings context, so a toggle re-renders
// every consumer reactively (see ADR-0015). All visible text runs through the
// translation function `t` (ADR 0026); the language switcher below flips the
// active UI language immediately, without a reload.
export default function SettingsDialog({ isOpen, onClose }) {
  const { whfb6LinkingEnabled, setWhfb6LinkingEnabled } = useSettings();
  const { t, language, changeLanguage } = useTranslation();
  const appVersion = import.meta.env.VITE_APP_VERSION;

  if (!isOpen) return null;

  const linkingLabel = t('settings.whfb6Linking.label');
  const closeLabel = t('settings.close');
  const languageLabel = t('settings.language.label');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-gold font-serif">{t('settings.title')}</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">{linkingLabel}</span>
              <span className="settings-row-hint text-dim">{t('settings.whfb6Linking.hint')}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={whfb6LinkingEnabled}
              aria-label={linkingLabel}
              className={`settings-switch ${whfb6LinkingEnabled ? 'is-on' : ''}`}
              onClick={() => setWhfb6LinkingEnabled(!whfb6LinkingEnabled)}
            >
              <span className="settings-switch-thumb" />
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">{languageLabel}</span>
            </div>
            <div className="settings-language-switch" role="radiogroup" aria-label={languageLabel}>
              {SUPPORTED_LANGUAGES.map((code) => {
                const isActive = code === language;
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    data-testid={`language-option-${code}`}
                    className={`settings-language-option ${isActive ? 'is-active' : ''}`}
                    onClick={() => changeLanguage(code)}
                  >
                    {LANGUAGE_LABELS[code]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="settings-version text-dim text-micro">
            {t('settings.version')} {appVersion}
          </div>
        </div>
      </div>
    </div>
  );
}
