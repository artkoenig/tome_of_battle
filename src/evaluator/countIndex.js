/**
 * Index-Schicht (`docs/evaluator-architecture.md` §3.3/§4.4).
 *
 * Ein Durchlauf ueber die realen Knoten baut Zaehlindizes, sodass Bezuege
 * O(1)-Nachschlaege statt Baumtraversalen sind. Jeder reale Knoten traegt zu
 * einer Menge von **Scope-Schluesseln** bei — je Rahmen seiner Vorfahrenkette
 * (die Wurzel/ROSTER, jedes umschliessende Kontingent, jeder Vorfahre bis zu
 * sich selbst) und je Ziel (alles / eigene Definition / jede Kategorie).
 *
 * Pro Schluessel werden **vier** Eimer gefuehrt, nach den beiden Grenzen, die
 * ein Beitrag auf dem Weg zum Rahmen kreuzt (§4.4): Selektionsschachtelung und
 * Kontingentgrenze. Das Query-Primitiv summiert je nach `includeChildSelections`
 * und `includeChildForces` die passenden Eimer. So sind beide Flags **unabhaengig
 * voneinander** wirksam — auch in Kombination.
 */

import { scopeKey } from './model.js';
import { realNodes, frameKeyOf } from './evalTree.js';

/**
 * Die vier Beitrags-Eimer eines Schluessels, nach gekreuzter Grenze:
 * - `BASE`: keine Grenze gekreuzt (der Rahmen selbst und seine direkten Kinder),
 * - `SELECTION`: nur Selektionsschachtelung gekreuzt (`includeChildSelections`),
 * - `FORCE`: nur eine Kontingentgrenze gekreuzt (`includeChildForces`),
 * - `BOTH`: beide gekreuzt (nur mit beiden Flags gezaehlt).
 */
const Bucket = Object.freeze({
  BASE: 'base',
  SELECTION: 'selection',
  FORCE: 'force',
  BOTH: 'both',
});

/** Waehlt den Eimer eines Beitrags aus den beiden gekreuzten Grenzen. */
function bucketFor(crossedSelection, crossedForce) {
  if (crossedSelection && crossedForce) return Bucket.BOTH;
  if (crossedSelection) return Bucket.SELECTION;
  if (crossedForce) return Bucket.FORCE;
  return Bucket.BASE;
}

/** Ein leerer Zaehler (Anzahl und Kostensummen je Kostenart). */
function emptyTally() {
  return { selectionCount: 0, costSums: new Map() };
}

/** Ein leerer Schluessel-Eintrag: ein Zaehler je Beitrags-Eimer. */
function emptyBuckets() {
  return {
    [Bucket.BASE]: emptyTally(),
    [Bucket.SELECTION]: emptyTally(),
    [Bucket.FORCE]: emptyTally(),
    [Bucket.BOTH]: emptyTally(),
  };
}

/**
 * Der Beitrag eines Knotens: seine Selektionsanzahl und **effektiven** Kosten je
 * Kostenart. Die Kosten kommen aus der Effektiv-Werte-Schicht (nach kosten-
 * aendernden Modifikatoren), nicht aus den Basisdefinitionen.
 *
 * **Kontingent-Knoten** tragen keine Kosten und zaehlen **nicht** als Selektion
 * "im Rahmen" (kein `null`-/Kategorie-Ziel, siehe {@link targetsOf}); sie tragen
 * aber ihre Instanzanzahl unter ihrer **eigenen Definitions-ID** bei, damit
 * Grenzen am Force-Typ (Kontingent-Definition, §3.2) den Bestand eines
 * Kontingents zaehlen koennen. Ohne das wuerde eine `min`-Grenze am Force-Typ
 * selbst bei vorhandenem Kontingent `actual=0` lesen.
 */
function contributionOf(node, effective) {
  if (node.isForce) return { selectionCount: node.instance.count, costSums: new Map() };
  const selectionCount = node.instance.count;
  const costSums = new Map();
  for (const [costTypeId, perSelection] of effective.costEntriesOf(node)) {
    costSums.set(costTypeId, perSelection * selectionCount);
  }
  return { selectionCount, costSums };
}

/**
 * Die Ziel-IDs, unter denen ein Knoten in einem Rahmen zaehlbar ist: `null`
 * ("alles im Rahmen"), seine eigene Definitions-ID und jede seiner **effektiven**
 * Kategorie-IDs. Dies ist der Zaehl-Zugriffspunkt aus §4.4: die Zaehlung stuetzt
 * sich auf die effektiven Kategorien (nach kategorie-aendernden Modifikatoren),
 * nicht auf die Basis-Kategorien.
 *
 * Ein **Kontingent-Knoten** ist nur unter seiner eigenen Definitions-ID zaehlbar
 * (fuer Grenzen am Force-Typ) — es ist keine Selektion "im Rahmen" und traegt
 * daher weder zum `null`-Ziel noch zu Kategorien bei.
 *
 * Ist der Knoten Member einer `selectionEntryGroup` (`memberGroupIds`, aus dem
 * Definitionsbaum abgeleitet), zaehlt er zusaetzlich unter jeder Gruppen-ID —
 * so liest die gruppen-skopierte Grenze (`scope=parent`, Ziel = Gruppen-ID) im
 * Eigentuemer-Rahmen die Zahl der gewaehlten Member.
 */
