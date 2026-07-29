/**
 * Die **eine** zentrale Rundungskonvention der Reinraum-Auswertungs-Engine
 * (`docs/evaluator-architecture.md` §4.7 und §5, Risiko 5: verstreute
 * `floor`/`round`-Aufrufe waeren ein klassischer Driftfehler).
 *
 * Prozent-Queries — Grenzen (`constraints.js`) wie Conditions und Repeats
 * (`modifiers.js`) — leiten ihren wirksamen Wert aus `Nenner * Prozent / 100`
 * ab und runden das Ergebnis an genau dieser Stelle — nirgends sonst.
 */

const HALF = 0.5;

/**
 * Kaufmaennisches Aufrunden bei .5 ("round half up"). Fuer die hier auftretenden
 * nicht-negativen Werte ist `floor(x + 0.5)` die praezise Definition
 * (0.5 → 1, 1.4 → 1, 1.5 → 2).
 *
 * @param {number} value  Nicht-negativer, ungerundeter Prozent-Ableitungswert.
 * @returns {number} Der auf eine ganze Zahl gerundete Wert.
 */
export function roundHalfUp(value) {
  return Math.floor(value + HALF);
}
