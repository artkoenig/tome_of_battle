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

import {
  scopeKey,
  ScopeKeyword,
  ConstraintKind,
  LimitMeasure,
  ROSTER_BUDGET_ANCHOR,
  costSumField,
  rosterBudgetLimitId,
} from './model.js';

/**
 * Der Bezugsrahmen der Budget-Regel: der **ganze** Roster — inklusive
 * geschachtelter Selektionen und Kontingente —, damit die Summe jede
 * kostentragende Auswahl der Armee erfasst und nicht nur die direkt unter einem
 * Kontingent liegenden.
 *
 * Dieselben Flags speisen die Zaehlung ({@link plannedRosterSum}) **und** die
 * Einordnung der Verletzung ({@link rosterBudgetLimit}); zwei Kopien koennten
 * auseinanderlaufen und die Meldung einen Rahmen nennen lassen, in dem gar nicht
 * gezaehlt wurde.
 */
const ROSTER_WIDE_FLAGS = Object.freeze({
  shared: true,
  includeChildSelections: true,
  includeChildForces: true,
});

/**
 * Die am ROSTER-Rahmen verplante Summe einer Kostenart aus dem Zaehlindex.
 *
 * @param {{ get: Function }} index  der Zaehlindex.
 * @param {string} costTypeId  die Kostenart, deren verplante Summe gelesen wird.
 * @returns {number} die verplante Summe der Kostenart (0, wenn niemand sie traegt).
 */
function plannedRosterSum(index, costTypeId) {
  const rosterKey = scopeKey(ScopeKeyword.ROSTER, null);
  const tally = index.get(
    rosterKey,
    ROSTER_WIDE_FLAGS.includeChildSelections,
    ROSTER_WIDE_FLAGS.includeChildForces,
  );
  return tally.costSums.get(costTypeId) ?? 0;
}

/**
 * Die **synthetische Grenze** der Budget-Regel einer Kostenart. Sie traegt
 * dieselbe Form wie eine Katalog-Grenze, damit die eine Einordnung
 * (`violationClassification.js`) beide Herkuenfte ohne Sonderfall liest: eine
 * MAX-Grenze ueber die verplante Summe dieser Kostenart im roster-weiten Rahmen.
 *
 * Ihre Id kommt aus dem engine-eigenen `budget::`-Raum und kollidiert deshalb nie
 * mit einer Katalog-Grenze.
 */
function rosterBudgetLimit(costTypeId) {
  return Object.freeze({
    id: rosterBudgetLimitId(costTypeId),
    kind: ConstraintKind.MAX,
    field: costSumField(costTypeId),
    scope: ScopeKeyword.ROSTER,
    isPercent: false,
    flags: ROSTER_WIDE_FLAGS,
  });
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
    limit: rosterBudgetLimit(costTypeId),
    anchor: ROSTER_BUDGET_ANCHOR,
    actual,
    bound: value,
    satisfied: false,
    delta: value - actual,
    // Die Budget-Regel haengt an keinem Anker des Baums, sondern am Roster als
    // Ganzem — sie ist immer berichtsfaehig. Der Wert steht ausdruecklich hier,
    // damit die eine Berichtsprojektion ihn nie aus einem fehlenden Feld raten muss.
    isReportable: true,
    // Ihre **Messgroesse** ist eine eigene Art, keine Kostensummen-Grenze des
    // Katalogs: gemessen wird die verplante Summe gegen die im Roster
    // **eingestellte** Grenze. Aus derselben Not wie `isReportable` steht sie
    // ausdruecklich hier — die Einordnung liest sie ab, statt sie zu erraten.
    measure: LimitMeasure.ROSTER_BUDGET,
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
