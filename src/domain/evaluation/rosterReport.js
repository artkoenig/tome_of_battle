/**
 * Der Bericht, wie ihn die Oberfläche sieht (Issue 0162, ADR-0038): die
 * App-Auswertung aus `useEvaluation` plus die aus ihren Diagnosen abgeleiteten
 * unauflösbaren Auswahlen — als **ein** Objekt, dessen Identität sich genau dann
 * ändert, wenn sich Roster oder System ändern.
 *
 * Die Identitätsstabilität ist der Zweck: der Bericht-Kontext aus ADR-0038 gibt
 * dieses Objekt weiter, und ein neuer Wert bei jedem Render würde jeden
 * Verbraucher bei jedem Render neu rechnen lassen. `evaluateAppRoster`
 * memoisiert bereits je `(system, roster)` (WeakMap in `evaluationCache.js`);
 * dieses Modul reicht diese Stabilität durch das Bündel hindurch.
 */

import { useMemo } from 'react';
import { useEvaluation } from './useEvaluation.js';
import { unresolvedSelectionsOf } from './datasetDiagnostics.js';

/**
 * Die App-Auswertung, erweitert um `unresolvedSelections`: Auswahlen, deren
 * Definition der Katalog nicht mehr kennt (stilles Katalog-Update, ADR-0018).
 * Keine Regelverletzung, aber dem Nutzer zu melden — die Engine übergeht sie
 * sonst stumm.
 *
 * @typedef {import('./evaluationCache.js').AppEvaluation
 *   & { unresolvedSelections: ReadonlyArray<{ defId: string, name: string }> }} RosterReport
 */

/**
 * Wertet `roster` gegen `system` aus und bündelt das Ergebnis zum Bericht der
 * Oberfläche.
 *
 * @param {Object|null|undefined} system
 * @param {import('../../shared/types.js').Roster|null|undefined} roster
 * @returns {RosterReport} referenzstabil, solange `system` und `roster`
 *   dieselben Objekte bleiben
 */
export function useRosterReportModel(system, roster) {
  const evaluation = useEvaluation(system, roster);

  const unresolvedSelections = useMemo(
    () => unresolvedSelectionsOf(evaluation.diagnostics, roster),
    [evaluation.diagnostics, roster]
  );

  return useMemo(
    () => ({ ...evaluation, unresolvedSelections }),
    [evaluation, unresolvedSelections]
  );
}
