/**
 * Der Bericht, wie ihn die Oberfläche sieht (Issue 0162, ADR-0038): die
 * App-Auswertung aus `evaluateAppRoster` plus die aus ihren Diagnosen
 * abgeleiteten unauflösbaren Auswahlen — als **ein** Objekt, dessen Identität
 * sich genau dann ändert, wenn sich Roster oder System ändern.
 *
 * Die Identitätsstabilität ist der Zweck: der Bericht-Kontext aus ADR-0038 gibt
 * dieses Objekt weiter, und ein neuer Wert bei jedem Aufruf würde jeden
 * Verbraucher neu rechnen lassen. `evaluateAppRoster` memoisiert bereits je
 * `(system, roster)` (WeakMap in `evaluationCache.js`) und liefert für jeden
 * Leerfall dieselbe eingefrorene Konstante; dieses Modul hängt seinen eigenen
 * Cache **an die Auswertung** statt an das Paar. Damit gilt die Stabilität
 * nicht nur innerhalb einer Montierung, sondern über alle Aufrufer hinweg —
 * genau das, was ein `useMemo` nicht leisten kann (Issue 0194).
 *
 * Der geteilte Schlüssel des Leerfalls ist unbedenklich: dessen `diagnostics`
 * sind leer, also ergibt jede Roster-Eingabe dort dieselbe leere
 * `unresolvedSelections`.
 *
 * Das Modul nennt React nicht — der Kontext kommt ohne die UI-Bibliothek aus
 * (`no-restricted-imports` in `.oxlintrc.json`,
 * `src/tests/contexts/frameworkFreedom.test.js`).
 */

import { evaluateAppRoster } from '../acl/evaluationCache.js';
import { unresolvedSelectionsOf } from './datasetDiagnostics.js';

/**
 * Die App-Auswertung, erweitert um `unresolvedSelections`: Auswahlen, deren
 * Definition der Katalog nicht mehr kennt (stilles Katalog-Update, ADR-0018).
 * Keine Regelverletzung, aber dem Nutzer zu melden — die Engine übergeht sie
 * sonst stumm.
 *
 * @typedef {import('../acl/evaluationCache.js').AppEvaluation
 *   & { unresolvedSelections: ReadonlyArray<{ defId: string, name: string }> }} RosterReport
 */

/**
 * Bericht je Auswertungsobjekt. Die Auswertung ist je `(system, roster)`
 * eindeutig, also ist es der Bericht auch.
 *
 * @type {WeakMap<Object, RosterReport>}
 */
const reportByEvaluation = new WeakMap();

/**
 * Wertet `roster` gegen `system` aus und bündelt das Ergebnis zum Bericht der
 * Oberfläche.
 *
 * @param {Object|null|undefined} system
 * @param {import('../../../shared/rostermodel/types.js').Roster|null|undefined} roster
 * @returns {RosterReport} referenzstabil — derselbe Bericht, solange `system`
 *   und `roster` dieselben Objekte bleiben, auch über getrennte Aufrufe hinweg
 */
export function rosterReportOf(system, roster) {
  const evaluation = evaluateAppRoster(system, roster);

  const cached = reportByEvaluation.get(evaluation);
  if (cached) return cached;

  const report = Object.freeze(
    /** @type {RosterReport} */ ({
      ...evaluation,
      unresolvedSelections: unresolvedSelectionsOf(evaluation.diagnostics, roster),
    })
  );
  reportByEvaluation.set(evaluation, report);
  return report;
}
