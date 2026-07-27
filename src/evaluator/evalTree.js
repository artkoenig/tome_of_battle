/**
 * Join-Schicht (`docs/evaluator-architecture.md` §3.2/§4.3).
 *
 * Verheiratet Instanz- und Definitionsbaum: jeder Instanzknoten erhaelt seine
 * aufgeloeste Definition. Ab Issue 03 traegt jeder Knoten die Struktur, die das
 * Query-Primitiv fuer die Bezugsrahmen-Aufloesung braucht: eine stabile
 * Rahmen-Identitaet (`frameId`), den Elternzeiger (`parent`), das umschliessende
 * Kontingent (`forceRoot`) und die Markierung, ob der Knoten selbst ein
 * Kontingent ist (`isForce`).
 *
 * Ab Issue 06 synthetisiert die Schicht zusaetzlich **Phantomknoten** (§3.2):
 * Anker fuer Pflichtdefinitionen (`min > 0`), die im jeweiligen Bezugsrahmen keine
 * Instanz haben. Ein Phantomknoten zaehlt nie mit (die Index-Schicht iteriert nur
 * reale Knoten, §4.4), traegt aber die Definition und ihre Grenzen, sodass die
 * Constraint-Schicht eine MIN-Grenze *gerade beim Fehlen* der Auswahl auswerten
 * kann (§4.7).
 *
 * Die Traversierung bietet deshalb **drei** Sichten auf denselben Baum, je nach
 * Frage der aufrufenden Schicht:
 *
 * - {@link allNodes} — alle Knoten, Phantome eingeschlossen (Grenzen-Auswertung:
 *   auch ein Anker traegt auszuwertende Grenzen);
 * - {@link realNodes} — nur die Knoten mit Instanz. Sie sind zugleich die
 *   **iterierten** Knoten: nur sie gehen in den Zaehlindex ein, also iteriert die
 *   Fixpunktschleife genau ueber sie;
 * - {@link syntheticNodes} — die Gegenmenge: alle Anker. Ihre effektiven Werte
 *   bestimmt ein **einmaliger Nach-Durchlauf** nach der Konvergenz
 *   (`fixpoint.js`, `applyAnchorPostPass`), weil sie auf den ausgewerteten Stand
 *   nicht zurueckwirken koennen.
 *
 * Ab Issue 75/05 baut die Schicht in **zwei Phasen** (ADR-0035):
 *
 * - **Phase 1** ({@link buildEvalTree}) — die realen Knoten, die Pflicht-Phantome,
 *   die Kategorie-Anker und die Gruppen-Anker. Das ist der Baum, ueber den die
 *   Fixpunktschleife laeuft.
 * - **Phase 2** ({@link attachOfferAnchor}, gesteuert von `offer.js`) — die
 *   **Angebots-Anker** fuer das Waehlbare, angehaengt **hinter** allen bestehenden
 *   Kindern, nachdem die Schleife konvergiert ist. Weil ausschliesslich angehaengt
 *   wird, bleiben Reihenfolge, Elternschaft und damit die {@link pathOf Pfade} aller
 *   vorhandenen Slots unveraendert.
 *
 * Jeder Knoten traegt seine **Ankerart** ({@link AnchorKind}) — die Herkunft eines
 * Slots ist damit abgelesen und nicht aus Pfadform oder Definitionsart geraten.
 */

import { AnchorKind, DefinitionKind, InfoElementKind, DiagnosticKind, ConstraintKind, ScopeKeyword, diagnostic, isLinkDefinition } from './model.js';
import { identityIdsOf, isOccurrenceOf, resolvedTargetIdOf } from './identity.js';

/** Praefix der Rahmen-Identitaet eines realen Knotens (die Wurzel ist `roster`). */
const NODE_FRAME_PREFIX = 'node:';

/** Trennzeichen der Segmente eines Knoten-Pfads (siehe {@link pathOf}). */
const PATH_SEPARATOR = '/';

/**
 * Die Rahmen-Identitaet eines Knotens als String-Schluessel: die Wurzel ist der
 * ROSTER-Rahmen, jeder andere Knoten seine eigene, instanz-eindeutige Identitaet
 * (zwei Instanzen derselben Definition sind **verschiedene** Rahmen).
 */
