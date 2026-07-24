/**
 * Constraint-Schicht (`docs/evaluator-architecture.md` §3.6/§4.7), Skeleton.
 *
 * Jede Grenze liefert nie nur "verletzt ja/nein", sondern das volle Tripel
 * Ist-Wert / effektiver Grenzwert / Delta plus Bezugsinstanz. Diese Scheibe
 * wertet **nur** MAX-Grenzen aus; MIN, Prozent-Grenzen und modifizierte
 * Grenzwerte folgen in spaeteren Scheiben.
 */

import { LimitKind } from './model.js';
import { realNodes } from './evalTree.js';
import { query } from './query.js';

/**
 * Wertet eine einzelne Grenze am Knoten aus und liefert ihr Ergebnis-Tripel.
 * Ziel der Zaehlung ist die eigene Definition der Bezugsinstanz.
 */
function evaluateLimit(limit, node, ctx) {
  const actual = query(ctx, limit.field, limit.scope, node.def.id);
  const bound = limit.value;
  return {
    limit,
    anchor: node,
    actual,
    bound,
    satisfied: actual <= bound,
    delta: bound - actual,
  };
}

/**
 * Wertet alle MAX-Grenzen des Baums aus.
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {{ get: (key: string) => { selectionCount: number } }} index
 * @param {object[]} diagnostics  Sammelliste, in die Query-Diagnosen fliessen.
 * @returns {object[]} Constraint-Ergebnisse (je ein Tripel).
 */
export function evaluateConstraints(root, index, diagnostics) {
  const results = [];
  const ctx = { index, diagnostics };
  for (const node of realNodes(root)) {
    for (const limit of node.def.limits) {
      if (limit.kind !== LimitKind.MAX) continue;
      results.push(evaluateLimit(limit, node, ctx));
    }
  }
  return results;
}
