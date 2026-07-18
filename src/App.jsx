import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FolderOpen, Plus, Trash2, Play, Edit3, Search, WifiOff, Download, Settings } from 'lucide-react';
import { getAllSystems, getAllRosters, saveRoster, deleteRoster } from './db/database';
import { runSystemMigrations } from './db/migrations';
import { fetchCatalogText } from './db/catalogUpdate';

import Importer from './components/Importer';
import RosterEditor from './components/RosterEditor';
import PlayMode from './components/PlayMode';
import NewRosterModal from './components/editor/NewRosterModal';
import RosterDashboard from './components/RosterDashboard';
import EnvBadge from './components/EnvBadge';
import SettingsDialog from './components/SettingsDialog';
import ConfirmationDialog from './components/editor/ConfirmationDialog';
import { SettingsProvider } from './contexts/SettingsContext';
import { 
  exportRosterToXml, 
  importRosterFromXml, 
  compressXmlToRosz, 
  decompressRoszToXml,
  MissingSystemError 
} from './utils/rosterSerialization';


import { syncRosterSelectionsWithSystem, reconcileImportedSelectionIds } from './solver/validator';
import useViewportHeight from './hooks/useViewportHeight';
export function getDiffChanges(installedVersion, release) {
  if (!release) return [];
  if (!release.commits || !release.tags) {
    return release.changes || [];
  }

  let installedHash = '';
  if (installedVersion) {
    if (installedVersion.includes('+')) {
      installedHash = installedVersion.split('+')[1];
    } else {
      const matchedTag = release.tags.find(
        t => t.name.toLowerCase() === installedVersion.toLowerCase()
      );
      if (matchedTag) {
        installedHash = matchedTag.hash;
      }
    }
  }

  if (installedHash) {
    const targetHash = installedHash.toLowerCase();
    const installedIndex = release.commits.findIndex(c => {
      const h = c.hash.toLowerCase();
      return h === targetHash || 
             (h.length >= 7 && targetHash.startsWith(h)) || 
             (targetHash.length >= 7 && h.startsWith(targetHash));
    });

    if (installedIndex !== -1) {
      const diff = release.commits.slice(0, installedIndex).map(c => c.subject);
      if (diff.length > 50) {
        return [...diff.slice(0, 50), '...und weitere Einträge.'];
      }
      return diff;
    }
  }

  // Fallback: If hash not found or too old (> 100 commits behind),
  // show the latest 50 commits from the list plus the note.
  const allCommits = release.commits.map(c => c.subject);
  if (allCommits.length > 50) {
    return [...allCommits.slice(0, 50), '...und weitere Einträge.'];
  }
  return allCommits.length > 0 ? allCommits : (release.changes || []);
}

