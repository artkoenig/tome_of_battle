/**
 * Kostenprojektion des Berichts (Issue 0121, Task 1; ADR-0034: was in den
 * Katalogdaten steht, beantwortet die Engine — die Oberflaeche rechnet keine
 * Kosten nach).
 *
 * Ein Durchlauf ueber den fertigen Auswertungsbaum projiziert die **effektiven**
 * Kosten (nach allen Kosten-Modifikatoren, `effectiveState.js`) auf drei Sichten:
 *
 * - je Slot die **Eigenkosten einer Instanz** (`costs`) — der Wert, den EINE
 *   Instanz kostet bzw. beim Waehlen kosten wuerde (auch an Angebots-Ankern,
 *   ADR-0035). Ein `entryLink`-Slot traegt die Kosten des Verweises vor denen
 *   des Ziels (`docs/battlescribe-data-format.md` §9.3) — das erledigt bereits
 *   die Effektiv-Werte-Schicht (`baseValuesOf`), hier wird nur gelesen;
 * - je Slot die **Gesamtkosten im aktuellen Zustand** (`totalCosts`):
 *   Eigenkosten × Anzahl plus die `totalCosts` aller Kind-Slots. Die Anzahl ist
 *   die **absolute** Gesamtstueckzahl der Instanz (Roster-Vertrag der Fassade,
 *   §7.5 „Zahlenbasis" — keine Elternketten-Multiplikation); ein synthetischer
 *   Anker hat keine Instanz und zaehlt mit 0;
 * - roster-weit die **Kostensumme je Kostenart** (`costTotals`): die Summe der
 *   Beitraege aller **belegten** Slots (Kosten je Instanz × Anzahl). Jede im
 *   Datensatz deklarierte Kostenart erscheint darin — ohne Vorkommen mit 0
 *   (Vertragsentscheidung Issue 0121: BattleScribe zeigt jede Kostenart des
 *   Spielsystems mit „0", und `describeDataset` fuehrt die Deklarationen
 *   bereits vollstaendig). Angebots-Anker und die uebrigen synthetischen Anker
 *   zaehlen nicht: sie tragen keine Instanz.
 *
 * Eine vierte Sicht steht daneben, siehe {@link buildRaiseCostProjection}: je
 * Slot der **Aushebe-Preis** (`raiseCosts`) — was das Aufstellen dieses Slots
 * kostet, seine Eigenkosten plus die seiner Pflicht-Kinder. Sie ist die einzige
 * Sicht, die einen Slot bepreist, den der Baum nicht fuehrt.
 *
 * Die Projektion **liest** ausschliesslich — den Baum und die Effektiv-Werte —
 * und rechnet nichts zweites her: dieselben effektiven Kosten speisen auch den
 * Zaehlindex (`countIndex.js`, `contributionOf`).
 */

import { createDetachedChildNode, mandatoryMemberDefsOf } from './evalTree.js';
import { extendBaseEffectiveState } from './effectiveState.js';
import { applyModifiersOfNodes } from './modifiers.js';
import { UNLIMITED } from './model.js';

/** Die leere Kostensicht eines Knotens, den die Projektion nicht kennt. */
const NO_COSTS = Object.freeze({});

/** Die leere Mitglieder-Sicht eines Knotens, den die Projektion nicht kennt. */
const NO_MEMBERS = Object.freeze([]);

/** Addiert einen Betrag auf eine Kostenart eines Kosten-Records. */
function addTo(record, costTypeId, value) {
  record[costTypeId] = (record[costTypeId] ?? 0) + value;
}

/**
 * Baut die Kostenprojektion eines Auswertungsbaums: je Slot die Eigenkosten
 * einer Instanz und die Gesamtkosten des Teilbaums, dazu die roster-weite
 * Kostensumme je Kostenart.
 *
 * @param {{ children: object[] }} root  Wurzel des Auswertungsbaums (nach
 *   Baumphase 2 — die Angebots-Anker haengen bereits).
 * @param {import('./effectiveState.js').EffectiveState} effective  der
 *   konvergierte Effektiv-Zustand (Kosten nach Modifikatoren).
 * @param {readonly string[]} declaredCostTypeIds  die im Datensatz deklarierten
 *   Kostenarten — sie erscheinen in `costTotals` auch ohne Vorkommen (mit 0).
 * @returns {{ costsOf: (node: object) => Record<string, number>, totalCostsOf: (node: object) => Record<string, number>, costTotals: Record<string, number> }}
 */
