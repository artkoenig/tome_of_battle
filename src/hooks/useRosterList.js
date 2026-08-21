import { useState } from 'react';
import { saveRoster, deleteRoster } from '../services/rosterStore';
import { readRosterText, buildRosterFile } from '../services/rosterTransfer';
import {
  exportRosterToXml, importRosterFromXml, MissingSystemError,
} from '../roster/rosterSerialization';
import { buildRoster } from '../roster/createRoster';
import { VIEWS } from '../constants/views';
import { syncRosterSelectionsWithSystem, reconcileImportedSelectionIds } from '../roster';
import { t } from '../i18n/i18nStore';

/**
 * Meldungen der Roster-CRUD-Vorgänge. Sie laufen ohne Backend und ohne Konsole
 * am Spieltisch — ein Fehlschlag muss den Nutzer über den Toast-Kanal (ADR 0010)
 * erreichen, sonst ist er von einem Erfolg nicht zu unterscheiden.
 */
const ERROR_MESSAGE_KEY = Object.freeze({
  createRoster: 'rosterList.createFailed',
  renameRoster: 'rosterList.renameFailed',
  deleteRoster: 'rosterList.deleteFailed',
});

/**
 * Kapselt das Listen-CRUD einer ganzen Roster-Sammlung: Anlegen, Öffnen,
 * Abspielen, Umbenennen, Löschen, Import und Export — samt dem Muster „nach jeder
 * Mutation neu laden" und der Zuordnung der Fehlermeldungen. Auch die beiden an
 * CRUD-Vorgänge gebundenen Dialog-Zustände (Anlege-Modal, Lösch-Bestätigung)
 * gehören hierher.
 *
 * Der Hook hält keine eigenen Systeme/Roster: Datenhaltung und Neuladen bleiben
 * beim Aufrufer (ADR-0002, DB nur über `database.js`), Navigation und Toast
 * werden hereingereicht. So bleibt der Hook unabhängig von der Wurzelkomponente
 * testbar; heißt bewusst **nicht** `useRoster` — dieser Name verwaltet den State
 * eines *geöffneten* Rosters im Editor.
 *
 * @param {{
 *   systems: object[],
 *   rosters: object[],
 *   setRosters: (updater: (prev: object[]) => object[]) => void,
 *   reloadData: () => (void|Promise<void>),
 *   navigate: (view: string, rosterId?: string|null) => void,
 *   showToast: (message: string, type?: string) => void,
 * }} deps
 */
/**
 * Der Nutzertext eines Fehlers aus Datei-Austausch oder Serialisierung. Beide
 * Schichten liegen unter der Oberfläche und übersetzen deshalb nicht (ADR-0037,
 * `keine-i18n-unter-ui`): sie tragen `messageKey`/`messageParams` und — wo es
 * eine technische Ergänzung gibt — `detail`. Formuliert wird genau hier.
 */
function describeRosterFileError(err) {
  if (!err?.messageKey) return err?.message;
  const message = t(err.messageKey, err.messageParams);
  return err.detail ? `${message} (${err.detail})` : message;
}

