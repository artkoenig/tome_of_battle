import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import { SUPPORTED_LOCALES, GERMAN_LOCALE, ENGLISH_LOCALE } from '../i18n/localeConfig';

// The settings key holding each supported locale's native label.
const LOCALE_LABEL_KEYS = {
  [GERMAN_LOCALE]: 'settings.language.german',
  [ENGLISH_LOCALE]: 'settings.language.english',
};

// The language options rendered by the switcher, derived from SUPPORTED_LOCALES
// so the switcher can never drift out of sync with what i18next actually supports.
const LANGUAGE_OPTIONS = SUPPORTED_LOCALES.map((locale) => ({
  locale,
  labelKey: LOCALE_LABEL_KEYS[locale],
}));

// Global settings dialog, opened from the header gear icon. Reads and writes the
// app settings through the settings context (see ADR-0023), so a change
// re-renders every consumer reactively; labels come from i18next (ADR-0022).
export default function SettingsDialog({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { whfb6LinkingEnabled, setWhfb6LinkingEnabled, locale, setLocale } = useSettings();
  const appVersion = import.meta.env.VITE_APP_VERSION;

  if (!isOpen) return null;

  const linkSettingLabel = t('settings.whfb6Linking.label');
  const languageLabel = t('settings.language.label');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-gold" style={{ fontFamily: 'var(--font-serif)' }}>{t('settings.title')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('settings.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">{linkSettingLabel}</span>
              <span className="settings-row-hint text-dim">{t('settings.whfb6Linking.hint')}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={whfb6LinkingEnabled}
              aria-label={linkSettingLabel}
              className={`settings-switch ${whfb6LinkingEnabled ? 'is-on' : ''}`}
              onClick={() => setWhfb6LinkingEnabled(!whfb6LinkingEnabled)}
            >
              <span className="settings-switch-thumb" />
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">{languageLabel}</span>
              <span className="settings-row-hint text-dim">{t('settings.language.hint')}</span>
            </div>
            <div
              className="settings-language-switch"
              role="radiogroup"
              aria-label={languageLabel}
            >
              {LANGUAGE_OPTIONS.map((option) => {
                const isActive = locale === option.locale;
                return (
                  <button
                    key={option.locale}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`settings-language-option ${isActive ? 'is-active' : ''}`}
                    onClick={() => setLocale(option.locale)}
                  >
                    {t(option.labelKey)}
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
