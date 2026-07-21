import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, FolderOpen, WifiOff, Download, Settings } from 'lucide-react';
import { getAllSystems, getAllRosters, saveRoster, deleteRoster } from './db/database';
import { runSystemMigrations } from './db/migrations';
import { fetchCatalogText } from './db/catalogUpdate';

import Importer from './components/Importer';
import RosterEditor from './components/RosterEditor';
import PlayMode from './components/PlayMode';
import NewRosterModal from './components/editor/NewRosterModal';
import RosterDashboard from './components/RosterDashboard';
import SettingsDialog from './components/SettingsDialog';
import ConfirmationDialog from './components/editor/ConfirmationDialog';
import PreviewBadge from './components/PreviewBadge';
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
import usePwaLifecycle from './hooks/usePwaLifecycle';
import { getDiffChanges } from './utils/releaseDiff';
import { DEFAULT_ROSTER_COST_LIMIT, createInitialGameState } from './utils/rosterDefaults';
import { VIEWS, isImmersiveView } from './constants/views';
import { Analytics } from '@vercel/analytics/react';

/** Der Ausgangspunkt der Verlaufs-Navigation: das Heerlager ohne offenes Roster. */
const INITIAL_HISTORY_STATE = Object.freeze({ view: VIEWS.ROSTERS, rosterId: null });

/** Anzeigedauer einer Toast-Benachrichtigung in Millisekunden. */
const TOAST_DURATION_MS = 3000;

/**
 * Meldungen der Vorgänge, die auf IndexedDB schreiben oder von dort lesen. Sie laufen
 * ohne Backend und ohne Konsole am Spieltisch — ein Fehlschlag muss den Nutzer über den
 * Toast-Kanal (ADR 0010) erreichen, sonst ist er von einem Erfolg nicht zu unterscheiden.
 */
const ERROR_MESSAGE = Object.freeze({
  createRoster: 'Fehler beim Erstellen der Liste.',
  renameRoster: 'Die Liste konnte nicht umbenannt werden.',
  deleteRoster: 'Die Liste konnte nicht gelöscht werden.',
  loadData: 'Die gespeicherten Spielsysteme und Listen konnten nicht geladen werden.',
});

