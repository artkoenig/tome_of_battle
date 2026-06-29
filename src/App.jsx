import React, { useState, useEffect } from 'react';
import { BookOpen, FolderOpen, Plus, Trash2, Shield, Play, Edit3, Bug, Search } from 'lucide-react';
import { getAllSystems, getAllRosters, saveRoster, deleteRoster } from './db/database';
import { runSystemMigrations } from './db/migrations';
import { useDebugMode } from './hooks/DebugContext';

import Importer from './components/Importer';
import RosterEditor from './components/RosterEditor';
import PlayMode from './components/PlayMode';
import DebugEntryEditorModal from './components/editor/DebugEntryEditorModal';
import { findExactEntryById, searchEditableEntries } from './parser/pdfRulesExtractor';

function GlobalDebugSearch({ systems, onSelectEntry }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    let allResults = [];
    for (const sys of systems) {
      const sysResults = searchEditableEntries(sys, query);
      sysResults.forEach(r => r.system = sys);
      allResults = allResults.concat(sysResults);
    }
    setResults(allResults.slice(0, 50));
  }, [query, systems]);

  return (
    <div style={{ position: 'relative', margin: '0 16px', flex: 1, maxWidth: '400px' }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
           type="text"
           placeholder="Globale Katalog-Suche..."
           value={query}
           onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
           onFocus={() => setIsOpen(true)}
           style={{ width: '100%', padding: '6px 12px 6px 32px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-gold-dim)', color: 'var(--text-gold)', borderRadius: '4px', outline: 'none' }}
        />
      </div>
      {isOpen && query.length >= 2 && (
         <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-gold-dim)', maxHeight: '400px', overflowY: 'auto', zIndex: 1000, marginTop: '4px', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
           {results.length === 0 ? (
             <div style={{ padding: '8px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>Keine Ergebnisse.</div>
           ) : (
             results.map((r, idx) => (
               <div 
                 key={idx} 
                 onClick={() => { 
                   onSelectEntry({ ref: r.ref, path: r.path, catalogueName: r.system.name }, r.system); 
                   setIsOpen(false); 
                   setQuery(''); 
                 }}
                 style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-dark)', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
               >
                 <span style={{ color: 'var(--text-gold)', fontWeight: 'bold', fontSize: '0.9rem' }}>{r.name}</span>
                 <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{r.type} • {r.system.name}</span>
               </div>
             ))
           )}
         </div>
      )}
    </div>
  );
}


