/**
 * Index-Schicht (`docs/evaluator-architecture.md` §3.4/§4.4).
 *
 * Ein Durchlauf ueber die realen Knoten baut Zaehlindizes, sodass Bezuege
 * O(1)-Nachschlaege statt Baumtraversalen sind. Pro Schluessel werden
 * **Selektionsanzahl** und **Kostensumme je Kostenart** (per ID) gefuehrt
 * (`Tally`). Force-/Parent-Rahmen und die direkt/tief-Unterscheidung folgen in
 * spaeteren Scheiben; diese Scheibe fuehrt nur den ROSTER-Rahmen.
 */

import { ScopeKeyword, scopeKey } from './model.js';
import { realNodes } from './evalTree.js';

const ZERO_TALLY = Object.freeze({ selectionCount: 0, costSums: new Map() });

/** Ein Beitrag eines Knotens: seine Selektionsanzahl und Kosten je Kostenart. */
function contributionOf(node) {
  const selectionCount = node.instance.count;
  const costSums = new Map();
  for (const [costTypeId, perSelection] of Object.entries(node.def.costs ?? {})) {
    costSums.set(costTypeId, perSelection * selectionCount);
  }
  return { selectionCount, costSums };
}

/** Addiert einen Beitrag (Anzahl und Kostensummen) auf den Schluessel `key`. */
function addContribution(tallies, key, contribution) {
  let tally = tallies.get(key);
  if (tally === undefined) {
    tally = { selectionCount: 0, costSums: new Map() };
    tallies.set(key, tally);
  }
  tally.selectionCount += contribution.selectionCount;
  for (const [costTypeId, value] of contribution.costSums) {
    tally.costSums.set(costTypeId, (tally.costSums.get(costTypeId) ?? 0) + value);
  }
}

/**
 * Baut den Zaehlindex ueber die realen Knoten des Evaluationsbaums.
 *
 * @param {object} root Wurzel des Evaluationsbaums.
 * @returns {{ get: (key: string) => { selectionCount: number, costSums: Map<string, number> } }}
 */
export function buildIndex(root) {
  const tallies = new Map();
  for (const node of realNodes(root)) {
    const contribution = contributionOf(node);
    // "Alles im Roster" und "auf diesen Eintrag gefiltert" — die beiden
    // Schluessel, die eine ROSTER-Query in dieser Scheibe nachfragen kann.
    addContribution(tallies, scopeKey(ScopeKeyword.ROSTER, null), contribution);
    addContribution(tallies, scopeKey(ScopeKeyword.ROSTER, node.def.id), contribution);
  }
  return {
    get: key => tallies.get(key) ?? ZERO_TALLY,
  };
}