export function buildCostProjection(root, effective, declaredCostTypeIds) {
  const costsByNode = new Map();
  const totalCostsByNode = new Map();
  /** @type {Record<string, number>} */
  const costTotals = {};
  for (const costTypeId of declaredCostTypeIds) {
    costTotals[costTypeId] = 0;
  }

  function projectNode(node) {
    /** @type {Record<string, number>} */
    const costs = {};
    for (const [costTypeId, perInstance] of effective.costEntriesOf(node)) {
      costs[costTypeId] = perInstance;
    }
    // Ein synthetischer Anker (Phantom, Gruppen-/Kategorie-/Angebots-Anker)
    // traegt keine Instanz: seine Anzahl ist 0, seine Gesamtkosten damit die
    // seiner Kind-Slots (Anker sind Blaetter oder tragen nur weitere Anker).
    const count = node.instance?.count ?? 0;
    /** @type {Record<string, number>} */
    const totals = {};
    for (const [costTypeId, perInstance] of Object.entries(costs)) {
      totals[costTypeId] = perInstance * count;
      // In die roster-weite Summe geht nur ein **belegter** Slot ein — ein
      // Angebot ist keine Auswahl (Kriterium 4, Issue 0121).
      if (node.instance !== null) {
        addTo(costTotals, costTypeId, perInstance * count);
      }
    }
    for (const child of node.children) {
      for (const [costTypeId, value] of Object.entries(projectNode(child))) {
        addTo(totals, costTypeId, value);
      }
    }
    costsByNode.set(node, Object.freeze(costs));
    totalCostsByNode.set(node, Object.freeze(totals));
    return totals;
  }

  for (const child of root.children) {
    projectNode(child);
  }

  return {
    costsOf: node => costsByNode.get(node) ?? NO_COSTS,
    totalCostsOf: node => totalCostsByNode.get(node) ?? NO_COSTS,
    costTotals: Object.freeze(costTotals),
  };
}

/**
 * Builds the **raise cost** projection: per slot what raising it would cost —
 * its own effective cost plus, for every child it is obliged to create, that
 * child's effective minimum count times that child's raise cost, recursively.
 *
 * This is the fourth projected view beside `costs`, `totalCosts` and
 * `costTotals`, and it is the only one that has to price a slot which is NOT in
 * the tree: an offer anchor is a leaf by design (`offer.js`), so a unit whose
 * points hang on a mandatory model child has no node to read them from. For each
 * such child the projection therefore builds a **detached** node
 * ({@link import('./evalTree.js').createDetachedChildNode}) — one that carries
 * `parent` and `forceRoot` but is never pushed into `parent.children`, so nothing
 * that walks the tree can reach it — and runs the two steps the anchor post pass
 * runs on offer anchors on it: seed its base values, then apply its modifiers.
 * Only then are its cost and its minimum read, so both are the **effective**
 * values in the context of the force the slot hangs under (a force-gated cost
 * modifier on the model changes the raise price, exactly as the catalogue says).
 *
 * Writing into the report's own `EffectiveState` is required, not merely
 * convenient: the same state is handed to the query context, and a fresh one
 * would make `ancestor`/category-scope conditions read empty values off the REAL
 * ancestors. It is free of feedback for the same three reasons
 * {@link import('./fixpoint.js').applyAnchorPostPass} documents: the count index
 * is finished and only read, the state keys by node OBJECT so a detached node can
 * never overwrite a real node's value, and the tree is not modified.
 *
 * The modifier diagnostics of this pass are collected locally and **dropped**:
 * the pass evaluates a slot that does not exist in the list, so a finding of it
 * would speak about a node no report path names, and the very same modifier is
 * already diagnosed wherever it applies to a slot that does exist. This is the
 * one place in the engine where a modifier diagnosis is deliberately not
 * forwarded.
 *
 * Termination on cyclic catalogue data is carried by a `visited` set of
 * definition ids along the CURRENT branch: a definition already on the branch
 * contributes nothing and is not descended into, while the same definition
 * reached through two different branches is still counted twice.
 *
 * @param {{ children: object[] }} root  root of the finished evaluation tree.
 * @param {import('./effectiveState.js').EffectiveState} effective  the converged
 *   effective state; it is EXTENDED by the values of the detached nodes.
 * @param {{ index: { get: Function }, categoryIds: Set<string>, budget?: object, primaryCatalogueByForceDefId?: Map<string, string> }} context
 *   the final count index, the known category ids, the roster budget and the
 *   origin index of the forces — the context {@link import('./modifiers.js').applyModifiersOfNodes} needs.
 * @returns {{ raiseCostsOf: (node: object) => Record<string, number>, raiseMembersOf: (node: object) => ReadonlyArray<{ defId: string, targetDefId: string|null, count: number, members: ReadonlyArray<object> }> }}
 *   the price of raising a slot and, from the very same walk, the members that
 *   raising it creates — so the price and the tree it prices can never diverge.
 */
