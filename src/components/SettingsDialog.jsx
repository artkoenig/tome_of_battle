import React from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

const LINK_SETTING_LABEL = 'Verlinkung zu 6th.whfb.app';
const LINK_SETTING_HINT =
  'Ist die Verlinkung aus, zeigen Regel-, Waffen- und Magic-Item-Chips statt eines Links zur externen Seite die Katalog-Kurzinfo.';
const VERSION_LABEL = 'Version';

// Global settings dialog, opened from the header gear icon. Reads and writes the
// whfb6 linking setting through the settings context, so a toggle re-renders
// every consumer reactively (see ADR-0015).
export default function SettingsDialog({ isOpen, onClose }) {
  const { whfb6LinkingEnabled, setWhfb6LinkingEnabled } = useSettings();
  const appVersion = import.meta.env.VITE_APP_VERSION;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-gold font-serif">Einstellungen</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="settings-row">
            <div className="settings-row-text">
              <span className="settings-row-label">{LINK_SETTING_LABEL}</span>
              <span className="settings-row-hint text-dim">{LINK_SETTING_HINT}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={whfb6LinkingEnabled}
              aria-label={LINK_SETTING_LABEL}
              className={`settings-switch ${whfb6LinkingEnabled ? 'is-on' : ''}`}
              onClick={() => setWhfb6LinkingEnabled(!whfb6LinkingEnabled)}
            >
              <span className="settings-switch-thumb" />
            </button>
          </div>
          <div className="settings-version text-dim text-micro">
            {VERSION_LABEL} {appVersion}
          </div>
        </div>
      </div>
    </div>
  );
}