function targetsOf(node, effective) {
  if (node.isForce) return [node.def.id];
  const targets = [null, node.def.id, ...effective.categoryIdsOf(node)];
  if (node.memberGroupIds !== undefined) targets.push(...node.memberGroupIds);
  if (node.def.type) targets.push(node.def.type);
  return Array.from(new Set(targets));
}

/** Addiert einen Beitrag auf einen Zaehler. */
function addTally(tally, contribution) {
  tally.selectionCount += contribution.selectionCount;
  for (const [costTypeId, value] of contribution.costSums) {
    tally.costSums.set(costTypeId, (tally.costSums.get(costTypeId) ?? 0) + value);
  }
}

/** Addiert einen Beitrag in den Eimer `bucket` des Schluessels `key`. */
function addContribution(tallies, key, bucket, contribution) {
  let buckets = tallies.get(key);
  if (buckets === undefined) {
    buckets = emptyBuckets();
    tallies.set(key, buckets);
  }
  addTally(buckets[bucket], contribution);
}

/**
 * Traegt den Beitrag eines Knotens in alle Rahmen seiner Vorfahrenkette ein.
 *
 * Aufgestiegen wird vom Knoten selbst bis zur Wurzel. Fuer den Rahmen `F` sind
 * die *strikt dazwischen* liegenden Knoten (Vorfahren des Beitragenden, echte
 * Nachfahren von `F`) massgeblich: ein nicht-Kontingent dazwischen kreuzt die
 * Selektionsschachtelung, ein Kontingent dazwischen eine Kontingentgrenze. Der
 * ROSTER-Rahmen (Wurzel) umspannt **alle** Kontingente und ignoriert daher
 * Kontingentgrenzen — `includeChildForces` hat auf Rosterebene keine Bedeutung.
 */
function indexNodeContribution(tallies, node, effective) {
  const contribution = contributionOf(node, effective);
  const targets = targetsOf(node, effective);
  let crossedSelection = false;
  let crossedForce = false;
  let frame = node;
  let isImmediate = true; // der Knoten selbst: keine Grenze dazwischen
  while (frame !== null) {
    const forceCrossedForFrame = frame.isRoot ? false : crossedForce;
    const bucket = bucketFor(crossedSelection, forceCrossedForFrame);
    const frameKey = frameKeyOf(frame);
    for (const targetId of targets) {
      addContribution(tallies, scopeKey(frameKey, targetId), bucket, contribution);
    }
    // Der aktuelle Rahmen wird fuer alle *hoeheren* Rahmen zu einem
    // dazwischenliegenden Knoten (der Beitragende selbst zaehlt nie als Grenze).
    if (!isImmediate) {
      if (frame.isForce) crossedForce = true;
      else crossedSelection = true;
    }
    isImmediate = false;
    frame = frame.parent;
  }
}

/** Summiert die von den Flags erlaubten Eimer eines Schluessels zu einem Zaehler. */
function combineBuckets(buckets, includeChildSelections, includeChildForces) {
  const result = emptyTally();
  addTally(result, buckets[Bucket.BASE]);
  if (includeChildSelections) addTally(result, buckets[Bucket.SELECTION]);
  if (includeChildForces) addTally(result, buckets[Bucket.FORCE]);
  if (includeChildSelections && includeChildForces) addTally(result, buckets[Bucket.BOTH]);
  return result;
}

const ZERO_TALLY = Object.freeze({ selectionCount: 0, costSums: new Map() });

/**
 * Baut den Zaehlindex ueber die realen Knoten des Evaluationsbaums aus den
 * **effektiven** Werten. Effektive Kosten und Kategorien (nach den Modifikatoren)
 * bestimmen, was gezaehlt wird — nicht die Basisdefinitionen (§4.4).
 *
 * @param {object} root Wurzel des Evaluationsbaums.
 * @param {import('./effectiveState.js').EffectiveState} effective effektive Kosten und Kategorien je Knoten.
 * @returns {{ get: (key: string, includeChildSelections?: boolean, includeChildForces?: boolean) => { selectionCount: number, costSums: Map<string, number> } }}
 *   `get` liefert den nach den beiden `includeChild…`-Flags zusammengesetzten
 *   Zaehler eines Schluessels (Vorgabe: nur der BASE-Eimer).
 */
export function buildIndex(root, effective) {
  const tallies = new Map();
  for (const node of realNodes(root)) {
    indexNodeContribution(tallies, node, effective);
  }
  return {
    get: (key, includeChildSelections = false, includeChildForces = false) => {
      const buckets = tallies.get(key);
      if (buckets === undefined) return ZERO_TALLY;
      return combineBuckets(buckets, includeChildSelections, includeChildForces);
    },
  };
}