export function frameKeyOf(node) {
  return node.isRoot ? ScopeKeyword.ROSTER : `${NODE_FRAME_PREFIX}${node.frameId}`;
}

/** Vergibt fortlaufende, instanz-eindeutige Rahmen-Identitaeten waehrend des Aufbaus. */
function createFrameIdSource() {
  let next = 0;
  return () => next++;
}

/**
 * Prueft die **Kohaerenz** einer Roster-Bindung: ein ueber einen Verweis gesetztes
 * Vorkommen fuehrt neben der Verweis-Id die Ziel-Id mit, die das Roster beim
 * Speichern gesehen hat. Loest der Verweis heute auf etwas anderes auf — Kataloge
 * werden zur Laufzeit aktualisiert (ADR-0014) —, ist das zu **melden**, nicht zu
 * erraten.
 *
 * Gemessen wird an der {@link isOccurrenceOf Zaehl-Identitaet} des Verweises: das
 * genannte Ziel ist genau dann noch stimmig, wenn der Verweis unter dieser Id
 * zaehlt. Das Pruefdatum ist **nie** ein zweiter Aufloesungsweg — bei Abweichung
 * gilt weiterhin der Verweis, weil an ihm die tragenden Regeln haengen; die
 * Auswertung laeuft mit der Diagnose daneben weiter.
 */
function checkTargetCoherence(def, instance, diagnostics) {
  const { expectedTargetDefId } = instance;
  if (expectedTargetDefId === undefined || isOccurrenceOf(def, expectedTargetDefId)) return;
  diagnostics.push(diagnostic(DiagnosticKind.ENTRY_LINK_TARGET_MISMATCH, {
    defId: instance.defId,
    expectedTargetDefId,
    targetId: resolvedTargetIdOf(def),
  }));
}

/** Haengt einen Instanzknoten samt Kindern (Auswahlen wie geschachtelte Kontingente) an. */
function attachInstance(parent, instance, resolved, diagnostics, nextFrameId) {
  const def = resolved.lookup(instance.defId);
  if (def === null) {
    diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_DEFINITION, { defId: instance.defId }));
    return;
  }
  checkTargetCoherence(def, instance, diagnostics);
  const isForce = def.kind === DefinitionKind.FORCE;
  const node = {
    def,
    instance,
    parent,
    children: [],
    isPhantom: false,
    isRoot: false,
    isForce,
    anchorKind: AnchorKind.OCCUPIED,
    frameId: nextFrameId(),
    // Das umschliessende Kontingent: der Knoten selbst, wenn er ein Kontingent
    // ist, sonst das seines Elternknotens. Steht ueber keinem Kontingent (z. B.
    // ein Wurzel-Eintrag ohne Force-Huelle), bleibt es null.
    forceRoot: null,
  };
  node.forceRoot = isForce ? node : parent.forceRoot;
  parent.children.push(node);
  for (const childInstance of instance.children ?? []) {
    attachInstance(node, childInstance, resolved, diagnostics, nextFrameId);
  }
}

/**
 * Haengt einen Phantomknoten als Auswertungsanker fuer eine Definition an, die im
 * Rahmen `parent` eine Grenze traegt, aber keine Instanz hat. Er ist strukturell
 * ein regulaerer Knoten (mit eigener Rahmen-Identitaet und `forceRoot`), aber ohne
 * Instanz (`instance = null`) und als Phantom markiert — die Index-Schicht laesst
 * ihn deshalb aus der Zaehlung aus, die Constraint-Schicht schliesst ihn ein.
 *
 * Seine {@link AnchorKind Ankerart} sagt, **warum** er da ist; sie wird vom
 * jeweiligen Synthese-Schritt gestellt, statt spaeter aus Elternschaft und
 * Definitionsart erraten zu werden.
 */
