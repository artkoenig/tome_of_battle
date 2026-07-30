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
 * Armeebuch, und die `.gst` ist keines. Ein Datensatz, der seine Kontingente in
 * der Spielsystemdatei deklariert, laesst den Rahmen darum unaufgeloest — das
 * Query-Primitiv meldet ihn dann fail-closed als `unresolvedScope`, statt still
 * ein Armeebuch zu erfinden (Issue 077, Decisions).
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
 * - ohne **jeden** Referenz-Katalog (leere Menge, z. B. ein Roster ohne
 *   Kontingente oder ein Kontingent mit unbekanntem Katalog) — es gibt
 *   nichts, wogegen auszuschliessen waere.
 *
 * @param {string} defId  Die zu pruefende Definitions-Id.
 * @param {Iterable<string>} referenceCatalogueIds  Die Katalog-Id(s), gegen
 *   die geprueft wird — bei einer Force-Grenze ihr eigener Katalog (hoechstens
 *   einer), bei einer Roster-Grenze alle Kataloge der im Roster tatsaechlich
 *   vertretenen Kontingente.
 * @param {{ sourceIdByDefId: Map<string, string>, catalogueRootEntryClosureById: Map<string, Set<string>>, gameSystemId: string|null }} [catalogueScope]
 * @returns {boolean}
 */
export function isInCatalogueScope(defId, referenceCatalogueIds, catalogueScope) {
  if (catalogueScope === null || catalogueScope === undefined) return true;
  const { sourceIdByDefId, catalogueRootEntryClosureById, gameSystemId } = catalogueScope;
  const sourceId = sourceIdByDefId.get(defId);
  if (sourceId === undefined || sourceId === null) return true;
  if (sourceId === gameSystemId) return true;
  let hasAnyReference = false;
  for (const catalogueId of referenceCatalogueIds) {
    hasAnyReference = true;
    if (catalogueRootEntryClosureById.get(catalogueId)?.has(sourceId)) return true;
  }
  return !hasAnyReference;
}
