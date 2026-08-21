import {
  exportRosterToXml,
  importRosterFromXml,
  compressXmlToRosz,
  decompressRoszToXml,
  MissingSystemError,
} from '../utils/rosterSerialization';

/**
 * Fassade über den Datei-Austausch eines Rosters (ADR-0037): das Lesen einer
 * `.ros`/`.rosz`-Datei und das Erzeugen einer solchen zum Herunterladen.
 *
 * Vertrag:
 * - `readRosterFile(file, systems)` packt aus, parst und liefert das Roster
 *   **so, wie die Datei es beschreibt**. Der Abgleich mit dem installierten
 *   System (Auswahl-Ids, Namen, Kosten) ist Fachlogik und bleibt beim
 *   Aufrufer; die Datenschicht kennt `src/roster/` nicht.
 * - `buildRosterFile(roster, system)` liefert `{ blob, fileName }` — ein
 *   fertiges `.rosz` samt dateisystemtauglichem Namen. Den Download löst die
 *   Oberfläche aus: ein `<a download>` ist Darstellung, keine Persistenz.
 * - `MissingSystemError` wird durchgereicht, damit ein Aufrufer den Fall
 *   „System nicht installiert" per `instanceof` von einer kaputten Datei
 *   unterscheiden kann.
 *
 * Beides schreibt nichts in die Ablage und meldet deshalb nichts über
 * `dataEvents`. Ein Import wird erst durch `rosterStore.saveRoster` bleibend —
 * und meldet sich dort.
 */

export { MissingSystemError };

// Zeichen, die in einem Dateinamen nicht vorkommen dürfen.
const UNSAFE_FILE_NAME_CHARS = /[/\\?%*:|"<>]/g;

const ROSZ_EXTENSION = '.rosz';

/**
 * @param {File|Blob} file eine `.rosz`- (gezippte) oder `.ros`-Datei.
 * @param {object[]} systems die installierten Systeme; das Roster verweist auf
 *   eines davon.
 * @returns {Promise<import('../types.js').Roster>}
 * @throws {MissingSystemError} wenn das referenzierte System fehlt.
 */
export async function readRosterFile(file, systems) {
  const xmlText = await decompressRoszToXml(file);
  return importRosterFromXml(xmlText, systems);
}

/**
 * @param {import('../types.js').Roster} roster
 * @param {object} system das System des Rosters.
 * @returns {Promise<{ blob: Blob, fileName: string }>}
 */
export async function buildRosterFile(roster, system) {
  const xmlText = exportRosterToXml(roster, system);
  const blob = await compressXmlToRosz(roster.name, xmlText);
  return { blob, fileName: `${roster.name.replace(UNSAFE_FILE_NAME_CHARS, '_')}${ROSZ_EXTENSION}` };
}