function attachPhantom(parent, def, nextFrameId, anchorKind) {
  const isForce = def.kind === DefinitionKind.FORCE;
  const node = {
    def,
    instance: null,
    parent,
    children: [],
    isPhantom: true,
    isRoot: false,
    isForce,
    anchorKind,
    frameId: nextFrameId(),
    forceRoot: null,
  };
  node.forceRoot = isForce ? node : parent.forceRoot;
  parent.children.push(node);
  return node;
}

/**
 * **Baumphase 2**: haengt einen {@link AnchorKind.OFFER_ANCHOR Angebots-Anker} als
 * **Blatt** hinter alle bestehenden Kinder von `parent`. Welche Definition in
 * welchem Rahmen einen bekommt, entscheidet `offer.js`; diese Schicht stellt nur
 * die Knotenform und zieht die Rahmen-Identitaet aus derselben Quelle wie Phase 1
 * ({@link tree-frame-ids}), sodass ein Anker nie die Identitaet eines vorhandenen
 * Knotens wiederverwendet.
 *
 * Ein Angebots-Anker ist **immer ein Blatt**: er ist kein realer Rahmen und
 * erzeugt deshalb selbst kein Angebot (`design.md`, „Waehlbar im Bezugsrahmen").
 *
 * @param {object} root  Wurzel des Baums (traegt die Quelle der Rahmen-Identitaeten).
 * @param {object} parent  der reale Rahmen, unter dem der Anker haengt.
 * @param {object} def  die angebotene Definition (bei einem Verweis: der Verweis selbst).
 * @returns {object} der angehaengte Anker.
 */
export function attachOfferAnchor(root, parent, def) {
  const node = {
    def,
    instance: null,
    parent,
    children: [],
    isPhantom: true,
    isRoot: false,
    isForce: false,
    anchorKind: AnchorKind.OFFER_ANCHOR,
    frameId: root.nextFrameId(),
    forceRoot: parent.forceRoot,
  };
  parent.children.push(node);
  return node;
}

/**
 * Liest die effektiven Basis-Limits einer Definition — die **eine** Quelle der
 * Wahrheit fuer „welche Grenzen haengen an diesem Knoten": die Constraint-Schicht
 * wertet genau diese aus, die Effektiv-Werte-Schicht bevoelkert genau diese.
 *
 * Ein Verweis (`entryLink`/`categoryLink`) erbt die Limits seines Ziels
 * (`resolved`); eigene Limits ueberschreiben bei gleicher ID.
 */
export function limitsOf(def) {
  if (isLinkDefinition(def) && def.resolved) {
    const merged = new Map();
    for (const limit of def.resolved.limits ?? []) merged.set(limit.id, limit);
    for (const limit of def.limits ?? []) merged.set(limit.id, limit);
    return Array.from(merged.values());
  }
  return def.limits ?? [];
}

/**
 * Die Info-Elemente einer Liste, verschachtelte Info-Gruppen flach mitgeliefert —
 * **auch die einer per `infoLink` bezogenen Gruppe**.
 *
 * Ein Link auf ein Profil oder eine Regel *ist* das Vorkommen dieses Elements und
 * traegt dessen Merkmale selbst (siehe {@link infoCarriersOf}); ein Link auf eine
 * **Info-Gruppe** hat dagegen keinen eigenen Wert zu tragen — die Gruppe buendelt
 * nur, ihre Mitglieder sind die eigentlichen Elemente. Ohne diesen Abstieg blieben
 * sie unerreichbar: weder wirkten ihre Modifikatoren, noch erschienen sie in der
 * Info-Projektion des Berichts (in den Fixture-Katalogen betrifft das vier Links,
 * alle im Vampire-Counts-Katalog).
 */
function* infoCarriersOfList(infos) {
  for (const info of infos) {
    yield info;
    if (info.kind === InfoElementKind.INFO_GROUP) {
      yield* infoCarriersOfList(info.infos ?? []);
    } else if (info.kind === InfoElementKind.INFO_LINK && info.resolved?.kind === InfoElementKind.INFO_GROUP) {
      yield* infoCarriersOfList(info.resolved.infos ?? []);
    }
  }
}

