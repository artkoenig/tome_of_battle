import React, { useState, useMemo } from 'react';
import { BookOpen, FolderOpen, WifiOff, Download, Settings } from 'lucide-react';

import Importer from './components/Importer';
import RosterEditor from './components/RosterEditor';
import PlayMode from './components/PlayMode';
import RosterDashboard from './components/RosterDashboard';
import AppDialogs from './components/AppDialogs';
import PreviewBadge from './components/PreviewBadge';
import { SettingsProvider } from './contexts/SettingsContext';

import useViewportHeight from './hooks/useViewportHeight';
import usePwaLifecycle from './hooks/usePwaLifecycle';
import useToast from './hooks/useToast';
import useAppNavigation from './hooks/useAppNavigation';
import useAppData from './hooks/useAppData';
import useRosterList from './hooks/useRosterList';
import { getDiffChanges } from './utils/releaseDiff';
import { VIEWS, isImmersiveView } from './constants/views';
import { Analytics } from '@vercel/analytics/react';

export default function App() {
  // Keep --app-vh in sync with the real visible viewport height so mobile
  // layout (#root, .empty-state-wrapper) sizes against the area actually
  // visible below collapsing browser chrome.
  useViewportHeight();

  const { view, selectedRosterId, navigate } = useAppNavigation();

  const {
    isInstallable,
    promptInstall,
    isUpdateAvailable,
    updateRelease,
    applyUpdate,
    isOffline,
  } = usePwaLifecycle();
  const { toast, showToast, reportError } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    systems,
    rosters,
    isDataLoaded,
    setRosters,
    loadAllData,
    handleSystemImported,
  } = useAppData({ showToast, navigate });

  const selectedRoster = useMemo(
    () => rosters.find(r => r.id === selectedRosterId) || null,
    [rosters, selectedRosterId]
  );
  const selectedSystem = useMemo(
    () => (selectedRoster ? systems.find(s => s.id === selectedRoster.systemId) || null : null),
    [systems, selectedRoster]
  );

  const {
    isNewRosterModalOpen,
    openNewRosterModal,
    closeNewRosterModal,
    rosterToDelete,
    requestRosterDeletion,
    cancelRosterDeletion,
    confirmRosterDeletion,
    createRoster,
    openRoster,
    playRoster,
    renameRoster,
    importRoster,
    exportRoster,
  } = useRosterList({
    systems,
    rosters,
    setRosters,
    reloadData: loadAllData,
    navigate,
    showToast,
  });

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
                data-testid="nav-rosters"
                className={view === VIEWS.ROSTERS ? 'btn-primary' : ''}
                onClick={() => { navigate(VIEWS.ROSTERS); loadAllData(); }}
              >
                <FolderOpen size={18} /> Heerlager
              </button>
              <button
                data-testid="nav-importer"
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
                onOpenRoster={openRoster}
                onDeleteRoster={requestRosterDeletion}
                onRenameRoster={renameRoster}
                onNewRoster={openNewRosterModal}
                isOffline={isOffline}
                onImportRoster={importRoster}
                onExportRoster={exportRoster}
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
                onPlay={playRoster}
                onExportRoster={exportRoster}
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

      {/* Root-gehostete Dialoge (Einstellungen, Neues Roster, Lösch-Bestätigung) */}
      <AppDialogs
        isSettingsOpen={isSettingsOpen}
        onCloseSettings={() => setIsSettingsOpen(false)}
        isNewRosterModalOpen={isNewRosterModalOpen}
        onCloseNewRosterModal={closeNewRosterModal}
        onCreateRoster={createRoster}
        systems={systems}
        rosterToDelete={rosterToDelete}
        onCancelRosterDeletion={cancelRosterDeletion}
        onConfirmRosterDeletion={confirmRosterDeletion}
      />

      {/* Mobile Bottom Navigation */}
      {systems.length > 0 && (
        <nav className="mobile-bottom-nav mobile-only">
          <button data-testid="nav-rosters" className={`mobile-nav-btn ${view === VIEWS.ROSTERS ? 'active' : ''}`} onClick={() => { navigate(VIEWS.ROSTERS); loadAllData(); }}>
            <FolderOpen size={20} />
            <span>Heerlager</span>
          </button>
          <button data-testid="nav-importer" className={`mobile-nav-btn ${view === VIEWS.IMPORTER ? 'active' : ''}`} onClick={() => { navigate(VIEWS.IMPORTER); loadAllData(); }}>
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