export default function App() {
  const { showDebugIds, toggleShowDebugIds } = useDebugMode();
  const [view, setView] = useState('rosters'); // rosters, importer, builder, play
  const [systems, setSystems] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [selectedRoster, setSelectedRoster] = useState(null);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Modal State for new Roster
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRosterName, setNewRosterName] = useState('');
  const [newRosterSystemId, setNewRosterSystemId] = useState('');
  const [newRosterCatId, setNewRosterCatId] = useState('');
  const [newRosterLimit, setNewRosterLimit] = useState(2000);

  // Debug Edit Modal State
  const [debugEditingEntry, setDebugEditingEntry] = useState(null);
  const [debugEditingSystem, setDebugEditingSystem] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle global click on debug IDs
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (!showDebugIds) return;
      const badge = e.target.closest('.debug-id-badge.clickable');
      if (!badge) return;

      let rawIdText = badge.textContent.trim();
      if (!rawIdText) return;

      // Clean prefix if it contains ":"
      let clickedId = rawIdText;
      if (clickedId.includes(':')) {
        clickedId = clickedId.split(':').pop().trim();
      }

      // Clean brackets if it contains them
      clickedId = clickedId.replace(/[[\]]/g, '').trim();

      if (!clickedId) return;

      e.stopPropagation();
      e.preventDefault();

      let foundEntry = null;
      let foundSystem = null;

      // Search selected system first, then others
      const searchSystems = [...systems];
      if (selectedSystem) {
        const idx = searchSystems.findIndex(s => s.id === selectedSystem.id);
        if (idx > -1) {
          searchSystems.splice(idx, 1);
          searchSystems.unshift(selectedSystem);
        }
      }

      for (const sys of searchSystems) {
        const exactMatch = findExactEntryById(sys, clickedId);
        if (exactMatch) {
          foundEntry = exactMatch;
          foundSystem = sys;
          break;
        }
      }

      if (foundEntry && foundSystem) {
        setDebugEditingEntry(foundEntry);
        setDebugEditingSystem(foundSystem);
      }
    };

    const handleMouseDown = (e) => {
      if (!showDebugIds) return;
      if (e.target.closest('.debug-id-badge.clickable')) {
        e.preventDefault();
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [showDebugIds, systems, selectedSystem]);

  const handleDebugSave = (updatedSystem) => {
    setSystems(prev => prev.map(s => s.id === updatedSystem.id ? updatedSystem : s));
    if (selectedSystem && selectedSystem.id === updatedSystem.id) {
      setSelectedSystem(updatedSystem);
    }
  };

  const loadAllData = async () => {
    try {
      const dbSystems = await getAllSystems();
      const allSystems = await runSystemMigrations(dbSystems);
      
      const allRosters = await getAllRosters();
      setSystems(allSystems);
      setRosters(allRosters);

      if (allSystems.length > 0 && !newRosterSystemId) {
        setNewRosterSystemId(allSystems[0].id);
        if (allSystems[0].catalogues?.length > 0) {
          setNewRosterCatId(allSystems[0].catalogues[0].id);
        }
      }
      setIsDataLoaded(true);
    } catch (e) {
      console.error("Error loading index data:", e);
      setIsDataLoaded(true);
    }
  };

  // Handle game system selection change in new roster modal
  const handleSystemChange = (systemId) => {
    setNewRosterSystemId(systemId);
    const selectedSys = systems.find(s => s.id === systemId);
    if (selectedSys && selectedSys.catalogues?.length > 0) {
      setNewRosterCatId(selectedSys.catalogues[0].id);
    } else {
      setNewRosterCatId('');
    }
  };

  const handleCreateRoster = async (e) => {
    e.preventDefault();
    if (!newRosterName || !newRosterSystemId || !newRosterCatId) {
      alert("Bitte fülle alle Felder aus.");
      return;
    }

    const systemDef = systems.find(s => s.id === newRosterSystemId);
    const costType = systemDef?.costTypes?.[0]?.id || 'pts';

    const roster = {
      id: Math.random().toString(36).substr(2, 9),
      name: newRosterName,
      systemId: newRosterSystemId,
      catalogueId: newRosterCatId,
      costLimit: parseInt(newRosterLimit) || 2000,
      costLimitType: costType,
      forces: [{
        id: Math.random().toString(36).substr(2, 9),
        // Reference the first force organisation parsed from GST if exists
        forceEntryId: systemDef?.forceEntries?.[0]?.id || null,
        catalogueId: newRosterCatId,
        selections: []
      }],
      gameState: {
        round: 1,
        vp: 0,
        cp: 0,
        wounds: {}
      }
    };

    try {
      await saveRoster(roster);
      setIsModalOpen(false);
      setNewRosterName('');
      loadAllData();
      
      // Open editor
      setSelectedSystem(systemDef);
      setSelectedRoster(roster);
      setView('builder');
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen der Liste.");
    }
  };

  const handleOpenRoster = (roster, viewMode = 'builder') => {
    const sys = systems.find(s => s.id === roster.systemId);
    if (!sys) {
      alert("Das zugehörige Spielsystem wurde gelöscht. Importiere es erneut.");
      return;
    }
    setSelectedSystem(sys);
    setSelectedRoster(roster);
    setView(viewMode);
  };

  const handleDeleteRoster = async (id, e) => {
    e.stopPropagation();
    if (confirm("Möchtest du diese Armeeliste wirklich löschen?")) {
      try {
        await deleteRoster(id);
        loadAllData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Selected system for new roster helper
  const activeModalSystem = systems.find(s => s.id === newRosterSystemId);

  return (
    <div id="root" className={view !== 'rosters' && view !== 'importer' ? 'in-builder-mode' : ''}>
      {/* Premium Header */}
      <header className="app-header">
        <div className="logo-container">
          <Shield className="text-gold" size={28} />
          <span className="logo-text">TOME OF BATTLE</span>
        </div>
        
        {showDebugIds && (
          <GlobalDebugSearch 
            systems={systems} 
            onSelectEntry={(entryObj, systemObj) => {
              setDebugEditingEntry(entryObj);
              setDebugEditingSystem(systemObj);
            }} 
          />
        )}

        <div className="app-header-actions">
          <button 
            className="debug-id-btn mobile-only"
            onClick={toggleShowDebugIds}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: showDebugIds ? 'var(--text-gold)' : 'var(--border-dark)',
              background: showDebugIds ? 'rgba(226, 183, 66, 0.15)' : 'transparent',
              color: showDebugIds ? 'var(--text-gold)' : 'var(--text-dim)'
            }}
            title="Debugging: IDs ein-/ausblenden"
          >
            <Bug size={18} className={showDebugIds ? 'text-gold' : 'text-dim'} />
            <span style={{ fontSize: '0.85rem' }}>Debug</span>
          </button>
          
          {systems.length > 0 && (
            <div className="desktop-nav-actions">
              <button 
                className={view === 'rosters' ? 'btn-primary' : ''}
                onClick={() => { setView('rosters'); loadAllData(); }}
              >
                <FolderOpen size={18} /> Heerlager
              </button>
              <button 
                className={view === 'importer' ? 'btn-primary' : ''}
                onClick={() => { setView('importer'); loadAllData(); }}
              >
                <BookOpen size={18} /> Bibliothekar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-content">
        {!isDataLoaded ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <p className="text-dim" style={{ animation: 'pulse 2s infinite' }}>Öffne das Buch des Wissens...</p>
          </div>
        ) : systems.length === 0 ? (
          <Importer onSystemImported={loadAllData} showAsEmptyState={true} />
        ) : view === 'rosters' && (
          <div className="container">
            {rosters.length > 0 && (
              <div className="gothic-panel dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>Heerlager</h2>
                  <p className="text-dim" style={{ margin: 0 }}>Verwalte deine Armeelisten oder erstelle neue Feldzüge.</p>
                </div>
                <button className="btn-primary desktop-btn" onClick={() => setIsModalOpen(true)}>
                  <Plus size={18} /> Neue Armeeliste
                </button>
              </div>
            )}

            {rosters.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%',
                  maxWidth: '300px',
                  height: '300px',
                  backgroundImage: 'url(/skull_shield.png)',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  marginBottom: '20px',
                }} />
                <h3 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>Die Waffenkammern sind leer</h3>
                <p className="text-dim" style={{ maxWidth: '450px', margin: '0 auto 32px', fontSize: '1.1rem', lineHeight: '1.6' }}>
                  Noch wehen keine Banner in deinem Heerlager. Versammle deine Truppen, wähle deine Anführer und bereite dich auf kommende Schlachten vor.
                </p>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '14px 28px', fontSize: '1.1rem' }}>
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
                                          <button className="btn-sm" onClick={() => handleOpenRoster(roster, 'builder')}>
                                            <Edit3 size={14} /> Ausrüsten
                                          </button>
                                          <button className="btn-primary btn-sm" onClick={() => handleOpenRoster(roster, 'play')}>
                                            <Play size={14} /> In die Schlacht
                                          </button>
                                          <button 
                                            className="btn-danger btn-sm" 
                                            style={{ padding: '4px 6px', marginLeft: 'auto' }}
                                            onClick={(e) => handleDeleteRoster(roster.id, e)}
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

            <button 
              className="fab-mobile mobile-only"
              onClick={() => setIsModalOpen(true)}
              title="Neue Armeeliste"
            >
              <Plus size={24} />
            </button>
          </div>
        )}

        {view === 'importer' && (
          <Importer onSystemImported={loadAllData} />
        )}

        {view === 'builder' && selectedRoster && selectedSystem && (
          <RosterEditor 
            system={selectedSystem}
            roster={selectedRoster}
            onBack={() => setView('rosters')}
            onPlay={(updatedRoster) => handleOpenRoster(updatedRoster, 'play')}
          />
        )}

        {view === 'play' && selectedRoster && selectedSystem && (
          <PlayMode 
            system={selectedSystem}
            roster={selectedRoster}
            onBack={() => handleOpenRoster(selectedRoster, 'builder')}
          />
        )}
      </main>

      {/* New Roster Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Neues Heer ausheben</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>X</button>
            </div>
            <form onSubmit={handleCreateRoster}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Name des Heeres</label>
                  <input 
                    type="text" 
                    placeholder="z. B. Ultramarines 2. Kompanie" 
                    value={newRosterName}
                    onChange={(e) => setNewRosterName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Spielsystem</label>
                  <select 
                    value={newRosterSystemId} 
                    onChange={(e) => handleSystemChange(e.target.value)}
                    required
                  >
                    <option value="" disabled>System auswählen...</option>
                    {systems.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{showDebugIds ? ` [ID: ${s.id}]` : ''}
                      </option>
                    ))}
                  </select>
                  {systems.length === 0 && (
                    <p className="text-danger" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Keine Spielsysteme importiert. Bitte gehe erst in den Bibliothekar.
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Katalog / Fraktion</label>
                  <select 
                    value={newRosterCatId}
                    onChange={(e) => setNewRosterCatId(e.target.value)}
                    required
                    disabled={!newRosterSystemId || activeModalSystem?.catalogues?.length === 0}
                  >
                    <option value="" disabled>Fraktion auswählen...</option>
                    {activeModalSystem?.catalogues?.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}{showDebugIds ? ` [ID: ${cat.id}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Punktegrenze</label>
                  <input 
                    type="number" 
                    value={newRosterLimit}
                    onChange={(e) => setNewRosterLimit(e.target.value)}
                    required
                    min={1}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setIsModalOpen(false)}>Abbrechen</button>
                <button type="submit" className="btn-primary" disabled={systems.length === 0}>
                  Heerschau starten
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debug Entry Editor Modal */}
      {debugEditingEntry && debugEditingSystem && (
        <DebugEntryEditorModal
          entry={debugEditingEntry}
          system={debugEditingSystem}
          onClose={() => {
            setDebugEditingEntry(null);
            setDebugEditingSystem(null);
          }}
          onSave={handleDebugSave}
        />
      )}

      {/* Mobile Bottom Navigation */}
      {systems.length > 0 && (
        <nav className="mobile-bottom-nav mobile-only">
          <button className={`mobile-nav-btn ${view === 'rosters' ? 'active' : ''}`} onClick={() => { setView('rosters'); loadAllData(); }}>
            <FolderOpen size={20} />
            <span>Heerlager</span>
          </button>
          <button className={`mobile-nav-btn ${view === 'importer' ? 'active' : ''}`} onClick={() => { setView('importer'); loadAllData(); }}>
            <BookOpen size={20} />
            <span>Bibliothekar</span>
          </button>
        </nav>
      )}
    </div>
  );
}
