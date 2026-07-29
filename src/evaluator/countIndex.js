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
 *
 * **Kosten steigen unter die Ziel-Ids ihrer Vorfahren auf** (Issue 091): eine
 * Grenze, deren `field` eine Kostenart ist, begrenzt die Summe dieser Kosten
 * unterhalb ihres **Traegers** (`docs/battlescribe-data-format.md` §7.6/§9.4).
 * Gelesen wird sie als ziel-gefilterte Query `(Rahmen, Traeger-Id)`; deshalb
 * verbucht diese Schicht den **Kostenanteil** eines Beitrags zusaetzlich unter
 * jeder Ziel-Id der Vorfahren, die im jeweiligen Rahmen liegen. Die
 * Selektionsanzahl steigt dabei **nicht** mit auf — unter der Traeger-Id steht
 * weiterhin nur der Traeger.
 */

import { DefinitionKind, scopeKey } from './model.js';
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
 * Die Ziel-IDs, unter denen ein Knoten in einem Rahmen zaehlbar ist: `null`
 * ("alles im Rahmen"), seine eigene Definitions-ID und jede seiner **effektiven**
 * Kategorie-IDs. Dies ist der Zaehl-Zugriffspunkt aus §4.4: die Zaehlung stuetzt
 * sich auf die effektiven Kategorien (nach kategorie-aendernden Modifikatoren),
 * nicht auf die Basis-Kategorien.
 *
 * Ein **Kontingent-Knoten** ist nur unter seiner eigenen Definitions-ID
 * (fuer Grenzen am Force-Typ) und seinen Kategorie-IDs zaehlbar. Es ist keine
 * generische Selektion "im Rahmen" und traegt daher nicht zum `null`-Ziel bei.
 *
 * Ist der Knoten Member einer `selectionEntryGroup` (`memberGroupIds`, aus dem
 * Definitionsbaum abgeleitet), zaehlt er zusaetzlich unter jeder Gruppen-ID —
 * so liest die gruppen-skopierte Grenze (`scope=parent`, Ziel = Gruppen-ID) im
 * Eigentuemer-Rahmen die Zahl der gewaehlten Member.
 *
 * Dazu zwei Ziele, die nicht aus dem Knoten selbst stammen:
 * - **`targetId`** — ein `entryLink` zaehlt auch unter der Id, auf die er zeigt.
 *   Nur so trifft eine Grenze, die den Eintrag benennt, auch das ueber einen
 *   Verweis gesetzte Vorkommen.
 * - **`type`** — das rohe `type`-Attribut des Eintrags (`model`, `unit`, …). Es
 *   traegt die Bedingung `childId="model"`. Ein `entryLink` traegt selbst kein
 *   solches Attribut (sein `type` ist der Ziel-Diskriminator
 *   `selectionEntry`/`selectionEntryGroup` und wird von {@link readEntryLink}
 *   gar nicht gelesen) — er zaehlt stattdessen unter dem rohen Typ seines
 *   transitiv aufgeloesten Ziels (`resolved.type`), sodass ein verlinkter
 *   Eintrag genauso zaehlt wie derselbe Eintrag direkt gesetzt (Issue 78).
 *
 * Exportiert, weil die Vorfahrenpruefung des Bezugsrahmens `ancestor`
 * (`query.js`, Issue 086) einen Vorfahren an **denselben** Zielen misst, unter
 * denen er hier zaehlbar ist — eine Quelle der Wahrheit statt einer zweiten,
 * driftgefaehrdeten Ziel-Liste.
 */
export function targetsOf(node, effective) {
  if (node.isForce) return [node.def.id, ...effective.categoryIdsOf(node)];
  const targets = [null, ...effective.categoryIdsOf(node)];
  if (node.def.kind !== DefinitionKind.GROUP) targets.push(node.def.id);
  if (node.def.targetId) targets.push(node.def.targetId);
  if (node.memberGroupIds !== undefined) targets.push(...node.memberGroupIds);
  if (node.def.type) targets.push(node.def.type);
  if (node.def.kind === DefinitionKind.ENTRY_LINK && node.def.resolved?.type) {
    targets.push(node.def.resolved.type);
  }
  return Array.from(new Set(targets));
}

/**
 * Die Ziel-IDs, unter denen ein Vorfahre als **Traeger** einer Kostengrenze zaehlbar
 * ist (§7.6/§9.4, Issue 091): seine eigenen Ziele ohne das Rahmen-Ziel `null`.
 *
 * `null` bleibt draussen, weil „alles im Rahmen" den Beitrag des Nachfahren ohnehin
 * schon zaehlt — er stuende sonst doppelt in der Summe. Weil {@link targetsOf} auch
 * die `memberGroupIds` eines Knotens liefert, deckt dieselbe eine Regel das
 * Gruppen-Muster aus §9.4 ab: die verschachtelten Kosten eines Gruppenmitglieds
 * steigen unter die Gruppen-ID auf, ohne einen zweiten Sonderweg.
 */