export function buildRaiseCostProjection(root, effective, { index, categoryIds, budget, primaryCatalogueByForceDefId }) {
  const raiseCostsByNode = new Map();
  const raiseMembersByNode = new Map();
  /** Diagnostics of this pass — collected and dropped on purpose, see above. */
  const droppedDiagnostics = [];
  /** Memoised per definition OBJECT: the answer is a pure function of `node.def`. */
  const mandatoryChildrenByDef = new Map();

  function mandatoryChildrenOf(node) {
    let children = mandatoryChildrenByDef.get(node.def);
    if (children === undefined) {
      children = mandatoryMemberDefsOf(node);
      mandatoryChildrenByDef.set(node.def, children);
    }
    return children;
  }

  /**
   * Seeds a detached node's base values and applies its modifiers — the two
   * steps the anchor post pass runs, on a node the tree does not carry.
   */
  function evaluateDetached(shadow) {
    extendBaseEffectiveState(effective, [shadow]);
    applyModifiersOfNodes([shadow], effective, {
      root, index, categoryIds, diagnostics: droppedDiagnostics, budget, primaryCatalogueByForceDefId,
    });
    return shadow;
  }

  /** The effective own cost of one instance — the same source `costs` reads. */
  function ownCostsOf(node) {
    /** @type {Record<string, number>} */
    const costs = {};
    for (const [costTypeId, perInstance] of effective.costEntriesOf(node)) {
      costs[costTypeId] = perInstance;
    }
    return costs;
  }

  function raiseOf(node, visited) {
    const costs = ownCostsOf(node);
    const members = [];
    for (const { def, gates, limit, limitDef } of mandatoryChildrenOf(node)) {
      const ids = [def.id, def.resolved?.id].filter(id => id !== undefined && id !== null);
      if (ids.some(id => visited.has(id))) continue;
      const shadow = evaluateDetached(createDetachedChildNode(root, node, def, gates));
      // A hidden obligation is none: a MIN limit at a hidden anchor is not
      // validated (§8, `evaluableLimitsOf`), so the raise neither owes this
      // child nor pays for it. Read after the modifier pass, like the bound —
      // a modifier may uncover it, and its visibility gates count too.
      if (effective.isHidden(shadow)) continue;
      // The bound is read AFTER the modifier pass: a minimum a modifier lifts
      // from 0 counts, one it drops to 0 contributes nothing and stops the
      // recursion there. An unlimited bound is no piece count at all.
      // For a pick-one group the bound hangs on the GROUP, so it is read off a
      // detached node of the group — evaluated the same way, one level up.
      const boundCarrier = limitDef === def
        ? shadow
        : evaluateDetached(createDetachedChildNode(root, node, limitDef, gates.slice(0, -1)));
      const bound = effective.limitValue(boundCarrier, limit.id) ?? limit.value;
      if (bound === UNLIMITED) continue;
      const mandatoryCount = Math.max(0, bound);
      if (mandatoryCount === 0) continue;
      const child = raiseOf(shadow, new Set([...visited, ...ids]));
      for (const [costTypeId, perInstance] of Object.entries(child.costs)) {
        addTo(costs, costTypeId, mandatoryCount * perInstance);
      }
      members.push(Object.freeze({
        defId: def.id,
        targetDefId: def.resolved?.id ?? null,
        count: mandatoryCount,
        members: child.members,
      }));
    }
    return { costs, members: Object.freeze(members) };
  }

  function projectRaiseCost(node) {
    const ownIds = [node.def.id, node.def.resolved?.id].filter(id => id !== undefined && id !== null);
    const { costs, members } = raiseOf(node, new Set(ownIds));
    raiseCostsByNode.set(node, Object.freeze(costs));
    raiseMembersByNode.set(node, members);
    for (const child of node.children) {
      projectRaiseCost(child);
    }
  }

  for (const child of root.children) {
    projectRaiseCost(child);
  }

  return {
    raiseCostsOf: node => raiseCostsByNode.get(node) ?? NO_COSTS,
    raiseMembersOf: node => raiseMembersByNode.get(node) ?? NO_MEMBERS,
  };
}
