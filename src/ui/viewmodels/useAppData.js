import { useState, useEffect, useRef } from 'react';
import { loadSystems } from '../../domain/services/systemLibrary';
import { loadRosters } from '../../domain/services/rosterStore';
import { refreshSystems } from '../../domain/services/catalogRevisions';
import { DATA_EVENT, subscribeToDataChanges } from '../../domain/services/dataEvents';
import { VIEWS } from '../../ui/constants/views';
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
 */

/**
 * Die noch nicht geladenen Listen. Als Literal im `useState` faellt `[]` auf
 * `never[]` und nimmt keinen echten Datensatz mehr an.
 *
 * @type {Array<{ id: string, name: string, catalogues?: unknown[] }>}
 */
const NO_SYSTEMS = [];

/** @type {import('../../domain/types.js').Roster[]} */
const NO_ROSTERS = [];

/**
 * @param {{
 *   showToast: (message: string, type?: string) => void,
 *   navigate: (view: string, rosterId?: string|null) => void,
 * }} deps
 */
export default function useAppData({ showToast, navigate }) {
  const [systems, setSystems] = useState(NO_SYSTEMS);
  const [rosters, setRosters] = useState(NO_ROSTERS);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Loads systems and rosters from IndexedDB into state. Local and fast — it never
  // touches the network — and returns the loaded systems so a caller can hand them
  // to the background catalog refresh without reloading them.
  const loadLocalData = async () => {
    const dbSystems = await loadSystems();
    const allRosters = await loadRosters();
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
      const { systems: refreshedSystems, failures, unrecoverable } =
        await refreshSystems(dbSystems);
      if (failures.length > 0) {
        showToast(
          t('appData.refreshFailed', { systems: failures.map(f => f.name).join(', ') }),
          'error'
        );
      }
      // Ein System ohne Katalogdateien kann seit Issue 0121 nicht mehr bewertet
      // werden — Listen daraus zeigten sonst still keine Regeln, keine Optionen und
      // 0 Punkte. Das darf der Nutzer nicht selbst herausfinden muessen.
      if (unrecoverable?.length > 0) {
        showToast(
          t('appData.reimportRequired', { systems: unrecoverable.map(s => s.name).join(', ') }),
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

  // Der **Startlauf**, und nur er: einmal aus der DB lesen, dann die
  // Start-Migration samt Katalog-Abgleich (Netz) laufen lassen. Beides gehoert
  // zum Hochfahren der App und zu keinem spaeteren Ereignis — vor Issue 0168
  // hing genau dieser Lauf an jedem Navigationsklick und parste dabei saemtliche
  // gespeicherten Kataloge neu.
  const runStartupLoad = async () => {
    try {
      const dbSystems = await loadLocalData();
      await refreshCatalogInBackground(dbSystems);
    } catch (e) {
      reportLoadFailure(e);
    }
  };

  // Der **Wiedereintritt**: ein erneutes Lesen aus der IndexedDB, mehr nicht.
  // Kein Netz, keine Migration, kein Neu-Parse. Das ist, was ein Aufrufer nach
  // einer Schreiboperation braucht, die nicht ueber den Meldekanal laeuft
  // (Roster-Import, Loeschen einer Liste).
  const reloadData = async () => {
    try {
      await loadLocalData();
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

  // `runStartupLoad` schließt über die pro Render neu erzeugten Callbacks
  // (showToast/navigate). Ein Ref hält stets die jüngste Fassung, damit der
  // einmalige Ladelauf beim Mounten sie aufrufen kann, ohne `runStartupLoad` als
  // Effekt-Abhängigkeit zu führen — das würde den Ladelauf endlos wiederholen.
  const runStartupLoadRef = useRef(runStartupLoad);
  runStartupLoadRef.current = runStartupLoad;

  useEffect(() => {
    runStartupLoadRef.current();
  }, []);

  // Die eine Verdrahtung des Änderungs-Kanals der Datenschicht (ADR-0037,
  // Issue 0167). Wer über `src/domain/services/` schreibt, meldet den Abschluss; hier
  // — und nur hier — zieht die App ihre Liste nach. Vorher erfuhr die
  // Roster-Liste einen im Editor gespeicherten Stand erst durch das
  // `reloadData` eines Navigationswechsels.
  //
  // Bewusst aus der Meldung heraus statt mit einem erneuten Lesen: das
  // Ereignis trägt den gespeicherten Stand, und ein Lesen je Speichervorgang
  // wäre ein Datenbankzugriff pro Klick im Editor.
  useEffect(() => subscribeToDataChanges((event) => {
    if (event.type === DATA_EVENT.ROSTER_SAVED) {
      setRosters(prev => (prev.some(r => r.id === event.roster.id)
        ? prev.map(r => (r.id === event.roster.id ? event.roster : r))
        : [...prev, event.roster]));
    } else if (event.type === DATA_EVENT.ROSTER_DELETED) {
      setRosters(prev => prev.filter(r => r.id !== event.rosterId));
    }
  }), []);

  return { systems, rosters, isDataLoaded, setRosters, reloadData, handleSystemImported };
}
