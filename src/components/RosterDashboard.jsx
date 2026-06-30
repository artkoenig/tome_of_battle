import React from 'react';
import { Plus, Trash2, Play, Edit3 } from 'lucide-react';

export default function RosterDashboard({
  rosters = [],
  systems = [],
  showDebugIds = false,
  onOpenRoster,
  onDeleteRoster,
  onNewRoster,
}) {
  return (
    <div className="container">
      {rosters.length > 0 && (
        <div className="gothic-panel dashboard-header hide-on-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Heerlager</h2>
            <p className="text-dim" style={{ margin: 0 }}>Verwalte deine Armeelisten oder erstelle neue Feldzüge.</p>
          </div>
          <button className="btn-primary desktop-btn" onClick={onNewRoster}>
            <Plus size={18} /> Neue Armeeliste
          </button>
        </div>
      )}

      {rosters.length === 0 ? (
        <div className="empty-state-container">
          <div className="empty-state-image empty-roster-image" />
          <h3 className="empty-state-title">Die Waffenkammern sind leer</h3>
          <p className="empty-state-text text-dim">
            Noch wehen keine Banner in deinem Heerlager. Versammle deine Truppen, wähle deine Anführer und bereite dich auf kommende Schlachten vor.
          </p>
          <button className="btn-primary empty-state-btn" onClick={onNewRoster}>
            <Plus size={20} /> Erste Armeeliste ausheben
          </button>
        </div>
      ) : (() => {
        const rostersBySystemAndFaction = rosters.reduce((acc, roster) => {
          const sys = systems.find(s => s.id === roster.systemId);
          const systemName = sys ? sys.name : 'Unbekanntes System';
          
          const cat = sys?.catalogues?.find(c => c.id === roster.catalogueId);
          const factionName = cat ? cat.name : 'Keine Fraktion';
          
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
          if (a === 'Unbekanntes System') return 1;
          if (b === 'Unbekanntes System') return -1;
          return a.localeCompare(b);
        });

        return (
          <div className="system-groups-container" style={{ marginTop: '24px' }}>
            {sortedSystems.map(systemName => {
              const factionsObj = rostersBySystemAndFaction[systemName];
              const sortedFactions = Object.keys(factionsObj).sort((a, b) => {
                if (a === 'Keine Fraktion') return 1;
                if (b === 'Keine Fraktion') return -1;
                return a.localeCompare(b);
              });

              return (
                <div key={systemName} className="system-group" style={{ marginBottom: '40px' }}>
                  <h2 className="system-group-title" style={{ fontSize: '1.4rem', borderBottom: '2px solid var(--border-gold)', paddingBottom: '6px', marginBottom: '20px' }}>
                    {systemName}
                  </h2>
                  
                  <div className="system-factions" style={{ paddingLeft: '16px' }}>
                    {sortedFactions.map(factionName => {
                      const factionRosters = factionsObj[factionName];
                      return (
                        <div key={factionName} className="faction-group" style={{ marginBottom: '28px' }}>
                          <h3 className="faction-group-title" style={{ borderBottom: '1px solid var(--border-gold-dim)', paddingBottom: '4px', marginBottom: '14px', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {factionName}
                          </h3>
                          <div className="dashboard-grid" style={{ marginTop: '12px' }}>
                            {factionRosters.map(({ roster, sys, cat }) => {
                              const costTypeObj = sys?.costTypes?.find(ct => ct.id === roster.costLimitType);
                              const costTypeLabel = costTypeObj?.name || 'Punkte';
                              
                              return (
                                <div key={roster.id} className="roster-card" style={{ minHeight: 'auto', padding: '12px 16px' }}>
                                  <div className="roster-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <h4 className="roster-title" style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-serif)', flex: 1, paddingRight: '12px' }}>
                                      {roster.name}
                                      {showDebugIds && <span className="debug-id-badge" style={{ display: 'block', marginTop: '4px', width: 'fit-content' }}>{roster.id}</span>}
                                    </h4>
                                    <div className="roster-points" style={{ 
                                      fontSize: '1.25rem', 
                                      fontWeight: 'bold', 
                                      color: 'var(--text-gold)', 
                                      fontFamily: 'var(--font-body)',
                                      whiteSpace: 'nowrap',
                                      textAlign: 'right'
                                    }}>
                                      {roster.costLimit} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 'normal' }}>{costTypeLabel}</span>
                                    </div>
                                  </div>
                                  <div className="roster-actions" style={{ marginTop: '8px' }}>
                                    <button className="btn-sm" onClick={() => onOpenRoster(roster, 'builder')}>
                                      <Edit3 size={14} /> Ausrüsten
                                    </button>
                                    <button className="btn-primary btn-sm" onClick={() => onOpenRoster(roster, 'play')}>
                                      <Play size={14} /> In die Schlacht
                                    </button>
                                    <button 
                                      className="btn-danger btn-sm" 
                                      style={{ padding: '4px 6px', marginLeft: 'auto' }}
                                      onClick={(e) => onDeleteRoster(roster.id, e)}
                                    >
                                      <Trash2 size={12} />
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
        <button 
          className="fab-mobile mobile-only"
          onClick={onNewRoster}
          title="Neue Armeeliste"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}
