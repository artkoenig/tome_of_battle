import { resolveCostTypeLabel } from '../../roster';

/**
 * Die **Kosten-Budgets eines Slots** als Anzeigetexte — „12 / 50 pts" je
 * kostenbezogener Höchstgrenze, die der Bericht am Slot führt (`costLimits`).
 *
 * Ein reiner Lookup auf den Bericht (ADR-0034, Leitprinzip 3): gemessen und
 * gedeckelt hat die Engine, hier wird nur noch abgelesen und benannt. Der
 * Konfigurator summierte die verplanten Punkte einer Gruppe vormals selbst
 * über ihre Zeilen — das sah zwar meist gleich aus, kannte aber weder den
 * Bezugsrahmen der Grenze noch verschachtelte Auswahlen, und über die Grenze
 * selbst wusste es gar nichts.
 *
 * Gezeigt werden nur **Höchst**grenzen auf eine verplante Kostensumme
 * (`costSum`): ein Mindestmaß ist keine Budgetanzeige, und die eingestellte
 * Roster-Kostengrenze (`budgetLimit`) steht in der Kopfzeile der Armee, nicht
 * an einer Option. Die Werte des Berichts (`current`/`bound`) sind engine-eigene
 * Zeichenketten-Werte der Aufzählungen `ConstraintKind`/`LimitMeasure` — wie im
 * übrigen App-Rand (`src/i18n/violationMessages.js`) als Literale gelesen.
 *
 * @param {{ costLimits?: Array<{ kind: string, measure: string, costTypeId: string|null, current: number, bound: number }> }|null|undefined} capability
 * @param {Object|null|undefined} system  das aufgelöste Spielsystem (benennt die Kostenart).
 * @returns {string[]} je Grenze ein Text; leer, wenn der Slot keine trägt.
 */
export function costBudgetTextsOf(capability, system) {
  return costBudgetsOf(capability).map(limit => {
    const label = resolveCostTypeLabel(system, limit.costTypeId);
    return `${limit.current} / ${limit.bound}${label ? ` ${label}` : ''}`;
  });
}

/** Die kostenbezogenen Höchstgrenzen eines Slots, die als Budget angezeigt werden. */
function costBudgetsOf(capability) {
  return (capability?.costLimits ?? [])
    .filter(limit => limit.kind === 'max' && limit.measure === 'costSum');
}

/**
 * Ob eines der Kosten-Budgets eines Slots **gerissen** ist. Die Engine sagt es je
 * Grenze (`satisfied`); die Oberfläche vergleicht dafür nichts selbst nach.
 *
 * Das ist nicht dasselbe wie `isBlocked` („kein Spielraum mehr"): ein Budget
 * genau am Anschlag sperrt weitere Auswahlen, ist aber kein Fehler.
 *
 * @param {{ costLimits?: Array<{ kind: string, measure: string, satisfied: boolean }> }|null|undefined} capability
 * @returns {boolean}
 */
export function hasExceededCostBudget(capability) {
  return costBudgetsOf(capability).some(limit => !limit.satisfied);
}
