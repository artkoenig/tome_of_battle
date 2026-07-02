import React, { useState, useEffect } from 'react';
import { BookOpen, FolderOpen, Plus, Trash2, Play, Edit3, Bug, Search, WifiOff, Download } from 'lucide-react';
import { getAllSystems, getAllRosters, saveRoster, deleteRoster } from './db/database';
import { runSystemMigrations } from './db/migrations';
import { useDebugMode } from './hooks/DebugContext';
import { getAvailableForceEntries } from './solver/validator';

import Importer from './components/Importer';
import RosterEditor from './components/RosterEditor';
import PlayMode from './components/PlayMode';
import DebugEntryEditorModal from './components/editor/DebugEntryEditorModal';
import GlobalDebugSearch from './components/editor/GlobalDebugSearch';
import NewRosterModal from './components/editor/NewRosterModal';
import RosterDashboard from './components/RosterDashboard';

import { findExactEntryById, searchEditableEntries } from './parser/catalogEditor';



export default function App() {
  const { showDebugIds, toggleShowDebugIds } = useDebugMode();
  const isLocal = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('172.16.') ||
    window.location.hostname.startsWith('127.')
  );
  const [view, setView] = useState('rosters'); // rosters, importer, builder, play
  const [systems, setSystems] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [selectedRoster, setSelectedRoster] = useState(null);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // PWA & Network states
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    const handleUpdateAvailable = (e) => {
      setWaitingWorker(e.detail);
      setUpdateAvailable(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const handleReloadApp = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  // Modal State for new Roster
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRosterName, setNewRosterName] = useState('');
  const [newRosterSystemId, setNewRosterSystemId] = useState('');
  const [newRosterCatId, setNewRosterCatId] = useState('');
  const [newRosterForceEntryId, setNewRosterForceEntryId] = useState('');
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
        let exactMatch = findExactEntryById(sys, clickedId);
        if (exactMatch) {
          if (exactMatch.type === 'entryLink' && exactMatch.ref?.targetId) {
            const targetMatch = findExactEntryById(sys, exactMatch.ref.targetId);
            if (targetMatch) {
              exactMatch = targetMatch;
            }
          }
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
        const defaultSys = allSystems[0];
        setNewRosterSystemId(defaultSys.id);
        const defaultCatId = defaultSys.catalogues?.length > 0 ? defaultSys.catalogues[0].id : '';
        setNewRosterCatId(defaultCatId);
        
        const avail = getAvailableForceEntries(defaultSys, defaultCatId);
        if (avail.length > 0) {
          setNewRosterForceEntryId(avail[0].id);
        } else {
          setNewRosterForceEntryId('');
        }
      }
      setIsDataLoaded(true);
    } catch (e) {
      console.error("Error loading index data:", e);
      setIsDataLoaded(true);
    }
  };

  const handleSystemImported = () => {
    loadAllData();
    setView('rosters');
  };


  // Handle game system selection change in new roster modal
  const handleSystemChange = (systemId) => {
    setNewRosterSystemId(systemId);
    const selectedSys = systems.find(s => s.id === systemId);
    let defaultCatId = '';
    if (selectedSys && selectedSys.catalogues?.length > 0) {
      defaultCatId = selectedSys.catalogues[0].id;
    }
    setNewRosterCatId(defaultCatId);
    
    if (selectedSys) {
      const avail = getAvailableForceEntries(selectedSys, defaultCatId);
      if (avail.length > 0) {
        setNewRosterForceEntryId(avail[0].id);
      } else {
        setNewRosterForceEntryId('');
      }
    } else {
      setNewRosterForceEntryId('');
    }
  };

  const handleCatalogueChange = (catId) => {
    setNewRosterCatId(catId);
    const selectedSys = systems.find(s => s.id === newRosterSystemId);
    if (selectedSys) {
      const avail = getAvailableForceEntries(selectedSys, catId);
      if (avail.length > 0) {
        setNewRosterForceEntryId(avail[0].id);
      } else {
        setNewRosterForceEntryId('');
      }
    } else {
      setNewRosterForceEntryId('');
    }
  };

  const handleOpenNewRosterModal = () => {
    setIsModalOpen(true);
    setNewRosterName('');
    if (systems.length > 0) {
      const defaultSys = systems[0];
      setNewRosterSystemId(defaultSys.id);
      const defaultCatId = defaultSys.catalogues?.length > 0 ? defaultSys.catalogues[0].id : '';
      setNewRosterCatId(defaultCatId);
      
      const avail = getAvailableForceEntries(defaultSys, defaultCatId);
      if (avail.length > 0) {
        setNewRosterForceEntryId(avail[0].id);
      } else {
        setNewRosterForceEntryId('');
      }
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
      id: crypto.randomUUID(),
      name: newRosterName,
      systemId: newRosterSystemId,
      catalogueId: newRosterCatId,
      costLimit: parseInt(newRosterLimit) || 2000,
      costLimitType: costType,
      forces: [{
        id: crypto.randomUUID(),
        forceEntryId: newRosterForceEntryId || systemDef?.forceEntries?.[0]?.id || null,
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

  const handleRenameRoster = async (roster, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === roster.name) return;
    try {
      await saveRoster({ ...roster, name: trimmed });
      loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Selected system for new roster helper
  const activeModalSystem = systems.find(s => s.id === newRosterSystemId);

  return (
    <div id="root" className={view !== 'rosters' && view !== 'importer' ? 'in-builder-mode' : ''}>
      {/* Premium Header */}
      <header className="app-header">
        <div className="logo-container">
          <img src="/favicon.png" className="logo-icon" alt="Tome of Battle Logo" />
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
          {isOffline && (
            <div 
              className="offline-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(166, 28, 28, 0.15)',
                borderColor: 'var(--color-danger)',
                borderWidth: '1px',
                borderStyle: 'solid',
                color: 'var(--color-danger)',
                padding: '6px 12px',
                borderRadius: '4px'
              }}
              title="Offline-Modus aktiv"
            >
              <WifiOff size={18} className="text-danger" />
              <span className="hide-on-mobile">Offline</span>
            </div>
          )}

          {isInstallable && (
            <button 
              className="install-app-btn"
              onClick={handleInstallClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'var(--border-gold)',
                background: 'rgba(226, 183, 66, 0.15)',
                color: 'var(--text-gold)',
                cursor: 'pointer'
              }}
              title="App auf dem Gerät installieren"
            >
              <Download size={18} className="text-gold" />
              <span className="hide-on-mobile text-label">Installieren</span>
            </button>
          )}

          {isLocal && (
            <button 
              className="debug-id-btn"
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
              <span className="text-label">Debug</span>
            </button>
          )}
          
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
          <Importer onSystemImported={handleSystemImported} showAsEmptyState={true} />
        ) : (
          <>
            {view === 'rosters' && (
              <RosterDashboard
                rosters={rosters}
                systems={systems}
                showDebugIds={showDebugIds}
                onOpenRoster={handleOpenRoster}
                onDeleteRoster={handleDeleteRoster}
                onRenameRoster={handleRenameRoster}
                onNewRoster={handleOpenNewRosterModal}
                isOffline={isOffline}
                isInstallable={isInstallable}
                onInstallClick={handleInstallClick}
              />
            )}

            {view === 'importer' && (
              <Importer onSystemImported={handleSystemImported} />
            )}

            {view === 'builder' && selectedRoster && selectedSystem && (
              <RosterEditor 
                system={selectedSystem}
                roster={selectedRoster}
                onBack={() => { setView('rosters'); loadAllData(); }}
                onPlay={(updatedRoster) => handleOpenRoster(updatedRoster, 'play')}
              />
            )}

            {view === 'play' && selectedRoster && selectedSystem && (
              <PlayMode 
                system={selectedSystem}
                roster={selectedRoster}
                onBack={() => { setView('rosters'); loadAllData(); }}
              />
            )}
          </>
        )}
      </main>

      {/* New Roster Modal */}
      <NewRosterModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateRoster}
        systems={systems}
        newRosterName={newRosterName}
        setNewRosterName={setNewRosterName}
        newRosterSystemId={newRosterSystemId}
        handleSystemChange={handleSystemChange}
        newRosterCatId={newRosterCatId}
        handleCatalogueChange={handleCatalogueChange}
        newRosterForceEntryId={newRosterForceEntryId}
        setNewRosterForceEntryId={setNewRosterForceEntryId}
        newRosterLimit={newRosterLimit}
        setNewRosterLimit={setNewRosterLimit}
      />

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
      {/* Update Available Toast Notification */}
      {updateAvailable && (
        <div className="update-toast">
          <div className="update-toast-content">
            <span className="font-serif text-gold update-toast-title">Update verfügbar!</span>
            <span className="update-toast-desc">Eine neue Version wurde im Hintergrund geladen.</span>
          </div>
          <button className="btn-primary btn-sm update-toast-btn" onClick={handleReloadApp}>
            Neu laden
          </button>
        </div>
      )}
    </div>
  );
}
