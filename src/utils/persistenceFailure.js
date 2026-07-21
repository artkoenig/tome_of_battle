// Der Rückkanal für fehlgeschlagenes Speichern. IndexedDB ist der einzige Datenpfad der
// Anwendung (ADR 0002); scheitert ein Schreibvorgang — überschrittene Quota, während eines
// Katalog-Updates blockierte Datenbank —, arbeitet der Nutzer sonst ahnungslos weiter und
// verliert seine Liste. Die Konsole sieht am Spieltisch niemand, deshalb wird die Meldung
// zusätzlich an den anwendungsweiten Kanal (Toast, ADR 0010) gereicht.

/** Nutzertexte für die Schreibvorgänge, die im Hintergrund laufen. */
export const PERSISTENCE_FAILURE_MESSAGE = Object.freeze({
  roster:
    'Die Armeeliste konnte nicht gespeichert werden. Deine letzten Änderungen sind nicht gesichert.',
  gameState:
    'Der Spielstand konnte nicht gespeichert werden. Wunden, Punkte und Runde sind nicht gesichert.',
});

/**
 * Erzeugt einen Melder, der einen Fehlschlag protokolliert und — sofern ein Kanal
 * vorhanden ist — dem Nutzer anzeigt.
 *
 * @param {string} message der Nutzertext dieses Schreibvorgangs.
 * @param {(message: string) => void} [reportError] anwendungsweiter Fehlerkanal.
 * @returns {(error: unknown) => void}
 */
export function createPersistenceFailureReporter(message, reportError) {
  return (error) => {
    console.error(message, error);
    if (reportError) reportError(message);
  };
}
