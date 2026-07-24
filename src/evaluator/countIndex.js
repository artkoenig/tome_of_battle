/**
 * Index-Schicht (`docs/evaluator-architecture.md` §3.4/§4.4), Skeleton-Umfang.
 *
 * Ein Durchlauf ueber die realen Knoten baut Zaehlindizes, sodass Bezuege
 * O(1)-Nachschlaege statt Baumtraversalen sind. Diese Scheibe fuehrt nur den
 * ROSTER-Rahmen und die Selektionsanzahl; Force-/Parent-Rahmen, Kostensummen
 * und die direkt/tief-Unterscheidung folgen in spaeteren Scheiben.
 */

import { ScopeKeyword, scopeKey } from './model.js';
import { realNodes } from './evalTree.js';

const ZERO_TALLY = Object.freeze({ selectionCount: 0 });

/** Addiert eine Selektionsanzahl auf den Schluessel `key`. */
function addSelections(tallies, key, selectionCount) {
  const current = tallies.get(key) ?? ZERO_TALLY;
  tallies.set(key, { selectionCount: current.selectionCount + selectionCount });
}

/**
 * Baut den Zaehlindex ueber die realen Knoten des Evaluationsbaums.
 *
 * @param {object} root Wurzel des Evaluationsbaums.
 * @returns {{ get: (key: string) => { selectionCount: number } }}
 */
export function buildIndex(root) {
  const tallies = new Map();
  for (const node of realNodes(root)) {
    const selectionCount = node.instance.count;
    // "Alles im Roster" und "auf diesen Eintrag gefiltert" — die beiden
    // Schluessel, die eine ROSTER-Query im Skeleton nachfragen kann.
    addSelections(tallies, scopeKey(ScopeKeyword.ROSTER, null), selectionCount);
    addSelections(tallies, scopeKey(ScopeKeyword.ROSTER, node.def.id), selectionCount);
  }
  return {
    get: key => tallies.get(key) ?? ZERO_TALLY,
  };
}
