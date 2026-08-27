import React from 'react';
import { Plus, Trash2, Play, Edit3, WifiOff, Download, Upload, MoreVertical, Filter, X } from 'lucide-react';
import { useRosterDashboard } from '../viewmodels/useRosterDashboard';
import { EMPTY_ROSTER_FILTER, NO_FILTER_OPTIONS } from '../viewmodels/rosterFilter';
import BottomSheet from './editor/BottomSheet';
import RosterFilterPanel from './RosterFilterPanel';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Noch keine Listen uebergeben. Als Literal im Parameter faellt `[]` auf
 * `never[]` und nimmt keinen echten Datensatz mehr an.
 *
 * @type {Array<Object>}
 */
const NO_ROSTERS = [];

/** @type {Array<Object>} */
const NO_SYSTEMS = [];

/**
 * Kein Filter angeschlossen — das Bündel, das `useRosterFilter` sonst liefert,
 * in seiner leeren Form. Als Literal im Parameter fiele es auf unbrauchbare
 * Typen, und ein Aufrufer ohne Filter (ein Test der Karten) soll jede Liste
 * sehen.
 *
 * @type {{
 *   selection: { systemIds: string[], factionIds: string[] },
 *   options: { systems: Array<{id: string, name: string}>, factions: Array<{id: string, name: string}> },
 *   chips: Array<{ category: string, id: string, name: string }>,
 *   selectedCount: number,
 *   toggleValue?: (category: string, id: string) => void,
 *   removeValue?: (category: string, id: string) => void,
 *   clearAll?: () => void,
 * }}
 */
const NO_FILTER = {
  selection: EMPTY_ROSTER_FILTER,
  options: NO_FILTER_OPTIONS,
  chips: [],
  selectedCount: 0,
};

/**
 * Die Bibliotheks-Hülle — nur noch JSX (ADR-0038).
 *
 * Gruppierung, Kartenwerte und der Umbenenn-/Aktions-Zustand kommen aus
 * `useRosterDashboard`. Insbesondere läuft die Auswertung nicht mehr in der
 * Map-Schleife des Renders: sie steht als fertiger Wert je Karte im ViewModel.
 */