function carrierTargetsOf(node, effective) {
  return targetsOf(node, effective).filter(targetId => targetId !== null);
}

/**
 * Der reine **Kostenanteil** eines Beitrags — das, was unter der Ziel-ID eines
 * Vorfahren aufsteigt. Die Selektions- und Kontingentanzahl bleibt zurueck: unter
 * der Traeger-ID steht der Traeger selbst, nicht zusaetzlich jeder seiner
 * Nachfahren. (Wie viele Auswahlen unterhalb eines Traegers stehen, ist eine eigene
 * Frage — Issue 083 — und wird hier nicht mit beantwortet.)
 */
function costsOnly(contribution) {
  return { selectionCount: 0, forceCount: 0, costSums: contribution.costSums };
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
 *
 * Auf demselben Weg steigen die **Kosten** zusaetzlich unter den Ziel-IDs der
 * durchlaufenen Vorfahren auf (Issue 091): eine Grenze, deren `field` eine
 * Kostenart ist, begrenzt die Summe dieser Kosten **unterhalb ihres Traegers**
 * (§7.6/§9.4), und die ziel-gefilterte Query `(Rahmen, Traeger-ID)` ist die
 * Stelle, die diese Summe liest. Fuer diese aufgestiegenen Anteile gilt die
 * Selektionsschachtelung **immer** als gekreuzt — auch im Rahmen des Traegers
 * selbst, wo der normale `crossedSelection`-Zustand noch falsch ist —, denn sie
 * stammen stets von echten Nachfahren des Traegers. So entscheidet
 * `includeChildSelections` in jedem Rahmen, ob sie mitzaehlen.
 */
function indexNodeContribution(tallies, node, effective) {
  const contribution = contributionOf(node, effective);
  const targets = targetsOf(node, effective);
  const ownTargets = new Set(targets);
  // Die Ziele der bereits durchlaufenen Vorfahren; sie waechst mit jedem Aufstieg.
  const carrierTargets = new Set();
  const climbingCosts = costsOnly(contribution);
  const carriesCosts = contribution.costSums.size > 0;
  let crossedSelection = false;
  let crossedForce = false;
  let frame = node;
  let isImmediate = true; // der Knoten selbst: keine Grenze dazwischen
  while (frame !== null) {
    const forceCrossedForFrame = frame.isRoot ? false : crossedForce;
    const bucket = bucketFor(crossedSelection, forceCrossedForFrame);
    const frameKey = frameKeyOf(frame);
    // Der Rahmen selbst ist der aeusserste Traeger, unter dessen Ziel-IDs dieser
    // Beitrag in *diesem* Rahmen zaehlt — die Wurzel ausgenommen, sie traegt keine
    // Definition. Ein Ziel, unter dem der Knoten schon selbst zaehlt, bleibt
    // draussen: seine Kosten stuenden sonst doppelt in derselben Summe.
    if (carriesCosts && !isImmediate && !frame.isRoot) {
      for (const carrierTargetId of carrierTargetsOf(frame, effective)) {
        if (!ownTargets.has(carrierTargetId)) carrierTargets.add(carrierTargetId);
      }
    }
    for (const targetId of targets) {
      let c = contribution;
      if (node.isForce && targetId === node.def.id) {
        c = { selectionCount: node.instance.count, forceCount: node.instance.count, costSums: contribution.costSums };
      }
      addContribution(tallies, scopeKey(frameKey, targetId), bucket, c);
    }
    // Aufgestiegene Kostenanteile stammen immer von *echten* Nachfahren des
    // Traegers — sie haben die Selektionsschachtelung also stets gekreuzt, auch
    // wenn der Query-Rahmen der Traeger selbst ist (`scope="self"`,
    // `shared="false"`), wo `crossedSelection` noch falsch ist. Deshalb wird der
    // Eimer hier mit erzwungener Selektionskreuzung gewaehlt: nur
    // `includeChildSelections="true"` zaehlt sie mit (Issue 091, Runde 1).
    const climbBucket = bucketFor(true, forceCrossedForFrame);
    for (const carrierTargetId of carrierTargets) {
      addContribution(tallies, scopeKey(frameKey, carrierTargetId), climbBucket, climbingCosts);
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
