/**
 * Zusammenfuehrung mehrerer gelesener Dokumente zu **einem** katalog-foermigen
 * Aggregat (ADR-0032). Einzige Verantwortung: die je-Dokument-Sammlungen eines
 * `.gst` plus einer oder mehrerer `.cat` in der von der Fassade vorgegebenen
 * deterministischen Reihenfolge (Spielsystem zuerst, dann die Kataloge)
 * konkatenieren. Keine Auflösungslogik — die uebernimmt der Resolver auf dem
 * Aggregat.
 *
 * Das Ergebnis hat exakt die Form, die ein einzelnes `parseCatalogue` liefert
 * (`{ entries, forces, categories, sharedEntries, infos, diagnostics }`). So
 * behaelt der Resolver seinen Ein-Katalog-Kontrakt, obwohl N Dokumente
 * einfliessen: die eine globale `id → Definition`-Tabelle entsteht aus der
 * Vereinigung aller Quellen.
 *
 * Genau **weil** das Aggregat die Herkunft einlegt, baut dieses Modul daneben die
 * beiden **Herkunftsindizes**, deren Angabe nur die einzelnen Dokumente kennen:
 * den der Kontingente ({@link buildPrimaryCatalogueIndex}) — der Bezugsrahmen
 * `primary-catalogue` fragt nach dem Armeebuch, aus dem das umschliessende
 * Kontingent stammt (Issue 077) — und den der Definitionen
 * ({@link buildDefinitionSourceIndex}), aus dem der Faehigkeitsdatensatz je Slot
 * seine `sourceId` liest (Issue 0121).
 *
 * Hier steht deshalb auch die **eine** Antwort auf die Frage „aus welchem
 * Armeebuch stammt dieses Kontingent?" ({@link forceCatalogueIdOf}, Issue 0140).
 * Sie hat **zwei** Quellen, und die Katalogdaten schlagen das Roster: steht die
 * Kontingent-Definition in einem Armeebuch, *ist* sie dessen Kontingent. Erst
 * wo der Index schweigt — weil der Datensatz seine Kontingente in der
 * **Spielsystemdatei** deklariert —, antwortet die Angabe des Rosters
 * ({@link declaredCatalogueIdOf}). Sie fuellt die Luecke, sie ueberschreibt
 * nichts.
 */

import { DefinitionKind } from './model.js';

/** Die je-Dokument-Sammlungen, die zu je einer Aggregat-Liste konkateniert werden. */
const MERGED_COLLECTIONS = Object.freeze([
  'entries',
  'forces',
  'categories',
  'sharedEntries',
  'infos',
  // Die Profiltypen liefern die Charakteristik-Typ-IDs, ueber die ein Modifikator
  // eine Charakteristik adressiert. Sie stehen im Spielsystem, die Modifikatoren in
  // den Katalogen — also muessen sie ebenso wie die Definitionen ueber alle Quellen
  // hinweg in **einer** Sicht liegen (ADR-0032).
  'profileTypes',
  // Die Quellen-Deklarationen: eine `publicationId` an einer Definition eines
  // Katalogs kann ein Buch benennen, das die Spielsystemdatei deklariert. Wie die
  // Profiltypen muessen sie deshalb ueber alle Quellen hinweg in **einer** Sicht
  // liegen (ADR-0032, Issue 0102).
  'publications',
  'diagnostics',
]);

/**
 * Fuehrt die gelesenen Dokumente in der uebergebenen Reihenfolge zu einem
 * katalog-foermigen Aggregat zusammen (reine, seiteneffektfreie Aggregation).
 *
 * @param {Array<{ entries?: object[], forces?: object[], categories?: object[], sharedEntries?: object[], infos?: object[], profileTypes?: object[], publications?: object[], diagnostics?: object[] }>} documents
 *   Die gelesenen Dokumente, bereits in deterministischer Reihenfolge (Spielsystem
 *   zuerst, dann die Kataloge in Aufruf-Reihenfolge).
 * @returns {{ entries: object[], forces: object[], categories: object[], sharedEntries: object[], infos: object[], profileTypes: object[], publications: object[], diagnostics: object[] }}
 */
export function mergeCatalogues(documents) {
  const merged = { entries: [], forces: [], categories: [], sharedEntries: [], infos: [], profileTypes: [], publications: [], diagnostics: [] };
  for (const document of documents) {
    for (const name of MERGED_COLLECTIONS) {
      merged[name].push(...(document[name] ?? []));
    }
  }
  return merged;
}

