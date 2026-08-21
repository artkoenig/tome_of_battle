import React from 'react';
import { X } from 'lucide-react';
import { useNewRosterModal } from '../../viewmodels/useNewRosterModal';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Modal zum Anlegen einer neuen Armeeliste — nur noch JSX (ADR-0038).
 *
 * Formularzustand und Angebot (Kataloge, Kontingente, Kostenart-Label) kommen
 * aus `useNewRosterModal`; das Ergebnis meldet es über
 * `onCreate({ name, systemId, catId, forceEntryId, limit })`.
 */
export default function NewRosterModal({ isOpen, onClose, onCreate, systems }) {
  const { t } = useTranslation();
  const form = useNewRosterModal({ isOpen, systems, onCreate });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-new-roster-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('newRoster.title')}</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={form.submit}>
          <div className="modal-body">
            <div className="form-field">
              <label>{t('newRoster.nameLabel')}</label>
              <input
                type="text"
                placeholder={t('newRoster.namePlaceholder')}
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>{t('newRoster.systemLabel')}</label>
              <select
                value={form.systemId}
                onChange={(e) => form.selectSystem(e.target.value)}
                required
              >
                <option value="" disabled>{t('newRoster.systemPlaceholder')}</option>
                {systems.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {!form.hasSystems && (
                <p className="text-danger text-micro form-field-hint">
                  {t('newRoster.noSystemsHint')}
                </p>
              )}
            </div>

            <div className="form-field">
              <label>{t('newRoster.catalogueLabel')}</label>
              <select
                value={form.catId}
                onChange={(e) => form.selectCatalogue(e.target.value)}
                required
                disabled={!form.systemId || form.selectableCatalogues.length === 0}
              >
                <option value="" disabled>{t('newRoster.factionPlaceholder')}</option>
                {form.selectableCatalogues.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>{t('newRoster.forceLabel')}</label>
              <select
                value={form.forceEntryId}
                onChange={(e) => form.setForceEntryId(e.target.value)}
                required
                disabled={!form.catId || form.availableForceEntries.length === 0}
              >
                <option value="" disabled>{t('newRoster.forcePlaceholder')}</option>
                {form.availableForceEntries.map(fe => (
                  <option key={fe.id} value={fe.id}>
                    {fe.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>{t('newRoster.costLimitLabel')}</label>
              <div className="input-with-suffix">
                <input
                  type="number"
                  value={form.limit}
                  onChange={(e) => form.setLimit(e.target.value)}
                  required
                  min={1}
                />
                <span className="text-subheading text-gold input-suffix-label">
                  {form.costLimitLabel}
                </span>
              </div>
              <div className="preset-btn-row">
                {form.presets.map(val => (
                  <button
                    key={val}
                    type="button"
                    className={`btn-sm preset-btn ${Number(form.limit) === val ? 'active' : ''}`}
                    onClick={() => form.setLimit(val)}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={!form.hasSystems}>
              {t('newRoster.submit')}
            </button>
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
