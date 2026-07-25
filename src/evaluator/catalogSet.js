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
 */

/** Die je-Dokument-Sammlungen, die zu je einer Aggregat-Liste konkateniert werden. */
const MERGED_COLLECTIONS = Object.freeze([
  'entries',
  'forces',
  'categories',
  'sharedEntries',
  'infos',
  'diagnostics',
]);

/**
 * Fuehrt die gelesenen Dokumente in der uebergebenen Reihenfolge zu einem
 * katalog-foermigen Aggregat zusammen (reine, seiteneffektfreie Aggregation).
 *
 * @param {Array<{ entries?: object[], forces?: object[], categories?: object[], sharedEntries?: object[], infos?: object[], diagnostics?: object[] }>} documents
 *   Die gelesenen Dokumente, bereits in deterministischer Reihenfolge (Spielsystem
 *   zuerst, dann die Kataloge in Aufruf-Reihenfolge).
 * @returns {{ entries: object[], forces: object[], categories: object[], sharedEntries: object[], infos: object[], diagnostics: object[] }}
 */
export function mergeCatalogues(documents) {
  const merged = { entries: [], forces: [], categories: [], sharedEntries: [], infos: [], diagnostics: [] };
  for (const document of documents) {
    for (const name of MERGED_COLLECTIONS) {
      merged[name].push(...(document[name] ?? []));
    }
  }
  return merged;
}