/** Eine Kontingent-Definition und, rekursiv, alle ihre Unter-Kontingente. */
function* forceAndSubForces(forceDef) {
  yield forceDef;
  for (const child of forceDef.children ?? []) {
    if (child.kind === DefinitionKind.FORCE) yield* forceAndSubForces(child);
  }
}

/**
 * Baut den **Herkunftsindex der Kontingente**: je Kontingent-Definition das
 * Armeebuch, das sie deklariert (`Map<forceDefId, catalogueId>`). Er beantwortet
 * den Bezugsrahmen `primary-catalogue` — „das Armeebuch, aus dem das
 * umschliessende Kontingent stammt" (Issue 077, Kriterium 1: aus den Katalogdaten
 * belegt, alle 27 Vorkommen tragen eine Katalog-Wurzel-Id in `childId`).
 *
 * Erfasst werden **Wurzel- und Unter-Kontingente**: auch eine Auswahl in einem
 * geschachtelten Kontingent steht in einem Armeebuch, und `forceRoot` des
 * Auswertungsbaums zeigt auf das naechste umschliessende Kontingent — also muss
 * jede Kontingent-Definition auffindbar sein.
 *
 * **Nur die Kataloge**, nie das Spielsystem: ein `primary-catalogue` ist ein
 * Armeebuch, und die `.gst` ist keines. Wo dieser Index antwortet, ist seine
 * Antwort **massgeblich** — auch gegen ein anderslautendes Roster
 * ({@link forceCatalogueIdOf}, Issue 0140). Ein Datensatz, der seine
 * Kontingente in der Spielsystemdatei deklariert, hat hier darum **keinen**
 * Eintrag; erst dort springt die Angabe des Rosters ein. Bringt es keine,
 * bleibt der Rahmen unaufgeloest und das Query-Primitiv meldet ihn fail-closed
 * als `unresolvedScope`, statt still ein Armeebuch zu erfinden (Issue 077,
 * Decisions).
 *
 * Das erste Vorkommen einer Id gewinnt — dieselbe Regel wie in der globalen
 * Definitionstabelle des Resolvers und in der Datensatz-Beschreibung; eine
 * doppelte Id ist ohnehin schon als Diagnose sichtbar.
 *
 * @param {Array<{ id?: string|null, forces?: object[] }>} catalogueDocuments
 *   Die gelesenen **Katalog**-Dokumente (`.cat`) in Aufruf-Reihenfolge.
 * @returns {Map<string, string>} Kontingent-Definitions-Id → Katalog-Id.
 */
export function buildPrimaryCatalogueIndex(catalogueDocuments) {
  /** @type {Map<string, string>} */
  const byForceDefId = new Map();
  for (const document of catalogueDocuments) {
    if (document.id === null || document.id === undefined) continue;
    for (const rootForce of document.forces ?? []) {
      for (const force of forceAndSubForces(rootForce)) {
        if (!byForceDefId.has(force.id)) byForceDefId.set(force.id, document.id);
      }
    }
  }
  return byForceDefId;
}

/**
 * Die vom **Roster** genannte Armeebuch-Id eines Kontingent-Knotens — oder
 * `undefined`, wenn es keine (gueltige) gibt (Issue 0140).
 *
 * Ein Kontingent-Knoten des Eingabe-Rosters darf sein Armeebuch selbst nennen
 * (`catalogueId`, Vertrag der Fassade `@param roster`; im App-Modell
 * `Force.catalogueId`, in einer `.ros` das gleichnamige Attribut am `<force>`).
 * Sie ist die einzige Quelle, die auch dann antwortet, wenn die
 * Kontingent-Definition aus der Spielsystemdatei stammt — aber nur dort wird sie
 * gelesen: wo der Herkunftsindex antwortet, gilt er ({@link
 * forceCatalogueIdOf}).
 *
 * Eine Armeebuch-Id, die der Datensatz **nicht kennt**, zaehlt wie **keine
 * Angabe**: sonst haette ein Kontingent, dessen Katalog gar nicht geladen ist,
 * eine Referenzmenge ohne jeden Treffer, und die Filterung schloesse *alles*
 * aus — ein still leeres Armeebuch. Bekannt heisst: der Datensatz fuehrt fuer
 * diese Id eine `catalogueLink`-Huelle ({@link
 * buildCatalogueScopeClosure}) — genau die Menge, gegen die spaeter
 * geprueft wird. Ist **gar keine** Registratur mitgegeben (ein direkter Aufruf
 * der tieferen Schichten ohne Katalog-Bezug), ist die Angabe nicht
 * nachpruefbar und wird unveraendert uebernommen.
 *
 * @param {{ catalogueId?: string|null }|null|undefined} instance  der
 *   Kontingent-Knoten des Eingabe-Rosters.
 * @param {{ has: (id: string) => boolean }|null|undefined} [knownCatalogueIds]
 *   die Katalog-Ids, die der Datensatz fuehrt (typischerweise
 *   `catalogueScopeClosureById`).
 * @returns {string|undefined}
 */