export default function useRosterList({ systems, rosters, setRosters, reloadData, navigate, showToast }) {
  const [isNewRosterModalOpen, setIsNewRosterModalOpen] = useState(false);
  const [rosterToDelete, setRosterToDelete] = useState(null);
  // Welche Roster-Ids in dieser Sitzung neu angelegt wurden (Issue 0138, Plan
  // Vertrag 4) — rein im Speicher, bewusst außerhalb von `Roster`/`Force` und
  // IndexedDB, damit die Markierung nie durch Speichern/Laden oder
  // `.rosz`-Export/Import wandert (siehe die "Nicht-offensichtliche
  // Entscheidung" im Plan). Ein Neuladen der Seite (neue Hook-Instanz) startet
  // mit einem leeren Set, sodass ein zuvor frisches Roster danach wieder als
  // bestehend gilt.
  const [freshRosterIds, setFreshRosterIds] = useState(() => new Set());
  const isFreshRoster = (id) => (id !== undefined && id !== null) && freshRosterIds.has(id);

  const openNewRosterModal = () => setIsNewRosterModalOpen(true);
  const closeNewRosterModal = () => setIsNewRosterModalOpen(false);

  // Übernimmt einen frisch bearbeiteten Roster-Stand in die Liste, damit die
  // abgeleitete Auswahl (und jede andere Ansicht) denselben Stand sieht.
  const updateRosterInList = (updatedRoster) => {
    setRosters(prev => prev.map(r => (r.id === updatedRoster.id ? updatedRoster : r)));
  };

  const createRoster = async ({ name, systemId, catId, forceEntryId, limit }) => {
    if (!name || !systemId || !catId) {
      showToast(t('rosterList.fillAllFields'), 'error');
      return;
    }

    const systemDef = systems.find(s => s.id === systemId);
    const roster = buildRoster({ name, systemId, catId, forceEntryId, limit }, systemDef);

    try {
      await saveRoster(roster);
      closeNewRosterModal();
      // Vor `setRosters`: das frisch angelegte Roster als "in dieser Sitzung
      // neu" markieren (Issue 0138), bevor irgendein Konsument (z. B. der
      // Auto-Add-Effekt in useRoster) es zu Gesicht bekommt.
      setFreshRosterIds(prev => {
        const next = new Set(prev);
        next.add(roster.id);
        return next;
      });
      // Die neue Liste sofort veröffentlichen, damit die abgeleitete Auswahl
      // den Editor öffnen kann, ohne auf das Neuladen aus der DB zu warten.
      // Einfügen nur, wenn es noch fehlt: seit Issue 0167 meldet `saveRoster`
      // seinen Abschluss, und der Abonnent in `useAppData` hat das Roster
      // womöglich schon eingesetzt — ein blindes Anhängen ergäbe es doppelt.
      setRosters(prev => (prev.some(r => r.id === roster.id) ? prev : [...prev, roster]));
      reloadData();

      // Open editor
      navigate(VIEWS.BUILDER, roster.id);
    } catch (err) {
      console.error(err);
      showToast(t(ERROR_MESSAGE_KEY.createRoster), 'error');
    }
  };

  /**
   * @param {import('../types.js').Roster} roster
   * @param {import('../constants/views.js').View} [viewMode]
   */
  const openRoster = (roster, viewMode = VIEWS.BUILDER) => {
    const sys = systems.find(s => s.id === roster.systemId);
    if (!sys) {
      showToast(t('rosterList.systemDeleted'), 'error');
      return;
    }
    navigate(viewMode, roster.id);
  };

  // Der Editor hält den aktuellsten Stand der Liste; er wird in die Liste
  // übernommen, bevor der Spielmodus ihn aus der Auswahl ableitet.
  const playRoster = (updatedRoster) => {
    updateRosterInList(updatedRoster);
    openRoster(updatedRoster, VIEWS.PLAY);
  };

  const requestRosterDeletion = (id, e) => {
    e.stopPropagation();
    const roster = rosters.find(r => r.id === id);
    if (roster) {
      setRosterToDelete(roster);
    }
  };

  const cancelRosterDeletion = () => setRosterToDelete(null);

  const confirmRosterDeletion = async () => {
    if (!rosterToDelete) return;
    const id = rosterToDelete.id;
    setRosterToDelete(null);
    try {
      await deleteRoster(id);
      reloadData();
    } catch (err) {
      console.error(err);
      showToast(t(ERROR_MESSAGE_KEY.deleteRoster), 'error');
    }
  };

  const renameRoster = async (roster, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === roster.name) return;
    try {
      await saveRoster({ ...roster, name: trimmed });
      reloadData();
    } catch (err) {
      console.error(err);
      showToast(t(ERROR_MESSAGE_KEY.renameRoster), 'error');
    }
  };

  const importRoster = async (file) => {
    try {
      const xmlText = await readRosterText(file);
      let newRoster = importRosterFromXml(xmlText, systems);

      const system = systems.find(s => s.id === newRoster.systemId);
      if (system) {
        // Imported files reference options by target id; realign them to the
        // catalogue link ids the editor matches before syncing names/costs.
        newRoster = reconcileImportedSelectionIds(newRoster, system);
        newRoster = syncRosterSelectionsWithSystem(newRoster, system);
      }

      await saveRoster(newRoster);
      showToast(t('rosterList.importSuccess', { name: newRoster.name }));
      reloadData();
    } catch (err) {
      console.error('Import error:', err);
      if (err instanceof MissingSystemError) {
        showToast(describeRosterFileError(err), 'error');
      } else {
        showToast(t('rosterList.importError', {
          message: describeRosterFileError(err) || t('rosterList.invalidFormat'),
        }), 'error');
      }
    }
  };

  const exportRoster = async (roster) => {
    try {
      const system = systems.find(s => s.id === roster.systemId);
      if (!system) {
        showToast(t('rosterList.systemMissingExport'), 'error');
        return;
      }

      const xmlText = exportRosterToXml(roster, system);
      const { blob, fileName } = await buildRosterFile(roster.name, xmlText);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      showToast(t('rosterList.exportError', {
        message: describeRosterFileError(err) || t('rosterList.exportFailed'),
      }), 'error');
    }
  };

  return {
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
  };
}