/**
 * Die **Traeger** der Info-Elemente eines Knotens — die **eine** Quelle der
 * Wahrheit fuer „welche Profile, Regeln und Info-Verweise haengen an diesem
 * Knoten": die Modifikator-Schicht wendet ihre Modifikatoren an, die Berichts-
 * schicht liest ihre effektiven Werte (analog {@link limitsOf} fuer Grenzen).
 *
 * Ein Verweis (`entryLink`) traegt die Info-Elemente seines Ziels mit — dieselbe
 * Erb-Regel wie bei den Grenzen. Ein `infoLink` bleibt **selbst** der Traeger: er
 * ist das Vorkommen des verlinkten Profils an diesem Knoten und erbt dessen
 * Merkmale und Modifikatoren, statt die geteilte Definition ein zweites Mal als
 * eigenen Traeger zu liefern (sonst truege ein Slot dasselbe Profil doppelt —
 * einmal mit, einmal ohne die am Link erzielte Wirkung). Zeigt der Link auf eine
 * **Info-Gruppe**, kommen deren Mitglieder hinzu: die Gruppe traegt selbst keinen
 * Wert, nur ihre Mitglieder tun es ({@link infoCarriersOfList}).
 */
export function* infoCarriersOf(def) {
  if (def === null || def === undefined) return;
  yield* infoCarriersOfList(def.infos ?? []);
  if (isLinkDefinition(def) && def.resolved) {
    yield* infoCarriersOfList(def.resolved.infos ?? []);
  }
}

/** True, wenn die Definition eine MIN-Grenze mit genau diesem Bezugsrahmen traegt. */
function hasMinLimitInFrame(def, scope) {
  return limitsOf(def).some(limit => limit.kind === ConstraintKind.MIN && limit.scope === scope);
}

/**
 * Summe der Instanzanzahlen realer Knoten im Teilbaum, die ein **Vorkommen** der
 * gesuchten Definition sind — also unter `defId` zaehlen (`identity.js`). Ein
 * ueber einen Verweis gesetztes Vorkommen zaehlt damit auch fuer eine Grenze, die
 * das Ziel benennt; jeder Knoten zaehlt hoechstens einmal, gleich wie viele seiner
 * Ids zutreffen.
 */
function countInstances(fromNode, defId) {
  let total = 0;
  for (const node of nodeAndDescendants(fromNode)) {
    if (!node.isPhantom && !node.isRoot && isOccurrenceOf(node.def, defId)) {
      total += node.instance?.count ?? 0;
    }
  }
  return total;
}

/**
 * Synthetisiert Phantomknoten fuer Pflichtdefinitionen (`min > 0`), die im
 * jeweiligen Bezugsrahmen fehlen (§3.2/§4.3):
 *
 * - **armeeweit** (MIN-Grenze mit ROSTER-Rahmen): je ein Anker an der Wurzel,
 *   wenn die Definition im gesamten Roster keine Instanz hat;
 * - **je Kontingent** (MIN-Grenze mit FORCE-Rahmen): je ein Anker im betroffenen
 *   Kontingent, wenn die Definition dort keine Instanz hat.
 *
 * Ein *vorhandener* Eintrag bekommt keinen Phantomknoten — seine Grenze wird schon
 * am realen Knoten ausgewertet; nur die **Absenz** braucht einen eigenen Anker.
 *
 * Eine Kategorie, die das Kontingent per `categoryLink` fuehrt, ist hier
 * ausgenommen: sie bekommt ihren Anker ueber
 * {@link synthesizeForceCategoryAnchors}. Beides zugleich gaebe zwei Anker fuer
 * dieselbe Kategorie und damit eine doppelt gemeldete Verletzung.
 */
function synthesizeMandatoryPhantoms(root, definitions, nextFrameId) {
  for (const def of definitions) {
    if (hasMinLimitInFrame(def, ScopeKeyword.ROSTER) && countInstances(root, def.id) === 0) {
      attachPhantom(root, def, nextFrameId, AnchorKind.MANDATORY_PHANTOM);
    }
  }
  const forceNodeList = [...forceNodes(root)];
  for (const forceNode of forceNodeList) {
    const anchoredCategoryIds = linkedCategoryIdsOf(forceNode.def);
    for (const def of definitions) {
      if (def.kind === DefinitionKind.CATEGORY && anchoredCategoryIds.has(def.id)) continue;
      if (hasMinLimitInFrame(def, ScopeKeyword.FORCE) && countInstances(forceNode, def.id) === 0) {
        attachPhantom(forceNode, def, nextFrameId, AnchorKind.MANDATORY_PHANTOM);
      }
    }
  }
}

