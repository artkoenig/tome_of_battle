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
 *
 * Diese **aufgestiegenen** Kostenanteile werden **getrennt** von den
 * Eigen-Beitraegen gefuehrt (`climbedCostSums` neben `costSums`, Issue 0113):
 * ob ein Traeger-Vorkommen selbst zaehlt, ist eine Frage der Schachtelung im
 * Rahmen (`includeChildSelections`), ob seine Nachfahren-Kosten mitzaehlen,
 * eine davon unabhaengige (§7.6 „just scope's field", Issue 091). Der Leser
 * gatet die aufgestiegenen Anteile deshalb ueber ein eigenes drittes Flag von
 * `get` — ohne Angabe faellt es auf `includeChildSelections` zurueck.
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

/**
 * The frame node's **own** share under the `null` target — deliberately *not* a
 * crossing bucket: {@link bucketFor} never returns it and it is no member of
 * {@link Bucket}, whose values mean "boundary crossed on the way to the frame".
 * {@link indexNodeContribution} writes it by explicit key, and only a read that
 * asks for it ({@link combineBuckets} with `includeFrameOwn`) sees it — the
 * query at the frame node itself (`scope="self"`), never a query from an
 * ancestor frame.
 */
const FRAME_OWN = 'frameOwn';

/** Waehlt den Eimer eines Beitrags aus den beiden gekreuzten Grenzen. */
function bucketFor(crossedSelection, crossedForce) {
  if (crossedSelection && crossedForce) return Bucket.BOTH;
  if (crossedSelection) return Bucket.SELECTION;
  if (crossedForce) return Bucket.FORCE;
  return Bucket.BASE;
}

/**
 * Ein leerer Zaehler: Anzahl und **eigene** Kostensummen je Kostenart, dazu die
 * getrennt gefuehrten **aufgestiegenen** Nachfahren-Kosten (Issue 0113).
 */
function emptyTally() {
  return { selectionCount: 0, forceCount: 0, costSums: new Map(), climbedCostSums: new Map() };
}

/** Ein leerer Schluessel-Eintrag: ein Zaehler je Beitrags-Eimer. */
function emptyBuckets() {
  return {
    [Bucket.BASE]: emptyTally(),
    [Bucket.SELECTION]: emptyTally(),
    [Bucket.FORCE]: emptyTally(),
    [Bucket.BOTH]: emptyTally(),
    [FRAME_OWN]: emptyTally(),
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
 * Das `null`-Ziel meint **alles im Rahmen**, also die Nachfahren — nicht den
 * Rahmen selbst, sobald ein *anderer* Knoten fragt. Eine Selektion fuehrt es
 * hier zwar, legt ihre eigene Anzahl im **eigenen** Rahmen aber getrennt ab, wo
 * nur die Query am Rahmenknoten selbst sie liest ({@link indexNodeContribution},
 * {@link FRAME_OWN}).
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
 * Vorfahren aufsteigt, verbucht im getrennten `climbedCostSums`-Fach (Issue
 * 0113). Die Selektions- und Kontingentanzahl bleibt zurueck: unter der
 * Traeger-ID steht der Traeger selbst, nicht zusaetzlich jeder seiner
 * Nachfahren. (Wie viele Auswahlen unterhalb eines Traegers stehen, ist eine eigene
 * Frage — Issue 083 — und wird hier nicht mit beantwortet.)
 */
function costsOnly(contribution) {
  return { selectionCount: 0, forceCount: 0, costSums: new Map(), climbedCostSums: contribution.costSums };
}

/** Addiert einen Beitrag auf einen Zaehler. */
function addTally(tally, contribution) {
  tally.selectionCount += contribution.selectionCount;
  tally.forceCount += contribution.forceCount;
  for (const [costTypeId, value] of contribution.costSums) {
    tally.costSums.set(costTypeId, (tally.costSums.get(costTypeId) ?? 0) + value);
  }
  for (const [costTypeId, value] of contribution.climbedCostSums ?? []) {
    tally.climbedCostSums.set(costTypeId, (tally.climbedCostSums.get(costTypeId) ?? 0) + value);
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
  let childOnPath = null; // der zuletzt durchlaufene Knoten: das Kind des Rahmens auf diesem Pfad
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
      } else if (isImmediate && targetId === null) {
        // In its **own** frame a node's count moves out of the crossing bucket
        // and into the separate FRAME_OWN slot, because one index key answers
        // two different questions: `catalogReader.js` maps `childId="any"` and a
        // missing `childId` alike to the target `null`.
        //
        // - Asked from an **ancestor** frame (`scope="parent"`, `roster`,
        //   `force`, `unit`, an ancestor id), `childId="any"` asks for what is
        //   *inside* the frame (§7.6 — die Bezugsgroesse summiert die
        //   **Nachfahren**), and the frame is not inside itself. Otherwise an
        //   `atLeast 1 scope="parent" childId="any"` could never be unmet,
        //   because the empty frame counted itself. A force node is not
        //   countable under `null` at all, for the same reason
        //   ({@link targetsOf}).
        // - Asked at the frame node **itself** (`scope="self"`, or any scope
        //   with `shared="false"`, which binds the frame to the carrier
        //   instance), it is the identity reading Battlescribe gives `self`,
        //   and the node's own count is the answer. `query.js` opens the slot
        //   for exactly that case.
        //
        // Die **Kosten** bleiben unbedingt im Kreuzungs-Eimer: eine
        // Prozentgrenze auf ein Kostenfeld liest ihren Nenner mit dem Ziel
        // `null` im Rahmen ihres Traegers (`constraints.js`), und dort gehoert
        // der Eigenanteil des Traegers dazu — so aendert sich kein Nenner und
        // nichts wird doppelt gezaehlt.
        c = { selectionCount: 0, forceCount: 0, costSums: contribution.costSums };
        addContribution(tallies, scopeKey(frameKey, targetId), FRAME_OWN, {
          selectionCount: contribution.selectionCount,
          forceCount: contribution.forceCount,
          costSums: new Map(),
        });
      }
      addContribution(tallies, scopeKey(frameKey, targetId), bucket, c);
    }
    // Aufgestiegene Kostenanteile stammen immer von *echten* Nachfahren des
    // Traegers — sie haben die Selektionsschachtelung also stets gekreuzt, auch
    // wenn der Query-Rahmen der Traeger selbst ist (`scope="self"`,
    // `shared="false"`), wo `crossedSelection` noch falsch ist. Deshalb wird der
    // Eimer hier mit erzwungener Selektionskreuzung gewaehlt; verbucht wird im
    // getrennten `climbedCostSums`-Fach, dessen Lese-Gate `includeClimbedCosts`
    // ist (Vorgabe: `includeChildSelections` — Issue 091, Runde 1; Issue 0113).
    const climbBucket = bucketFor(true, forceCrossedForFrame);
    for (const carrierTargetId of carrierTargets) {
      addContribution(tallies, scopeKey(frameKey, carrierTargetId), climbBucket, climbingCosts);
    }
    // Der **Gruppen-Rahmen**: eine `selectionEntryGroup` ist im Roster kein
    // eigener Knoten — ihre Member haengen unter dem Eigentuemer, ihr Anker
    // daneben. Dieselbe Menge, die die gruppen-skopierte Grenze im
    // Eigentuemer-Rahmen unter der Gruppen-Id zaehlt, steht deshalb hier
    // zusaetzlich im Rahmen des Ankers (`groupFrames`, `evalTree.js`) — nur so
    // sieht eine Query, die **am Anker selbst** gestellt wird (`scope="self"`,
    // ebenso jedes `shared="false"`), den Bestand der Gruppe statt einen leeren
    // Rahmen (`docs/battlescribe-data-format.md` §7.6: eine Grenze an einer
    // Gruppe zaehlt ihre Mitglieder, nicht die Gruppe).
    //
    // Verbucht wird mit **demselben** Eimer wie im Eigentuemer-Rahmen: der
    // Member ist dessen direktes Kind (BASE), alles unter ihm hat die
    // Selektionsschachtelung gekreuzt (SELECTION) — `includeChildSelections`
    // wirkt am Gruppen-Rahmen also wie am Eigentuemer-Rahmen. Der Eigenanteil
    // des Rahmenknotens ({@link FRAME_OWN}) hat hier keinen Gegenpart: der
    // Anker selbst ist synthetisch und steht in keiner Zaehlung.
    if (childOnPath !== null && childOnPath.groupFrames !== undefined) {
      for (const anchor of childOnPath.groupFrames) {
        if (anchor.parent !== frame) continue;
        const anchorKey = frameKeyOf(anchor);
        for (const targetId of targets) {
          addContribution(tallies, scopeKey(anchorKey, targetId), bucket, contribution);
        }
      }
    }
    // Der aktuelle Rahmen wird fuer alle *hoeheren* Rahmen zu einem
    // dazwischenliegenden Knoten (der Beitragende selbst zaehlt nie als Grenze).
    if (!isImmediate) {
      if (frame.isForce) crossedForce = true;
      else crossedSelection = true;
    }
    isImmediate = false;
    childOnPath = frame;
    frame = frame.parent;
  }
}

/**
 * Summiert die von den Flags erlaubten Eimer eines Schluessels zu einem Zaehler.
 *
 * Die Eimer-Wahl der **Eigen**-Beitraege folgt den beiden `includeChild…`-Flags.
 * Die **aufgestiegenen** Nachfahren-Kosten haben ihr eigenes Gate
 * (`includeClimbedCosts`, Issue 0113): sie liegen — Selektionskreuzung stets
 * erzwungen — nur in den Eimern SELECTION und BOTH und werden von dort in die
 * gelieferte `costSums`-Summe gemischt, wenn das Gate offen ist (BOTH weiterhin
 * nur mit `includeChildForces`).
 *
 * Der **Eigenanteil des Rahmenknotens** unter dem `null`-Ziel ({@link FRAME_OWN})
 * ist kein Kreuzungs-Eimer und haengt an keinem der drei Flags: er zaehlt genau
 * dann mit, wenn `includeFrameOwn` gesetzt ist — die Query wird am Rahmenknoten
 * selbst gestellt.
 */
function combineBuckets(buckets, includeChildSelections, includeChildForces, includeClimbedCosts, includeFrameOwn) {
  const result = emptyTally();
  addTally(result, buckets[Bucket.BASE]);
  if (includeFrameOwn) addTally(result, buckets[FRAME_OWN]);
  if (includeChildSelections) addTally(result, buckets[Bucket.SELECTION]);
  if (includeChildForces) addTally(result, buckets[Bucket.FORCE]);
  if (includeChildSelections && includeChildForces) addTally(result, buckets[Bucket.BOTH]);
  if (includeClimbedCosts) {
    const climbedSources = [buckets[Bucket.SELECTION]];
    if (includeChildForces) climbedSources.push(buckets[Bucket.BOTH]);
    for (const source of climbedSources) {
      for (const [costTypeId, value] of source.climbedCostSums) {
        result.costSums.set(costTypeId, (result.costSums.get(costTypeId) ?? 0) + value);
      }
    }
  }
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
 * @returns {{ get: (key: string, includeChildSelections?: boolean, includeChildForces?: boolean, includeClimbedCosts?: boolean, includeFrameOwn?: boolean) => { selectionCount: number, forceCount: number, costSums: Map<string, number> } }}
 *   `get` liefert den nach den beiden `includeChild…`-Flags zusammengesetzten
 *   Zaehler eines Schluessels (Vorgabe: nur der BASE-Eimer). Das dritte Flag
 *   gatet die **aufgestiegenen** Nachfahren-Kosten getrennt (Issue 0113) und
 *   faellt ohne Angabe auf `includeChildSelections` zurueck — fuer jeden Leser
 *   ohne eigene Angabe bleibt das Verhalten damit unveraendert. Das vierte Flag
 *   gatet den Eigenanteil des Rahmenknotens unter dem `null`-Ziel
 *   ({@link FRAME_OWN}); es ist **vorgabegemaess offen**, sodass nur ein Leser,
 *   der es ausdruecklich schliesst, den Rahmenknoten aus „alles im Rahmen"
 *   heraushaelt — das tut die Query, wenn der Rahmen ein anderer Knoten ist als
 *   der fragende (`query.js`).
 */
export function buildIndex(root, effective) {
  const tallies = new Map();
  for (const node of realNodes(root)) {
    indexNodeContribution(tallies, node, effective);
  }
  return {
    get: (key, includeChildSelections = false, includeChildForces = false, includeClimbedCosts = includeChildSelections, includeFrameOwn = true) => {
      const buckets = tallies.get(key);
      if (buckets === undefined) return ZERO_TALLY;
      return combineBuckets(buckets, includeChildSelections, includeChildForces, includeClimbedCosts, includeFrameOwn);
    },
  };
}