export function declaredCatalogueIdOf(instance, knownCatalogueIds) {
  const declared = instance?.catalogueId;
  if (declared === null || declared === undefined) return undefined;
  if (knownCatalogueIds === null || knownCatalogueIds === undefined) return declared;
  return knownCatalogueIds.has(declared) ? declared : undefined;
}

/**
 * Das Armeebuch eines Kontingent-**Knotens** — die **eine** Antwort auf „aus
 * welchem Armeebuch stammt dieses Kontingent?" (Issue 0140), die sowohl die
 * Pflicht-Phantom-Synthese (`evalTree.js`) und die Angebots-Schicht
 * (`offer.js`) als auch der Bezugsrahmen `primary-catalogue` (`query.js`)
 * stellen. Sie ist zugleich die **Wurzel des Auswertungsumfangs** dieses
 * Kontingents (Issue 0159): das Buch selbst, seine transitive
 * `catalogueLink`-Huelle ({@link buildCatalogueScopeClosure}) und das
 * Spielsystem — mehr erreicht dieses Kontingent nicht.
 *
 * Zwei Quellen, in dieser Reihenfolge:
 *
 * 1. der **Herkunftsindex** aus den Katalogdaten
 *    ({@link buildPrimaryCatalogueIndex}): steht die Kontingent-Definition in
 *    einem Armeebuch, *ist* sie dessen Kontingent — ein anderslautendes
 *    Roster-Attribut ist Metadatenmuell und wird nicht gelesen;
 * 2. die **Angabe des Rosters** am Kontingent-Knoten, beim Aufbau des Baums
 *    einmal geprueft und dort als `declaredCatalogueId` abgelegt
 *    ({@link declaredCatalogueIdOf}, `attachInstance`). Sie **fuellt die
 *    Luecke**, die der Index laesst: fuer ein in der Spielsystemdatei
 *    deklariertes Kontingent kann er prinzipiell keine Antwort haben.
 *
 * Schweigen beide, ist die Antwort `null` — die Aufrufer fallen dann offen
 * aus (Filterung) bzw. fail-closed (`primary-catalogue`), jeder wie bisher.
 *
 * Die Antwort ist **je Knoten**, nicht je Definition: zwei Kontingente
 * derselben `.gst`-Definition koennen zu zwei verschiedenen Armeebuechern
 * gehoeren (Verbuendete).
 *
 * Woher die Antwort stammt, spielt fuer den Umfang keine Rolle mehr (Issue
 * 0159): der Umfang folgt allein dem Buch und seiner `catalogueLink`-Huelle,
 * nicht der Frage, ob Katalogdaten oder Roster das Buch genannt haben.
 *
 * @param {{ declaredCatalogueId?: string|undefined, def?: { id?: string } }|null|undefined} forceNode
 * @param {Map<string, string>|null|undefined} [primaryCatalogueByForceDefId]
 * @returns {string|undefined}
 */
export function forceCatalogueIdOf(forceNode, primaryCatalogueByForceDefId) {
  const defId = forceNode?.def?.id;
  const fromIndex = defId === null || defId === undefined
    ? undefined
    : primaryCatalogueByForceDefId?.get(defId);
  if (fromIndex !== undefined) return fromIndex;
  const declared = forceNode?.declaredCatalogueId;
  if (declared === null || declared === undefined) return undefined;
  return declared;
}

/** Die Wurzel-Sammlungen, aus denen der Resolver seine Definitionen indiziert. */
const DEFINITION_ROOT_COLLECTIONS = Object.freeze(['entries', 'forces', 'categories', 'sharedEntries']);

