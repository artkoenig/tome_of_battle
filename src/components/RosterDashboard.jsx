import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Play, Edit3, WifiOff, Download, Upload, MoreVertical } from 'lucide-react';
import { calculateRosterCosts, findForceEntryById } from '../solver/validator';
import BottomSheet from './editor/BottomSheet';

export default function RosterDashboard({
  rosters = [],
  systems = [],
  onOpenRoster,
  onDeleteRoster,
  onRenameRoster,
  onNewRoster,
  isOffline = false,
  isInstallable = false,
  onInstallClick,
  onImportRoster,
  onExportRoster,
}) {
  const { t } = useTranslation();
  const unknownSystemName = t('dashboard.unknownSystem');
  const noFactionName = t('dashboard.noFaction');
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
        style={{ display: 'none' }}
      />
      {/* PWA & Network Offline/Install Status Banners */}
      {isOffline && (
        <div 
          className="gothic-panel offline-banner"
          style={{
            marginBottom: '20px',
            borderColor: 'var(--color-danger)',
            background: 'rgba(166, 28, 28, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px'
          }}
        >
          <WifiOff className="text-danger" size={24} style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: 0, color: 'var(--color-danger)' }} className="text-ui-title">{t('dashboard.offlineBanner.title')}</h4>
            <p style={{ margin: '2px 0 0' }} className="text-label text-dim">
              {t('dashboard.offlineBanner.text')}
            </p>
          </div>
        </div>
      )}

      {rosters.length > 0 && (
        <div className="gothic-panel dashboard-header hide-on-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>{t('dashboard.title')}</h2>
            <p className="text-dim" style={{ margin: 0 }}>{t('dashboard.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary desktop-btn" onClick={handleImportClick}>
              <Upload size={18} /> {t('dashboard.import')}
            </button>
            <button className="btn-primary desktop-btn" onClick={onNewRoster}>
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
            <button className="btn-primary empty-state-btn" onClick={onNewRoster}>
              <Plus size={20} /> {t('dashboard.empty.create')}
            </button>
          </div>
        </div>
      ) : (() => {
        const rostersBySystemAndFaction = rosters.reduce((acc, roster) => {
          const sys = systems.find(s => s.id === roster.systemId);
          const systemName = sys ? sys.name : unknownSystemName;

          const cat = sys?.catalogues?.find(c => c.id === roster.catalogueId);
          const factionName = cat ? cat.name : noFactionName;
          
          if (!acc[systemName]) {
            acc[systemName] = {};
          }
          if (!acc[systemName][factionName]) {
            acc[systemName][factionName] = [];
          }
          acc[systemName][factionName].push({ roster, sys, cat });
          return acc;
        }, {});

        const sortedSystems = Object.keys(rostersBySystemAndFaction).sort((a, b) => {
          if (a === unknownSystemName) return 1;
          if (b === unknownSystemName) return -1;
          return a.localeCompare(b);
        });

        return (
          <div className="system-groups-container" style={{ marginTop: '24px' }}>
            {sortedSystems.map(systemName => {
              const factionsObj = rostersBySystemAndFaction[systemName];
              const sortedFactions = Object.keys(factionsObj).sort((a, b) => {
                if (a === noFactionName) return 1;
                if (b === noFactionName) return -1;
                return a.localeCompare(b);
              });

              return (
                <div key={systemName} className="system-group" style={{ marginBottom: '40px' }}>
                  <h2 className="system-group-title text-heading">
                    {systemName}
                  </h2>
                  
                  <div className="system-factions" style={{ paddingLeft: '16px' }}>
                    {sortedFactions.map(factionName => {
                      const factionRosters = factionsObj[factionName];
                      return (
                        <div key={factionName} className="faction-group" style={{ marginBottom: '28px' }}>
                          <h3 className="faction-group-title text-subheading">
                            {factionName}
                          </h3>
                          <div className="dashboard-grid" style={{ marginTop: '12px' }}>
                            {factionRosters.map(({ roster, sys, cat }) => {
                              const pointsAbbreviation = t('dashboard.pointsAbbreviation');
                              const costTypeObj = sys?.costTypes?.find(ct => ct.id === roster.costLimitType);
                              const rawLabel = costTypeObj?.name || pointsAbbreviation;
                              const costTypeLabel = (rawLabel.toLowerCase() === 'pts' || rawLabel.toLowerCase() === 'punkte' || rawLabel.toLowerCase() === 'points') ? pointsAbbreviation : rawLabel;
                              
                              const calcCosts = (sys && roster.forces) ? calculateRosterCosts(roster, sys) : {};
                              const currentPoints = calcCosts[roster.costLimitType] || 0;

                              return (
                                <div key={roster.id} className="roster-card" style={{ minHeight: 'auto', padding: '12px 16px' }}>
                                  <div className="roster-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
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
                                          <span className="text-micro text-dim" style={{ display: 'block', marginTop: '2px' }}>
                                            {forceDef.name}
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                    <div className="roster-points" style={{
                                      whiteSpace: 'nowrap',
                                      textAlign: 'right',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'flex-end'
                                    }}>
                                      <span className="roster-title"><span>{currentPoints}</span> / <span>{roster.costLimit}</span></span>
                                      <span className="text-micro text-dim" style={{ display: 'block', marginTop: '2px' }}>{costTypeLabel}</span>
                                    </div>
                                  </div>
                                  <div className="roster-actions" style={{ marginTop: '8px' }}>
                                    <button className="btn-sm" onClick={() => onOpenRoster(roster, 'builder')}>
                                      <Edit3 size={14} /> {t('dashboard.equip')}
                                    </button>
<button className="btn-sm" onClick={() => onOpenRoster(roster, 'play')}>
  <Play size={14} /> {t('dashboard.play')}
</button>
                                    <button className="btn-sm hide-on-mobile" onClick={() => onExportRoster?.(roster)} title={t('dashboard.exportTitle')}>
                                      <Download size={14} /> {t('dashboard.export')}
                                    </button>
                                    <button 
                                      className="btn-danger square-btn hide-on-mobile" 
                                      style={{ marginLeft: 'auto' }}
                                      onClick={(e) => onDeleteRoster(roster.id, e)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    <button 
                                      className="btn-sm square-btn mobile-only" 
                                      style={{ marginLeft: 'auto' }}
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
            title={t('dashboard.actions')}
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
                <span className="popover-item-name" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Plus size={18} className="text-gold" />
                  <span>{t('dashboard.createRosterSheet')}</span>
                </span>
              </div>
              <div
                className="popover-item"
                onClick={() => {
                  setIsActionsSheetOpen(false);
                  handleImportClick();
                }}
              >
                <span className="popover-item-name" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Upload size={18} className="text-gold" />
                  <span>{t('dashboard.importRosterSheet')}</span>
                </span>
              </div>
            </div>
          </BottomSheet>

          <BottomSheet
            isOpen={rosterActionsRosterId !== null}
            onClose={() => setRosterActionsRosterId(null)}
            title={t('dashboard.actions')}
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
                <span className="popover-item-name" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Download size={18} />
                  <span>{t('dashboard.export')}</span>
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
                <span className="popover-item-name" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Trash2 size={18} className="text-danger" />
                  <span>{t('dashboard.delete')}</span>
                </span>
              </div>
            </div>
          </BottomSheet>
        </>
      )}
    </div>
  );
}
