/**
 * React-Hook `useEvaluation` (Issue 0121, Task 3): verdrahtet die
 * Evaluator-Fassade (`src/evaluator/evaluator.js`) mit dem App-Modell.
 *
 * `useEvaluation(system, roster)` bereitet die rohen XMLs des Systems
 * (`system.rawXmls`, Shape aus `src/db/systemImport.js`) **einmal je
 * System-Objektidentitaet** auf (`prepareDataset`), uebersetzt das App-Roster
 * je Roster-Objektidentitaet (`toEvaluatorRoster`) und liefert
 * `{ violations, capabilities, description, costTotals, pathBySelectionId }`.
 *
 * Memoisierung (Kriterium 8 des Issues, verschaerft in Task 7):
 * - `prepareDataset` laeuft hoechstens einmal je System-Objektidentitaet —
 *   **global geteilt** ueber alle Hook-Instanzen und die Direktaufrufe des
 *   Moduls `evaluationCache.js` (`evaluateAppRoster`/`describeSystem`); erst
 *   ein neues System-Objekt loest eine neue Vorbereitung aus.
 * - `describeDataset` haengt nur am aufbereiteten Datensatz, laeuft also
 *   ebenfalls je System-Identitaet.
 * - `evaluate` + Adapter laufen je Roster-Objektidentitaet (und erneut, wenn
 *   der Datensatz wechselt).
 *
 * Der Hook ist rein ableitend: kein DB-Zugriff, kein Kontext, keine Effekte.
 * `prepareDataset` laeuft synchron im Render — der Vertrag der Tests verlangt
 * ein synchrones Ergebnis im ersten Render; die Entkopplung des teuren
 * Vorlaufs (0,5–1,5 s bei echten Katalogen) ist Sache der aufrufenden UI in
 * spaeteren Tasks.
 *
 * Leere Eingaben (system null/undefined, `rawXmls` fehlt oder ohne `.gst`,
 * roster null/undefined) ergeben ohne Throw das **referenzstabile**
 * Leer-Ergebnis: `violations: []`, `capabilities` leere Map,
 * `description: null`, `costTotals: {}`, `pathBySelectionId` leere Map.
 */

import { useMemo } from 'react';
import { evaluate, describeDataset } from '../evaluator/evaluator.js';
import { preparedDatasetOf } from './evaluationCache.js';
import { toEvaluatorRoster } from './rosterAdapter.js';

/**
 * Das Ergebnis des Hooks.
 *
 * @typedef {Object} EvaluationResult
 * @property {ReadonlyArray<object>} violations  Verletzungen aus dem Bericht der Fassade.
 * @property {Map<string, object>} capabilities  Faehigkeitsdatensaetze je Slot-Pfad.
 * @property {{ costTypes: object[], catalogues: object[], creatableForces: object[], diagnostics: object[] } | null} description
 *   Beschreibung des Datensatzes (`describeDataset`); `null` im Leerfall.
 * @property {Readonly<Record<string, number>>} costTotals  Kostensumme je deklarierter Kostenart.
 * @property {Map<string, string>} pathBySelectionId  App-Selection-UUID → Slot-Pfad.
 */

/**
 * Das eine, eingefrorene Leer-Ergebnis: referenzstabil ueber alle Renders und
 * Hook-Instanzen hinweg (Kriterium 5 gilt fuer alle Eingaben).
 *
 * @type {EvaluationResult}
 */
const EMPTY_RESULT = Object.freeze({
  violations: Object.freeze([]),
  capabilities: new Map(),
  description: null,
  costTotals: Object.freeze({}),
  pathBySelectionId: new Map(),
});

/**
 * Wertet ein App-Roster gegen die Katalogdaten seines Systems aus.
 *
 * @param {{ rawXmls?: { gst: Array<{ name: string, content: string }>, cat: Array<{ name: string, content: string }> } } | null | undefined} system
 *   Das App-System-Objekt mit den rohen XMLs; `null`/`undefined` oder ohne
 *   (vollstaendiges) `rawXmls` → Leer-Ergebnis.
 * @param {import('../types.js').Roster | null | undefined} roster
 *   Das App-Roster; `null`/`undefined` → Leer-Ergebnis.
 * @returns {EvaluationResult}
 */
export function useEvaluation(system, roster) {
  // Katalog-Vorlauf: genau einmal je System-Objektidentitaet — aus dem
  // modulweiten Cache (`evaluationCache.js`), geteilt mit allen anderen
  // Hook-Instanzen und den Direktaufrufen. Ein System ohne rawXmls
  // (Start-Migration noch nicht gelaufen) oder ohne .gst-Datei hat keinen
  // Datensatz — wie ein fehlendes System behandelt (null).
  const prepared = useMemo(() => preparedDatasetOf(system), [system]);

  // Beschreibung: haengt allein am aufbereiteten Datensatz — je System-Identitaet.
  const description = useMemo(
    () => (prepared === null ? null : describeDataset(prepared)),
    [prepared],
  );

  // Adapter: je Roster-Objektidentitaet.
  const adapted = useMemo(
    () => (roster === null || roster === undefined ? null : toEvaluatorRoster(roster)),
    [roster],
  );

  // Auswertung: je Roster-Identitaet gegen den gehaltenen Datensatz-Griff.
  const report = useMemo(() => {
    if (prepared === null || adapted === null) return null;
    return evaluate(prepared, adapted.evalRoster);
  }, [prepared, adapted]);

  // Ergebnisobjekt: referenzstabil, solange die Eingaben (per Objektidentitaet)
  // unveraendert sind; jeder Leer-/Fehlfall liefert dieselbe EMPTY_RESULT-Referenz.
  return useMemo(() => {
    if (report === null || adapted === null || description === null) return EMPTY_RESULT;
    return {
      violations: report.violations,
      capabilities: report.capabilities,
      description,
      costTotals: report.costTotals,
      pathBySelectionId: adapted.pathBySelectionId,
    };
  }, [report, adapted, description]);
}