/** Eine Definition und, rekursiv, ihren ganzen Teilbaum in den Index eintragen. */
function collectDefinitionSource(definition, sourceId, byDefId) {
  if (!byDefId.has(definition.id)) byDefId.set(definition.id, sourceId);
  for (const child of definition.children ?? []) {
    collectDefinitionSource(child, sourceId, byDefId);
  }
}

/**
 * Baut den **Herkunftsindex der Definitionen**: je Definitions-Id das Dokument,
 * das sie deklariert (`Map<defId, documentId>`). Er beantwortet die Frage „aus
 * welchem Armeebuch stammt dieses Angebot?", die der Faehigkeitsdatensatz als
 * `sourceId` fuehrt (Issue 0121) — genau wie {@link buildPrimaryCatalogueIndex}
 * kennen sie nur die **einzelnen** Dokumente, nicht das Aggregat.
 *
 * Traversiert wird rekursiv ueber `children` und ueber dieselben
 * Wurzel-Sammlungen, aus denen der Resolver indiziert (`collectDefinition` in
 * `resolver.js`) — ein verschachtelter Eintrag, ein `entryLink`, ein
 * `categoryLink` und ein geteilter Eintrag haben damit ebenso eine Herkunft wie
 * eine Wurzel-Definition.
 *
 * Anders als der Kontingent-Index umfasst dieser **auch das Spielsystem**: ein
 * geteilter Eintrag der `.gst` ist ein Angebot des Spielsystems und traegt
 * dessen Id als Herkunft. Ein Dokument **ohne Wurzel-Id** wird uebersprungen —
 * seine Definitionen bleiben ohne bekannte Herkunft (`sourceId: null` im
 * Bericht), statt eine zu erfinden.
 *
 * Das erste Vorkommen einer Id gewinnt — dieselbe Regel wie in der globalen
 * Definitionstabelle des Resolvers und in der Datensatz-Beschreibung; eine
 * doppelte Id ist ohnehin schon als Diagnose sichtbar.
 *
 * @param {Array<{ id?: string|null }>} documents  Die gelesenen Dokumente in
 *   deterministischer Reihenfolge (Spielsystem zuerst, dann die Kataloge in
 *   Aufruf-Reihenfolge, ADR-0032).
 * @returns {Map<string, string>} Definitions-Id → Dokument-Id.
 */
export function buildDefinitionSourceIndex(documents) {
  /** @type {Map<string, string>} */
  const byDefId = new Map();
  for (const document of documents) {
    if (document.id === null || document.id === undefined) continue;
    for (const collection of DEFINITION_ROOT_COLLECTIONS) {
      for (const definition of document[collection] ?? []) {
        collectDefinitionSource(definition, document.id, byDefId);
      }
    }
  }
  return byDefId;
}

/**
 * Baut die **`catalogueLink`-Huelle** je Katalog (`Map<catalogueId,
 * Set<catalogueId>>`, Issue 0159): die Menge der Katalog-Ids, die zum
 * Auswertungsumfang eines Kontingents **dieses** Katalogs gehoeren — er
 * selbst, plus transitiv und zyklensicher jeder Katalog, den er per
 * `catalogueLink` benennt.
 *
 * `importRootEntries` steuert diese Huelle **nicht** (Issue 0159, ADR-0032
 * Nachtrag): ein `catalogueLink` ist die Umfangs- und Aufloesungsgrenze eines
 * Armeebuchs, nicht bloss eine Abhaengigkeits-Deklaration. Wer verlinkt ist,
 * ist im Umfang; wer nicht verlinkt ist, erreicht dieses Kontingent nicht —
 * auch dann nicht, wenn er als Quelle mitgegeben wurde.
 *
 * Was `importRootEntries` steuert, ist die **engere** zweite Huelle
 * ({@link buildRootImportClosure}): ob die **Wurzel**-Eintraege des verlinkten
 * Katalogs zum Wurzel-Angebot des verlinkenden gehoeren. Ein geteilter Eintrag
 * des verlinkten Katalogs bleibt davon unberuehrt — er wird ueber einen
 * `entryLink` erreicht, nicht importiert.
 *
 * Nur ein Katalog mit eigener Wurzel-Id nimmt an der Huelle teil — ein Katalog
 * ohne sie bekommt keinen Eintrag und gilt ueberall dort, wo dieser Index
 * nachgeschlagen wird, als unbekannt (siehe Aufrufer).
 *
 * @param {Array<{ id?: string|null, catalogueLinks?: Array<{ targetId: string }> }>} catalogueDocuments
 *   Die gelesenen **Katalog**-Dokumente (`.cat`) in Aufruf-Reihenfolge.
 * @returns {Map<string, Set<string>>} Katalog-Id → Menge der Katalog-Ids in ihrer Huelle.
 */
