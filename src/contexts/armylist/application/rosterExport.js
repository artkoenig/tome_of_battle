/**
 * Der Anwendungsfall "eine Liste verlässt die App als Datei": Bericht holen,
 * Roster serialisieren, `.rosz` packen.
 *
 * Vertrag:
 * - `buildRosterExportFile(roster, system)` liefert `{ blob, fileName }` — den
 *   fertigen Download. Ausgelöst wird er von der Oberfläche (ein `<a download>`
 *   ist Darstellung), zusammengesetzt wird er hier.
 * - Geschrieben wird nichts, also meldet der Weg auch nichts über `dataEvents`.
 * - Fehler kommen unverändert aus `rosterSerialization`/`rosterTransfer` heraus
 *   (`RosterFileError` mit `messageKey`); formuliert werden sie in der
 *   Oberfläche.
 *
 * Warum der Bericht **hier** geholt wird und nicht mehr im Bildschirm
 * (Issue 0193, Nachbesserung zu T4): `exportRosterToXml` braucht ihn für die
 * Kostenzeilen, und die Oberfläche hatte ihn allein deshalb aus dem Lesemodell
 * gezogen — ein zweiter Kontext im Bildschirm für einen Aufruf. ADR-0039 verbietet
 * das Auswerten dem Schreib**modell**; ein Anwendungsfall darf das Lesemodell
 * über seine eine Tür (`ruleengine/readmodel/index.js`) nennen, wie es
 * `mandatoryListRules.js` schon tut.
 */

import { evaluateAppRoster } from '../../ruleengine/readmodel/index.js';
import { exportRosterToXml } from '../model/rosterSerialization.js';
import { buildRosterFile } from './rosterTransfer.js';

/**
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {Object} system  das App-System, zu dem die Liste gehört.
 * @returns {Promise<{ blob: Blob, fileName: string }>}
 */
export async function buildRosterExportFile(roster, system) {
  const report = evaluateAppRoster(system, roster);
  const xmlText = exportRosterToXml(roster, system, report);
  return buildRosterFile(roster.name, xmlText);
}
