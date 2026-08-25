import JSZip from 'jszip';

import { RosterFileError } from '../model/rosterFileError.js';

/**
 * Fassade über den Datei-Austausch eines Rosters (ADR-0037): das Auspacken einer
 * `.ros`/`.rosz`-Datei zu ihrem XML-Text und das Packen eines solchen Textes zu
 * einer herunterladbaren `.rosz`-Datei.
 *
 * Vertrag:
 * - `readRosterText(file)` liefert den XML-Text der Datei — ausgepackt, wenn es
 *   ein Archiv ist, sonst roh gelesen. Das Deuten dieses Textes ist Fachlogik
 *   und bleibt beim Aufrufer (`src/contexts/armylist/model/rosterSerialization.js`); die
 *   Datenschicht kennt `src/contexts/armylist/model/` nicht.
 * - `buildRosterFile(rosterName, xmlText)` liefert `{ blob, fileName }` — ein
 *   fertiges `.rosz` samt dateisystemtauglichem Namen. Den Download löst die
 *   Oberfläche aus: ein `<a download>` ist Darstellung, keine Persistenz.
 * - `RosterFileError` ist der Fehler, den beide Richtungen werfen. Er wohnt im
 *   Schreibmodell (`src/contexts/armylist/model/rosterFileError.js`), weil er das
 *   Dateiformat beschreibt, und trägt den Übersetzungsschlüssel, nicht den
 *   Text: die Schicht übersetzt nicht (`keine-i18n-unter-ui`), die Oberfläche
 *   formuliert.
 *
 * Beides schreibt nichts in die Ablage und meldet deshalb nichts über
 * `dataEvents`. Ein Import wird erst durch `rosterStore.saveRoster` bleibend —
 * und meldet sich dort.
 */

// Zeichen, die in einem Dateinamen nicht vorkommen dürfen.
const UNSAFE_FILE_NAME_CHARS = /[/\\?%*:|"<>]/g;

const ROSZ_EXTENSION = '.rosz';

/**
 * Compresses raw XML text into a BattleScribe-compliant .rosz (ZIP) Blob.
 * @param {string} fileName 
 * @param {string} xmlText 
 * @returns {Promise<Blob>} ZIP Blob
 */
async function compressXmlToRosz(fileName, xmlText) {
  const zip = new JSZip();
  const baseName = fileName.replace(/\.rosz$/i, '').replace(/\.ros$/i, '');
  zip.file(`${baseName}.ros`, xmlText);
  // Explicit octet-stream avoids browsers appending a ".zip" suffix to the
  // ".rosz" download name based on JSZip's default "application/zip" blob type.
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
}

/**
 * The local file header signature every ZIP archive starts with ("PK\x03\x04"). It tells
 * an archive apart from raw .ros XML, so a failure to unpack it can be reported as real
 * damage instead of being mistaken for "this file was never a ZIP".
 */
const ZIP_FILE_SIGNATURE = Object.freeze([0x50, 0x4b, 0x03, 0x04]);

const ROSTER_XML_EXTENSION = '.ros';

/**
 * Whether the blob starts with the ZIP local file header signature. Only the first
 * bytes are read, so the check stays cheap regardless of the archive's size.
 */
async function hasZipFileSignature(fileBlob) {
  const header = new Uint8Array(
    await fileBlob.slice(0, ZIP_FILE_SIGNATURE.length).arrayBuffer()
  );
  return ZIP_FILE_SIGNATURE.every((byte, index) => header[index] === byte);
}

function readBlobAsText(fileBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(fileBlob);
  });
}

/**
 * Unpacks a .rosz archive and returns the contained roster XML.
 * @throws {Error} when the archive is damaged or carries no .ros entry.
 */
async function extractRosterXmlFromZip(fileBlob) {
  let zip;
  try {
    zip = await JSZip.loadAsync(fileBlob);
  } catch (error) {
    // The signature identified this as a ZIP, so a load failure is genuine damage
    // and must not be papered over by the raw-XML fallback below.
    throw new RosterFileError('serialization.damagedArchive', null, error.message);
  }

  const rosFileName = Object.keys(zip.files).find(name => name.endsWith(ROSTER_XML_EXTENSION));
  if (!rosFileName) {
    throw new RosterFileError('serialization.missingRosterEntry', { extension: ROSTER_XML_EXTENSION });
  }
  return zip.files[rosFileName].async('text');
}

/**
 * Decompresses a BattleScribe .rosz ZIP Blob (or handles raw .ros XML directly) and returns
 * the XML text. Which of the two it is, is decided by the ZIP signature rather than by a
 * failed unpacking attempt — so a damaged archive surfaces as an error instead of being
 * read as text and failing later with a misleading "invalid file format".
 * @param {Blob|File} fileBlob
 * @returns {Promise<string>} XML text
 */
async function decompressRoszToXml(fileBlob) {
  if (await hasZipFileSignature(fileBlob)) {
    return extractRosterXmlFromZip(fileBlob);
  }
  return readBlobAsText(fileBlob);
}

/**
 * @param {File|Blob} file eine `.rosz`- (gezippte) oder `.ros`-Datei.
 * @returns {Promise<string>} der XML-Text der Datei.
 * @throws {Error} mit `messageKey`, wenn das Archiv beschädigt ist oder keinen
 *   `.ros`-Eintrag trägt.
 */
export async function readRosterText(file) {
  return decompressRoszToXml(file);
}

/**
 * @param {string} rosterName der Name des Rosters; er wird zum Dateinamen.
 * @param {string} xmlText der serialisierte `.ros`-Inhalt.
 * @returns {Promise<{ blob: Blob, fileName: string }>}
 */
export async function buildRosterFile(rosterName, xmlText) {
  const blob = await compressXmlToRosz(rosterName, xmlText);
  return { blob, fileName: `${rosterName.replace(UNSAFE_FILE_NAME_CHARS, '_')}${ROSZ_EXTENSION}` };
}