export function buildCatalogueScopeClosure(catalogueDocuments) {
  return buildClosure(catalogueDocuments, () => true);
}

/**
 * Baut die **Wurzel-Import-Huelle** je Katalog (`Map<catalogueId,
 * Set<catalogueId>>`): die Menge der Katalog-Ids, deren **Wurzel**-Eintraege zum
 * Wurzel-Angebot eines Kontingents dieses Katalogs gehoeren — er selbst, plus
 * transitiv und zyklensicher jeder Katalog, den er per `catalogueLink` mit
 * `importRootEntries="true"` benennt.
 *
 * Sie ist die engere Schwester von {@link buildCatalogueScopeClosure} und
 * beantwortet eine andere Frage: jene sagt, **welche Definitionen** ein
 * Kontingent ueberhaupt erreichen, diese, **wessen Wurzel-Eintraege** es als
 * eigenes Angebot fuehrt (Issue 0098, Kriterium 3). Ohne
 * `importRootEntries="true"` ist ein `catalogueLink` laut XSD-Vorgabe stumm:
 * die geteilten Eintraege des Ziels bleiben ueber `entryLink`s erreichbar, sein
 * Wurzel-Angebot gehoert aber nicht dem verlinkenden Katalog.
 *
 * @param {Array<{ id?: string|null, catalogueLinks?: Array<{ targetId: string, importRootEntries?: boolean }> }>} catalogueDocuments
 * @returns {Map<string, Set<string>>} Katalog-Id → Menge der Katalog-Ids, deren Wurzel-Eintraege er importiert.
 */
export function buildRootImportClosure(catalogueDocuments) {
  return buildClosure(catalogueDocuments, link => link.importRootEntries === true);
}

/**
 * Die gemeinsame, transitive und zyklensichere Huellenbildung beider Indizes —
 * `followLink` entscheidet, welche `catalogueLink`s sie durchschreitet.
 */
function buildClosure(catalogueDocuments, followLink) {
  const byId = new Map(catalogueDocuments.filter(document => document.id !== null && document.id !== undefined)
    .map(document => [document.id, document]));

  /** @param {string} catalogueId */
  function closureOf(catalogueId, visited) {
    const hull = new Set([catalogueId]);
    if (visited.has(catalogueId)) return hull;
    visited.add(catalogueId);
    const document = byId.get(catalogueId);
    for (const link of document?.catalogueLinks ?? []) {
      if (!byId.has(link.targetId) || !followLink(link)) continue;
      for (const linkedId of closureOf(link.targetId, visited)) hull.add(linkedId);
    }
    return hull;
  }

  const closureByCatalogueId = new Map();
  for (const catalogueId of byId.keys()) {
    closureByCatalogueId.set(catalogueId, closureOf(catalogueId, new Set()));
  }
  return closureByCatalogueId;
}

