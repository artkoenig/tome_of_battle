/**
 * Die **eine** zentrale Rundungskonvention der Reinraum-Auswertungs-Engine
 * (`docs/evaluator-architecture.md` §4.7 und §5, Risiko 5: verstreute
 * `floor`/`round`-Aufrufe waeren ein klassischer Driftfehler).
 *
 * Prozentgrenzen leiten ihren Grenzwert aus `Nenner * Prozent / 100` ab und
 * runden das Ergebnis an genau dieser Stelle — nirgends sonst.
 */

const HALF = 0.5;

/**
 * Kaufmaennisches Aufrunden bei .5 ("round half up"). Fuer die hier auftretenden
 * nicht-negativen Grenzwerte ist `floor(x + 0.5)` die praezise Definition
 * (0.5 → 1, 1.4 → 1, 1.5 → 2).
 *
 * @param {number} value  Nicht-negativer, ungerundeter Grenzwert.
 * @returns {number} Der auf eine ganze Zahl gerundete Grenzwert.
 */
export function roundHalfUp(value) {
  return Math.floor(value + HALF);
}
