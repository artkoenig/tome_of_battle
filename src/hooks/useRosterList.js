import { useState } from 'react';
import { saveRoster, deleteRoster } from '../db/database';
import { buildRoster } from '../utils/createRoster';
import { VIEWS } from '../constants/views';
import {
  exportRosterToXml,
  importRosterFromXml,
  compressXmlToRosz,
  decompressRoszToXml,
  MissingSystemError
} from '../utils/rosterSerialization';
import { syncRosterSelectionsWithSystem, reconcileImportedSelectionIds } from '../solver/validator';
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
export default function useRosterList({ systems, rosters, setRosters, reloadData, navigate, showToast }) {
  const [isNewRosterModalOpen, setIsNewRosterModalOpen] = useState(false);
  const [rosterToDelete, setRosterToDelete] = useState(null);

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
      // Die neue Liste sofort veröffentlichen, damit die abgeleitete Auswahl
      // den Editor öffnen kann, ohne auf das Neuladen aus der DB zu warten.
      setRosters(prev => [...prev, roster]);
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
      showToast(t('rosterList.importSuccess', { name: newRoster.name }));
      reloadData();
    } catch (err) {
      console.error('Import error:', err);
      if (err instanceof MissingSystemError) {
        showToast(err.message, 'error');
      } else {
        showToast(t('rosterList.importError', { message: err.message || t('rosterList.invalidFormat') }), 'error');
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
      showToast(t('rosterList.exportError', { message: err.message || t('rosterList.exportFailed') }), 'error');
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
  };
}
