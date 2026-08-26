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

import { AnchorKind, CountedFieldKind, DefinitionKind, InfoElementKind, DiagnosticKind, ConstraintKind, ScopeKeyword, diagnostic, isLinkDefinition } from './model.js';
import { isInCatalogueScope, isInRootImportScope, declaredCatalogueIdOf, forceCatalogueIdOf } from './catalogSet.js';

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
 * Haengt einen Instanzknoten samt Kindern (Auswahlen wie geschachtelte
 * Kontingente) an.
 *
 * Ein **Kontingent**-Knoten traegt dabei die vom Roster genannte Armeebuch-Id
 * (`declaredCatalogueId`, Issue 0140) — einmal hier gegen die dem Datensatz
 * bekannten Kataloge geprueft ({@link declaredCatalogueIdOf}) und danach von
 * jedem Aufrufer ueber {@link forceCatalogueIdOf} gelesen. Sie haengt am
 * **Knoten**, nicht an der Definition: zwei Kontingente derselben
 * `.gst`-Definition koennen zu zwei verschiedenen Armeebuechern gehoeren.
 */
function attachInstance(parent, instance, resolved, diagnostics, nextFrameId, knownCatalogueIds) {
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
    anchorKind: AnchorKind.OCCUPIED,
    frameId: nextFrameId(),
    // Das umschliessende Kontingent: der Knoten selbst, wenn er ein Kontingent
    // ist, sonst das seines Elternknotens. Steht ueber keinem Kontingent (z. B.
    // ein Wurzel-Eintrag ohne Force-Huelle), bleibt es null.
    forceRoot: null,
    // Nur ein Kontingent hat ein Armeebuch; an jedem anderen Knoten bliebe die
    // Angabe des Rosters ohne Bedeutung.
    declaredCatalogueId: isForce ? declaredCatalogueIdOf(instance, knownCatalogueIds) : undefined,
  };
  node.forceRoot = isForce ? node : parent.forceRoot;
  parent.children.push(node);
  for (const childInstance of instance.children ?? []) {
    attachInstance(node, childInstance, resolved, diagnostics, nextFrameId, knownCatalogueIds);
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
 *
 * `limitScopeFilter` schneidet den Anker optional auf einen Bezugsrahmen **oder
 * eine Liste davon** zu (siehe {@link evaluableLimitsOf}): die Constraint-Schicht
 * wertet an ihm dann nur die Grenzen mit einem dieser `scope`s aus. Gestellt wird er ausschliesslich
 * von {@link synthesizeUnlinkedCategoryAnchors}, wo **mehrere** Anker derselben
 * Definition (je Rahmen einer) haengen koennen — ohne Zuschnitt meldete jeder
 * Anker jede Grenze, also jede Grenze mehrfach. Alle anderen Anker bleiben
 * ungefiltert (`null`): sie sind je Definition und Rahmen einmalig, und ein
 * Pflicht-Phantom wertet MAX-Grenzen seines Rahmens bewusst huckepack mit aus.
 *
 * `ownLimitsOnly` schneidet den Anker auf die **am Verweis selbst** deklarierten
 * Grenzen zu (siehe {@link evaluableLimitsOf}, gleiche Mechanik wie am
 * Gruppen-Anker, {@link attachGroupAnchor}). Gestellt wird es vom Pflicht-Phantom
 * eines Wurzel-`entryLink` ({@link synthesizeMandatoryPhantoms}): §9.9 verlangt,
 * am Link nur dessen eigene Grenzen auszuwerten — die vom Ziel geerbten
 * ({@link limitsOf}) feuerten sonst als falsche Pflicht mit (ADR-0032).
 *
 * @param {string|string[]|null} [limitScopeFilter] Ein Bezugsrahmen, eine Liste
 *   davon, oder `null` fuer einen ungefilterten Anker.
 */
function attachPhantom(parent, def, nextFrameId, anchorKind, limitScopeFilter = null, ownLimitsOnly = false) {
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
    limitScopeFilter,
    ownLimitsOnly,
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
 * @param {object[]} [visibilityGates]  die **Sichtbarkeits-Klammern** des Angebots:
 *   die Gruppen bzw. Gruppen-Verweise, durch die `offer.js` zu `def` abgestiegen ist
 *   (aeusserste zuerst). Weil der Anker ein Blatt am Rahmen ist, traegt allein diese
 *   Kette die Sichtbarkeit der Klammer an den Member weiter: ihr Basis-`hidden` geht in
 *   das des Ankers ein (`effectiveState.js`), ihre `field="hidden"`-Modifikatoren laufen
 *   am Anker mit (`modifiers.js`).
 * @returns {object} der angehaengte Anker.
 */
export function attachOfferAnchor(root, parent, def, visibilityGates = []) {
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
    visibilityGates,
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
 * Die an einem **Knoten** auszuwertenden Grenzen: die Basis-Limits seiner
 * Definition ({@link limitsOf}) — bei einem rahmen-zugeschnittenen Anker
 * (`limitScopeFilter`, siehe {@link attachPhantom}) nur die Grenzen mit genau
 * dem Bezugsrahmen, fuer den der Anker synthetisiert wurde. Traegt eine
 * unverlinkte Kategorie Grenzen **verschiedener** Rahmen (roster UND force),
 * haengt je Rahmen ein eigener Anker; ohne den Zuschnitt wertete jeder Anker
 * jede Grenze aus — dieselbe Verletzung erschiene je Anker einmal, und der
 * rahmen-fremde Anker hinterliesse eine unechte `unresolvedScope`-Diagnose.
 *
 * Ein Anker mit `ownLimitsOnly` wertet nur die **am Link selbst** deklarierten
 * Grenzen aus, nicht die vom Ziel geerbten. Zwei Steller: der Gruppen-Anker des
 * zweiten Geschwister-Links auf ein schon verankertes Ziel, dessen geteilte
 * Grenzen bereits am ersten Anker haengen ({@link attachGroupAnchor}); und das
 * Pflicht-Phantom eines Wurzel-`entryLink` (§9.9, Issue 85), an dem allein die
 * Grenzen und Modifier des Links gelten — nicht die des Ziels
 * ({@link synthesizeMandatoryPhantoms}).
 *
 * Die Constraint-Schicht ruft diese Sicht; {@link limitsOf} bleibt die eine
 * Quelle der Wahrheit dafuer, welche Grenzen an der **Definition** haengen
 * (Effektiv-Werte-Schicht: auch eine hier weggefilterte Grenze behaelt ihren
 * effektiven Grenzwert — sie wird nur nicht an diesem Knoten ausgewertet).
 */
export function evaluableLimitsOf(node) {
  const limits = node.ownLimitsOnly === true ? (node.def.limits ?? []) : limitsOf(node.def);
  const filter = node.limitScopeFilter;
  if (filter === null || filter === undefined) return limits;
  // Der Zuschnitt darf **mehrere** Rahmen nennen: unter einem Kontingent loesen
  // `force` und `parent` beide auf, und beide gehoeren an denselben einen Anker
  // (sonst stuende die Kategorie doppelt im Bericht, siehe
  // {@link synthesizeUnlinkedCategoryAnchors}).
  const frames = Array.isArray(filter) ? filter : [filter];
  return limits.filter(limit => frames.includes(limit.scope));
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
 * Der Grenzbestand, der entscheidet, ob eine **Wurzel-Definition** ein
 * Pflicht-Phantom bekommt — und den ihr Phantom dann auswertet. Fuer einen
 * `entryLink` sind das allein seine **eigenen** Grenzen (`def.limits`), nicht
 * die per {@link limitsOf} vom Ziel geerbten: §9.9 verlangt, am Link nur dessen
 * Constraint und Modifier auszuwerten — die `min`-Grenze eines nur verlinkten
 * Ziels ist keine Wurzel-Pflicht (ADR-0032) und feuerte sonst als zweiter,
 * falscher Verstoss neben dem des Links. Das Phantom wird dazu mit
 * `ownLimitsOnly` zugeschnitten ({@link attachPhantom}, {@link evaluableLimitsOf}).
 */
function mandatoryLimitStockOf(def) {
  const ownLimitsOnly = def.kind === DefinitionKind.ENTRY_LINK;
  const limits = ownLimitsOnly ? (def.limits ?? []) : limitsOf(def);
  return { limits, ownLimitsOnly };
}

/** True, wenn der Grenzbestand eine MIN-Grenze mit genau diesem Bezugsrahmen enthaelt. */
function hasMinLimit(limits, scope) {
  return limits.some(limit => limit.kind === ConstraintKind.MIN && limit.scope === scope);
}

/** True, wenn die Definition irgendeine Grenze mit genau diesem Bezugsrahmen traegt. */
function hasAnyLimitInFrame(def, scope) {
  return limitsOf(def).some(limit => limit.scope === scope);
}

/**
 * True, wenn unter `parent` ein **ungefilterter** synthetischer Anker dieser
 * Definition haengt — einer ohne `limitScopeFilter`, der also *alle* Grenzen
 * seiner Definition auswertet (typisch: das Pflicht-Phantom, das MAX-Grenzen
 * huckepack mitnimmt).
 *
 * Die Unterscheidung traegt (Issue 0147): ein rahmen-**zugeschnittener**
 * Geschwister-Anker deckt nur seinen eigenen Rahmen ab. Wer ihn wie einen
 * ungefilterten behandelt, laesst die Grenzen des anderen Rahmens ungeprueft —
 * genau der Fall der Kategorie „Battle standard bearer", die eine force- **und**
 * eine parent-skopierte Grenze traegt.
 */
function hasUnfilteredPhantomFor(parent, defId) {
  return parent.children.some(child => child.isPhantom
    && child.def.id === defId
    && (child.limitScopeFilter === null || child.limitScopeFilter === undefined));
}

/**
 * True, wenn **irgendwo** im Baum ein **ungefilterter** synthetischer Anker
 * dieser Definition haengt (ohne `limitScopeFilter`, siehe
 * {@link attachPhantom}). Nur ein ungefilterter Anker wertet alle Grenzen der
 * Definition huckepack mit aus — und eine armeeweite Grenze loest er von jedem
 * Standort aus auf, auch unter einem Kontingent. Ein rahmen-zugeschnittener
 * Anker wertet dagegen nur die Grenzen seines eigenen Rahmens.
 */
function hasUnfilteredPhantomAnywhereFor(root, defId) {
  for (const node of nodeAndDescendants(root)) {
    if (node.isPhantom && node.def?.id === defId
        && (node.limitScopeFilter === null || node.limitScopeFilter === undefined)) {
      return true;
    }
  }
  return false;
}

/** Summe der Instanzanzahlen realer Knoten mit dieser Definitions-ID im Teilbaum. */
function countInstances(fromNode, defId) {
  let total = 0;
  for (const node of nodeAndDescendants(fromNode)) {
    if (node.isPhantom || node.isRoot) continue;
    // Ein Verweis-Knoten zaehlt fuer sein **Ziel** mit (Issue 0154): eine
    // Auswahl, die ueber einen `entryLink` hereinkam, traegt die Id des
    // Verweises, ist aber ein Vorkommen der Zieldefinition — genau das, was
    // die Grenze der Zieldefinition ohnehin zaehlt (`constraints.js`,
    // `countedTargetId`). Ohne diese Zeile haengt der Absenz-Anker einer
    // geteilten Pflichtdefinition auch dann, wenn sie laengst in der Liste
    // steht: ein Phantom neben einer erfuellten Pflicht.
    if (node.def?.id === defId || (isLinkDefinition(node.def) && node.def.targetId === defId)) {
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
 * Ein Wurzel-**`entryLink`** ist die zweite §9.9-Kodierung derselben Pflicht
 * (Issue 85): ob sein Phantom haengt, entscheidet allein sein **eigener**
 * Grenzbestand ({@link mandatoryLimitStockOf}), und das Phantom wertet auch nur
 * diesen aus (`ownLimitsOnly`). Die Absenz wird ueber `def.id` — die Link-Id —
 * geprueft: Roster-Auswahlen ueber den Link tragen genau diese Id. Ist das
 * **Ziel** auf anderem Weg vorhanden, ist das Phantom harmlos, denn seine Grenze
 * zaehlt ueber die Ziel-Id (`targetId`, `constraints.js`) und ist dann erfuellt.
 *
 * In der **Kontingent-Schleife** ist eine Kategorie, die das Kontingent per
 * `categoryLink` fuehrt, ausgenommen: sie bekommt ihren Anker dort ueber
 * {@link synthesizeForceCategoryAnchors} — beides zugleich gaebe zwei Anker fuer
 * dieselbe Kategorie im selben Kontingent. Die **Roster-Schleife** kennt keine
 * solche Ausnahme: eine verlinkte Kategorie mit armeeweiter MIN-Grenze bekommt
 * ihr Wurzel-Phantom **zusaetzlich** zu den Kategorie-Ankern der verlinkenden
 * Kontingente (die dieselben Grenzen per `limitsOf` erben). Alle diese Anker
 * werten die Grenze aus — die Faehigkeitsdatensaetze bleiben so vollstaendig;
 * dass die Meldungsliste dieselbe armeeweite Pflicht trotzdem nur einmal
 * traegt, entscheidet die Berichtsschicht (`report.js`, Entdopplung ueber
 * Grenz- und Ziel-Id, Issue 0093).
 *
 * **Katalog-Bezugsrahmen** (`catalogueScope`, Issue 0098): eine eigenstaendige
 * Wurzel-Definition (`ENTRY`/`FORCE`/`ENTRY_LINK`) synthetisiert ihr
 * Pflicht-Phantom nur, wenn ihre Herkunft zum Katalog-Fussabdruck der
 * Referenz-Kataloge gehoert — und zwar, weil sie hier als **Wurzel**-Eintrag
 * ihres Katalogs ins Spiel kommt, in der engeren Lesart
 * ({@link isInRootImportScope}): ein ohne `importRootEntries="true"`
 * verlinkter Katalog liegt im Auswertungsumfang, seine Wurzel-Eintraege aber
 * erzwingen im verlinkenden Buch nichts (Issue 0098, Kriterium 3). Geteilte
 * Eintraege gehen stattdessen ueber
 * {@link synthesizeOfferedSharedMandatoryPhantoms} und dort ueber die volle
 * Huelle ({@link isInCatalogueScope}) — fuer den
 * ROSTER-Rahmen die Kataloge **aller** im Roster tatsaechlich vertretenen
 * Kontingente, fuer den FORCE-Rahmen allein der Katalog **dieses**
 * Kontingents. Welches Armeebuch ein Kontingent hat, beantwortet dabei
 * {@link forceCatalogueIdOf} — der Herkunftsindex, und nur wo der schweigt die
 * Angabe des Rosters (Issue 0140), je Kontingent-**Knoten** und deshalb fuer
 * zwei Kontingente aus verschiedenen Buechern getrennt. Ein Wurzel-**`entryLink`** wird hier bewusst **nicht** wie
 * beim Angebot (`offer.js`) ausgenommen (Issue 0133): waehrend ein
 * unbedingtes Angebot ueber einen fremden Link legitim katalogübergreifend
 * bleibt (die geteilte Zieleinheit ist ueberall wählbar), haengt eine eigene
 * `min`-Constraint **am Link selbst** — sie gehoert zum deklarierenden
 * Katalog, nicht zum Ziel. Ein Katalog A, der seinen eigenen Wurzel-Link auf
 * eine geteilte Bibliotheksdefinition mit eigener Pflicht versieht (z. B.
 * "Ogre Bulls" in Ogre Kingdoms), darf diese Pflicht nicht in einem Roster
 * erzwingen, dessen Kontingente ausschliesslich aus einem anderen Katalog B
 * stammen — selbst wenn B einen eigenen, constraint-losen Link auf dasselbe
 * Ziel deklariert (dasselbe Angebots-Idiom, ohne die Pflicht).
 *
 * Eine **`CATEGORY`**-Definition braucht eine eigene, engere Ausnahme: sie
 * wird nie selbst instanziiert, sondern nur ueber einen `categoryLink` an
 * einem **Kontingent** referenziert (z. B. "Regiment of Renown" in
 * `Mercenaries.cat`, per `categoryLink` an "Clan Blood Dragons" in
 * `Vampire Counts.cat` gefuehrt, ganz ohne `importRootEntries`) — ein
 * echtes, im Roster **anwesendes** Kontingent erklaert sich damit
 * ausdruecklich zustaendig, unabhaengig vom Katalog der Kategorie. Nur *das*
 * ist die Ausnahme: sie greift ausschliesslich fuer eine Kategorie, die
 * mindestens ein im ROSTER-Rahmen tatsaechlich vorhandenes Kontingent per
 * eigenem `categoryLink` fuehrt (`rosterLinkedCategoryIds`, gesammelt aus
 * {@link linkedCategoryIdsOf} ueber alle Kontingente). Eine Kategorie ohne
 * jeden Bezug zu irgendeinem anwesenden Kontingent bleibt normal
 * katalog-gefiltert — sonst poolte jede beliebige, voellig fremde
 * Katalog-Kategorie wieder katalogunabhaengig (die Regression, die Runde 2
 * der Review nachwies). Im FORCE-Rahmen ist keine gesonderte Ausnahme
 * noetig: eine Kategorie, die **dieses** Kontingent per `categoryLink`
 * fuehrt, ist schon vorher per `continue` ausgeschlossen (ihr Anker haengt
 * stattdessen ueber {@link synthesizeForceCategoryAnchors}); jede andere
 * Kategorie, die dieses Kontingent nicht fuehrt, hat keinen Grund, von der
 * Katalog-Filterung ausgenommen zu sein.
 *
 * Ohne `catalogueScope` (kein Kontext mitgegeben) bleibt das Verhalten
 * ungefiltert — additiv, kein Wechsel fuer den Ein-Katalog-Fall.
 */
/**
 * Die Referenz-Kataloge der im Roster tatsaechlich vertretenen Kontingente
 * (Issue 0098) — der ROSTER-Bezugsrahmen fuer {@link isInCatalogueScope}.
 * Geteilt zwischen {@link synthesizeMandatoryPhantoms} und
 * {@link synthesizeUnlinkedCategoryAnchors}, damit beide dieselbe Definition
 * von "im Roster referenzierte Kataloge" verwenden.
 *
 * Je Kontingent gilt sein eigenes Armeebuch ({@link forceCatalogueIdOf}):
 * zuerst der Herkunftsindex, und nur wo der schweigt die Angabe des Rosters.
 * Ein Roster mit Kontingenten aus **verschiedenen** Buechern traegt deshalb
 * hier beide.
 */
function rosterCatalogueReferencesOf(forceNodeList, primaryCatalogueByForceDefId) {
  return forceNodeList
    .map(forceNode => forceCatalogueIdOf(forceNode, primaryCatalogueByForceDefId))
    .filter(catalogueId => catalogueId !== undefined);
}

/**
 * Die Kategorie-Ids, die irgendein reales (nicht-phantomes) Objekt **unter**
 * `node` per eigenem `categoryLink` fuehrt (Issue 0098, Review-Runde 3) —
 * nicht nur ein Kontingent selbst ({@link linkedCategoryIdsOf} allein deckte
 * nur `forceEntry`-eigene Links ab), sondern auch eine bereits belegte
 * Auswahl (`selectionEntry`), deren `categoryLink` katalogfremd sein kann
 * (genau wie ein `forceEntry`-Link). `node` selbst zaehlt nicht mit
 * ({@link allNodes} liefert nur Nachfahren) — ein Kontingent-eigener Link
 * wird an den jeweiligen Aufrufstellen separat behandelt
 * (`anchoredCategoryIds`/`rosterLinkedCategoryIds`-Aufruf mit `root`, der
 * auch die Kontingent-Knoten selbst mit einschliesst). Ausgewertet, **bevor**
 * irgendein Phantom haengt (aufgerufen am Anfang von
 * {@link synthesizeMandatoryPhantoms} bzw. vor
 * {@link synthesizeUnlinkedCategoryAnchors}), zaehlt {@link realNodes} hier
 * also ausschliesslich echte Roster-Instanzen — keine Anker.
 */
function referencedCategoryIdsUnder(node) {
  const ids = new Set();
  for (const descendant of realNodes(node)) {
    for (const categoryId of linkedCategoryIdsOf(descendant.def)) ids.add(categoryId);
    const owner = ownerDefinitionOf(descendant);
    if (owner !== descendant.def) {
      for (const categoryId of linkedCategoryIdsOf(owner)) ids.add(categoryId);
    }
  }
  return ids;
}

function synthesizeMandatoryPhantoms(root, definitions, nextFrameId, catalogueScope, primaryCatalogueByForceDefId) {
  const forceNodeList = [...forceNodes(root)];
  const rosterCatalogueReferences = rosterCatalogueReferencesOf(forceNodeList, primaryCatalogueByForceDefId);
  // `root` selbst schliesst {@link realNodes} nicht ein — ein Kontingent
  // zaehlt hier trotzdem mit, weil es selbst ein Nachfahre der (nicht
  // gezaehlten) synthetischen Wurzel ist.
  const rosterLinkedCategoryIds = referencedCategoryIdsUnder(root);

  for (const def of definitions) {
    const { limits, ownLimitsOnly } = mandatoryLimitStockOf(def);
    if (hasMinLimit(limits, ScopeKeyword.ROSTER) && countInstances(root, def.id) === 0
        && ((def.kind === DefinitionKind.CATEGORY && rosterLinkedCategoryIds.has(def.id))
          || isInRootImportScope(def.id, rosterCatalogueReferences, catalogueScope))) {
      attachPhantom(root, def, nextFrameId, AnchorKind.MANDATORY_PHANTOM, null, ownLimitsOnly);
    }
  }
  for (const forceNode of forceNodeList) {
    const anchoredCategoryIds = linkedCategoryIdsOf(forceNode.def);
    // Kategorien, die eine Auswahl **unter diesem Kontingent** per eigenem
    // `categoryLink` fuehrt (nicht das Kontingent selbst — das steht schon
    // in `anchoredCategoryIds`), zaehlen fuer dieses Kontingent ebenso als
    // referenziert (Review-Runde 3, derselbe Grund wie im ROSTER-Zweig).
    const forceLinkedCategoryIds = referencedCategoryIdsUnder(forceNode);
    const forceCatalogueId = forceCatalogueIdOf(forceNode, primaryCatalogueByForceDefId);
    const forceCatalogueReferences = forceCatalogueId === undefined ? [] : [forceCatalogueId];
    for (const def of definitions) {
      if (def.kind === DefinitionKind.CATEGORY && anchoredCategoryIds.has(def.id)) continue;
      const { limits, ownLimitsOnly } = mandatoryLimitStockOf(def);
      if (hasMinLimit(limits, ScopeKeyword.FORCE) && countInstances(forceNode, def.id) === 0
          && ((def.kind === DefinitionKind.CATEGORY && forceLinkedCategoryIds.has(def.id))
            || isInRootImportScope(def.id, forceCatalogueReferences, catalogueScope))) {
        attachPhantom(forceNode, def, nextFrameId, AnchorKind.MANDATORY_PHANTOM, null, ownLimitsOnly);
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
 * Haengt Kategorie-Anker fuer **unverlinkte** Kategorie-Definitionen an
 * (`docs/battlescribe-data-format.md` §5.5/§5.6): Grenzen koennen direkt an der
 * `categoryEntry` haengen und gelten auch dann, wenn **kein** Kontingent die
 * Kategorie per `categoryLink` fuehrt. Eine MIN-Grenze bekommt in diesem Fall
 * schon ueber {@link synthesizeMandatoryPhantoms} ihren Anker (eine Kategorie
 * hat nie eine Instanz, ihr Pflicht-Phantom haengt also immer); eine Kategorie
 * mit **ausschliesslich** MAX-Grenzen bliebe ohne diesen Schritt ankerlos und
 * ihre Grenze still unausgewertet (Issue 0092, die klassische 0–1-Kodierung).
 *
 * Es haengt hoechstens **ein** Anker je Kategorie **und Rahmen**, und jeder
 * Anker wertet nur die Grenzen **seines** Rahmens aus (`limitScopeFilter`,
 * {@link evaluableLimitsOf}), damit keine Grenze doppelt meldet:
 *
 * - eine Kategorie, die **irgendein** Kontingent per `categoryLink` fuehrt, ist
 *   ganz ausgenommen: dessen Anker ({@link synthesizeForceCategoryAnchors})
 *   wertet ihre Grenzen bereits aus — die armeeweiten direkt, die
 *   kontingent-skopierten ueber die Ziel-Typ-Regel (unten);
 * - haengt schon ein Pflicht-Phantom derselben Definition
 *   ({@link synthesizeMandatoryPhantoms}), wertet das — ungefiltert — auch
 *   ihre MAX-Grenzen huckepack mit aus; der Anker entfaellt fuer jeden Rahmen,
 *   den das Phantom von seinem Standort aus aufloest. Fuer den ROSTER-Rahmen
 *   zaehlt dabei **jedes** ungefilterte Phantom im Baum
 *   ({@link hasUnfilteredPhantomAnywhereFor}): eine armeeweite Grenze loest
 *   von jedem Standort aus auf, auch von einem Phantom unter einem Kontingent.
 *   Fuer den FORCE-Rahmen zaehlt nur ein Phantom **unter einem Kontingent** —
 *   an der Wurzel liefert eine kontingent-skopierte Grenze `unresolvedScope`,
 *   keine Auswertung, deshalb braeuchte sie dort weiterhin ihren Anker;
 * - traegt die Kategorie Grenzen **verschiedener** Rahmen (roster UND force),
 *   haengen zwei Anker — der Rahmen-Zuschnitt sorgt dafuer, dass keiner die
 *   Grenzen des anderen wiederholt und keiner an einer rahmen-fremden Grenze
 *   eine unechte `unresolvedScope`-Diagnose hinterlaesst.
 *
 * Eine `scope="force"`-Grenze mit Kategorie-Ziel zaehlt ueber die
 * **Ziel-Typ-Regel** (BSData §7.7, `query.js`) ohnehin armeeweit — welcher
 * Kontingent-Knoten den Anker traegt, aendert ihr Ergebnis nicht. Deshalb
 * genuegt **ein** Anker am ersten Kontingent (je einer pro Kontingent meldete
 * dieselbe armeeweite Verletzung mehrfach); ohne Kontingent gibt es keine
 * Mitglieder und nichts auszuwerten. Der ROSTER-Rahmen ankert an der Wurzel —
 * am Kontingent-Knoten liegt fuer ihn nichts Besseres, an der Wurzel loest auch
 * ein Roster ohne Kontingente ihn auf.
 *
 * **Katalog-Bezugsrahmen** (`catalogueScope`, Issue 0098, Runde 2/3): eine
 * Definition, die diese Funktion ueberhaupt anfasst, fuehrt kein anwesendes
 * Kontingent per **eigenem** `categoryLink` (`linkedAnywhere`, unveraendert
 * seit Runde 2 — dessen Anker deckt {@link synthesizeForceCategoryAnchors}
 * bereits ab). Sie kann aber sehr wohl von einer bereits belegten **Auswahl**
 * per `categoryLink` referenziert sein (Runde 3: derselbe Fund wie bei
 * {@link synthesizeMandatoryPhantoms}, hier fuer eine Kategorie mit
 * **ausschliesslich** MAX-Grenzen, die sonst nie einen Pflicht-Phantom
 * bekommt). Nur wenn WEDER ein Kontingent noch eine Auswahl sie referenziert,
 * greift die Katalog-Filterung ({@link isInCatalogueScope}); referenziert
 * irgendetwas Reales sie, haengt der Anker unbedingt — ohne `catalogueScope`
 * bleibt das Verhalten wie zuvor ungefiltert.
 */
function synthesizeUnlinkedCategoryAnchors(root, definitions, nextFrameId, catalogueScope, primaryCatalogueByForceDefId) {
  const forceNodeList = [...forceNodes(root)];
  const linkedAnywhere = new Set();
  for (const forceNode of forceNodeList) {
    for (const id of linkedCategoryIdsOf(forceNode.def)) linkedAnywhere.add(id);
  }
  const referencedAnywhere = referencedCategoryIdsUnder(root);
  const rosterCatalogueReferences = rosterCatalogueReferencesOf(forceNodeList, primaryCatalogueByForceDefId);
  for (const def of definitions) {
    if (def.kind !== DefinitionKind.CATEGORY) continue;
    if (linkedAnywhere.has(def.id)) continue;
    if (!referencedAnywhere.has(def.id) && !isInCatalogueScope(def.id, rosterCatalogueReferences, catalogueScope)) continue;
    if (hasAnyLimitInFrame(def, ScopeKeyword.ROSTER) && !hasUnfilteredPhantomAnywhereFor(root, def.id)) {
      attachPhantom(root, def, nextFrameId, AnchorKind.CATEGORY_ANCHOR, ScopeKeyword.ROSTER);
    }
    // Kontingent-Ebene: **ein** Anker je Kontingent, dessen Zuschnitt beide dort
    // aufloesenden Rahmen tragen kann.
    //
    // - `force`: die Ziel-Typ-Regel (§7.7, `query.js`) zaehlt ein Kategorie-Ziel
    //   ohnehin armeeweit — welcher Kontingent-Knoten den Anker traegt, aendert
    //   das Ergebnis nicht. **Ein** Anker am ersten Kontingent genuegt; je einer
    //   pro Kontingent meldete dieselbe armeeweite Verletzung mehrfach.
    // - `parent`: loest am Anker auf dessen Elternknoten auf, also auf genau
    //   dieses Kontingent, und die Ziel-Typ-Regel weitet ihn **nicht** auf. Zwei
    //   Kontingente zaehlen getrennt — der Anker haengt deshalb an **jedem**
    //   (Issue 0147). Real getragen vom Border-Patrols-Muster der `.gst`: die
    //   Kategorien „Chariot", „War Machine" und „Magical Standard" tragen
    //   ausschliesslich eine parent-skopierte MAX-Grenze mit Rohwert -1
    //   (unbegrenzt), die ein bedingter `set` auf 1 bzw. 0 zieht — und **kein**
    //   `forceEntry` fuehrt diese drei per `categoryLink`. Ohne diesen Anker
    //   blieben die drei Regeln still unausgewertet.
    //
    // Beide Rahmen an **einem** Knoten zu buendeln (statt je Rahmen einen) ist
    // kein Detail: zwei Anker derselben Kategorie unter demselben Kontingent
    // waeren zwei Slots im Bericht, und jede Oberflaeche, die Kategorie-Slots
    // eines Kontingents auflistet, zeigte die Kategorie doppelt.
    const forceLevelFrames = [];
    if (hasAnyLimitInFrame(def, ScopeKeyword.FORCE)) forceLevelFrames.push(ScopeKeyword.FORCE);
    if (hasAnyLimitInFrame(def, ScopeKeyword.PARENT)) forceLevelFrames.push(ScopeKeyword.PARENT);
    if (forceLevelFrames.length > 0) {
      for (const [index, forceNode] of forceNodeList.entries()) {
        if (hasUnfilteredPhantomFor(forceNode, def.id)) continue;
        // Der armeeweit zaehlende `force`-Rahmen nur am ersten Kontingent.
        const frames = index === 0 ? forceLevelFrames : forceLevelFrames.filter(frame => frame !== ScopeKeyword.FORCE);
        if (frames.length === 0) continue;
        attachPhantom(forceNode, def, nextFrameId, AnchorKind.CATEGORY_ANCHOR, frames);
      }
    }
  }
}

/**
 * Die tragende Definition eines Knotens: bei einem `entryLink`-Knoten die
 * aufgeloeste Zieldefinition (die die Gruppen traegt), sonst die eigene.
 *
 * Ein Verweis darf **selbst** Kinder deklarieren (`Catalogue.xsd`: `EntryLink`
 * erweitert `SelectionEntryBase` und fuehrt damit
 * `selectionEntries`/`selectionEntryGroups`/`entryLinks`;
 * `docs/battlescribe-data-format.md` §7.2). Diese am Verweis deklarierten
 * Kinder stehen an genau **dieser** Verwendungsstelle neben denen des Ziels —
 * sie gehoeren also ebenso zur tragenden Definition. Real z. B. der Empire-
 * Captain: die Gruppe „Mounts" verlinkt „Empire Warhorse", und die Option
 * „Barding" haengt am **Verweis**, nicht am geteilten Ziel-Eintrag. Ohne diese
 * Vereinigung faende keine der Traversierungen ueber `ownerDefinitionOf` die
 * Barding-Option: kein Angebots-Anker, kein Gruppen-Anker, kein
 * Pflicht-Phantom, keine Sichtbarkeits-Klammer.
 *
 * Reihenfolge wie in {@link optionDefinitionsUnder} beim Gruppen-Verweis:
 * erst die Kinder des Ziels, dann die am Verweis deklarierten. Deklariert der
 * Verweis keine, geht die Zieldefinition unveraendert (und ohne Kopie) durch.
 */
export function ownerDefinitionOf(node) {
  if (node.def.kind === DefinitionKind.ENTRY_LINK && node.def.resolved) {
    const linkLocalChildren = node.def.children ?? [];
    if (linkLocalChildren.length === 0) return node.def.resolved;
    return {
      ...node.def.resolved,
      children: [...(node.def.resolved.children ?? []), ...linkLocalChildren],
    };
  }
  return node.def;
}

/**
 * Die per `entryLink type="selectionEntryGroup"` verlinkte Gruppendefinition
 * eines Kindes — oder `null`, wenn das Kind kein solcher Verweis ist. Ein Link
 * auf eine Gruppe **ist** die Gruppe an dieser Stelle (Issue 083): die
 * Traversierungen unten behandeln ihn wie eine direkt geschachtelte Gruppe,
 * statt ihn als Auswahlpunkt zu deuten oder ganz zu ueberspringen.
 */
function linkedGroupTargetOf(def) {
  if (def.kind !== DefinitionKind.ENTRY_LINK) return null;
  if (def.resolved?.kind !== DefinitionKind.GROUP) return null;
  return def.resolved;
}

/**
 * Alle `selectionEntry`- und `entryLink`-Kinder einer Definition, rekursiv
 * durch Gruppen (da Gruppen fuer Selektions-Zugehoerigkeit transparent sind).
 * Ein `entryLink` auf eine **Gruppe** ist genauso transparent wie die Gruppe
 * selbst (Issue 083): er ist kein Auswahlpunkt — seine Grenzen wertet der
 * Gruppen-Anker aus ({@link synthesizeGroupAnchors}), seine Member sind die
 * eigentlichen Auswahlpunkte. Der `visited`-Satz haelt eine zyklische
 * Verweiskette endlich (wie `collectGroupMemberIds` im Resolver).
 */
function* selectionDefinitionsUnder(ownerDef, visited = new Set(), gates = []) {
  for (const child of ownerDef.children ?? []) {
    const linkedGroup = linkedGroupTargetOf(child);
    if (linkedGroup !== null) {
      if (visited.has(linkedGroup.id)) continue;
      visited.add(linkedGroup.id);
      yield* selectionDefinitionsUnder(linkedGroup, visited, [...gates, child]);
    } else if (child.kind === DefinitionKind.ENTRY_LINK || child.kind === DefinitionKind.ENTRY || child.kind === DefinitionKind.CATEGORY_LINK) {
      yield { def: child, gates };
    } else if (child.kind === DefinitionKind.GROUP) {
      yield* selectionDefinitionsUnder(child, visited, [...gates, child]);
    }
  }
}

/**
 * Die **Sichtbarkeits-Klammern** je Definitions-Id unter einem Eigentuemer: die
 * durchschrittenen `selectionEntryGroup`s bzw. Gruppen-Verweise, aeusserste
 * zuerst ({@link selectionDefinitionsUnder}).
 *
 * Eine versteckte Gruppe versteckt, **was sie haelt**
 * (`docs/battlescribe-data-format.md` §8) — und das gilt fuer jeden Knoten, der
 * an ihrer Stelle steht, nicht nur fuer das Angebot: fuer die belegte Auswahl
 * ebenso wie fuer das Pflicht-Phantom einer nicht gewaehlten Option. Ohne diese
 * Kette meldete die Engine die Min-Grenze eines Members einer dauerhaft
 * versteckten Gruppe als offene Pflicht, die der Nutzer nicht erfuellen kann:
 * real z. B. „Lore of Necromancy" (`min 1`) in der Gruppe „Lores of Magic"
 * (`hidden="true"`) des Master Necromancer (Vampire Counts).
 */
function visibilityGatesUnder(ownerDef) {
  const gatesByDefId = new Map();
  for (const { def, gates } of selectionDefinitionsUnder(ownerDef)) {
    if (gates.length > 0 && !gatesByDefId.has(def.id)) gatesByDefId.set(def.id, gates);
  }
  return gatesByDefId;
}

/**
 * Traegt die Sichtbarkeits-Klammern der Definitionsgruppen an die **belegten**
 * Kind-Knoten jedes realen Rahmens nach ({@link visibilityGatesUnder}). Der
 * Instanzbaum kennt die Gruppen nicht — die `.ros` verwirft ihr `entryGroupId`
 * (§3.2) —, also muss die Zugehoerigkeit hier aus dem Definitionsbaum kommen,
 * wie schon die Gruppen-Mitgliedschaft der Zaehl-Schicht.
 */
function annotateOccupiedVisibilityGates(root) {
  for (const owner of realNodes(root)) {
    const gatesByDefId = visibilityGatesUnder(ownerDefinitionOf(owner));
    if (gatesByDefId.size === 0) continue;
    for (const child of owner.children) {
      if (child.isPhantom) continue;
      const gates = gatesByDefId.get(child.def.id);
      if (gates !== undefined) child.visibilityGates = gates;
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
    for (const { def: childDef, gates } of selectionDefinitionsUnder(ownerDef)) {
      if (owner.isForce && childDef.kind === DefinitionKind.CATEGORY_LINK) continue;
      if (hasMinLimitInFrame(childDef, ScopeKeyword.PARENT) && countInstances(owner, childDef.id) === 0) {
        const alreadyHasPhantom = owner.children.some(c => c.isPhantom && c.def.id === childDef.id);
        if (!alreadyHasPhantom) {
          // Die durchschrittenen Gruppen tragen ihre Sichtbarkeit an das Phantom
          // weiter: eine versteckte Gruppe versteckt, was sie haelt (§8), und
          // eine Min-Grenze an einem versteckten Anker wird nicht validiert.
          const phantom = attachPhantom(owner, childDef, nextFrameId, AnchorKind.MANDATORY_PHANTOM);
          if (gates.length > 0) phantom.visibilityGates = gates;
        }
      }
    }
  }
}

/**
 * The parent-scoped MIN limit that makes a child definition **mandatory** for its
 * owner — or `null` when the definition carries none.
 *
 * Only a bound that counts PIECES qualifies: a cost-measured minimum
 * (`field.kind !== SELECTION_COUNT`) and a percentage minimum are not a number of
 * children the raise has to create, so they make no child mandatory here. The
 * candidate is picked by the mere PRESENCE of the bound, never by its base value —
 * the effective value after every modifier is read later, by the caller.
 *
 * The bound must be the definition's **own**: a link that declares no minimum
 * obliges nothing, whatever the shared entry behind it declares for its other
 * users (`limitsOf` would merge the target's in). That is the reading a raise
 * has always followed, and it is what keeps a shared "Hand Weapon" entry from
 * arriving under every unit that merely offers it.
 */
function mandatoryMinLimitOf(def) {
  return (def.limits ?? []).find(limit =>
    limit.kind === ConstraintKind.MIN
    && limit.scope === ScopeKeyword.PARENT
    && limit.field?.kind === CountedFieldKind.SELECTION_COUNT
    && !limit.isPercent,
  ) ?? null;
}

/**
 * The member a **mandatory group** contributes when no member of it is taken by a
 * minimum of its own: the one the catalogue names
 * (`selectionEntryGroup/@defaultSelectionEntryId`, which references the member's
 * OWN id — at a link that is the link id, never its `targetId`), else the first
 * member in document order. Every member of the group is a candidate for it,
 * itemised or not — that is the long-standing reading of the write model this
 * walk took over (Issue 0157).
 */
function defaultMemberOf(groupDef, members) {
  const declared = groupDef.defaultSelectionEntryId ?? null;
  if (declared !== null) {
    const named = members.find(({ def }) => def.id === declared);
    if (named !== undefined) return named;
  }
  return members[0] ?? null;
}

/**
 * The **candidates** for the children a slot is obliged to create when it is
 * raised — the one reading of that question in the engine, and the source of both
 * the raise cost and the raise members of a slot (`costProjection.js`).
 *
 * Which of the candidates actually oblige the slot is decided by the caller, on
 * the **effective** bounds (`costProjection.js`); this walk only names them and
 * says where each one's count comes from. Two shapes make a child mandatory:
 * - **itemised** (`kind: 'itemised'`) — the member carries a parent-scoped MIN
 *   limit of its own ({@link mandatoryMinLimitOf}), and the group around it (if
 *   any) carries one too. A group without a minimum obliges nothing at all, not
 *   even a member that names its own — that is the reading the write model had
 *   before Issue 0157 moved it here, and it stays the one a raise follows.
 * - **pick-one** (`kind: 'groupDefault'`) — the GROUP carries the MIN limit
 *   ("take one out of this pot"). It fills only where **no** member of that
 *   group is obliged itemised, which the caller can only tell once the bounds
 *   are known; the member that fills it is the group's default
 *   ({@link defaultMemberOf}) and the bound to read is the group's, so the
 *   entry named as `limitDef` is the group rather than the member.
 *
 * Descent into a nested group is never gated on the outer group's limit
 * (`selectionDefinitionsUnder` walks through), and every group is judged by its
 * own. A `categoryLink` is skipped throughout: a category is not a selection
 * anyone creates or pays for.
 *
 * The answer is a pure function of `node.def`, so a caller may memoise it by that
 * object.
 *
 * @param {object} node  the slot whose mandatory member candidates are asked for.
 * @returns {Array<{ kind: 'itemised'|'groupDefault', def: object, gates: object[], limit: object, limitDef: object, group: object|null, groupLimit: object|null, groupGates: object[]|null }>}
 *   in document order; `limitDef` is the definition whose `limit` gives the count,
 *   `groupLimit`/`groupGates` describe the group that gates the candidate.
 */
export function mandatoryMemberDefsOf(node) {
  /** @type {Array<{ kind: 'itemised'|'groupDefault', def: object, gates: object[], limit: object, limitDef: object, group: object|null, groupLimit: object|null, groupGates: object[]|null }>} */
  const found = [];
  /** Members per innermost gate — the group that immediately holds them. */
  const membersByGroup = new Map();
  /** The gates of a group itself — its member's gates without the group. */
  const gatesByGroup = new Map();

  for (const { def, gates } of selectionDefinitionsUnder(ownerDefinitionOf(node))) {
    if (def.kind === DefinitionKind.CATEGORY_LINK) continue;
    const group = gates.length > 0 ? gates[gates.length - 1] : null;
    if (group !== null) {
      if (!membersByGroup.has(group)) {
        membersByGroup.set(group, []);
        gatesByGroup.set(group, gates.slice(0, -1));
      }
      membersByGroup.get(group).push({ def, gates });
    }
    const limit = mandatoryMinLimitOf(def);
    if (limit === null) continue;
    found.push({
      kind: 'itemised',
      def, gates, limit, limitDef: def, group,
      groupLimit: group === null ? null : mandatoryMinLimitOf(group),
      groupGates: group === null ? null : gates.slice(0, -1),
    });
  }

  for (const [group, members] of membersByGroup) {
    const limit = mandatoryMinLimitOf(group);
    if (limit === null) continue;
    const chosen = defaultMemberOf(group, members);
    if (chosen === null) continue;
    found.push({
      kind: 'groupDefault',
      def: chosen.def, gates: chosen.gates, limit, limitDef: group, group,
      groupLimit: limit, groupGates: gatesByGroup.get(group) ?? [],
    });
  }

  return found;
}

/**
 * A node in the shape of a mandatory phantom ({@link attachPhantom}) that is
 * **deliberately NOT pushed into `parent.children`**: everything that reaches
 * nodes reaches them through `children`, so staying out of that array is what
 * keeps this hypothetical slot out of the report — no capability record, no slot
 * path, no constraint result, no violation, no index entry, no cost total.
 *
 * It still carries `parent` and `forceRoot`, because that ancestor chain is what
 * lets `query.js` resolve the `parent`, `force` and `ancestor` scopes of the
 * modifiers evaluated on it (`costProjection.js`, {@link buildRaiseCostProjection}).
 *
 * @param {object} root  root of the tree (carries the source of frame identities).
 * @param {object} parent  the node this child would hang under.
 * @param {object} def  the child definition.
 * @param {object[]} [gates]  the visibility gates walked to reach `def`.
 * @returns {object} the detached node.
 */
export function createDetachedChildNode(root, parent, def, gates = []) {
  return {
    def,
    instance: null,
    parent,
    children: [],
    isPhantom: true,
    isRoot: false,
    isForce: false,
    anchorKind: AnchorKind.MANDATORY_PHANTOM,
    frameId: root.nextFrameId(),
    forceRoot: parent.forceRoot,
    visibilityGates: gates,
  };
}

/** Ob eine Definition ein deklariertes `sortIndex` traegt (Issue 0133). */
function hasSortIndex(def) {
  return def.sortIndex !== null && def.sortIndex !== undefined;
}

/**
 * Die Grenzen-tragenden `selectionEntryGroup`s im Definitionsteilbaum eines
 * Eigentuemers — ueber verschachtelte Gruppen hinweg, aber **nicht** ueber
 * Eintraege hinaus: die Gruppen eines geschachtelten Eintrags gehoeren diesem
 * Eintrag als Eigentuemer, nicht dem aeusseren. Eine gruppen-skopierte Grenze
 * (`scope=parent`) rechnet immer gegen die naechste reale Auswahl.
 *
 * Eine per `entryLink type="selectionEntryGroup"` **verlinkte** Gruppe zaehlt
 * dazu (Issue 083): geliefert wird dann der **Link** — er erbt die Grenzen
 * seines Ziels und traegt seine eigenen dazu ({@link limitsOf}) —, und die
 * Traversierung steigt in die Zielgruppe ab, weil dort weitere verlinkte oder
 * geschachtelte Gruppen haengen koennen. Ohne diesen Abstieg bekaeme eine
 * verlinkte Gruppe keinen Anker: ihr `max` bliebe stumm, ihr `min` feuerte am
 * Pflicht-Phantom des Links faelschlich mit Ist 0.
 *
 * Der `visited`-Satz haelt Verweiszyklen endlich und verankert die vom **Ziel**
 * geerbten Grenzen je Eigentuemer nur einmal (zwei Links auf dieselbe Gruppe
 * meldeten dieselbe geteilte Grenze sonst doppelt). Die **am Link selbst**
 * deklarierten Grenzen sind davon ausgenommen: sie sind die eigenen Grenzen
 * genau dieses Links und gelten je Link — ein weiterer Geschwister-Link auf ein
 * schon gesehenes Ziel wird deshalb mit `ownLimitsOnly` geliefert, wenn er
 * eigene Grenzen traegt. So entscheidet die Dokumentreihenfolge der Geschwister
 * nie, ob eine Link-Grenze ausgewertet wird.
 *
 * Ein `sortIndex` ohne eigene Grenzen (Issue 0133) loest ebenfalls einen Anker
 * aus — sonst waere der deskriptive Wert einer grenzenlosen Gruppe aus
 * `capabilities` nicht erreichbar ({@link ../evaluator/report.js}) —, aber
 * **`hasLimits: false`**: {@link synthesizeGroupAnchors} annotiert dessen
 * Member deshalb nicht unter der Gruppen-Id. Ohne diese Trennung wuerde ein
 * rein deskriptives `sortIndex` eine bislang grenzenlose Gruppe erstmals
 * zaehlbar machen und so Bedingungen/Modifier andernorts veraendern, die per
 * `childId` auf dieselbe Gruppen-Id verweisen — ein `sortIndex` darf aber nie
 * ein Gueltigkeits-Urteil veraendern.
 *
 * @returns {Generator<{ def: object, ownLimitsOnly: boolean, hasLimits: boolean }>}
 */
function* groupDefinitionsWithLimits(ownerDef, visited = new Set()) {
  for (const child of ownerDef.children ?? []) {
    const linkedGroup = linkedGroupTargetOf(child);
    if (linkedGroup !== null) {
      if (visited.has(linkedGroup.id)) {
        // Ziel schon verankert: nur die eigenen Grenzen dieses Links (oder sein eigener sortIndex) fehlen noch.
        const ownLimits = child.limits ?? [];
        if (ownLimits.length > 0) yield { def: child, ownLimitsOnly: true, hasLimits: true };
        else if (hasSortIndex(child)) yield { def: child, ownLimitsOnly: true, hasLimits: false };
        continue;
      }
      visited.add(linkedGroup.id);
      const limits = limitsOf(child);
      if (limits.length > 0) yield { def: child, ownLimitsOnly: false, hasLimits: true };
      else if (hasSortIndex(child)) yield { def: child, ownLimitsOnly: false, hasLimits: false };
      yield* groupDefinitionsWithLimits(linkedGroup, visited);
      continue;
    }
    if (child.kind !== DefinitionKind.GROUP) continue;
    const limits = limitsOf(child);
    if (limits.length > 0) yield { def: child, ownLimitsOnly: false, hasLimits: true };
    else if (hasSortIndex(child)) yield { def: child, ownLimitsOnly: false, hasLimits: false };
    yield* groupDefinitionsWithLimits(child, visited);
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
 *
 * `ownLimitsOnly` schneidet den Anker auf die **am Link selbst** deklarierten
 * Grenzen zu ({@link evaluableLimitsOf}): der zweite Geschwister-Link auf ein
 * schon verankertes Ziel wertet nur seine eigenen Grenzen aus — die vom Ziel
 * geerbten meldete sonst jeder Anker einmal ({@link groupDefinitionsWithLimits}).
 */
function attachGroupAnchor(owner, groupDef, nextFrameId, ownLimitsOnly = false) {
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
    ownLimitsOnly,
  };
  owner.children.push(node);
  return node;
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
 * Annotiert die Member einer Gruppe mit **ihrem Gruppen-Anker** (`groupFrames`):
 * dem Knoten, der als **Zaehlrahmen der Gruppe** einsteht.
 *
 * Eine Gruppe ist im Roster kein eigener Knoten — ihre Member haengen unter dem
 * Eigentuemer, der Anker daneben. Eine Query, die **am Anker selbst** gestellt
 * wird (`scope="self"`, ebenso jedes `shared="false"`), fragt damit nach dem
 * Bestand eines Rahmens, in dem im Baum nichts steht: die Gruppe zaehlt aber
 * „ihre Mitglieder, nicht die Gruppe" (`docs/battlescribe-data-format.md` §7.6).
 * Diese Annotation macht genau das zur Index-Aussage — die Index-Schicht traegt
 * einen Member (und alles unter ihm) zusaetzlich im **Rahmen des Ankers** bei
 * ({@link import('./countIndex.js').buildIndex}), sodass die Zaehlung am
 * Gruppen-Rahmen dieselbe Menge sieht wie die gruppen-skopierte Grenze im
 * Eigentuemer-Rahmen.
 *
 * Member ist — anders als bei {@link annotateGroupMembers}, das die Zaehlbarkeit
 * unter der **Gruppen-Id** im ganzen Teilbaum annotiert — nur ein **direktes
 * Kind** des Eigentuemers: die Gruppe bietet ihre Optionen an genau dieser Stelle
 * an, tiefer geschachtelte Vorkommen derselben Definition stehen in einem anderen
 * Rahmen. Sie zaehlen im Gruppen-Rahmen trotzdem mit, sobald eine Query
 * `includeChildSelections` setzt — dann naemlich als Nachfahren ihres Members.
 */
function annotateGroupFrameMembers(owner, anchor, memberIds) {
  for (const node of owner.children) {
    if (node.isPhantom || node.instance === null) continue;
    if (memberIds.has(node.instance.defId)) {
      (node.groupFrames ??= new Set()).add(anchor);
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

    for (const { def: groupDef, ownLimitsOnly, hasLimits } of groupDefinitionsWithLimits(ownerDef)) {
      const anchor = attachGroupAnchor(owner, groupDef, nextFrameId, ownLimitsOnly);
      // Bei einer verlinkten Gruppe ist der Anker der **Link** (nur an ihm
      // gelten seine eigenen Grenzen); gezaehlt wird aber unter der Id, die
      // die Constraint-Schicht am Link abfragt (`targetId`), und die Member
      // stehen im Index unter der **aufgeloesten** Gruppen-Id.
      const isLink = groupDef.kind === DefinitionKind.ENTRY_LINK;
      const countedId = isLink ? groupDef.targetId : groupDef.id;
      const memberIds = memberIndex.get(isLink ? groupDef.resolved.id : groupDef.id);
      if (memberIds === undefined) continue;
      // Der **Rahmen des Ankers** traegt seine Member immer: er ist ein
      // engine-eigener Schluessel, den allein eine Query am Anker selbst liest
      // ({@link annotateGroupFrameMembers}) — er macht keine Gruppe unter ihrer
      // **Id** zaehlbar und kann deshalb kein Urteil andernorts verschieben.
      annotateGroupFrameMembers(owner, anchor, memberIds);
      // Die Zaehlbarkeit unter der **Gruppen-Id** dagegen bleibt den
      // Grenzen-tragenden Gruppen vorbehalten: ein Anker fuer ein rein
      // deskriptives sortIndex (kein `hasLimits`, Issue 0133) zaehlt seine
      // Member nie mit — sonst machte ein Anzeige-Attribut eine bislang
      // grenzenlose Gruppe zaehlbar und veraenderte damit Bedingungen/Modifier
      // andernorts, die per `childId` auf ihre Id verweisen.
      if (!hasLimits) continue;
      annotateGroupMembers(owner, countedId, memberIds);
    }
  }
}

/**
 * Meldet jede **belegte** Auswahl, deren Definition aus einem Katalog
 * ausserhalb des Auswertungsumfangs ihres Kontingents stammt (Issue 0159,
 * Kriterium 4) — `SELECTION_OUT_OF_CATALOGUE_SCOPE`.
 *
 * Der Umfang ist derselbe wie ueberall sonst ({@link isInCatalogueScope}): das
 * Armeebuch des Kontingents, dessen transitive `catalogueLink`-Huelle und das
 * Spielsystem. Anders als beim Angebot wird hier die **volle** Huelle gelesen,
 * nicht die Wurzel-Import-Huelle: ob ein Eintrag als Wurzel-Angebot gehoert
 * haette, ist eine andere Frage als die, ob seine Definition dieses Kontingent
 * ueberhaupt erreicht.
 *
 * Gemeldet, nicht verworfen: die Auswahl steht im Roster und wird weiter voll
 * ausgewertet. Was sie nicht darf, ist still bleiben — weder als Absturz noch
 * als halbe Auswertung (ADR-0032, Entscheidung 3 und ihr Nachtrag).
 *
 * Ein Knoten ueber keinem Kontingent (`forceRoot === null`) und ein Kontingent
 * ohne bekanntes Armeebuch haben nichts, wogegen zu pruefen waere; beide fallen
 * offen aus, wie die Pruefung selbst.
 */
function diagnoseSelectionsOutOfCatalogueScope(root, catalogueScope, primaryCatalogueByForceDefId, diagnostics) {
  if (catalogueScope === null || catalogueScope === undefined) return;
  const forceCatalogueIdByFrameId = new Map();
  for (const node of realNodes(root)) {
    const forceRoot = node.forceRoot;
    if (forceRoot === null || forceRoot === undefined) continue;
    if (!forceCatalogueIdByFrameId.has(forceRoot.frameId)) {
      forceCatalogueIdByFrameId.set(forceRoot.frameId, forceCatalogueIdOf(forceRoot, primaryCatalogueByForceDefId));
    }
    const forceCatalogueId = forceCatalogueIdByFrameId.get(forceRoot.frameId);
    if (forceCatalogueId === undefined) continue;
    const defId = node.def?.id;
    if (defId === undefined || defId === null) continue;
    if (isInCatalogueScope(defId, [forceCatalogueId], catalogueScope)) continue;
    diagnostics.push(diagnostic(DiagnosticKind.SELECTION_OUT_OF_CATALOGUE_SCOPE, {
      defId,
      sourceId: catalogueScope.sourceIdByDefId.get(defId) ?? null,
      forceCatalogueId,
    }));
  }
}

/**
 * Baut **Baumphase 1** aus aufgeloesten Definitionen und Roster-Instanzen: die
 * realen Knoten und alle Anker, die schon vor der Konvergenz feststehen. Die
 * Wurzel ist ein synthetischer Ankerknoten ohne eigene Definition; sie traegt den
 * ROSTER-Rahmen und liegt ueber keinem Kontingent. Nachdem alle realen Knoten
 * haengen, werden Phantomknoten fuer fehlende Pflichtdefinitionen synthetisiert
 * (siehe {@link synthesizeMandatoryPhantoms}), Kategorie-Anker je Kontingent
 * (siehe {@link synthesizeForceCategoryAnchors}), Kategorie-Anker fuer
 * unverlinkte Grenzen-tragende Kategorien (siehe
 * {@link synthesizeUnlinkedCategoryAnchors}) und Gruppen-Anker fuer
 * gruppen-skopierte Grenzen (siehe {@link synthesizeGroupAnchors}).
 *
 * Die Wurzel traegt zusaetzlich die **Quelle der Rahmen-Identitaeten**
 * (`nextFrameId`) des Baums. Baumphase 2 ({@link attachOfferAnchor}) zieht aus
 * derselben Quelle weiter, sodass ein spaeter angehaengter Anker nie die
 * Rahmen-Identitaet eines vorhandenen Knotens wiederverwendet — sonst laese eine
 * `self`-skopierte Grenze am Anker den Bestand eines fremden Knotens.
 *
 * @param {{ lookup: (id: string) => object|null, definitions?: object[], groupMemberIds?: Map<string, Set<string>> }} resolved
 * @param {{ forces?: Array<{ defId: string|null, count?: number, catalogueId?: string|null, children?: object[] }> }} roster
 *   Der Instanzbaum. Ein Kontingent-Knoten darf sein Armeebuch nennen
 *   (`catalogueId`, Issue 0140); die Angabe landet geprueft am Knoten
 *   ({@link attachInstance}) und gilt dort, wo der Herkunftsindex schweigt.
 * @param {{ sourceIdByDefId: Map<string, string>, catalogueScopeClosureById: Map<string, Set<string>>, gameSystemId: string|null }} [catalogueScope]
 *   Der Katalog-Bezugsrahmen (Issue 0098): schneidet die Pflicht-Phantom-Synthese
 *   auf Definitionen zu, deren Herkunft zu den im Roster tatsaechlich
 *   vertretenen Kontingent-Katalogen gehoert — das Spielsystem ausgenommen. Ohne
 *   ihn (`undefined`) ungefiltertes, unveraendertes Verhalten. Sein `catalogueScopeClosureById` ist zugleich
 *   die Registratur, gegen die die Armeebuch-Angabe des Rosters geprueft wird —
 *   eine dem Datensatz unbekannte Id zaehlt wie keine Angabe
 *   ({@link declaredCatalogueIdOf}).
 * @param {Map<string, string>} [primaryCatalogueByForceDefId]
 *   Der Herkunftsindex der Kontingente — die **erste** Quelle des Armeebuchs
 *   eines Kontingents ({@link forceCatalogueIdOf}); ohne ihn **und** ohne
 *   Angabe des Rosters wirkt `catalogueScope` wie fehlend.
 * @returns {{ root: object, diagnostics: object[] }}
 */
export function buildEvalTree(resolved, roster, catalogueScope, primaryCatalogueByForceDefId) {
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
  // Die Kataloge, die dieser Datensatz fuehrt: die Registratur, an der sich die
  // Armeebuch-Angabe des Rosters messen lassen muss (Issue 0140).
  const knownCatalogueIds = catalogueScope?.catalogueScopeClosureById;
  for (const forceInstance of roster.forces ?? []) {
    attachInstance(root, forceInstance, resolved, diagnostics, nextFrameId, knownCatalogueIds);
  }
  diagnoseSelectionsOutOfCatalogueScope(root, catalogueScope, primaryCatalogueByForceDefId, diagnostics);
  // Direkt nach dem Instanzbaum: die Sichtbarkeits-Klammern der belegten Knoten.
  // Sie stammen aus dem Definitionsbaum, nicht aus der Instanz — die `.ros`
  // verwirft die Gruppen-Zugehoerigkeit (§3.2).
  annotateOccupiedVisibilityGates(root);
  synthesizeMandatoryPhantoms(root, resolved.definitions ?? [], nextFrameId, catalogueScope, primaryCatalogueByForceDefId);
  synthesizeParentScopePhantoms(root, nextFrameId);
  synthesizeForceCategoryAnchors(root, nextFrameId);
  // Nach Pflicht-Phantomen und Kontingent-Ankern, damit die Duplikat-Pruefung
  // („haengt hier schon ein Anker dieser Kategorie?") beide sehen kann.
  synthesizeUnlinkedCategoryAnchors(root, resolved.definitions ?? [], nextFrameId, catalogueScope, primaryCatalogueByForceDefId);
  // Nach den realen Knoten und den Pflicht-Phantomen: die Gruppen-Anker zuletzt,
  // damit die stabilen Pfade der realen Geschwister unveraendert bleiben.
  synthesizeGroupAnchors(root, resolved, nextFrameId);
  return { root, diagnostics };
}

/**
 * Die **aufgeloeste Ziel-Id** eines Knotens: bei einem Verweis dessen Ziel,
 * sonst die eigene Definition — dieselbe Identitaet, ueber die die
 * Constraint-Schicht zaehlt (`countedTargetId`).
 */
function resolvedTargetIdOf(node) {
  if (!node.def) return null;
  return isLinkDefinition(node.def) ? node.def.targetId : node.def.id;
}

/**
 * **Baumphase 2.5**: die Pflicht-Phantome der **geteilten** Definitionen, die in
 * diesem Roster tatsaechlich **angeboten** werden (Issue 0154).
 *
 * Ein geteilter Eintrag ist kein Wurzel-Angebot (Issue 0153, ADR-0032) und
 * bekommt in Phase 1 deshalb kein Phantom: seine `min`-Grenze duerfte sonst in
 * jedem Roster feuern, auch dort, wo ihn nichts erreichbar macht. Er kann aber
 * eine **armee- bzw. kontingentweite Pflicht** an sich selbst tragen —
 * „mindestens einer davon in dieser Armee" —, und die gilt der Liste, nicht dem
 * Platz: sie ist genau dann einzufordern, wenn der Roster den Eintrag
 * ueberhaupt anbietet. Real getragen von den Hoch-Elfen-Ehrungen: „Pure of
 * Heart" steht allein unter `<sharedSelectionEntries>`, ist allein ueber den
 * `entryLink` der geteilten Gruppe „Honours" unter einem Helden waehlbar und
 * traegt dort `min 1 scope="roster"` — mindestens ein Held muss sie nehmen.
 *
 * **Angebotsregel.** Angeboten ist, was ein Anker des fertigen Baums fuehrt:
 * ein belegter Slot oder ein Angebots-Anker, dessen aufgeloestes Ziel diese
 * Definition ist. Deshalb laeuft diese Phase **nach** {@link import('./offer.js').attachOfferAnchors} —
 * vorher ist die Frage „wird das hier angeboten?" nicht beantwortbar. Ein
 * geteilter Eintrag, auf den im ganzen Korpus **kein** `entryLink` zeigt,
 * bleibt damit stumm (das Muster des Szenarios `roster-scope-mandatory-chariot`,
 * RSMC-R7), und eine leere Armee fordert nichts ein: ohne Auswahl gibt es
 * keinen Rahmen, der etwas anboete.
 *
 * Alles Weitere ist die Phase-1-Regel, unveraendert: das Phantom haengt nur bei
 * **Absenz** ({@link countInstances}, das einen Verweis fuer sein Ziel
 * mitzaehlt), nur im Rahmen seiner Grenze (ROSTER an der Wurzel, FORCE am
 * Kontingent) und nur im **Katalog-Bezugsrahmen** ({@link isInCatalogueScope}) —
 * eine Pflicht eines fremden Armeebuchs bleibt dessen Sache.
 *
 * @returns {object[]} die angehaengten Phantome, in Anhaenge-Reihenfolge; der
 *   Aufrufer traegt sie wie die Angebots-Anker in die Effektiv-Werte-Schicht nach.
 */
export function synthesizeOfferedSharedMandatoryPhantoms(root, resolved, catalogueScope, primaryCatalogueByForceDefId) {
  const sharedDefinitions = resolved.sharedDefinitions ?? [];
  if (sharedDefinitions.length === 0) return [];
  const nextFrameId = root.nextFrameId;
  const attached = [];

  const offeredIdsUnder = node => {
    const ids = new Set();
    for (const descendant of nodeAndDescendants(node)) {
      if (descendant.isRoot) continue;
      // Ein Pflicht-Phantom ist selbst kein Angebot — es ist die Meldung ueber
      // eine Absenz und darf keine zweite begruenden.
      if (descendant.anchorKind === AnchorKind.MANDATORY_PHANTOM) continue;
      const id = resolvedTargetIdOf(descendant);
      if (id !== null) ids.add(id);
    }
    return ids;
  };

  const forceNodeList = [...forceNodes(root)];
  const rosterCatalogueReferences = rosterCatalogueReferencesOf(forceNodeList, primaryCatalogueByForceDefId);
  const rosterOfferedIds = offeredIdsUnder(root);
  for (const def of sharedDefinitions) {
    const { limits, ownLimitsOnly } = mandatoryLimitStockOf(def);
    if (hasMinLimit(limits, ScopeKeyword.ROSTER) && rosterOfferedIds.has(def.id)
        && countInstances(root, def.id) === 0
        && isInCatalogueScope(def.id, rosterCatalogueReferences, catalogueScope)) {
      attached.push(attachPhantom(root, def, nextFrameId, AnchorKind.MANDATORY_PHANTOM, null, ownLimitsOnly));
    }
  }
  for (const forceNode of forceNodeList) {
    const forceOfferedIds = offeredIdsUnder(forceNode);
    const forceCatalogueId = forceCatalogueIdOf(forceNode, primaryCatalogueByForceDefId);
    const forceCatalogueReferences = forceCatalogueId === undefined ? [] : [forceCatalogueId];
    for (const def of sharedDefinitions) {
      const { limits, ownLimitsOnly } = mandatoryLimitStockOf(def);
      if (hasMinLimit(limits, ScopeKeyword.FORCE) && forceOfferedIds.has(def.id)
          && countInstances(forceNode, def.id) === 0
          && isInCatalogueScope(def.id, forceCatalogueReferences, catalogueScope)) {
        attached.push(attachPhantom(forceNode, def, nextFrameId, AnchorKind.MANDATORY_PHANTOM, null, ownLimitsOnly));
      }
    }
  }
  return attached;
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
