import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';
import { GERMAN_LOCALE, ENGLISH_LOCALE } from '../i18n/localeConfig';

// The language options rendered by the switcher, in display order. Each maps a
// supported locale to the settings key holding its native label.
const LANGUAGE_OPTIONS = [
  { locale: GERMAN_LOCALE, labelKey: 'settings.language.german' },
  { locale: ENGLISH_LOCALE, labelKey: 'settings.language.english' },
];

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