/** Die Kategorie-IDs, die eine Kontingent-Definition per `categoryLink` fuehrt. */
export function linkedCategoryIdsOf(forceDef) {
  const ids = new Set();
  for (const childDef of forceDef.children ?? []) {
    if (childDef.kind === DefinitionKind.CATEGORY_LINK) ids.add(childDef.targetId);
  }
  return ids;
}

/**
 * Haengt je Kontingent einen **Kategorie-Anker** an: fuer jeden `categoryLink`
 * seiner Kontingent-Definition einen Phantomknoten (§4.3).
 *
 * Anders als ein Pflicht-Phantom haengt er **immer**, nicht nur bei Absenz — eine
 * Kategorie ist kein Auswahlpunkt, sondern ein Zaehlrahmen: ihre Grenzen ("hoechstens
 * 3 Special-Auswahlen", "mindestens 2 Core") rechnen gegen die Zahl der Auswahlen
 * *in* der Kategorie. Ohne diesen Anker haette eine MAX-Grenze an einer Kategorie
 * keinen Auswertungsknoten und bliebe still unausgewertet, waehrend eine MIN-Grenze
 * ueber {@link synthesizeMandatoryPhantoms} zufaellig einen bekaeme.
 *
 * Der Anker traegt den **Link**, nicht die Kategorie: so gelten die am Link
 * deklarierten Grenzen (kontingent-spezifisch, z. B. "max 2 Goblin-Charaktere in
 * dieser Armeeliste") zusammen mit den vom Ziel geerbten ({@link limitsOf}). Die
 * Constraint-Schicht zaehlt fuer ihn ueber die Kategorie-ID (`targetId`).
 */
function synthesizeForceCategoryAnchors(root, nextFrameId) {
  for (const forceNode of [...forceNodes(root)]) {
    for (const childDef of forceNode.def.children ?? []) {
      if (childDef.kind === DefinitionKind.CATEGORY_LINK) {
        attachPhantom(forceNode, childDef, nextFrameId, AnchorKind.CATEGORY_ANCHOR);
      }
    }
  }
}

/**
 * Die tragende Definition eines Knotens: bei einem `entryLink`-Knoten die
 * aufgeloeste Zieldefinition (die die Gruppen traegt), sonst die eigene.
 */
export function ownerDefinitionOf(node) {
  if (node.def.kind === DefinitionKind.ENTRY_LINK && node.def.resolved) {
    return node.def.resolved;
  }
  return node.def;
}

/**
 * Alle `selectionEntry`- und `entryLink`-Kinder einer Definition, rekursiv
 * durch Gruppen (da Gruppen fuer Selektions-Zugehoerigkeit transparent sind).
 */
function* selectionDefinitionsUnder(ownerDef) {
  for (const child of ownerDef.children ?? []) {
    if (child.kind === DefinitionKind.ENTRY_LINK || child.kind === DefinitionKind.ENTRY || child.kind === DefinitionKind.CATEGORY_LINK) {
      yield child;
    } else if (child.kind === DefinitionKind.GROUP) {
      yield* selectionDefinitionsUnder(child);
    }
  }
}

/**
 * Synthetisiert Phantomknoten fuer Pflicht-Selektionen (`min > 0` mit `scope="parent"`),
 * die der Nutzer beim jeweiligen Eigentuemer komplett weggelassen hat.
 * Jeder instanziierte Knoten prueft seine Definition auf solche Pflicht-Kinder.
 *
 * Ein `categoryLink` **unter einem Kontingent** ist ausgenommen: dort haengt
 * schon der Kategorie-Anker ({@link synthesizeForceCategoryAnchors}), und zwei
 * Anker fuer dieselbe Kategorie meldeten dieselbe Verletzung doppelt. Unter einer
 * Auswahl (Kategorie-Zuordnung eines Eintrags) bleibt dieser Pfad zustaendig.
 */