export default function App() {
  // Keep --app-vh in sync with the real visible viewport height so mobile
  // layout (#root, .empty-state-wrapper) sizes against the area actually
  // visible below collapsing browser chrome.
  useViewportHeight();

  const [view, setView] = useState(VIEWS.ROSTERS);
  const [systems, setSystems] = useState([]);
  const [rosters, setRosters] = useState([]);
  // Einzige Quelle der Wahrheit für die Auswahl: die ID. Roster und System
  // werden daraus abgeleitet, damit eine Änderung an der Liste (etwa ein
  // Umbenennen) sofort in der geöffneten Ansicht sichtbar wird.
  const [selectedRosterId, setSelectedRosterId] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const selectedRoster = useMemo(
    () => rosters.find(r => r.id === selectedRosterId) || null,
    [rosters, selectedRosterId]
  );
  const selectedSystem = useMemo(
    () => (selectedRoster ? systems.find(s => s.id === selectedRoster.systemId) || null : null),
    [systems, selectedRoster]
  );

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const {
    isInstallable,
    promptInstall,
    isUpdateAvailable,
    updateRelease,
    applyUpdate,
  } = usePwaLifecycle();
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
    }, TOAST_DURATION_MS);
  };

  // Der zentrale Fehlerkanal der Anwendung (ADR 0010): Ansichten und Hooks, die selbst
  // keine Oberfläche für Fehler besitzen — Autosave, Spielstand, Import —, reichen ihre
  // Meldung hierher, statt sie in der Konsole enden zu lassen.
  const reportError = (message) => showToast(message, 'error');

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Modal State for new Roster (Formular-State lebt im NewRosterModal selbst)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rosterToDelete, setRosterToDelete] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  // Seed a base history entry so the first back-navigation has a defined target.
  useEffect(() => {
    window.history.replaceState(INITIAL_HISTORY_STATE, '');
  }, []);

  // Support the browser/hardware back button: restore the view (and the selected
  // roster) that was active at that point in history, instead of leaving the app.
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state || INITIAL_HISTORY_STATE;
      setSelectedRosterId(state.rosterId || null);
      setView(state.view || VIEWS.ROSTERS);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigates to a view and pushes a history entry, so the browser back button
  // returns to whatever view/roster was active before this call.
  const navigate = (nextView, rosterId = null) => {
    const isSameEntry = nextView === view && rosterId === selectedRosterId;
    const historyState = { view: nextView, rosterId };

    if (isSameEntry) {
      window.history.replaceState(historyState, '');
    } else {
      window.history.pushState(historyState, '');
    }

    setView(nextView);
    setSelectedRosterId(rosterId);
  };

  // Übernimmt einen frisch bearbeiteten Roster-Stand in die Liste, damit die
  // abgeleitete Auswahl (und jede andere Ansicht) denselben Stand sieht.
  const updateRosterInList = (updatedRoster) => {
    setRosters(prev => prev.map(r => (r.id === updatedRoster.id ? updatedRoster : r)));
  };

  // Loads systems and rosters from IndexedDB into state. Local and fast — it never
  // touches the network — and returns the loaded systems so a caller can hand them
  // to the background catalog refresh without reloading them.
  const loadLocalData = async () => {
    const dbSystems = await getAllSystems();
    const allRosters = await getAllRosters();
    setSystems(dbSystems);
    setRosters(allRosters);
    setIsDataLoaded(true);
    return dbSystems;
  };

  // Checks the remote catalog for newer revisions and republishes the refreshed
  // systems. This performs a real network request, so it is written to be safe to
  // run un-awaited in the background: a refresh failure stays invisible (the catalog
  // is only a cache) apart from the existing per-system toast on partial failures.
  const refreshCatalogInBackground = async (dbSystems) => {
    try {
      const { systems: refreshedSystems, failures } = await runSystemMigrations(dbSystems, fetchCatalogText);
      if (failures.length > 0) {
        showToast(
          `Konnte folgende Systeme nicht aktualisieren, alter Stand wird weiterverwendet: ${failures.map(f => f.name).join(', ')}`,
          'error'
        );
      }
      setSystems(refreshedSystems);
    } catch (e) {
      // Bewusst nur Protokoll: der Katalog ist ein Cache, der gespeicherte Stand bleibt
      // nutzbar. Was der Nutzer wissen muss — nicht aktualisierbare Systeme — meldet
      // bereits der Toast oberhalb.
      console.error("Error refreshing catalog in background:", e);
    }
  };

  // Ein fehlgeschlagener Lesevorgang bedeutet eine leere oder unvollständige Oberfläche;
  // ohne Meldung wäre sie von "noch keine Daten importiert" nicht zu unterscheiden.
  const reportLoadFailure = (error) => {
    console.error("Error loading index data:", error);
    showToast(ERROR_MESSAGE.loadData, 'error');
    setIsDataLoaded(true);
  };

  // Reloads everything and also waits for the catalog refresh. Used by callers that
  // are not gated behind a loading overlay (tab switches, roster CRUD), where waiting
  // for the network round-trip is acceptable.
  const loadAllData = async () => {
    try {
      const dbSystems = await loadLocalData();
      await refreshCatalogInBackground(dbSystems);
    } catch (e) {
      reportLoadFailure(e);
    }
  };

  // Awaits only the local IndexedDB reload before switching views so the first-import
  // path (empty state -> Heerlager) has `systems` populated by the time the Importer's
  // loading overlay comes down — otherwise the empty Importer flashes for a frame
  // between the overlay and the RosterDashboard. The catalog refresh is a network
  // round-trip and must NOT gate leaving the overlay, so it runs in the background and
  // republishes the systems (and surfaces its failure toast) once it finishes.
  const handleSystemImported = async () => {
    let dbSystems = [];
    try {
      dbSystems = await loadLocalData();
    } catch (e) {
      reportLoadFailure(e);
    }
    navigate(VIEWS.ROSTERS);
    refreshCatalogInBackground(dbSystems);
  };


  const handleCreateRoster = async ({ name, systemId, catId, forceEntryId, limit }) => {
    if (!name || !systemId || !catId) {
      showToast("Bitte fülle alle Felder aus.", 'error');
      return;
    }

    const systemDef = systems.find(s => s.id === systemId);
    // Ein neues Roster wird in der ersten vom System deklarierten Kostenart geführt;
    // eine Kostenart-id ist katalogspezifisch und darf nicht erfunden werden.
    const costType = systemDef?.costTypes?.[0]?.id ?? null;

    const roster = {
      id: crypto.randomUUID(),
      name,
      systemId,
      catalogueId: catId,
      costLimit: parseInt(limit) || DEFAULT_ROSTER_COST_LIMIT,
      costLimitType: costType,
      forces: [{
        id: crypto.randomUUID(),
        forceEntryId: forceEntryId || systemDef?.forceEntries?.[0]?.id || null,
        catalogueId: catId,
        selections: []
      }],
      gameState: createInitialGameState()
    };

    try {
      await saveRoster(roster);
      setIsModalOpen(false);
      // Die neue Liste sofort veröffentlichen, damit die abgeleitete Auswahl
      // den Editor öffnen kann, ohne auf das Neuladen aus der DB zu warten.
      setRosters(prev => [...prev, roster]);
      loadAllData();

      // Open editor
      navigate(VIEWS.BUILDER, roster.id);
    } catch (err) {
      console.error(err);
      showToast(ERROR_MESSAGE.createRoster, 'error');
    }
  };

  const handleOpenRoster = (roster, viewMode = VIEWS.BUILDER) => {
    const sys = systems.find(s => s.id === roster.systemId);
    if (!sys) {
      showToast("Das zugehörige Spielsystem wurde gelöscht. Importiere es erneut.", 'error');
      return;
    }
    navigate(viewMode, roster.id);
  };

  // Der Editor hält den aktuellsten Stand der Liste; er wird in die Liste
  // übernommen, bevor der Spielmodus ihn aus der Auswahl ableitet.
  const handlePlayRoster = (updatedRoster) => {
    updateRosterInList(updatedRoster);
    handleOpenRoster(updatedRoster, VIEWS.PLAY);
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
      showToast(ERROR_MESSAGE.renameRoster, 'error');
    }
  };

  const handleImportRoster = async (file) => {
    try {
      const xmlText = await decompressRoszToXml(file);
      let newRoster = importRosterFromXml(xmlText, systems);

      const system = systems.find(s => s.id === newRoster.systemId);
      if (system) {
        // Imported files reference options by target id; realign them to the
        // catalogue link ids the editor matches before syncing names/costs.
        newRoster = reconcileImportedSelectionIds(newRoster, system);
        newRoster = syncRosterSelectionsWithSystem(newRoster, system);
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
    <div id="root" className={isImmersiveView(view) ? 'in-builder-mode' : ''}>
      {/* Premium Header */}
      <header className="app-header">
        <div className="logo-container">
          <img src="/favicon.png" className="logo-icon" alt="Tome of Battle Logo" />
          <div className="logo-title-group">
            <span className="logo-text">TOME OF BATTLE</span>
          </div>
          <PreviewBadge />
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
              onClick={promptInstall}
              title="App auf dem Gerät installieren"
            >
              <Download size={18} className="text-gold" />
              <span className="hide-on-mobile text-label">Installieren</span>
            </button>
          )}

          {systems.length > 0 && (
            <div className="desktop-nav-actions">
              <button
                className={view === VIEWS.ROSTERS ? 'btn-primary' : ''}
                onClick={() => { navigate(VIEWS.ROSTERS); loadAllData(); }}
              >
                <FolderOpen size={18} /> Heerlager
              </button>
              <button
                className={view === VIEWS.IMPORTER ? 'btn-primary' : ''}
                onClick={() => { navigate(VIEWS.IMPORTER); loadAllData(); }}
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
          <Importer
            onSystemImported={handleSystemImported}
            onReportError={reportError}
            showAsEmptyState={true}
          />
        ) : (
          <>
            {view === VIEWS.ROSTERS && (
              <RosterDashboard
                rosters={rosters}
                systems={systems}
                onOpenRoster={handleOpenRoster}
                onDeleteRoster={handleDeleteRoster}
                onRenameRoster={handleRenameRoster}
                onNewRoster={() => setIsModalOpen(true)}
                isOffline={isOffline}
                onImportRoster={handleImportRoster}
                onExportRoster={handleExportRoster}
              />
            )}

            {view === VIEWS.IMPORTER && (
              <Importer onSystemImported={handleSystemImported} onReportError={reportError} />
            )}

            {view === VIEWS.BUILDER && selectedRoster && selectedSystem && (
              <RosterEditor
                system={selectedSystem}
                roster={selectedRoster}
                onBack={() => { navigate(VIEWS.ROSTERS); loadAllData(); }}
                onPlay={handlePlayRoster}
                onExportRoster={handleExportRoster}
                onReportError={reportError}
              />
            )}

            {view === VIEWS.PLAY && selectedRoster && selectedSystem && (
              <PlayMode
                system={selectedSystem}
                roster={selectedRoster}
                onBack={() => { navigate(VIEWS.BUILDER, selectedRosterId); }}
                onReportError={reportError}
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
            showToast(ERROR_MESSAGE.deleteRoster, 'error');
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
          <button className={`mobile-nav-btn ${view === VIEWS.ROSTERS ? 'active' : ''}`} onClick={() => { navigate(VIEWS.ROSTERS); loadAllData(); }}>
            <FolderOpen size={20} />
            <span>Heerlager</span>
          </button>
          <button className={`mobile-nav-btn ${view === VIEWS.IMPORTER ? 'active' : ''}`} onClick={() => { navigate(VIEWS.IMPORTER); loadAllData(); }}>
            <BookOpen size={20} />
            <span>Bibliothekar</span>
          </button>
        </nav>
      )}
      {/* Update Available Toast Notification */}
      {isUpdateAvailable && (
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
          <button className="btn-primary btn-sm update-toast-btn" onClick={applyUpdate}>
            Neu laden
          </button>
        </div>
      )}
      {/* Global Toast Notification */}
      {toast && (
        <div className={`gothic-toast toast-${typeof toast === 'object' ? toast.type : 'success'}`}>
          <span>{typeof toast === 'object' ? toast.message : toast}</span>
        </div>
      )}
    </div>
    <Analytics />
    </SettingsProvider>
  );
}
