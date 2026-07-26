/**
 * Die engine-allgemeine Regel **„Armee zu teuer"** (Main-Issue 70, `design.md`).
 *
 * Anders als eine im Katalog hinterlegte Grenze ist dies eine Regel der
 * Auswertungs-Engine selbst: je konfigurierter Kostenart wird die am
 * ROSTER-Rahmen verplante Summe gegen die fuer diese Kostenart eingestellte
 * Grenze (`RosterBudget`) geprueft. Uebersteigt die Summe die Grenze, entsteht
 * eine roster-weite Budget-Verletzung; auf oder unter der Grenze entsteht keine.
 * Jede Kostenart wird gegen **ihre eigene** Grenze geprueft.
 *
 * Die verplante Summe kommt aus dem **bereits gebauten Zaehlindex** am
 * ROSTER-Rahmen (SSOT — keine zweite Summierung): der Roster-Rahmen umspannt alle
 * Kontingente und schachtelt alle Selektionen ein, daher wird der Gesamtbestand
 * inklusive geschachtelter Auswahlen und Kontingente gezaehlt.
 *
 * Die Verletzung traegt die gleiche Form wie die uebrigen Constraint-Ergebnisse
 * (`{ limit, anchor, actual, bound, satisfied, delta }`) und wird darum von der
 * **einen** Berichtsprojektion (`report.js:toViolation`) erfasst — mit einem
 * synthetischen roster-weiten Anker ({@link ROSTER_BUDGET_ANCHOR}), weil die
 * Regel an keinem realen Baumknoten haengt.
 */

import { scopeKey, ScopeKeyword, ROSTER_BUDGET_ANCHOR, rosterBudgetLimitId } from './model.js';

/**
 * Die am ROSTER-Rahmen verplante Summe einer Kostenart aus dem Zaehlindex.
 * Der ROSTER-Rahmen umspannt den gesamten Roster — inklusive geschachtelter
 * Selektionen (`includeChildSelections`) und Kontingente (`includeChildForces`) —,
 * damit die Summe jede kostentragende Auswahl der Armee erfasst, nicht nur die
 * direkt unter einem Kontingent liegenden.
 *
 * @param {{ get: Function }} index  der Zaehlindex.
 * @param {string} costTypeId  die Kostenart, deren verplante Summe gelesen wird.
 * @returns {number} die verplante Summe der Kostenart (0, wenn niemand sie traegt).
 */
function plannedRosterSum(index, costTypeId) {
  const rosterKey = scopeKey(ScopeKeyword.ROSTER, null);
  const includeChildSelections = true;
  const includeChildForces = true;
  const tally = index.get(rosterKey, includeChildSelections, includeChildForces);
  return tally.costSums.get(costTypeId) ?? 0;
}

/**
 * Prueft eine einzelne eingestellte Kostengrenze und liefert ihre roster-weite
 * Budget-Verletzung, oder `null`, wenn die verplante Summe die Grenze nicht
 * uebersteigt (auf oder unter der Grenze). Die Verletzung hat MAX-Semantik:
 * erfuellt, solange die Summe die Grenze nicht ueberschreitet.
 *
 * @param {{ get: Function }} index  der Zaehlindex.
 * @param {{ costTypeId: string, value: number }} limit  die eingestellte Grenze einer Kostenart.
 * @returns {object|null} das Verletzungs-Ergebnis in Constraint-Ergebnis-Form, oder `null`.
 */
function evaluateCostLimit(index, { costTypeId, value }) {
  const actual = plannedRosterSum(index, costTypeId);
  if (actual <= value) return null;
  return {
    limit: { id: rosterBudgetLimitId(costTypeId) },
    anchor: ROSTER_BUDGET_ANCHOR,
    actual,
    bound: value,
    satisfied: false,
    delta: value - actual,
  };
}

/**
 * Wertet die Regel „Armee zu teuer" ueber alle eingestellten Kostengrenzen aus:
 * je Kostenart die am ROSTER-Rahmen verplante Summe gegen ihre eigene Grenze.
 *
 * @param {{ get: Function }} index  der Zaehlindex (SSOT der verplanten Summen).
 * @param {import('./rosterBudget.js').RosterBudget} budget  die eingestellten Kostengrenzen.
 * @returns {object[]} die roster-weiten Budget-Verletzungen (nur die ueberschrittenen
 *   Kostenarten), je in Constraint-Ergebnis-Form fuer die Berichtsprojektion.
 */
export function evaluateRosterBudget(index, budget) {
  const violations = [];
  for (const limit of budget.entries()) {
    const violation = evaluateCostLimit(index, limit);
    if (violation !== null) violations.push(violation);
  }
  return violations;
}
