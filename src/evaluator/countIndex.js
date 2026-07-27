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

import { DefinitionKind, scopeKey, typeScopeKey } from './model.js';
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
  return { selectionCount: 0, forceCount: 0, costSums: new Map() };
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
  if (node.isForce) return { selectionCount: 0, forceCount: node.instance.count, costSums: new Map() };
  const selectionCount = node.instance.count;
  const costSums = new Map();
  for (const [costTypeId, perSelection] of effective.costEntriesOf(node)) {
    costSums.set(costTypeId, perSelection * selectionCount);
  }
  return { selectionCount, forceCount: 0, costSums };
}

/**
 * Die Ziele, unter denen ein Knoten in einem Rahmen zaehlbar ist — getrennt nach
 * den **zwei Schluesselraeumen** des Index (`design.md`, Kontrakt 8):
 *
 * - **Id-Ziele**: `null` ("alles im Rahmen"), jede Id seines Vorkommens
 *   (`occurrenceIds`: die eigene und jedes Glied seiner Verweiskette bis zum Ziel,
 *   Kontrakt 3), jede seiner **effektiven** Kategorie-IDs und jede Gruppen-ID, deren
 *   Member er ist. Dies ist der Zaehl-Zugriffspunkt aus §4.4: die Zaehlung stuetzt
 *   sich auf die effektiven Kategorien (nach kategorie-aendernden Modifikatoren),
 *   nicht auf die Basis-Kategorien.
 * - **Typ-Ziel**: der gezaehlte Typ seines Vorkommens (`countedType`: das rohe
 *   `type`-Attribut der tragenden Definition, bei einem Verweis das seines Ziels,
 *   Kontrakt 4). Das ist es, was eine Bedingung mit einem Typ-Schluesselwort als
 *   `childId` liest. Ein Ziel ohne `type` (eine Gruppe) traegt keines bei.
 *
 * Beide Wertarten fallen in **getrennte** Schluesselraeume: eine Katalog-Id, die
 * zufaellig `model` lautet, zaehlt deshalb nicht als Typ.
 *
 * Dass ein Vorkommen unter *allen* seinen Ids zaehlt, ist die Naht, an der eine am
 * `entryLink` deklarierte Grenze ihre eigene Auswahl findet **und** eine am Ziel
 * deklarierte dieselbe Auswahl trotzdem sieht. Doppelt gezaehlt wird dabei nichts:
 * jede Abfrage nennt genau einen Schluessel.
 *
 * Ein **Kontingent-Knoten** ist nur unter seiner eigenen Definitions-ID
 * (fuer Grenzen am Force-Typ) und seinen Kategorie-IDs zaehlbar. Es ist keine
 * generische Selektion "im Rahmen" und traegt daher weder zum `null`-Ziel noch zu
 * einem Typ-Ziel bei.
 *
 * Eine **Gruppe** als Definition eines realen Knotens traegt keine Id-Ziele: eine
 * Gruppe ist kein Auswahlpunkt, ihre Zaehlung laeuft ueber die `memberGroupIds`
 * ihrer Member.
 */
function countTargetsOf(node, effective) {
  const categoryIds = effective.categoryIdsOf(node);
  if (node.isForce) {
    return { idTargets: Array.from(new Set([node.def.id, ...categoryIds])), typeTarget: null };
  }
  const idTargets = [null, ...categoryIds];
  if (node.def.kind !== DefinitionKind.GROUP) idTargets.push(...node.occurrenceIds);
  if (node.memberGroupIds !== undefined) idTargets.push(...node.memberGroupIds);
  return { idTargets: Array.from(new Set(idTargets)), typeTarget: node.countedType ?? null };
}

/** Addiert einen Beitrag auf einen Zaehler. */
function addTally(tally, contribution) {
  tally.selectionCount += contribution.selectionCount;
  tally.forceCount += contribution.forceCount;
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
  const { idTargets, typeTarget } = countTargetsOf(node, effective);
  let crossedSelection = false;
  let crossedForce = false;
  let frame = node;
  let isImmediate = true; // der Knoten selbst: keine Grenze dazwischen
  while (frame !== null) {
    const forceCrossedForFrame = frame.isRoot ? false : crossedForce;
    const bucket = bucketFor(crossedSelection, forceCrossedForFrame);
    const frameKey = frameKeyOf(frame);
    for (const targetId of idTargets) {
      let c = contribution;
      if (node.isForce && targetId === node.def.id) {
        c = { selectionCount: node.instance.count, forceCount: node.instance.count, costSums: contribution.costSums };
      }
      addContribution(tallies, scopeKey(frameKey, targetId), bucket, c);
    }
    if (typeTarget !== null) {
      addContribution(tallies, typeScopeKey(frameKey, typeTarget), bucket, contribution);
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

const ZERO_TALLY = Object.freeze({ selectionCount: 0, forceCount: 0, costSums: new Map() });

/**
 * Baut den Zaehlindex ueber die realen Knoten des Evaluationsbaums aus den
 * **effektiven** Werten. Effektive Kosten und Kategorien (nach den Modifikatoren)
 * bestimmen, was gezaehlt wird — nicht die Basisdefinitionen (§4.4).
 *
 * @param {object} root Wurzel des Evaluationsbaums.
 * @param {import('./effectiveState.js').EffectiveState} effective effektive Kosten und Kategorien je Knoten.
 * @returns {{ get: (key: string, includeChildSelections?: boolean, includeChildForces?: boolean) => { selectionCount: number, forceCount: number, costSums: Map<string, number> } }}
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
