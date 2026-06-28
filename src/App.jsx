import React, { useState, useEffect } from 'react';
import { BookOpen, FolderOpen, Plus, Trash2, Shield, Play, Edit3 } from 'lucide-react';
import { getAllSystems, getAllRosters, saveRoster, deleteRoster } from './db/database';
import { runSystemMigrations } from './db/migrations';

import Importer from './components/Importer';
import RosterEditor from './components/RosterEditor';
import PlayMode from './components/PlayMode';

export default function App() {
  const [view, setView] = useState('rosters'); // rosters, importer, builder, play
  const [systems, setSystems] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [selectedRoster, setSelectedRoster] = useState(null);
  const [selectedSystem, setSelectedSystem] = useState(null);

  // Modal State for new Roster
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRosterName, setNewRosterName] = useState('');
  const [newRosterSystemId, setNewRosterSystemId] = useState('');
  const [newRosterCatId, setNewRosterCatId] = useState('');
  const [newRosterLimit, setNewRosterLimit] = useState(2000);

  useEffect(() => {
    loadAllData();
  }, []);

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
    } catch (e) {
      console.error("Error loading index data:", e);
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
    <div id="root">
      {/* Premium Header */}
      <header className="app-header">
        <div className="logo-container">
          <Shield className="text-gold" size={28} />
          <span className="logo-text">TOME OF BATTLE</span>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
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
            <BookOpen size={18} /> BSData Bibliothekar
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-content">
        {view === 'rosters' && (
          <div className="container">
            <div className="gothic-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Heerlager</h2>
                <p className="text-dim" style={{ margin: 0 }}>Verwalte deine Armeelisten oder erstelle neue Feldzüge.</p>
              </div>
              <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} /> Neue Armeeliste
              </button>
            </div>

            {rosters.length === 0 ? (
              <div className="gothic-panel" style={{ textAlign: 'center', padding: '60px 0' }}>
                <Shield className="text-dim" size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <h3>Keine Heere ausgehoben</h3>
                <p className="text-dim">Erstelle eine neue Armeeliste, um deine Streitkräfte zusammenzustellen.</p>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ marginTop: '12px' }}>
                  Jetzt Armeeliste erstellen
                </button>
              </div>
            ) : (
              <div className="dashboard-grid">
                {rosters.map(roster => {
                  const sys = systems.find(s => s.id === roster.systemId);
                  const cat = sys?.catalogues?.find(c => c.id === roster.catalogueId);
                  
                  return (
                    <div key={roster.id} className="roster-card">
                      <div className="roster-card-header">
                        <div>
                          <h3 className="roster-title">{roster.name}</h3>
                          <div className="roster-meta">
                            {sys ? sys.name : 'Unbekanntes System'}
                          </div>
                          <div className="roster-meta" style={{ color: 'var(--text-gold)', marginTop: '2px' }}>
                            Fraktion: {cat ? cat.name : 'Keine'}
                          </div>
                        </div>
                      </div>
                      <div className="roster-info">
                        <span className="font-sans" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                          Punktegrenze: {roster.costLimit} {roster.costLimitType.toUpperCase()}
                        </span>
                      </div>
                      <div className="roster-actions">
                        <button className="btn-sm" onClick={() => handleOpenRoster(roster, 'builder')}>
                          <Edit3 size={14} /> Ausrüsten
                        </button>
                        <button className="btn-primary btn-sm" onClick={() => handleOpenRoster(roster, 'play')}>
                          <Play size={14} /> In die Schlacht
                        </button>
                        <button 
                          className="btn-danger btn-sm" 
                          style={{ padding: '6px 8px', marginLeft: 'auto' }}
                          onClick={(e) => handleDeleteRoster(roster.id, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                      <option key={s.id} value={s.id}>{s.name}</option>
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
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
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
    </div>
  );
}