/**
 * True, wenn eine Definition zum **Auswertungsumfang** irgendeines der
 * gegebenen Referenz-Kataloge gehoert (Issue 0098, Umfang nach Issue 0159) —
 * die **eine** Pruefung, die der Pflicht-Phantom-Synthese (`evalTree.js`, je
 * Kontingent ein Referenz-Katalog), der Angebots-Schicht (`offer.js`,
 * dasselbe) und der Umfangs-Diagnose belegter Auswahlen (`evalTree.js`)
 * zugrunde liegt.
 *
 * Der Umfang eines Kontingents ist **genau** sein Armeebuch, dessen transitive
 * `catalogueLink`-Huelle ({@link buildCatalogueScopeClosure}) und das
 * Spielsystem. Ein fremdes Armeebuch desselben Datensatzes liegt ausserhalb —
 * es liefert weder Definition noch Angebot mehr hinein, gleich ob es eine
 * Bibliothek ist und gleich ob Katalogdaten oder Roster das Armeebuch des
 * Kontingents genannt haben (Issue 0159 hebt die Bibliotheks-Ausnahme aus
 * Issue 0140 auf: was ein Buch braucht, verlinkt es, und dann ist es in der
 * Huelle).
 *
 * Faellt **offen** aus (liefert `true`), sobald eine Angabe fehlt, statt eine
 * unbekannte Herkunft als Ausschlussgrund zu behandeln:
 *
 * - ohne `catalogueScope` (kein Kontext mitgegeben, z. B. ein direkter
 *   Testaufruf der tieferen Schichten ohne Katalog-Bezug) — unveraendertes,
 *   ungefiltertes Verhalten;
 * - ohne bekannte Herkunft der Definition (`sourceIdByDefId` kennt sie
 *   nicht) — kein Katalog, den man ausschliessen koennte;
 * - fuer das Spielsystem selbst (`gameSystemId`) — spielsystemweite
 *   Definitionen gelten in jedem Kontingent;
 * - ohne **jeden** Referenz-Katalog (leere Menge, z. B. ein Roster ohne
 *   Kontingente oder ein Kontingent mit unbekanntem Katalog) — es gibt
 *   nichts, wogegen auszuschliessen waere.
 *
 * @param {string} defId  Die zu pruefende Definitions-Id.
 * @param {Iterable<string>} catalogueIds
 *   Die Referenz-Kataloge, gegen die geprueft wird ({@link forceCatalogueIdOf})
 *   — bei einer Force-Grenze der eine Katalog ihres Kontingents, bei einer
 *   Roster-Grenze die Kataloge aller im Roster tatsaechlich vertretenen
 *   Kontingente.
 * @param {{ sourceIdByDefId: Map<string, string>, catalogueScopeClosureById: Map<string, Set<string>>, gameSystemId: string|null }} [catalogueScope]
 * @returns {boolean}
 */
export function isInCatalogueScope(defId, catalogueIds, catalogueScope) {
  return isInClosure(defId, catalogueIds, catalogueScope, catalogueScope?.catalogueScopeClosureById);
}

/**
 * True, wenn eine **Wurzel**-Definition zum Wurzel-Angebot irgendeines der
 * gegebenen Referenz-Kataloge gehoert — dieselbe Pruefung wie
 * {@link isInCatalogueScope}, aber gegen die engere Wurzel-Import-Huelle
 * ({@link buildRootImportClosure}).
 *
 * Sie gilt genau dort, wo eine Definition **als Wurzel-Eintrag ihres Katalogs**
 * ins Spiel kommt: das Wurzel-Angebot je Kontingent (`offer.js`) und die
 * Pflicht-Phantome der Wurzel-Definitionsliste (`evalTree.js`). Ein Katalog, den
 * das Armeebuch ohne `importRootEntries="true"` verlinkt, liegt zwar im
 * Auswertungsumfang — seine Wurzel-Eintraege bleiben aber sein eigenes Angebot
 * (Issue 0098, Kriterium 3). Alles Uebrige — geteilte Eintraege, Link-Ziele,
 * Kategorien — geht ueber {@link isInCatalogueScope}.
 *
 * @param {string} defId
 * @param {Iterable<string>} catalogueIds
 * @param {{ sourceIdByDefId: Map<string, string>, rootImportClosureById: Map<string, Set<string>>, gameSystemId: string|null }} [catalogueScope]
 * @returns {boolean}
 */
export function isInRootImportScope(defId, catalogueIds, catalogueScope) {
  return isInClosure(defId, catalogueIds, catalogueScope, catalogueScope?.rootImportClosureById);
}

/**
 * Der gemeinsame Kern beider Pruefungen: dieselben Faelle des offenen Ausfalls,
 * nur je eine andere Huelle.
 */
function isInClosure(defId, catalogueIds, catalogueScope, closureById) {
  if (catalogueScope === null || catalogueScope === undefined) return true;
  // Eine Huelle, die der Kontext nicht fuehrt (ein aelterer, von Hand gebauter
  // `catalogueScope` einer Schichtenprobe), faellt offen aus wie ein fehlender
  // Kontext — nicht als Ausschluss von allem.
  if (closureById === null || closureById === undefined) return true;
  const { sourceIdByDefId, gameSystemId } = catalogueScope;
  const sourceId = sourceIdByDefId.get(defId);
  if (sourceId === undefined || sourceId === null) return true;
  if (sourceId === gameSystemId) return true;
  let hasAnyReference = false;
  for (const catalogueId of catalogueIds) {
    hasAnyReference = true;
    if (closureById.get(catalogueId)?.has(sourceId)) return true;
  }
  return !hasAnyReference;
}
