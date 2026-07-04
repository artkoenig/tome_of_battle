import React, { useState, useEffect } from 'react';
import { BookOpen, FolderOpen, Plus, Trash2, Play, Edit3, Bug, Search, WifiOff, Download } from 'lucide-react';
import { getAllSystems, getAllRosters, saveRoster, deleteRoster } from './db/database';
import { runSystemMigrations } from './db/migrations';
import { useDebugMode } from './hooks/DebugContext';

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
  const [updateRelease, setUpdateRelease] = useState(null);

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
      const detail = e.detail || {};
      // detail may be the plain worker (legacy shape) or { worker, release }.
      const worker = detail.worker || detail;
      setWaitingWorker(worker);
      setUpdateRelease(detail.release || null);
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

  // Modal State for new Roster (Formular-State lebt im NewRosterModal selbst)
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debug Edit Modal State
  const [debugEditingEntry, setDebugEditingEntry] = useState(null);
  const [debugEditingSystem, setDebugEditingSystem] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  // Seed a base history entry so the first back-navigation has a defined target.
  useEffect(() => {
    window.history.replaceState({ view: 'rosters', rosterId: null }, '');
  }, []);

  // Support the browser/hardware back button: restore the view (and roster/system
  // context) that was active at that point in history, instead of leaving the app.
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state || { view: 'rosters', rosterId: null };
      const roster = state.rosterId ? rosters.find(r => r.id === state.rosterId) : null;
      const sys = roster ? systems.find(s => s.id === roster.systemId) : null;

      if (state.rosterId && roster && sys) {
        setSelectedRoster(roster);
        setSelectedSystem(sys);
      } else {
        setSelectedRoster(null);
        setSelectedSystem(null);
      }
      setView(state.view || 'rosters');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [rosters, systems]);

  // Navigates to a view and pushes a history entry, so the browser back button
  // returns to whatever view/roster was active before this call.
  const navigate = (nextView, { roster = null, system = null } = {}) => {
    const isSameEntry = nextView === view && (roster?.id || null) === (selectedRoster?.id || null);
    const historyState = { view: nextView, rosterId: roster?.id || null };

    if (isSameEntry) {
      window.history.replaceState(historyState, '');
    } else {
      window.history.pushState(historyState, '');
    }

    setView(nextView);
    setSelectedRoster(roster);
    setSelectedSystem(system);
  };

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
      setIsDataLoaded(true);
    } catch (e) {
      console.error("Error loading index data:", e);
      setIsDataLoaded(true);
    }
  };

  const handleSystemImported = () => {
    loadAllData();
    navigate('rosters');
  };


  const handleCreateRoster = async ({ name, systemId, catId, forceEntryId, limit }) => {
    if (!name || !systemId || !catId) {
      alert("Bitte fülle alle Felder aus.");
      return;
    }

    const systemDef = systems.find(s => s.id === systemId);
    const costType = systemDef?.costTypes?.[0]?.id || 'pts';

    const roster = {
      id: crypto.randomUUID(),
      name,
      systemId,
      catalogueId: catId,
      costLimit: parseInt(limit) || 2000,
      costLimitType: costType,
      forces: [{
        id: crypto.randomUUID(),
        forceEntryId: forceEntryId || systemDef?.forceEntries?.[0]?.id || null,
        catalogueId: catId,
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
      loadAllData();

      // Open editor
      navigate('builder', { roster, system: systemDef });
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
    navigate(viewMode, { roster, system: sys });
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
            <div className="offline-badge" title="Offline-Modus aktiv">
              <WifiOff size={18} className="text-danger" />
              <span className="hide-on-mobile">Offline</span>
            </div>
          )}

          {isInstallable && (
            <button
              className="install-app-btn"
              onClick={handleInstallClick}
              title="App auf dem Gerät installieren"
            >
              <Download size={18} className="text-gold" />
              <span className="hide-on-mobile text-label">Installieren</span>
            </button>
          )}

          {isLocal && (
            <button
              className={`debug-id-btn ${showDebugIds ? 'active' : ''}`}
              onClick={toggleShowDebugIds}
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
                onClick={() => { navigate('rosters'); loadAllData(); }}
              >
                <FolderOpen size={18} /> Heerlager
              </button>
              <button
                className={view === 'importer' ? 'btn-primary' : ''}
                onClick={() => { navigate('importer'); loadAllData(); }}
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
          <div className="app-loading-screen">
            <p className="text-dim">Öffne das Buch des Wissens...</p>
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
                onNewRoster={() => setIsModalOpen(true)}
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
                onBack={() => { navigate('rosters'); loadAllData(); }}
                onPlay={(updatedRoster) => handleOpenRoster(updatedRoster, 'play')}
              />
            )}

            {view === 'play' && selectedRoster && selectedSystem && (
              <PlayMode 
                system={selectedSystem}
                roster={selectedRoster}
                onBack={() => { navigate('rosters'); loadAllData(); }}
              />
            )}
          </>
        )}
      </main>

      {/* New Roster Modal */}
      <NewRosterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateRoster}
        systems={systems}
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
          <button className={`mobile-nav-btn ${view === 'rosters' ? 'active' : ''}`} onClick={() => { navigate('rosters'); loadAllData(); }}>
            <FolderOpen size={20} />
            <span>Heerlager</span>
          </button>
          <button className={`mobile-nav-btn ${view === 'importer' ? 'active' : ''}`} onClick={() => { navigate('importer'); loadAllData(); }}>
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
            {updateRelease && updateRelease.changes && updateRelease.changes.length > 0 ? (
              <div className="update-toast-changes">
                <span className="update-toast-changes-heading">
                  Das ist neu{updateRelease.date ? ` · ${updateRelease.date}` : ''}:
                </span>
                <ul className="update-toast-change-list">
                  {updateRelease.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <span className="update-toast-desc">Eine neue Version wurde im Hintergrund geladen.</span>
            )}
          </div>
          <button className="btn-primary btn-sm update-toast-btn" onClick={handleReloadApp}>
            Neu laden
          </button>
        </div>
      )}
    </div>
  );
}
