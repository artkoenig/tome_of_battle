/**
 * Modulweiter Auswertungs-Cache (Issue 0121, Task 7): der Katalog-Vorlauf
 * (`prepareDataset`) laeuft **genau einmal je System-Objekt** — geteilt ueber
 * alle `useEvaluation`-Hook-Instanzen und alle Direktaufrufe dieses Moduls.
 *
 * Der Cache ist eine WeakMap ueber die System-Objektidentitaet: ein neues
 * System-Objekt (Neuladen aus der DB, Katalog-Update) loest genau eine neue
 * Vorbereitung aus; ein gehaltenes Objekt wird nie doppelt vorbereitet und
 * haelt nichts am Leben, was die App nicht ohnehin haelt.
 *
 * Exporte:
 * - `evaluateAppRoster(system, roster)` — dieselbe Ergebnisform wie
 *   `useEvaluation` (`{ violations, capabilities, costTotals,
 *   pathBySelectionId }`), als reine Funktion ausserhalb von React aufrufbar.
 *   Leer-/Fehlfaelle (system null/undefined/ohne vollstaendiges `rawXmls`,
 *   roster null/undefined) ergeben ohne Throw das referenzstabile
 *   Leer-Ergebnis.
 * - `describeSystem(system)` — die Datensatz-Beschreibung ohne Roster
 *   (`describeDataset`); system null oder ohne (vollstaendige) `rawXmls`
 *   (fehlende oder leere `.gst`-Liste) → `null`.
 * - `preparedDatasetOf(system)` — der gecachte Griff fuer `useEvaluation`;
 *   `null` in denselben Leerfaellen.
 */

import { prepareDataset, evaluate, describeDataset } from '../evaluator/evaluator.js';
import { toEvaluatorRoster } from './rosterAdapter.js';

/** Aufbereiteter Datensatz je System-Objektidentitaet (genau ein Vorlauf). */
const preparedBySystem = new WeakMap();

/**
 * Das eine, eingefrorene Leer-Ergebnis von {@link evaluateAppRoster}:
 * referenzstabil ueber alle Aufrufe hinweg (dieselbe Form wie `useEvaluation`,
 * ohne `description`).
 */
const EMPTY_RESULT = Object.freeze({
  violations: Object.freeze([]),
  capabilities: new Map(),
  costTotals: Object.freeze({}),
  pathBySelectionId: new Map(),
});

/**
 * Der aufbereitete Datensatz eines System-Objekts — hoechstens ein
 * `prepareDataset`-Lauf je Objektidentitaet. Ein System ohne `rawXmls`
 * (Start-Migration noch nicht gelaufen) oder ohne `.gst`-Datei hat keinen
 * Datensatz → `null`.
 *
 * @param {{ rawXmls?: { gst: Array<{ content: string }>, cat?: Array<{ content: string }> } } | null | undefined} system
 * @returns {object|null} der undurchsichtige Griff der Evaluator-Fassade.
 */
export function preparedDatasetOf(system) {
  const gameSystem = system?.rawXmls?.gst?.[0]?.content;
  if (gameSystem === undefined) return null;
  let prepared = preparedBySystem.get(system);
  if (prepared === undefined) {
    prepared = prepareDataset({
      gameSystem,
      catalogues: (system.rawXmls.cat ?? []).map(file => file.content),
    });
    preparedBySystem.set(system, prepared);
  }
  return prepared;
}

/**
 * Wertet ein App-Roster gegen die Katalogdaten seines Systems aus — dieselbe
 * Ergebnisform wie `useEvaluation`, als reine Funktion ohne React.
 *
 * @param {object|null|undefined} system  App-System-Objekt mit `rawXmls`.
 * @param {import('../types.js').Roster|null|undefined} roster  das App-Roster.
 * @returns {{ violations: ReadonlyArray<object>, capabilities: Map<string, object>, costTotals: Readonly<Record<string, number>>, pathBySelectionId: Map<string, string> }}
 */
export function evaluateAppRoster(system, roster) {
  const prepared = preparedDatasetOf(system);
  if (prepared === null || roster === null || roster === undefined) return EMPTY_RESULT;
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(roster);
  const report = evaluate(prepared, evalRoster);
  return {
    violations: report.violations,
    capabilities: report.capabilities,
    costTotals: report.costTotals,
    pathBySelectionId,
  };
}

/**
 * Die Datensatz-Beschreibung eines Systems **ohne Roster** (ADR-0034):
 * Kostenarten, spielbare gegenueber Bibliotheks-Katalogen, anlegbare
 * Kontingente — aus demselben einen Katalog-Vorlauf wie die Auswertung.
 *
 * @param {object|null|undefined} system  App-System-Objekt mit `rawXmls`.
 * @returns {{ costTypes: object[], catalogues: object[], creatableForces: object[], diagnostics: object[] } | null}
 *   `null`, wenn das System keinen Datensatz hat (kein `rawXmls`, leere
 *   `.gst`-Liste).
 */
export function describeSystem(system) {
  const prepared = preparedDatasetOf(system);
  return prepared === null ? null : describeDataset(prepared);
}
