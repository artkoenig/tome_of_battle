/**
 * Der Fehler des Roster-**Dateiformats**: eine `.ros`/`.rosz`, die sich nicht
 * lesen oder nicht schreiben lässt. Er gehört zum Schreibmodell, nicht zur
 * Fassade, die ihn zuerst brauchte (`src/contexts/armylist/application/rosterTransfer.js`).
 *
 * Die Schicht übersetzt nicht (`keine-i18n-unter-ui`): `messageKey`/
 * `messageParams` benennen den Nutzertext, `detail` trägt die technische
 * Ergänzung (z. B. die Meldung der ZIP-Bibliothek), die die Oberfläche in
 * Klammern anhängt. Formuliert wird er einzig in `describeRosterFileError`
 * (`src/ui/viewmodels/useRosterList.js`).
 */
export class RosterFileError extends Error {
  /**
   * @param {string} messageKey
   * @param {Object|null} [messageParams]
   * @param {string|null} [detail]
   */
  constructor(messageKey, messageParams = null, detail = null) {
    super(messageKey);
    this.name = 'RosterFileError';
    this.messageKey = messageKey;
    this.messageParams = messageParams;
    this.detail = detail;
  }
}