export default function App() {
  // Keep --app-vh in sync with the real visible viewport height so mobile
  // layout (#root, .empty-state-wrapper) sizes against the area actually
  // visible below collapsing browser chrome.
  useViewportHeight();

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
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

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
  const [rosterToDelete, setRosterToDelete] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const loadAllData = async () => {
    try {
      const dbSystems = await getAllSystems();
      const { systems: allSystems, failures } = await runSystemMigrations(dbSystems, fetchCatalogText);
      if (failures.length > 0) {
        showToast(
          `Konnte folgende Systeme nicht aktualisieren, alter Stand wird weiterverwendet: ${failures.map(f => f.name).join(', ')}`,
          'error'
        );
      }

      const allRosters = await getAllRosters();
      setSystems(allSystems);
      setRosters(allRosters);
      setIsDataLoaded(true);
    } catch (e) {
      console.error("Error loading index data:", e);
      setIsDataLoaded(true);
    }
  };

  // Awaits the data reload before switching views so the first-import path
  // (empty state -> Heerlager) has `systems` populated by the time the Importer's
  // loading overlay comes down — otherwise the empty Importer flashes for a frame
  // between the overlay and the RosterDashboard.
  const handleSystemImported = async () => {
    await loadAllData();
    navigate('rosters');
  };


  const handleCreateRoster = async ({ name, systemId, catId, forceEntryId, limit }) => {
    if (!name || !systemId || !catId) {
      showToast("Bitte fülle alle Felder aus.", 'error');
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
      showToast("Fehler beim Erstellen der Liste.", 'error');
    }
  };

  const handleOpenRoster = (roster, viewMode = 'builder') => {
    const sys = systems.find(s => s.id === roster.systemId);
    if (!sys) {
      showToast("Das zugehörige Spielsystem wurde gelöscht. Importiere es erneut.", 'error');
      return;
    }
    navigate(viewMode, { roster, system: sys });
  };

  const handleDeleteRoster = (id, e) => {
    e.stopPropagation();
    const roster = rosters.find(r => r.id === id);
    if (roster) {
      setRosterToDelete(roster);
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

  const handleImportRoster = async (file) => {
    try {
      const xmlText = await decompressRoszToXml(file);
      const newRoster = importRosterFromXml(xmlText, systems);
      
      const system = systems.find(s => s.id === newRoster.systemId);
      if (system) {
        // Imported files reference options by target id; realign them to the
        // catalogue link ids the editor matches before syncing names/costs.
        reconcileImportedSelectionIds(newRoster, system);
        syncRosterSelectionsWithSystem(newRoster, system);
      }
      
      await saveRoster(newRoster);
      showToast(`Erfolgreich importiert: ${newRoster.name}`);
      loadAllData();
    } catch (err) {
      console.error('Import error:', err);
      if (err instanceof MissingSystemError) {
        showToast(err.message, 'error');
      } else {
        showToast(`Fehler beim Importieren: ${err.message || 'Ungültiges Dateiformat.'}`, 'error');
      }
    }
  };

  const handleExportRoster = async (roster) => {
    try {
      const system = systems.find(s => s.id === roster.systemId);
      if (!system) {
        showToast("Das zugehörige Spielsystem fehlt. Der Export kann nicht durchgeführt werden.", 'error');
        return;
      }
      
      const xmlText = exportRosterToXml(roster, system);
      const roszBlob = await compressXmlToRosz(roster.name, xmlText);
      
      const url = URL.createObjectURL(roszBlob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedName = roster.name.replace(/[/\\?%*:|"<>]/g, '_');
      a.download = `${sanitizedName}.rosz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      showToast(`Fehler beim Exportieren: ${err.message || 'Export fehlgeschlagen.'}`, 'error');
    }
  };

  const diffChanges = getDiffChanges(import.meta.env.VITE_APP_VERSION, updateRelease);

  return (
    <SettingsProvider>
    <div id="root" className={view !== 'rosters' && view !== 'importer' ? 'in-builder-mode' : ''}>
      {/* Premium Header */}
      <header className="app-header">
        <div className="logo-container">
          <img src="/favicon.png" className="logo-icon" alt="Tome of Battle Logo" />
          <div className="logo-title-group">
            <span className="logo-text">TOME OF BATTLE</span>
          </div>
          <EnvBadge />
        </div>
        
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

          <button
            className="header-settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Einstellungen"
            aria-label="Einstellungen"
          >
            <Settings size={18} />
          </button>
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
                onOpenRoster={handleOpenRoster}
                onDeleteRoster={handleDeleteRoster}
                onRenameRoster={handleRenameRoster}
                onNewRoster={() => setIsModalOpen(true)}
                isOffline={isOffline}
                isInstallable={isInstallable}
                onInstallClick={handleInstallClick}
                onImportRoster={handleImportRoster}
                onExportRoster={handleExportRoster}
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
                onExportRoster={handleExportRoster}
              />
            )}

            {view === 'play' && selectedRoster && selectedSystem && (
              <PlayMode 
                system={selectedSystem}
                roster={selectedRoster}
                onBack={() => { navigate('builder', { roster: selectedRoster, system: selectedSystem }); }}
              />
            )}
          </>
        )}
      </main>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* New Roster Modal */}
      <NewRosterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateRoster}
        systems={systems}
      />

      {/* Confirmation Dialog for deleting Roster */}
      <ConfirmationDialog
        isOpen={!!rosterToDelete}
        onClose={() => setRosterToDelete(null)}
        onConfirm={async () => {
          if (!rosterToDelete) return;
          const id = rosterToDelete.id;
          setRosterToDelete(null);
          try {
            await deleteRoster(id);
            loadAllData();
          } catch (err) {
            console.error(err);
          }
        }}
        title="Armeeliste löschen"
        message={
          <>
            Möchtest du die Armeeliste <strong>{rosterToDelete?.name}</strong> wirklich löschen?
          </>
        }
        confirmLabel="Löschen"
        isDanger={true}
      />

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
            <span className="font-serif text-gold update-toast-title">Chronik der Veränderungen</span>
            {updateRelease && diffChanges.length > 0 ? (
              <div className="update-toast-changes">
                <span className="update-toast-changes-heading">
                  {updateRelease.version ? `Version ${updateRelease.version}` : 'Das ist neu'}
                  {updateRelease.date ? ` · ${updateRelease.date}` : ''}:
                </span>
                <ul className="update-toast-change-list">
                  {diffChanges.map((change, i) => (
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
      {/* Global Toast Notification */}
      {toast && (
        <div className={`gothic-toast toast-${typeof toast === 'object' ? toast.type : 'success'}`} style={{ pointerEvents: 'none' }}>
          <span>{typeof toast === 'object' ? toast.message : toast}</span>
        </div>
      )}
    </div>
    </SettingsProvider>
  );
}
