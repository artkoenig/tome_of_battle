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
 * kann (§4.7). Die Traversierung trennt deshalb reale ({@link realNodes}) von
 * allen Knoten ({@link allNodes}, Phantome eingeschlossen).
 */

import { DefinitionKind, DiagnosticKind, ConstraintKind, ScopeKeyword, diagnostic, isLinkDefinition } from './model.js';

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

/** Haengt einen Instanzknoten samt Kindern (Auswahlen wie geschachtelte Kontingente) an. */
function attachInstance(parent, instance, resolved, diagnostics, nextFrameId) {
  const def = resolved.lookup(instance.defId);
  if (def === null) {
    diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_DEFINITION, { defId: instance.defId }));
    return;
  }
  const isForce = def.kind === DefinitionKind.FORCE;
  const node = {
    def,
    instance,
    parent,
    children: [],
    isPhantom: false,
    isRoot: false,
    isForce,
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
 */
function attachPhantom(parent, def, nextFrameId) {
  const isForce = def.kind === DefinitionKind.FORCE;
  const node = {
    def,
    instance: null,
    parent,
    children: [],
    isPhantom: true,
    isRoot: false,
    isForce,
    frameId: nextFrameId(),
    forceRoot: null,
  };
  node.forceRoot = isForce ? node : parent.forceRoot;
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

/** True, wenn die Definition eine MIN-Grenze mit genau diesem Bezugsrahmen traegt. */
function hasMinLimitInFrame(def, scope) {
  return limitsOf(def).some(limit => limit.kind === ConstraintKind.MIN && limit.scope === scope);
}

/** Summe der Instanzanzahlen realer Knoten mit dieser Definitions-ID im Teilbaum. */
function countInstances(fromNode, defId) {
  let total = 0;
  for (const node of nodeAndDescendants(fromNode)) {
    if (!node.isPhantom && !node.isRoot && node.def?.id === defId) {
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
      attachPhantom(root, def, nextFrameId);
    }
  }
  const forceNodeList = [...forceNodes(root)];
  for (const forceNode of forceNodeList) {
    const anchoredCategoryIds = linkedCategoryIdsOf(forceNode.def);
    for (const def of definitions) {
      if (def.kind === DefinitionKind.CATEGORY && anchoredCategoryIds.has(def.id)) continue;
      if (hasMinLimitInFrame(def, ScopeKeyword.FORCE) && countInstances(forceNode, def.id) === 0) {
        attachPhantom(forceNode, def, nextFrameId);
      }
    }
  }
}

/** Die Kategorie-IDs, die eine Kontingent-Definition per `categoryLink` fuehrt. */
function linkedCategoryIdsOf(forceDef) {
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
        attachPhantom(forceNode, childDef, nextFrameId);
      }
    }
  }
}

/**
 * Die tragende Definition eines Knotens: bei einem `entryLink`-Knoten die
 * aufgeloeste Zieldefinition (die die Gruppen traegt), sonst die eigene.
 */
function ownerDefinitionOf(node) {
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
          attachPhantom(owner, childDef, nextFrameId);
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
 */
function annotateGroupMembers(owner, groupId, memberIds) {
  for (const node of nodeAndDescendants(owner)) {
    if (node === owner || node.isPhantom || node.isRoot || node.instance === null) continue;
    if (memberIds.has(node.instance.defId)) {
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
 * Baut den Evaluationsbaum aus aufgeloesten Definitionen und Roster-Instanzen.
 * Die Wurzel ist ein synthetischer Ankerknoten ohne eigene Definition; sie
 * traegt den ROSTER-Rahmen und liegt ueber keinem Kontingent. Nachdem alle realen
 * Knoten haengen, werden Phantomknoten fuer fehlende Pflichtdefinitionen
 * synthetisiert (siehe {@link synthesizeMandatoryPhantoms}), Kategorie-Anker je
 * Kontingent (siehe {@link synthesizeForceCategoryAnchors}) und Gruppen-Anker fuer
 * gruppen-skopierte Grenzen (siehe {@link synthesizeGroupAnchors}).
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
    frameId: nextFrameId(),
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
 */
export function* realNodes(root) {
  for (const node of allNodes(root)) {
    if (!node.isPhantom) yield node;
  }
}

/** True, wenn die Definition irgendeine MIN-Grenze traegt. */
function hasAnyMinLimit(def) {
  return limitsOf(def).some(limit => limit.kind === ConstraintKind.MIN);
}

/**
 * Die **auswaehlbaren Slots** des Baums (§4.8): alle realen Knoten plus die
 * Phantom-Pflichtslots — Phantomknoten, die eine MIN-Grenze verankern. Ein
 * Phantom ohne MIN-Grenze waere kein Auswahlpunkt und bleibt aussen vor. Der
 * Bericht baut je Slot einen Faehigkeitsdatensatz.
 */
export function* selectableSlotsOf(root) {
  for (const node of allNodes(root)) {
    if (!node.isPhantom || hasAnyMinLimit(node.def)) yield node;
  }
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
