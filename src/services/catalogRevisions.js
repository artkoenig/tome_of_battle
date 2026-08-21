import {
  fetchCatalogText,
  buildRawFileUrl,
  deriveRevisionState,
  REVISION_STATE,
} from '../db/catalogUpdate';
import { runSystemMigrations } from '../db/migrations';

/**
 * Fassade über den Katalog-Abgleich (ADR-0037): den Abruf der entfernten
 * Katalogdateien und den Vergleich der Revisionsstände (ADR 0014).
 *
 * Vertrag:
 * - `fetchCatalogText(url)` holt eine Katalogdatei als Text.
 * - `buildRawFileUrl(rawBaseUrl, fileName)` baut die Adresse einer Rohdatei.
 * - `deriveRevisionState(availableRevision, localFile)` beantwortet, wie der
 *   verfügbare Stand zum lokalen steht (`REVISION_STATE`). Beides ist reine
 *   Rechnung ohne Zugriff.
 * - `refreshSystems(systems)` gleicht die gespeicherten Systeme gegen den
 *   entfernten Katalog ab und liefert `{ systems, failures, unrecoverable }`.
 *   Der Abgleich ist ein Lesevorgang mit Cache-Charakter: er meldet **nicht**
 *   über `dataEvents`, weil er den Bestand des Nutzers nicht ändert, sondern
 *   den zwischengespeicherten Katalog auffrischt — und weil sein Ergebnis
 *   ohnehin an den Aufrufer zurückgeht.
 *
 * Wie ein Zustand angezeigt wird, entscheidet die Oberfläche
 * (`useImporter.buildRevisionDisplay`).
 */

export { fetchCatalogText, buildRawFileUrl, deriveRevisionState, REVISION_STATE };

/**
 * @param {object[]} systems die gespeicherten Systeme.
 * @returns {Promise<{ systems: object[], failures: object[], unrecoverable: object[] }>}
 */
export function refreshSystems(systems) {
  return runSystemMigrations(systems, fetchCatalogText);
}
