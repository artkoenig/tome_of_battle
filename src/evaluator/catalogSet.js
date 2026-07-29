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
 * Genau **weil** das Aggregat die Herkunft einlegt, baut dieses Modul daneben den
 * **Herkunftsindex der Kontingente** ({@link buildPrimaryCatalogueIndex}): der
 * Bezugsrahmen `primary-catalogue` fragt nach dem Armeebuch, aus dem das
 * umschliessende Kontingent stammt (Issue 077), und diese Angabe kennen nur die
 * einzelnen Dokumente.
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
  // Dasselbe gilt fuer die Kostenart- und Publikations-Deklarationen (Issue 0102):
  // beide stehen ueblicherweise im Spielsystem, waehrend die Modifikatoren bzw.
  // `publicationId`-Verweise in den Katalogen liegen — der Resolver registriert
  // jede deklarierte Kostenart als Modifier-Ziel, die Info-Projektion loest die
  // Buchquellen ueber die Deklarationen auf.
  'costTypes',
  'publications',
  'diagnostics',
]);

/**
 * Fuehrt die gelesenen Dokumente in der uebergebenen Reihenfolge zu einem
 * katalog-foermigen Aggregat zusammen (reine, seiteneffektfreie Aggregation).
 *
 * @param {Array<{ entries?: object[], forces?: object[], categories?: object[], sharedEntries?: object[], infos?: object[], profileTypes?: object[], costTypes?: object[], publications?: object[], diagnostics?: object[] }>} documents
 *   Die gelesenen Dokumente, bereits in deterministischer Reihenfolge (Spielsystem
 *   zuerst, dann die Kataloge in Aufruf-Reihenfolge).
 * @returns {{ entries: object[], forces: object[], categories: object[], sharedEntries: object[], infos: object[], profileTypes: object[], costTypes: object[], publications: object[], diagnostics: object[] }}
 */
export function mergeCatalogues(documents) {
  const merged = { entries: [], forces: [], categories: [], sharedEntries: [], infos: [], profileTypes: [], costTypes: [], publications: [], diagnostics: [] };
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