function synthesizeParentScopePhantoms(root, nextFrameId) {
  for (const owner of [...realNodes(root)]) {
    const ownerDef = ownerDefinitionOf(owner);
    for (const childDef of selectionDefinitionsUnder(ownerDef)) {
      if (owner.isForce && childDef.kind === DefinitionKind.CATEGORY_LINK) continue;
      if (hasMinLimitInFrame(childDef, ScopeKeyword.PARENT) && countInstances(owner, childDef.id) === 0) {
        const alreadyHasPhantom = owner.children.some(c => c.isPhantom && c.def.id === childDef.id);
        if (!alreadyHasPhantom) {
          attachPhantom(owner, childDef, nextFrameId, AnchorKind.MANDATORY_PHANTOM);
        }
      }
    }
  }
}

/**
 * Die Grenzen-tragenden `selectionEntryGroup`s im Definitionsteilbaum eines
 * Eigentuemers — ueber verschachtelte Gruppen hinweg, aber **nicht** ueber
 * Eintraege hinaus: die Gruppen eines geschachtelten Eintrags gehoeren diesem
 * Eintrag als Eigentuemer, nicht dem aeusseren. Eine gruppen-skopierte Grenze
 * (`scope=parent`) rechnet immer gegen die naechste reale Auswahl.
 */
function* groupDefinitionsWithLimits(ownerDef) {
  for (const child of ownerDef.children ?? []) {
    if (child.kind !== DefinitionKind.GROUP) continue;
    if (limitsOf(child).length > 0) yield child;
    yield* groupDefinitionsWithLimits(child);
  }
}

/**
 * Haengt einen **Gruppen-Anker** unter die Eigentuemer-Auswahl: den
 * Auswertungsanker fuer die Grenzen einer `selectionEntryGroup` (`scope=parent`).
 * Er ist — wie ein Phantomknoten — synthetisch und zaehlt nie mit (die
 * Index-Schicht laesst ihn aus), traegt aber die Gruppendefinition, sodass die
 * Constraint-Schicht ihre min/max gegen den Eigentuemer-Rahmen auswertet. Er ist
 * **immer** praesent (nicht nur bei Absenz), damit sowohl `min` (leere
 * Pflichtgruppe) als auch `max` (zu viele Member) anschlagen koennen. Als Phantom
 * (`isPhantom`) bleibt er aus der Zaehlung ausgeschlossen (§4.4).
 */
function attachGroupAnchor(owner, groupDef, nextFrameId) {
  const node = {
    def: groupDef,
    instance: null,
    parent: owner,
    children: [],
    isPhantom: true,
    isRoot: false,
    isForce: false,
    anchorKind: AnchorKind.GROUP_ANCHOR,
    frameId: nextFrameId(),
    forceRoot: owner.forceRoot,
  };
  owner.children.push(node);
}

/**
 * Annotiert die Member-Knoten einer Gruppe im Teilbaum des Eigentuemers mit der
 * Gruppen-ID (`memberGroupIds`). Die Index-Schicht traegt einen so markierten
 * Knoten zusaetzlich unter der Gruppen-ID bei, sodass die gruppen-skopierte
 * Grenze ueber dasselbe Query-Primitiv die Member zaehlt. Synthetische Knoten
 * (Phantome, Anker) sind keine Member.
 *
 * Member ist ein Knoten, wenn **eine** Id seiner {@link identityIdsOf
 * Zaehl-Identitaet} in der Mitgliederliste steht — ein per Verweis gesetztes
 * Vorkommen also auch dann, wenn die Liste nur sein Ziel nennt. Die Markierung
 * ist eine Mengenzugehoerigkeit: mehrere zutreffende Ids markieren denselben
 * Knoten einmal.
 */
function annotateGroupMembers(owner, groupId, memberIds) {
  for (const node of nodeAndDescendants(owner)) {
    if (node === owner || node.isPhantom || node.isRoot || node.instance === null) continue;
    if (identityIdsOf(node.def).some(id => memberIds.has(id))) {
      (node.memberGroupIds ??= new Set()).add(groupId);
    }
  }
}

