/**
 * Constraint-Schicht (`docs/evaluator-architecture.md` §3.6/§4.7).
 *
 * Jede Grenze liefert nie nur "verletzt ja/nein", sondern das volle Tripel
 * Ist-Wert / effektiver Grenzwert / Delta plus Bezugsinstanz. Diese Scheibe
 * wertet MIN- und MAX-Grenzen ueber Selektionsanzahl *und* Kostensummen aus und
 * leitet Prozentgrenzen aus dem Nenner ihres Bezugsrahmens ab (eine zentrale
 * Rundungskonvention). Modifizierte Grenzwerte folgen in spaeteren Scheiben.
 */

import { LimitKind, SUSPENDED, DiagnosticKind, diagnostic } from './model.js';
import { realNodes } from './evalTree.js';
import { query } from './query.js';
import { roundHalfUp } from './rounding.js';

const PERCENT_DIVISOR = 100;

/**
 * Bestimmt den effektiven Grenzwert einer Grenze. Bei einer Prozentgrenze wird
 * er aus dem im Bezugsrahmen gezaehlten Nenner abgeleitet; ein Nenner 0 fuehrt
 * zu `SUSPENDED` samt Null-Nenner-Diagnose (A4), nie zu einer Verletzung.
 */
function resolveBound(limit, ctx) {
  const raw = limit.value;
  if (!limit.isPercent) return raw;
  const denominator = query(ctx, limit.field, limit.scope, null);
  if (denominator === 0) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.ZERO_DENOMINATOR, { limitId: limit.id }));
    return SUSPENDED;
  }
  return roundHalfUp((denominator * raw) / PERCENT_DIVISOR);
}

/**
 * Wertet eine einzelne Grenze am Knoten aus und liefert ihr Ergebnis-Tripel,
 * oder `null`, wenn die Grenze suspendiert ist. Ziel der Zaehlung ist die
 * eigene Definition der Bezugsinstanz.
 */
function evaluateLimit(limit, node, ctx) {
  const bound = resolveBound(limit, ctx);
  if (bound === SUSPENDED) return null;
  const actual = query(ctx, limit.field, limit.scope, node.def.id);
  const satisfied = limit.kind === LimitKind.MIN ? actual >= bound : actual <= bound;
  return {
    limit,
    anchor: node,
    actual,
    bound,
    satisfied,
    delta: bound - actual,
  };
}

/**
 * Wertet alle MIN- und MAX-Grenzen des Baums aus.
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {{ get: (key: string) => object }} index
 * @param {object[]} diagnostics  Sammelliste, in die Query- und Null-Nenner-Diagnosen fliessen.
 * @returns {object[]} Constraint-Ergebnisse (je ein Tripel; suspendierte Grenzen ausgenommen).
 */
export function evaluateConstraints(root, index, diagnostics) {
  const results = [];
  const ctx = { index, diagnostics };
  for (const node of realNodes(root)) {
    for (const limit of node.def.limits) {
      const result = evaluateLimit(limit, node, ctx);
      if (result !== null) results.push(result);
    }
  }
  return results;
}
