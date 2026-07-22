import { useState, useEffect, useRef } from 'react';
import { getAllSystems, getAllRosters } from '../db/database';
import { runSystemMigrations } from '../db/migrations';
import { fetchCatalogText } from '../db/catalogUpdate';
import { VIEWS } from '../constants/views';
import { t } from '../i18n/i18nStore';

/**
 * Meldung des initialen Ladevorgangs. Er läuft ohne Backend und ohne Konsole am
 * Spieltisch — ein Fehlschlag muss den Nutzer über den Toast-Kanal (ADR 0010)
 * erreichen, sonst ist er von einem Erfolg nicht zu unterscheiden.
 */
const LOAD_DATA_ERROR_KEY = 'appData.loadFailed';

/**
 * Kapselt das Laden der App-Daten: initiales Lesen der Systeme und Roster aus
 * IndexedDB, die Katalog-Hintergrund-Aktualisierung (Netz) und die Behandlung
 * eines frisch importierten Systems. DB-Zugriff ausschließlich über
 * `database.js` (ADR-0002).
 *
 * Datenhaltung liegt hier (Systeme, Roster, Ladezustand). `setRosters` wird nach
 * außen gereicht, damit das Listen-CRUD frische Stände optimistisch
 * veröffentlichen kann; Toast-Kanal und Navigation werden hereingereicht, damit
 * der Hook unabhängig von der Wurzelkomponente testbar bleibt.
 *
 * @param {{
 *   showToast: (message: string, type?: string) => void,
 *   navigate: (view: string, rosterId?: string|null) => void,
 * }} deps
 */
export default function useAppData({ showToast, navigate }) {
  const [systems, setSystems] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

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
          t('appData.refreshFailed', { systems: failures.map(f => f.name).join(', ') }),
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
    showToast(t(LOAD_DATA_ERROR_KEY), 'error');
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

  // `loadAllData` schließt über die pro Render neu erzeugten Callbacks
  // (showToast/navigate). Ein Ref hält stets die jüngste Fassung, damit der
  // einmalige Ladelauf beim Mounten sie aufrufen kann, ohne `loadAllData` als
  // Effekt-Abhängigkeit zu führen — das würde den Ladelauf endlos wiederholen.
  const loadAllDataRef = useRef(loadAllData);
  loadAllDataRef.current = loadAllData;

  useEffect(() => {
    loadAllDataRef.current();
  }, []);

  return { systems, rosters, isDataLoaded, setRosters, loadAllData, handleSystemImported };
}
