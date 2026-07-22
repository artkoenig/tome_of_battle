// Der Rückkanal für fehlgeschlagenes Speichern. IndexedDB ist der einzige Datenpfad der
// Anwendung (ADR 0002); scheitert ein Schreibvorgang — überschrittene Quota, während eines
// Katalog-Updates blockierte Datenbank —, arbeitet der Nutzer sonst ahnungslos weiter und
// verliert seine Liste. Die Konsole sieht am Spieltisch niemand, deshalb wird die Meldung
// zusätzlich an den anwendungsweiten Kanal (Toast, ADR 0010) gereicht.

import { t } from '../i18n/i18nStore.js';

/**
 * Übersetzungsschlüssel der Nutzertexte je Schreibvorgang. Der konkrete Wortlaut liegt in
 * den Sprachdateien (ADR 0026) und wird erst beim Melden in die aktive Sprache aufgelöst.
 */
export const PERSISTENCE_FAILURE_MESSAGE_KEY = Object.freeze({
  roster: 'persistence.roster',
  gameState: 'persistence.gameState',
});

/**
 * Erzeugt einen Melder, der einen Fehlschlag protokolliert und — sofern ein Kanal
 * vorhanden ist — dem Nutzer in der aktiven Sprache anzeigt.
 *
 * @param {string} messageKey Übersetzungsschlüssel des Nutzertexts dieses Schreibvorgangs.
 * @param {(message: string) => void} [reportError] anwendungsweiter Fehlerkanal.
 * @returns {(error: unknown) => void}
 */
export function createPersistenceFailureReporter(messageKey, reportError) {
  return (error) => {
    const message = t(messageKey);
    console.error(message, error);
    if (reportError) reportError(message);
  };
}
