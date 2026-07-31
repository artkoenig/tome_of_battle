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
  'diagnostics',
]);

/**
 * Fuehrt die gelesenen Dokumente in der uebergebenen Reihenfolge zu einem
 * katalog-foermigen Aggregat zusammen (reine, seiteneffektfreie Aggregation).
 *
 * @param {Array<{ entries?: object[], forces?: object[], categories?: object[], sharedEntries?: object[], infos?: object[], profileTypes?: object[], diagnostics?: object[] }>} documents
 *   Die gelesenen Dokumente, bereits in deterministischer Reihenfolge (Spielsystem
 *   zuerst, dann die Kataloge in Aufruf-Reihenfolge).
 * @returns {{ entries: object[], forces: object[], categories: object[], sharedEntries: object[], infos: object[], profileTypes: object[], diagnostics: object[] }}
 */
export function mergeCatalogues(documents) {
  const merged = { entries: [], forces: [], categories: [], sharedEntries: [], infos: [], profileTypes: [], diagnostics: [] };
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
 * diese Id einen Wurzel-Angebots-Fussabdruck ({@link
 * buildCatalogueRootEntryClosure}) — genau die Menge, gegen die spaeter
 * geprueft wird. Ist **gar keine** Registratur mitgegeben (ein direkter Aufruf
 * der tieferen Schichten ohne Katalog-Bezug), ist die Angabe nicht
 * nachpruefbar und wird unveraendert uebernommen.
 *
 * @param {{ catalogueId?: string|null }|null|undefined} instance  der
 *   Kontingent-Knoten des Eingabe-Rosters.
 * @param {{ has: (id: string) => boolean }|null|undefined} [knownCatalogueIds]
 *   die Katalog-Ids, die der Datensatz fuehrt (typischerweise
 *   `catalogueRootEntryClosureById`).
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
 * stellen.
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
 * Schweigen beide, ist die Antwort `undefined` — die Aufrufer fallen dann offen
 * aus (Filterung) bzw. fail-closed (`primary-catalogue`), jeder wie bisher.
 *
 * Die Antwort ist **je Knoten**, nicht je Definition: zwei Kontingente
 * derselben `.gst`-Definition koennen zu zwei verschiedenen Armeebuechern
 * gehoeren (Verbuendete).
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
  return forceNode?.declaredCatalogueId ?? undefined;
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
 * Baut den **Wurzel-Angebots-Fussabdruck** je Katalog (`Map<catalogueId,
 * Set<catalogueId>>`, Issue 0098): die Menge der Katalog-Ids, deren
 * Wurzel-Eintraege und -Forces zum Angebot **dieses** Katalogs gehoeren — er
 * selbst, plus transitiv und zyklensicher jeder Katalog, den er per
 * `catalogueLink` mit `importRootEntries="true"` importiert.
 *
 * Ohne `importRootEntries="true"` ist ein `catalogueLink` laut XSD-Vorgabe
 * (Default `false`) eine reine Abhaengigkeits-Deklaration (ADR-0032): er
 * traegt den verlinkten Katalog in den Datensatz, ohne dessen Wurzel-Angebot
 * zu uebernehmen. Nur ein Katalog mit eigener Wurzel-Id nimmt am
 * Fussabdruck teil — ein Katalog ohne sie bekommt keinen Eintrag und gilt
 * ueberall dort, wo dieser Index nachgeschlagen wird, als unbekannt (siehe
 * Aufrufer).
 *
 * @param {Array<{ id?: string|null, catalogueLinks?: Array<{ targetId: string, importRootEntries: boolean }> }>} catalogueDocuments
 *   Die gelesenen **Katalog**-Dokumente (`.cat`) in Aufruf-Reihenfolge.
 * @returns {Map<string, Set<string>>} Katalog-Id → Menge der Katalog-Ids in ihrem Fussabdruck.
 */
export function buildCatalogueRootEntryClosure(catalogueDocuments) {
  const byId = new Map(catalogueDocuments.filter(document => document.id !== null && document.id !== undefined)
    .map(document => [document.id, document]));

  /** @param {string} catalogueId */
  function closureOf(catalogueId, visited) {
    const footprint = new Set([catalogueId]);
    if (visited.has(catalogueId)) return footprint;
    visited.add(catalogueId);
    const document = byId.get(catalogueId);
    for (const link of document?.catalogueLinks ?? []) {
      if (!link.importRootEntries) continue;
      if (!byId.has(link.targetId)) continue;
      for (const importedId of closureOf(link.targetId, visited)) footprint.add(importedId);
    }
    return footprint;
  }

  const closureByCatalogueId = new Map();
  for (const catalogueId of byId.keys()) {
    closureByCatalogueId.set(catalogueId, closureOf(catalogueId, new Set()));
  }
  return closureByCatalogueId;
}

/**
 * Baut die Menge der **Bibliothekskataloge** des Datensatzes (`library="true"`,
 * Issue 0140): die Katalog-Ids, deren Angebote in **jedem** Kontingent gelten.
 *
 * Ein Bibliothekskatalog ist kein Armeebuch, sondern ein geteilter Vorrat, den
 * die Armeebuecher benutzen (Soeldner, Regiments of Renown). Er ist deshalb nie
 * ein *fremdes* Armeebuch und wird von {@link isInCatalogueScope} ebenso
 * ausgenommen wie das Spielsystem — sonst verloere ein Kontingent, dessen
 * Definition in der `.gst` steht, seine Bibliotheksangebote (der Vertrag aus
 * Issue 0121, Task 19, Punkt 5 und Issue 0135, Kriterium 10).
 *
 * Ein Katalog **ohne** eigene Wurzel-Id nimmt nicht teil: seine Definitionen
 * tragen ohnehin keine Herkunft, gegen die zu pruefen waere. Ein fehlendes oder
 * unlesbares `library`-Kennzeichen zaehlt als „kein Bibliothekskatalog" — die
 * XSD-Vorgabe ist `false` (`catalogReader.js`), und die Ausnahme darf nur
 * hinzufuegen, was belegt ist.
 *
 * @param {Array<{ id?: string|null, isLibrary?: boolean }>} catalogueDocuments
 *   Die gelesenen **Katalog**-Dokumente (`.cat`) in Aufruf-Reihenfolge.
 * @returns {Set<string>} Die Ids der Bibliothekskataloge.
 */
export function buildLibraryCatalogueIds(catalogueDocuments) {
  const ids = new Set();
  for (const document of catalogueDocuments) {
    if (document.id === null || document.id === undefined) continue;
    if (document.isLibrary === true) ids.add(document.id);
  }
  return ids;
}

/**
 * Baut je Katalog die Menge der Kataloge, ueber die er sich **ausdruecklich
 * geaeussert** hat: die Ziele seiner `catalogueLink`s, unabhaengig von
 * `importRootEntries` (`Map<catalogueId, Set<catalogueId>>`, Issue 0140).
 *
 * Er sagt, wo die Bibliotheks-Ausnahme in {@link isInCatalogueScope} **nicht**
 * greift. Ein `catalogueLink` ist die Aussage eines Armeebuchs ueber genau
 * diesen anderen Katalog; ob es dessen Wurzel-Angebot uebernimmt, sagt
 * `importRootEntries`, und diese Aussage gilt (Issue 0098, Kriterium 3) — auch
 * fuer eine Bibliothek. Wo ein Armeebuch dagegen **gar nichts** gesagt hat,
 * gibt es keine Aussage zu achten, und ein geteilter Vorrat bleibt geteilt.
 *
 * Nur **direkte** Links zaehlen: eine Aussage ueber einen Katalog trifft, wer
 * sie hinschreibt; die transitive Kette bildet der Fussabdruck ab
 * ({@link buildCatalogueRootEntryClosure}).
 *
 * @param {Array<{ id?: string|null, catalogueLinks?: Array<{ targetId: string }> }>} catalogueDocuments
 *   Die gelesenen **Katalog**-Dokumente (`.cat`) in Aufruf-Reihenfolge.
 * @returns {Map<string, Set<string>>} Katalog-Id → Ids der von ihm verlinkten Kataloge.
 */
export function buildDeclaredCatalogueLinkIndex(catalogueDocuments) {
  /** @type {Map<string, Set<string>>} */
  const byCatalogueId = new Map();
  for (const document of catalogueDocuments) {
    if (document.id === null || document.id === undefined) continue;
    const targets = byCatalogueId.get(document.id) ?? new Set();
    for (const link of document.catalogueLinks ?? []) targets.add(link.targetId);
    byCatalogueId.set(document.id, targets);
  }
  return byCatalogueId;
}

/**
 * True, wenn eine Definition zum Katalog-Fussabdruck **irgendeines** der
 * gegebenen Referenz-Kataloge gehoert (Issue 0098) — die **eine** Pruefung,
 * die sowohl der Pflicht-Phantom-Synthese (`evalTree.js`, je Kontingent ein
 * Referenz-Katalog) als auch der Angebots-Schicht (`offer.js`, dasselbe)
 * zugrunde liegt.
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
 *   Wurzel-Eintraege gelten in jedem Kontingent;
 * - fuer einen **Bibliothekskatalog**, ueber den der Referenz-Katalog nichts
 *   gesagt hat (`libraryCatalogueIds` + `linkedCatalogueIdsById`, Issue 0140) —
 *   eine Bibliothek ist kein Armeebuch, sondern ein geteilter Vorrat, den jedes
 *   Armeebuch benutzt; sie kann deshalb nie das *fremde* Armeebuch sein, gegen
 *   das dieser Rahmen schuetzt (derselbe Grund wie beim Spielsystem, und der
 *   schon festgelegte Vertrag aus Issue 0121/0135: Spielsystem- und
 *   Bibliothekseintraege erscheinen ueberall).
 *
 *   **Die Grenze der Ausnahme:** hat das Armeebuch die Bibliothek per
 *   `catalogueLink` ausdruecklich benannt, gilt seine Aussage — dann
 *   entscheidet allein `importRootEntries` ueber ihr Wurzel-Angebot (Issue
 *   0098, Kriterium 3, dort mit einer `library="true"`-Quelle belegt). Die
 *   Ausnahme greift also genau dort, wo **keine** Aussage vorliegt: unstated
 *   ist kein Ausschlussgrund, hingeschrieben schon. Fehlt eine der beiden
 *   Mengen, wird nichts zusaetzlich ausgeschlossen;
 * - ohne **jeden** Referenz-Katalog (leere Menge, z. B. ein Roster ohne
 *   Kontingente oder ein Kontingent mit unbekanntem Katalog) — es gibt
 *   nichts, wogegen auszuschliessen waere.
 *
 * @param {string} defId  Die zu pruefende Definitions-Id.
 * @param {Iterable<string>} referenceCatalogueIds  Die Katalog-Id(s), gegen
 *   die geprueft wird — bei einer Force-Grenze ihr eigener Katalog (hoechstens
 *   einer), bei einer Roster-Grenze alle Kataloge der im Roster tatsaechlich
 *   vertretenen Kontingente. Woher der Katalog eines Kontingents kommt,
 *   beantwortet {@link forceCatalogueIdOf} — Herkunftsindex vor Angabe des
 *   Rosters.
 * @param {{ sourceIdByDefId: Map<string, string>, catalogueRootEntryClosureById: Map<string, Set<string>>, gameSystemId: string|null, libraryCatalogueIds?: Set<string>, linkedCatalogueIdsById?: Map<string, Set<string>> }} [catalogueScope]
 * @returns {boolean}
 */
export function isInCatalogueScope(defId, referenceCatalogueIds, catalogueScope) {
  if (catalogueScope === null || catalogueScope === undefined) return true;
  const {
    sourceIdByDefId, catalogueRootEntryClosureById, gameSystemId,
    libraryCatalogueIds, linkedCatalogueIdsById,
  } = catalogueScope;
  const sourceId = sourceIdByDefId.get(defId);
  if (sourceId === undefined || sourceId === null) return true;
  if (sourceId === gameSystemId) return true;
  const isFromLibrary = libraryCatalogueIds?.has(sourceId) === true;
  let hasAnyReference = false;
  for (const catalogueId of referenceCatalogueIds) {
    hasAnyReference = true;
    if (catalogueRootEntryClosureById.get(catalogueId)?.has(sourceId)) return true;
    // Eine Bibliothek, ueber die genau dieses Armeebuch nichts gesagt hat:
    // geteilter Vorrat, kein fremdes Buch.
    if (isFromLibrary && linkedCatalogueIdsById?.get(catalogueId)?.has(sourceId) !== true) return true;
  }
  return !hasAnyReference;
}