export default function RosterDashboard({
  rosters = NO_ROSTERS,
  systems = NO_SYSTEMS,
  onOpenRoster,
  onDeleteRoster,
  onRenameRoster,
  onNewRoster,
  isOffline = false,
  onImportRoster,
  onExportRoster,
  filter = NO_FILTER,
}) {
  const { t } = useTranslation();
  const dashboard = useRosterDashboard({
    rosters, systems, onRenameRoster, onImportRoster, onExportRoster, onDeleteRoster,
    filter: filter.selection,
  });

  return (
    <div className="container">
      <input
        type="file"
        ref={dashboard.fileInputRef}
        onChange={dashboard.pickImportFile}
        accept=".ros,.rosz"
        className="is-hidden"
      />
      {/* PWA & Network Offline/Install Status Banners */}
      {isOffline && (
        <div className="gothic-panel offline-banner">
          <WifiOff className="text-danger no-shrink" size={24} />
          <div>
            <h4 className="text-ui-title offline-banner-title">{t('app.offline.active')}</h4>
            <p className="text-label text-dim offline-banner-text">
              {t('dashboard.offlineText')}
            </p>
          </div>
        </div>
      )}

      {!dashboard.isEmpty && (
        <div className="gothic-panel dashboard-header hide-on-mobile">
          <div className="dashboard-header-filter">
            <button
              data-testid="dashboard-filter"
              className="btn-secondary desktop-btn"
              onClick={dashboard.toggleFilterPanel}
              title={t('dashboard.filter.label')}
            >
              <Filter size={18} /> {t('dashboard.filter.label')}
              {filter.selectedCount > 0 && (
                <span className="filter-count-badge">{filter.selectedCount}</span>
              )}
            </button>
            {dashboard.isFilterPanelOpen && (
              <RosterFilterPanel
                options={filter.options}
                selection={filter.selection}
                selectedCount={filter.selectedCount}
                onToggle={filter.toggleValue}
                onClear={filter.clearAll}
              />
            )}
          </div>
          <div className="dashboard-header-actions">
            <button className="btn-secondary desktop-btn" onClick={dashboard.openFilePicker}>
              <Upload size={18} /> {t('common.import')}
            </button>
            <button data-testid="new-roster" className="btn-primary desktop-btn" onClick={onNewRoster}>
              <Plus size={18} /> {t('dashboard.newRoster')}
            </button>
          </div>
        </div>
      )}

      {filter.chips.length > 0 && (
        <div className="dashboard-filter-chips" data-testid="dashboard-filter-chips">
          {filter.chips.map(chip => (
            <button
              key={`${chip.category}:${chip.id}`}
              className="filter-chip"
              onClick={() => filter.removeValue?.(chip.category, chip.id)}
              title={t('dashboard.filter.remove', { name: chip.name })}
              aria-label={t('dashboard.filter.remove', { name: chip.name })}
            >
              <span>{chip.name}</span>
              <X size={12} />
            </button>
          ))}
          <button
            className="filter-chip-clear"
            onClick={() => filter.clearAll?.()}
          >
            {t('dashboard.filter.clearAll')}
          </button>
        </div>
      )}

      {dashboard.isEmpty ? (
        <div className="empty-state-container">
          <div className="empty-state-image empty-roster-image" />
          <h3 className="empty-state-title">{t('dashboard.empty.title')}</h3>
          <p className="empty-state-text text-dim">
            {t('dashboard.empty.text')}
          </p>
          <div className="empty-state-actions">
            <button className="btn-secondary empty-state-btn" onClick={dashboard.openFilePicker}>
              <Upload size={20} /> {t('dashboard.empty.import')}
            </button>
            <button data-testid="new-roster" className="btn-primary empty-state-btn" onClick={onNewRoster}>
              <Plus size={20} /> {t('dashboard.empty.create')}
            </button>
          </div>
        </div>
      ) : dashboard.hasNoMatches ? (
        <div className="empty-state-container" data-testid="dashboard-filter-no-match">
          <h3 className="empty-state-title">{t('dashboard.filter.noMatch.title')}</h3>
          <p className="empty-state-text text-dim">{t('dashboard.filter.noMatch.text')}</p>
          <div className="empty-state-actions">
            <button className="btn-secondary empty-state-btn" onClick={() => filter.clearAll?.()}>
              {t('dashboard.filter.clearAll')}
            </button>
          </div>
        </div>
      ) : (
        <div className="faction-groups-container">
          {dashboard.factionGroups.map(faction => (
            <div key={faction.factionName} className="faction-group">
              <h3 className="faction-group-title text-subheading">
                {faction.factionName}
              </h3>
              <div className="dashboard-grid">
                {faction.cards.map(({ roster, currentPoints, costLimit, costTypeLabel, forceName }) => (
                  <div key={roster.id} className="roster-card">
                    <div className="roster-card-header">
                      <div className="roster-title-block">
                        {dashboard.editingId === roster.id ? (
                          <input
                            type="text"
                            className="roster-title-input"
                            value={dashboard.editName}
                            onChange={(e) => dashboard.setEditName(e.target.value)}
                            onBlur={() => dashboard.finishEditing(roster)}
                            onKeyDown={(e) => dashboard.handleTitleKeyDown(e, roster)}
                            autoFocus
                          />
                        ) : (
                          <div
                            className="roster-title-container"
                            onClick={(e) => dashboard.startEditing(roster, e)}
                            title={t('dashboard.editTitle')}
                          >
                            <h4 className="roster-title">{roster.name}</h4>
                            <Edit3 className="edit-icon" size={14} />
                          </div>
                        )}
                        {forceName && (
                          <span className="text-micro text-dim roster-force-label">
                            {forceName}
                          </span>
                        )}
                      </div>
                      <div className="roster-points">
                        <span className="roster-title"><span>{currentPoints}</span> / <span>{costLimit}</span></span>
                        <span className="text-micro text-dim roster-cost-type-label">{costTypeLabel}</span>
                      </div>
                    </div>
                    <div className="roster-actions">
                      <button className="btn-sm" onClick={() => onOpenRoster(roster, 'builder')}>
                        <Edit3 size={14} /> {t('common.equip')}
                      </button>
                      <button data-testid="roster-play" className="btn-sm" onClick={() => onOpenRoster(roster, 'play')}>
                        <Play size={14} /> {t('common.play')}
                      </button>
                      <button className="btn-sm hide-on-mobile" onClick={() => onExportRoster?.(roster)} title={t('dashboard.exportRosterTitle')}>
                        <Download size={14} /> {t('common.export')}
                      </button>
                      <button
                        className="btn-danger square-btn hide-on-mobile push-end"
                        onClick={(e) => onDeleteRoster(roster.id, e)}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        className="btn-sm square-btn mobile-only push-end"
                        onClick={() => dashboard.openRosterActions(roster.id)}
                        title={t('dashboard.moreActions')}
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!dashboard.isEmpty && (
        <>
          <button
            className="fab-mobile mobile-only"
            onClick={dashboard.openActionsSheet}
            title={t('common.actions')}
          >
            <Plus size={24} />
          </button>

          <BottomSheet
            isOpen={dashboard.isActionsSheetOpen}
            onClose={dashboard.closeActionsSheet}
            title={t('dashboard.armyActions')}
          >
            <div className="popover-list">
              <div
                className="popover-item"
                onClick={() => {
                  dashboard.closeActionsSheet();
                  onNewRoster();
                }}
              >
                <span className="popover-item-name flex-row gap-12">
                  <Plus size={18} className="text-gold" />
                  <span>{t('dashboard.newRosterLong')}</span>
                </span>
              </div>
              <div
                className="popover-item"
                onClick={() => {
                  dashboard.closeActionsSheet();
                  dashboard.openFilePicker();
                }}
              >
                <span className="popover-item-name flex-row gap-12">
                  <Upload size={18} className="text-gold" />
                  <span>{t('dashboard.importRoster')}</span>
                </span>
              </div>
            </div>
          </BottomSheet>

          <BottomSheet
            isOpen={dashboard.isRosterActionsSheetOpen}
            onClose={dashboard.closeRosterActions}
            title={t('common.actions')}
          >
            <div className="popover-list">
              <div className="popover-item" onClick={dashboard.exportFromSheet}>
                <span className="popover-item-name flex-row gap-12">
                  <Download size={18} />
                  <span>{t('common.export')}</span>
                </span>
              </div>
              <div className="popover-item" onClick={dashboard.deleteFromSheet}>
                <span className="popover-item-name flex-row gap-12">
                  <Trash2 size={18} className="text-danger" />
                  <span>{t('common.delete')}</span>
                </span>
              </div>
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
