import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { describeSystem } from '../../evaluation/evaluationCache';
import { costLimitLabelOf } from '../../evaluation/costDisplays';
import { DEFAULT_ROSTER_COST_LIMIT } from '../../utils/rosterDefaults';
import { useTranslation } from '../../i18n/useTranslation';

const COST_LIMIT_PRESETS = [1000, 1500, 2000, 2500];

/**
 * Die spielbaren Kataloge eines Systems aus der Datensatz-Beschreibung:
 * spielbar ist jeder Katalog, der keine reine Bibliothek ist (ADR-0034).
 */
const playableCataloguesOf = (description) =>
  (description?.catalogues ?? []).filter(catalogue => catalogue.isLibrary !== true);

/**
 * Die anlegbaren Kontingente fuer den gewaehlten Katalog: die sichtbaren
 * (`isHidden`-gefilterten) Kontingente der Beschreibung, beschraenkt auf die
 * des Spielsystems (Quelle ist kein Katalog) und die des gewaehlten Katalogs —
 * Kontingente fremder Armeebuecher gehoeren nicht in diese Auswahl.
 */
function creatableForcesOf(description, catalogueId) {
  if (!description) return [];
  const catalogueIds = new Set(description.catalogues.map(catalogue => catalogue.id));
  return description.creatableForces.filter(force =>
    force.isHidden !== true
    && (force.sourceId === catalogueId || !catalogueIds.has(force.sourceId)));
}

/**
 * Der Vorschlag fuer das Zahlenfeld: die deklarierte Vorgabe-Grenze
 * (`defaultCostLimit`) der Limit-Kostenart — der ersten Kostenart des Systems.
 * Ohne deklarierte Grenze (fehlend oder Sentinel −1 → `defaultLimit: null`)
 * bleibt der bisherige Vorgabewert.
 */
const defaultLimitOf = (description) =>
  description?.costTypes?.[0]?.defaultLimit ?? DEFAULT_ROSTER_COST_LIMIT;

/**
 * Modal zum Anlegen einer neuen Armeeliste. Verwaltet seinen Formular-State
 * selbst und meldet das Ergebnis über onCreate({ name, systemId, catId, forceEntryId, limit }).
 * Katalog-, Kontingent- und Kostenart-Angebot kommen aus der
 * Datensatz-Beschreibung des Evaluators (`describeSystem`, Issue 0121, Task 7).
 */
export default function NewRosterModal({ isOpen, onClose, onCreate, systems }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [systemId, setSystemId] = useState('');
  const [catId, setCatId] = useState('');
  const [forceEntryId, setForceEntryId] = useState('');
  // Spiegelt den rohen Eingabewert des Zahlenfelds, daher auch string.
  const [limit, setLimit] = useState(/** @type {number|string} */ (DEFAULT_ROSTER_COST_LIMIT));

  const defaultForceEntryId = (description, catalogueId) => {
    const avail = creatableForcesOf(description, catalogueId);
    return avail.length > 0 ? avail[0].id : '';
  };

  const applySystemDefaults = (system) => {
    const description = describeSystem(system);
    setSystemId(system?.id || '');
    const defaultCatId = playableCataloguesOf(description)[0]?.id ?? '';
    setCatId(defaultCatId);
    setForceEntryId(description ? defaultForceEntryId(description, defaultCatId) : '');
    setLimit(defaultLimitOf(description));
  };

  // Beim Öffnen Formular zurücksetzen und Defaults aus dem ersten System übernehmen
  useEffect(() => {
    if (isOpen) {
      setName('');
      applySystemDefaults(systems[0]);
    }
    // Absichtlich nur von isOpen abhängig: Der Effekt setzt das Formular beim Öffnen
    // zurück. Nähme man systems bzw. applySystemDefaults auf, würde jede neue Identität
    // dieser Werte das Formular auch im geöffneten Zustand zurücksetzen und dabei
    // bereits getroffene Eingaben des Nutzers verwerfen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const activeSystem = systems.find(s => s.id === systemId);
  const activeDescription = describeSystem(activeSystem);
  const selectableCatalogues = playableCataloguesOf(activeDescription);
  const availableForceEntries = creatableForcesOf(activeDescription, catId);

  const handleSystemChange = (id) => {
    applySystemDefaults(systems.find(s => s.id === id));
  };

  const handleCatalogueChange = (newCatId) => {
    setCatId(newCatId);
    setForceEntryId(activeDescription ? defaultForceEntryId(activeDescription, newCatId) : '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({ name, systemId, catId, forceEntryId, limit });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-new-roster-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('newRoster.title')}</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label>{t('newRoster.nameLabel')}</label>
              <input
                type="text"
                placeholder={t('newRoster.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>{t('newRoster.systemLabel')}</label>
              <select
                value={systemId}
                onChange={(e) => handleSystemChange(e.target.value)}
                required
              >
                <option value="" disabled>{t('newRoster.systemPlaceholder')}</option>
                {systems.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {systems.length === 0 && (
                <p className="text-danger text-micro form-field-hint">
                  {t('newRoster.noSystemsHint')}
                </p>
              )}
            </div>

            <div className="form-field">
              <label>{t('newRoster.catalogueLabel')}</label>
              <select
                value={catId}
                onChange={(e) => handleCatalogueChange(e.target.value)}
                required
                disabled={!systemId || selectableCatalogues.length === 0}
              >
                <option value="" disabled>{t('newRoster.factionPlaceholder')}</option>
                {selectableCatalogues.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>{t('newRoster.forceLabel')}</label>
              <select
                value={forceEntryId}
                onChange={(e) => setForceEntryId(e.target.value)}
                required
                disabled={!catId || availableForceEntries.length === 0}
              >
                <option value="" disabled>{t('newRoster.forcePlaceholder')}</option>
                {availableForceEntries.map(fe => (
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
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  required
                  min={1}
                />
                <span className="text-subheading text-gold input-suffix-label">
                  {/* Noch existiert kein Roster; das Limit gilt für die erste Kostenart des Systems. */}
                  {costLimitLabelOf(null, activeDescription?.costTypes)}
                </span>
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
              {t('newRoster.submit')}
            </button>
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
