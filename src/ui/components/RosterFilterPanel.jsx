import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { FILTER_CATEGORY, NO_FILTER_OPTIONS, EMPTY_ROSTER_FILTER, selectedIdsOf } from '../viewmodels/rosterFilter';

/**
 * Die Auswahlfläche des Übersichts-Filters (Issue 0203) — nur JSX (ADR-0038).
 *
 * Zwei Mehrfachauswahlen: Spielsysteme und Fraktionen. Die Werte und die
 * Auswahl kommen fertig aus `useRosterFilter`; hier wird nichts abgeleitet.
 * Dieselbe Fläche steht auf dem Schreibtisch im Aufklapper der Werkzeugleiste
 * und mobil im Bodenblatt der Kopfzeile.
 */
export default function RosterFilterPanel({
  options = NO_FILTER_OPTIONS,
  selection = EMPTY_ROSTER_FILTER,
  onToggle,
  onClear,
  selectedCount = 0,
}) {
  const { t } = useTranslation();

  const section = (category, titleKey, values) => (
    <div className="roster-filter-section">
      <h4 className="text-label text-dim roster-filter-section-title">{t(titleKey)}</h4>
      {values.length === 0 ? (
        <p className="text-micro text-dim">{t('dashboard.filter.noValues')}</p>
      ) : (
        values.map(value => (
          <label key={value.id} className="roster-filter-option">
            <input
              type="checkbox"
              checked={selectedIdsOf(selection, category).includes(value.id)}
              onChange={() => onToggle?.(category, value.id)}
            />
            <span>{value.name}</span>
          </label>
        ))
      )}
    </div>
  );

  return (
    <div className="roster-filter-panel" data-testid="roster-filter-panel">
      {section(FILTER_CATEGORY.SYSTEM, 'dashboard.filter.systems', options.systems)}
      {section(FILTER_CATEGORY.FACTION, 'dashboard.filter.factions', options.factions)}
      {selectedCount > 0 && (
        <button className="btn-sm roster-filter-clear" onClick={() => onClear?.()}>
          {t('dashboard.filter.clearAll')}
        </button>
      )}
    </div>
  );
}