/**
 * Synthetisiert je reale Eigentuemer-Auswahl fuer jede Grenzen-tragende
 * `selectionEntryGroup` ihrer Definition einen Gruppen-Anker und annotiert deren
 * Member. Gruppen-Zugehoerigkeit stammt aus dem Definitionsbaum
 * (`resolved.groupMemberIds`), nicht aus der Instanz.
 */
function synthesizeGroupAnchors(root, resolved, nextFrameId) {
  const memberIndex = resolved.groupMemberIds ?? new Map();
  for (const owner of [...realNodes(root)]) {
    if (owner.isForce) continue;
    const ownerDef = ownerDefinitionOf(owner);

    if (ownerDef.kind === DefinitionKind.GROUP) {
      const memberIds = memberIndex.get(ownerDef.id);
      if (memberIds !== undefined) annotateGroupMembers(owner, ownerDef.id, memberIds);
    }

    for (const groupDef of groupDefinitionsWithLimits(ownerDef)) {
      attachGroupAnchor(owner, groupDef, nextFrameId);
      const memberIds = memberIndex.get(groupDef.id);
      if (memberIds !== undefined) annotateGroupMembers(owner, groupDef.id, memberIds);
    }
  }
}

/**
 * Baut **Baumphase 1** aus aufgeloesten Definitionen und Roster-Instanzen: die
 * realen Knoten und alle Anker, die schon vor der Konvergenz feststehen. Die
 * Wurzel ist ein synthetischer Ankerknoten ohne eigene Definition; sie traegt den
 * ROSTER-Rahmen und liegt ueber keinem Kontingent. Nachdem alle realen Knoten
 * haengen, werden Phantomknoten fuer fehlende Pflichtdefinitionen synthetisiert
 * (siehe {@link synthesizeMandatoryPhantoms}), Kategorie-Anker je Kontingent
 * (siehe {@link synthesizeForceCategoryAnchors}) und Gruppen-Anker fuer
 * gruppen-skopierte Grenzen (siehe {@link synthesizeGroupAnchors}).
 *
 * Die Wurzel traegt zusaetzlich die **Quelle der Rahmen-Identitaeten**
 * (`nextFrameId`) des Baums. Baumphase 2 ({@link attachOfferAnchor}) zieht aus
 * derselben Quelle weiter, sodass ein spaeter angehaengter Anker nie die
 * Rahmen-Identitaet eines vorhandenen Knotens wiederverwendet — sonst laese eine
 * `self`-skopierte Grenze am Anker den Bestand eines fremden Knotens.
 *
 * @param {{ lookup: (id: string) => object|null, definitions?: object[], groupMemberIds?: Map<string, Set<string>> }} resolved
 * @param {{ forces?: object[] }} roster
 * @returns {{ root: object, diagnostics: object[] }}
 */
export function buildEvalTree(resolved, roster) {
  const diagnostics = [];
  const nextFrameId = createFrameIdSource();
  const root = {
    def: null,
    instance: null,
    parent: null,
    children: [],
    isPhantom: false,
    isRoot: true,
    isForce: false,
    anchorKind: AnchorKind.OCCUPIED,
    frameId: nextFrameId(),
    nextFrameId,
    forceRoot: null,
  };
  for (const forceInstance of roster.forces ?? []) {
    attachInstance(root, forceInstance, resolved, diagnostics, nextFrameId);
  }
  synthesizeMandatoryPhantoms(root, resolved.definitions ?? [], nextFrameId);
  synthesizeParentScopePhantoms(root, nextFrameId);
  synthesizeForceCategoryAnchors(root, nextFrameId);
  // Nach den realen Knoten und den Pflicht-Phantomen: die Gruppen-Anker zuletzt,
  // damit die stabilen Pfade der realen Geschwister unveraendert bleiben.
  synthesizeGroupAnchors(root, resolved, nextFrameId);
  return { root, diagnostics };
}

