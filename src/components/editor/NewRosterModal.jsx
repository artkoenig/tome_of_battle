import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { getAvailableForceEntries } from '../../solver/validator';

const DEFAULT_COST_LIMIT = 2000;
const COST_LIMIT_PRESETS = [1000, 1500, 2000, 2500];

/**
 * Modal zum Anlegen einer neuen Armeeliste. Verwaltet seinen Formular-State
 * selbst und meldet das Ergebnis über onCreate({ name, systemId, catId, forceEntryId, limit }).
 */
export default function NewRosterModal({ isOpen, onClose, onCreate, systems }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [systemId, setSystemId] = useState('');
  const [catId, setCatId] = useState('');
  const [forceEntryId, setForceEntryId] = useState('');
  const [limit, setLimit] = useState(DEFAULT_COST_LIMIT);

  const defaultForceEntryId = (system, catalogueId) => {
    const avail = getAvailableForceEntries(system, catalogueId);
    return avail.length > 0 ? avail[0].id : '';
  };

  const applySystemDefaults = (system) => {
    setSystemId(system?.id || '');
    const defaultCatId = system?.catalogues?.length > 0 ? system.catalogues[0].id : '';
    setCatId(defaultCatId);
    setForceEntryId(system ? defaultForceEntryId(system, defaultCatId) : '');
  };

  // Beim Öffnen Formular zurücksetzen und Defaults aus dem ersten System übernehmen
  useEffect(() => {
    if (isOpen) {
      setName('');
      setLimit(DEFAULT_COST_LIMIT);
      applySystemDefaults(systems[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const activeSystem = systems.find(s => s.id === systemId);
  const availableForceEntries = getAvailableForceEntries(activeSystem, catId);

  const handleSystemChange = (id) => {
    applySystemDefaults(systems.find(s => s.id === id));
  };

  const handleCatalogueChange = (newCatId) => {
    setCatId(newCatId);
    setForceEntryId(activeSystem ? defaultForceEntryId(activeSystem, newCatId) : '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({ name, systemId, catId, forceEntryId, limit });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-new-roster-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('dashboard.newRosterModal.title')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('settings.close')}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label>{t('dashboard.newRosterModal.nameLabel')}</label>
              <input
                type="text"
                placeholder={t('dashboard.newRosterModal.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>{t('dashboard.newRosterModal.systemLabel')}</label>
              <select
                value={systemId}
                onChange={(e) => handleSystemChange(e.target.value)}
                required
              >
                <option value="" disabled>{t('dashboard.newRosterModal.systemPlaceholder')}</option>
                {systems.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {systems.length === 0 && (
                <p className="text-danger text-micro form-field-hint">
                  {t('dashboard.newRosterModal.noSystemsHint')}
                </p>
              )}
            </div>

            <div className="form-field">
              <label>{t('dashboard.newRosterModal.catalogueLabel')}</label>
              <select
                value={catId}
                onChange={(e) => handleCatalogueChange(e.target.value)}
                required
                disabled={!systemId || activeSystem?.catalogues?.length === 0}
              >
                <option value="" disabled>{t('dashboard.newRosterModal.cataloguePlaceholder')}</option>
                {activeSystem?.catalogues?.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>{t('dashboard.newRosterModal.forceLabel')}</label>
              <select
                value={forceEntryId}
                onChange={(e) => setForceEntryId(e.target.value)}
                required
                disabled={!catId || availableForceEntries.length === 0}
              >
                <option value="" disabled>{t('dashboard.newRosterModal.forcePlaceholder')}</option>
                {availableForceEntries.map(fe => (
                  <option key={fe.id} value={fe.id}>
                    {fe.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>{t('dashboard.newRosterModal.limitLabel')}</label>
              <div className="input-with-suffix">
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  required
                  min={1}
                />
                <span className="text-subheading text-gold input-suffix-label">{t('dashboard.pointsAbbreviation')}</span>
              </div>
              <div className="preset-btn-row">
                {COST_LIMIT_PRESETS.map(val => (
                  <button
                    key={val}
                    type="button"
                    className={`btn-sm preset-btn ${Number(limit) === val ? 'active' : ''}`}
                    onClick={() => setLimit(val)}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={systems.length === 0}>
              {t('dashboard.newRosterModal.submit')}
            </button>
            <button type="button" onClick={onClose}>{t('dialogs.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
