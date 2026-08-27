import React, { useState, useMemo } from 'react';
import { BookOpen, FolderOpen, WifiOff, Download, Settings, Filter } from 'lucide-react';

import Importer from './components/Importer';
import RosterEditor from './components/RosterEditor';
import PlayMode from './components/PlayMode';
import RosterDashboard from './components/RosterDashboard';
import RosterFilterPanel from './components/RosterFilterPanel';
import AppDialogs from './components/AppDialogs';
import PreviewBadge from './components/PreviewBadge';
import BottomSheet from './components/editor/BottomSheet';
import { SettingsProvider } from './viewmodels/SettingsContext';
import { useRosterFilter } from './viewmodels/useRosterFilter';

import useViewportHeight from './viewmodels/useViewportHeight';
import usePwaLifecycle from './viewmodels/usePwaLifecycle';
import useToast from './viewmodels/useToast';
import useAppNavigation from './viewmodels/useAppNavigation';
import useAppData from './viewmodels/useAppData';
import useRosterList from './viewmodels/useRosterList';
import { getDiffChanges } from './viewmodels/releaseDiff';
import { VIEWS, isImmersiveView } from '../ui/constants/views';
import { useTranslation } from './i18n/useTranslation';
import { Analytics } from '@vercel/analytics/react';

/**
 * Der Einstiegspunkt. Der Einstellungs-Anbieter steht **über** der App-Hülle,
 * weil die Hülle selbst ihn liest: der Übersichts-Filter (Issue 0203) lebt in
 * den gespeicherten Einstellungen und wird mobil aus der Kopfzeile bedient.
 */
export default function App() {
  return (
    <SettingsProvider>
      <AppShell />
    </SettingsProvider>
  );
}