/** Rekursiver Generator ueber einen Knoten und alle seine Nachfahren. */
function* nodeAndDescendants(node) {
  yield node;
  for (const child of node.children) {
    yield* nodeAndDescendants(child);
  }
}

/**
 * Alle Knoten des Baums (die synthetische Wurzel ausgenommen), **Phantome
 * eingeschlossen**. Die Modifikator- und die Constraint-Schicht iterieren hierueber:
 * auch die Grenzen eines Phantomknotens sind auszuwerten und modifizierbar
 * (§4.6/§4.7).
 */
export function* allNodes(root) {
  for (const child of root.children) {
    yield* nodeAndDescendants(child);
  }
}

/**
 * Reale Knoten des Baums (die synthetische Wurzel **und** alle Phantomknoten
 * ausgenommen). Kontingent-Knoten sind reale Knoten: sie leiten Beitraege ihrer
 * Nachfahren weiter, tragen aber selbst keine Selektion bei (siehe Index-Schicht).
 * Phantomknoten zaehlen nie mit (§4.4) und bleiben deshalb hier aussen vor.
 *
 * Das ist zugleich die Knotenmenge, ueber die die **Fixpunktschleife iteriert**:
 * weil nur reale Knoten in den Zaehlindex eingehen, kann nur ihre Veraenderung
 * eine weitere Runde noetig machen.
 */
export function* realNodes(root) {
  for (const node of allNodes(root)) {
    if (!node.isPhantom) yield node;
  }
}

/**
 * Die **synthetischen** Knoten des Baums: Pflicht-Phantome, Kategorie-Anker und
 * Gruppen-Anker — die Gegenmenge zu {@link realNodes}.
 *
 * Sie tragen keine Instanz, gehen in keine Zaehlung ein und koennen den
 * ausgewerteten Stand deshalb nicht veraendern. Ihre effektiven Werte sind eine
 * reine Funktion des konvergierten Stands und werden in **einem** Durchlauf nach
 * der Fixpunktschleife bestimmt (`fixpoint.js`, `applyAnchorPostPass`) statt in
 * jeder Runde neu.
 */
export function* syntheticNodes(root) {
  for (const node of allNodes(root)) {
    if (node.isPhantom) yield node;
  }
}

/**
 * Die **Slots** des Baums (§4.8): jede Stelle, an der eine Auswahl stehen kann —
 * ob dort etwas steht oder nicht (ADR-0035). Das sind alle Knoten jeder
 * {@link AnchorKind Ankerart}: die belegten, die Pflicht-Phantome, die
 * Gruppen-Anker, die Kategorie-Anker und die Angebots-Anker.
 *
 * Bis Issue 75/05 fielen Anker ohne MIN-Grenze hier heraus — eine
 * budget-gesteuert ausgeblendete Kategorie war im Bericht damit unsichtbar. Nun
 * gilt: **Gesperrtes und Verstecktes wird materialisiert und markiert, nicht
 * weggelassen.** Ein fehlender Eintrag waere von einem vergessenen nicht zu
 * unterscheiden, und „gesperrt" muss eine abgelesene Eigenschaft sein statt der
 * Abwesenheit eines Eintrags.
 */
export function* selectableSlotsOf(root) {
  yield* allNodes(root);
}

/**
 * Der stabile Pfad eines Knotens als String-Schluessel: die Folge der
 * Kind-Indizes von der Wurzel bis zum Knoten (z. B. `"0/2/1"`). Zwei Instanzen
 * derselben Definition erhalten verschiedene Pfade, weil sie an verschiedenen
 * Positionen haengen — der Pfad ist die stabile Identitaet eines Auswahlpunkts
 * im Bericht, ueber die die UI-Projektions-Lookups nachschlagen.
 */
export function pathOf(node) {
  const segments = [];
  for (let current = node; current.parent !== null; current = current.parent) {
    segments.unshift(current.parent.children.indexOf(current));
  }
  return segments.join(PATH_SEPARATOR);
}

/** Die realen Kontingent-Knoten des Baums (Anker fuer je-Kontingent-Phantome). */
function* forceNodes(root) {
  for (const node of realNodes(root)) {
    if (node.isForce) yield node;
  }
}
