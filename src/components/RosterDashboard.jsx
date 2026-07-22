import React, { useState, useRef } from 'react';
import { Plus, Trash2, Play, Edit3, WifiOff, Download, Upload, MoreVertical } from 'lucide-react';
import { calculateRosterCosts, findForceEntryById, resolveCostLimitLabel } from '../solver/validator';
import BottomSheet from './editor/BottomSheet';
import { useTranslation } from '../i18n/useTranslation';

export default function RosterDashboard({
  rosters = [],
  systems = [],
  onOpenRoster,
  onDeleteRoster,
  onRenameRoster,
  onNewRoster,
  isOffline = false,
  onImportRoster,
  onExportRoster,
}) {
  const { t } = useTranslation();
  const unknownSystemLabel = t('dashboard.unknownSystem');
  const noFactionLabel = t('dashboard.noFaction');
  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onImportRoster) {
      onImportRoster(file);
    }
    e.target.value = ''; // Reset file input
  };
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [isActionsSheetOpen, setIsActionsSheetOpen] = useState(false);
  const [rosterActionsRosterId, setRosterActionsRosterId] = useState(null);

  const startEditing = (roster, e) => {
    e.stopPropagation();
    setEditName(roster.name);
    setEditingId(roster.id);
  };

  const finishEditing = (roster) => {
    onRenameRoster?.(roster, editName);
    setEditingId(null);
  };

  const handleTitleKeyDown = (e, roster) => {
    if (e.key === 'Enter') {
      finishEditing(roster);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className="container">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
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

      {rosters.length > 0 && (
        <div className="gothic-panel dashboard-header hide-on-mobile">
          <div>
            <h2>{t('app.nav.rosters')}</h2>
            <p className="text-dim dashboard-header-subtitle">{t('dashboard.subtitle')}</p>
          </div>
          <div className="dashboard-header-actions">
            <button className="btn-secondary desktop-btn" onClick={handleImportClick}>
              <Upload size={18} /> {t('common.import')}
            </button>
            <button data-testid="new-roster" className="btn-primary desktop-btn" onClick={onNewRoster}>
              <Plus size={18} /> {t('dashboard.newRoster')}
            </button>
          </div>
        </div>
      )}

      {rosters.length === 0 ? (
        <div className="empty-state-container">
          <div className="empty-state-image empty-roster-image" />
          <h3 className="empty-state-title">{t('dashboard.empty.title')}</h3>
          <p className="empty-state-text text-dim">
            {t('dashboard.empty.text')}
          </p>
          <div className="empty-state-actions">
            <button className="btn-secondary empty-state-btn" onClick={handleImportClick}>
              <Upload size={20} /> {t('dashboard.empty.import')}
            </button>
            <button data-testid="new-roster" className="btn-primary empty-state-btn" onClick={onNewRoster}>
              <Plus size={20} /> {t('dashboard.empty.create')}
            </button>
          </div>
        </div>
      ) : (() => {
        const rostersBySystemAndFaction = rosters.reduce((acc, roster) => {
          const sys = systems.find(s => s.id === roster.systemId);
          const systemName = sys ? sys.name : unknownSystemLabel;

          const cat = sys?.catalogues?.find(c => c.id === roster.catalogueId);
          const factionName = cat ? cat.name : noFactionLabel;
          
          if (!acc[systemName]) {
            acc[systemName] = {};
          }
          if (!acc[systemName][factionName]) {
            acc[systemName][factionName] = [];
          }
          acc[systemName][factionName].push({ roster, sys });
          return acc;
        }, {});

        const sortedSystems = Object.keys(rostersBySystemAndFaction).sort((a, b) => {
          if (a === unknownSystemLabel) return 1;
          if (b === unknownSystemLabel) return -1;
          return a.localeCompare(b);
        });

        return (
          <div className="system-groups-container">
            {sortedSystems.map(systemName => {
              const factionsObj = rostersBySystemAndFaction[systemName];
              const sortedFactions = Object.keys(factionsObj).sort((a, b) => {
                if (a === noFactionLabel) return 1;
                if (b === noFactionLabel) return -1;
                return a.localeCompare(b);
              });

              return (
                <div key={systemName} className="system-group">
                  <h2 className="system-group-title text-heading">
                    {systemName}
                  </h2>
                  
                  <div className="system-factions">
                    {sortedFactions.map(factionName => {
                      const factionRosters = factionsObj[factionName];
                      return (
                        <div key={factionName} className="faction-group">
                          <h3 className="faction-group-title text-subheading">
                            {factionName}
                          </h3>
                          <div className="dashboard-grid">
                            {factionRosters.map(({ roster, sys }) => {
                              const costTypeLabel = resolveCostLimitLabel(roster, sys);
                              const calcCosts = (sys && roster.forces) ? calculateRosterCosts(roster, sys) : {};
                              const currentPoints = calcCosts[roster.costLimitType] || 0;

                              return (
                                <div key={roster.id} className="roster-card">
                                  <div className="roster-card-header">
                                    <div className="roster-title-block">
                                      {editingId === roster.id ? (
                                        <input
                                          type="text"
                                          className="roster-title-input"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          onBlur={() => finishEditing(roster)}
                                          onKeyDown={(e) => handleTitleKeyDown(e, roster)}
                                          autoFocus
                                        />
                                      ) : (
                                        <div
                                          className="roster-title-container"
                                          onClick={(e) => startEditing(roster, e)}
                                          title={t('dashboard.editTitle')}
                                        >
                                          <h4 className="roster-title">{roster.name}</h4>
                                          <Edit3 className="edit-icon" size={14} />
                                        </div>
                                      )}
                                      {(() => {
                                        const forceEntryId = roster.forces?.[0]?.forceEntryId;
                                        const forceDef = sys ? findForceEntryById(sys, forceEntryId) : null;
                                        return forceDef ? (
                                          <span className="text-micro text-dim roster-force-label">
                                            {forceDef.name}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                    <div className="roster-points">
                                      <span className="roster-title"><span>{currentPoints}</span> / <span>{roster.costLimit}</span></span>
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
                                      onClick={() => setRosterActionsRosterId(roster.id)}
                                      title={t('dashboard.moreActions')}
                                    >
                                      <MoreVertical size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {rosters.length > 0 && (
        <>
          <button 
            className="fab-mobile mobile-only"
            onClick={() => setIsActionsSheetOpen(true)}
            title={t('common.actions')}
          >
            <Plus size={24} />
          </button>

          <BottomSheet
            isOpen={isActionsSheetOpen}
            onClose={() => setIsActionsSheetOpen(false)}
            title={t('dashboard.armyActions')}
          >
            <div className="popover-list">
              <div 
                className="popover-item"
                onClick={() => {
                  setIsActionsSheetOpen(false);
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
                  setIsActionsSheetOpen(false);
                  handleImportClick();
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
            isOpen={rosterActionsRosterId !== null}
            onClose={() => setRosterActionsRosterId(null)}
            title={t('common.actions')}
          >
            <div className="popover-list">
              <div 
                className="popover-item"
                onClick={() => {
                  const roster = rosters.find(r => r.id === rosterActionsRosterId);
                  if (roster) onExportRoster?.(roster);
                  setRosterActionsRosterId(null);
                }}
              >
                <span className="popover-item-name flex-row gap-12">
                  <Download size={18} />
                  <span>{t('common.export')}</span>
                </span>
              </div>
              <div 
                className="popover-item"
                onClick={() => {
                  const id = rosterActionsRosterId;
                  setRosterActionsRosterId(null);
                  onDeleteRoster(id, { stopPropagation() {} });
                }}
              >
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