function AppShell() {
  const { t } = useTranslation();
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
    reloadData,
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
    isFreshRoster,
  } = useRosterList({
    systems,
    rosters,
    setRosters,
    reloadData,
    navigate,
    showToast,
  });

  const rosterFilter = useRosterFilter({ rosters, systems });

  const diffChanges = getDiffChanges(import.meta.env.VITE_APP_VERSION, updateRelease);

  return (
    <>
    <div id="root" className={isImmersiveView(view) ? 'in-builder-mode' : ''}>
      {/* Premium Header */}
      <header className="app-header">
        <div className="logo-container">
          <img src="/favicon.png" className="logo-icon" alt={t('app.logoAlt')} />
          <div className="logo-title-group">
            <span className="logo-text">TOME OF BATTLE</span>
          </div>
          <PreviewBadge />
        </div>

        <div className="app-header-actions">
          {isOffline && (
            <div className="offline-badge" title={t('app.offline.active')}>
              <WifiOff size={18} className="text-danger" />
              <span className="hide-on-mobile">{t('app.offline.short')}</span>
            </div>
          )}

          {isInstallable && (
            <button
              className="install-app-btn"
              onClick={promptInstall}
              title={t('app.install.title')}
            >
              <Download size={18} className="text-gold" />
              <span className="hide-on-mobile text-label">{t('app.install.label')}</span>
            </button>
          )}

          {/* Ein Navigationsklick wechselt nur die Ansicht. Er liest nicht neu und
              stösst keine Start-Migration an (Issue 0168): die Systeme stehen bereits
              im Zustand, und Roster-Änderungen kommen über den Meldekanal der
              Datenschicht (ADR-0037). Das frühere `loadAllData()` an dieser Stelle
              parste bei jedem Klick sämtliche Kataloge neu. */}
          {systems.length > 0 && (
            <div className="desktop-nav-actions">
              <button
                data-testid="nav-rosters"
                className={view === VIEWS.ROSTERS ? 'btn-primary' : ''}
                onClick={() => { navigate(VIEWS.ROSTERS); }}
              >
                <FolderOpen size={18} /> {t('app.nav.rosters')}
              </button>
              <button
                data-testid="nav-importer"
                className={view === VIEWS.IMPORTER ? 'btn-primary' : ''}
                onClick={() => { navigate(VIEWS.IMPORTER); }}
              >
                <BookOpen size={18} /> {t('app.nav.importer')}
              </button>
            </div>
          )}

          {/* Unterhalb der mobilen Schwelle gibt es keine Werkzeugleiste der
              Übersicht — der Filter steht deshalb hier, neben den
              Einstellungen, und öffnet das Bodenblatt der App (Issue 0203). */}
          {view === VIEWS.ROSTERS && systems.length > 0 && (
            <button
              data-testid="header-filter"
              className="header-filter-btn mobile-only"
              onClick={rosterFilter.openSheet}
              title={t('dashboard.filter.label')}
              aria-label={t('dashboard.filter.label')}
            >
              <Filter size={18} />
              {rosterFilter.selectedCount > 0 && (
                <span className="filter-count-badge">{rosterFilter.selectedCount}</span>
              )}
            </button>
          )}

          <button
            className="header-settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            title={t('settings.title')}
            aria-label={t('settings.title')}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-content">
        {!isDataLoaded ? (
          <div className="app-loading-screen">
            <p className="text-dim">{t('app.loading')}</p>
          </div>
        ) : systems.length === 0 ? (
          <Importer
            systems={systems}
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
                filter={rosterFilter}
              />
            )}

            {view === VIEWS.IMPORTER && (
              <Importer systems={systems} onSystemImported={handleSystemImported} onReportError={reportError} />
            )}

            {view === VIEWS.BUILDER && selectedRoster && selectedSystem && (
              <RosterEditor
                system={selectedSystem}
                roster={selectedRoster}
                onBack={() => { navigate(VIEWS.ROSTERS); }}
                onPlay={playRoster}
                onExportRoster={exportRoster}
                onReportError={reportError}
                isFreshRoster={isFreshRoster(selectedRoster?.id)}
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

      <BottomSheet
        isOpen={rosterFilter.isSheetOpen}
        onClose={rosterFilter.closeSheet}
        title={t('dashboard.filter.title')}
      >
        <RosterFilterPanel
          options={rosterFilter.options}
          selection={rosterFilter.selection}
          selectedCount={rosterFilter.selectedCount}
          onToggle={rosterFilter.toggleValue}
          onClear={rosterFilter.clearAll}
        />
      </BottomSheet>

      {/* Mobile Bottom Navigation */}
      {systems.length > 0 && (
        <nav className="mobile-bottom-nav mobile-only">
          <button data-testid="nav-rosters" className={`mobile-nav-btn ${view === VIEWS.ROSTERS ? 'active' : ''}`} onClick={() => { navigate(VIEWS.ROSTERS); }}>
            <FolderOpen size={20} />
            <span>{t('app.nav.rosters')}</span>
          </button>
          <button data-testid="nav-importer" className={`mobile-nav-btn ${view === VIEWS.IMPORTER ? 'active' : ''}`} onClick={() => { navigate(VIEWS.IMPORTER); }}>
            <BookOpen size={20} />
            <span>{t('app.nav.importer')}</span>
          </button>
        </nav>
      )}
      {/* Update Available Toast Notification */}
      {isUpdateAvailable && (
        <div className="update-toast">
          <div className="update-toast-content">
            <span className="font-serif text-gold update-toast-title">{t('app.update.title')}</span>
            {updateRelease && diffChanges.length > 0 ? (
              <div className="update-toast-changes">
                <span className="update-toast-changes-heading">
                  {updateRelease.version ? t('app.update.version', { version: updateRelease.version }) : t('app.update.whatsNew')}
                  {updateRelease.date ? ` · ${updateRelease.date}` : ''}:
                </span>
                <ul className="update-toast-change-list">
                  {diffChanges.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <span className="update-toast-desc">{t('app.update.description')}</span>
            )}
          </div>
          <button className="btn-primary btn-sm update-toast-btn" onClick={applyUpdate}>
            {t('app.update.reload')}
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
    </>
  );
}
