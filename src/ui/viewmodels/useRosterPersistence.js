/**
 * Catalogue sync and autosave of the editor's state node (Issue 0176, cut out
 * of `useRosterState.js`).
 *
 * The 150 ms delay applies to persisting only — display and validation derive
 * synchronously from the roster. Save callback and error channel are held in
 * refs because persisting runs out of a timeout, where a value captured in the
 * creating render would be stale.
 */

import { useEffect, useRef } from 'react';

import { syncRosterSelectionsWithSystem } from '../../domain/roster';
import {
  PERSISTENCE_FAILURE_MESSAGE_KEY,
  createPersistenceFailureReporter,
} from '../hooks/persistenceFailure';
import '../../shared/types.js';

const AUTOSAVE_DEBOUNCE_MS = 150;

/**
 * @param {Object} args
 * @param {import('../../shared/types.js').Roster} args.roster
 * @param {Object} args.system
 * @param {(roster: import('../../shared/types.js').Roster) => void} args.replaceRoster
 *   writes a synced roster back without an undo step
 * @param {Function} args.saveRosterCallback
 * @param {(message: string) => void} [args.reportError] app-wide error channel; a failed
 *   autosave reaches the user through it instead of ending in the console.
 * @returns {{ saveNow: (roster: import('../../shared/types.js').Roster) => Promise<void> }}
 */
export function useRosterPersistence({ roster, system, replaceRoster, saveRosterCallback, reportError }) {
  const saveCallbackRef = useRef(saveRosterCallback);
  saveCallbackRef.current = saveRosterCallback;
  const pendingSaveRef = useRef(null);
  const reportErrorRef = useRef(reportError);
  reportErrorRef.current = reportError;

  const persistRoster = (rosterToSave) => {
    const save = saveCallbackRef.current;
    if (!save) return;

    const reportFailure = createPersistenceFailureReporter(
      PERSISTENCE_FAILURE_MESSAGE_KEY.roster,
      reportErrorRef.current
    );

    try {
      const savePromise = save(rosterToSave);
      if (savePromise && typeof savePromise.catch === 'function') {
        savePromise.catch(reportFailure);
      }
    } catch (error) {
      reportFailure(error);
    }
  };

  // Katalog-Abgleich und Autosave. Die Verzögerung wirkt ausschließlich auf das
  // Persistieren — Anzeige und Validierung leiten sich synchron aus dem Roster ab.
  useEffect(() => {
    if (!roster || !system) return;

    const syncedRoster = syncRosterSelectionsWithSystem(roster, system);
    if (syncedRoster !== roster) {
      replaceRoster(syncedRoster);
      return;
    }

    pendingSaveRef.current = roster;
    const persistHandler = setTimeout(() => {
      persistRoster(roster);
      pendingSaveRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(persistHandler);
  }, [roster, system, replaceRoster]);

  // Noch ausstehende Änderungen beim Unmount wegschreiben (z. B. bei schneller Navigation)
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        persistRoster(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, []);

  /** The explicit save command: awaits the callback rather than debouncing it. */
  const saveNow = async (rosterToSave) => {
    if (saveCallbackRef.current) {
      await saveCallbackRef.current(rosterToSave);
    }
  };

  return { saveNow };
}
