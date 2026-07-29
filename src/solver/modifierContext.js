/**
 * Der eine getippte Builder des flachen Modifier-Auswertungs-Kontexts.
 *
 * Der Kontext wandert als flaches, spread-fähiges Objekt durch die gesamte
 * Modifier-Auswertung (`modifierEvaluator.js` liest ihn wert-basiert; nachgelagerte
 * Stellen spread-erweitern ihn, z. B. um `_resolvingSelfScopeCategory`). Vor diesem
 * Builder wurde er an rund einem Dutzend Stellen von Hand zusammengebaut, mit über
 * die Aufrufer driftenden Feldern und einer doppelten Durchreichung der Zähltabellen.
 *
 * Für die Kategorie-/Selektions-Zählungen existieren drei Semantiken; der Builder
 * macht die Quelle **explizit** und schließt die Doppel-Durchreichung konstruktiv aus:
 *
 * 1. **`counts`** — die vollständigen, vorberechneten Zähltabellen aus
 *    `computeRosterCounts` (Validierungs-Pfad). Der Leser (`toQueryContext`) leitet
 *    daraus selbst armeeweite und kontingentweite Sichten ab.
 * 2. **`categorySlices`** — vorab extrahierte Scheiben (`selectionCounts`,
 *    `forceCategoryCounts`), **wörtlich** übernommen: auch der `null`-Sentinel
 *    („bewusst ohne Kategorie-Zählung", siehe `collectPrimaryCategoryEntries`) und
 *    die noch veränderlichen Tabellen mitten im Zähl-Lauf (`computeRosterCounts`)
 *    werden unverändert — ohne Kopie, ohne Default — weitergereicht.
 * 3. **keine** — ein zählungsloser Kontext (z. B. der Fabrik-Kontext der
 *    Aushebe-Verfügbarkeit); der Leser nähert dann wie eh und je an.
 *
 * `counts` und `categorySlices` zugleich sind ein Programmierfehler und werfen —
 * genau ein Leser-Vertrag pro Kontext, erzwungen am Bauort, nicht am Leser.
 */

/**
 * @typedef {Object} ModifierEvalContext Der flache Kontext der Modifier-Auswertung.
 * @property {Object|null} roster   das aktuelle Roster (oder null/undefined, wenn keins geladen ist).
 * @property {Object|null} system   das geparste Spielsystem (gst + Kataloge).
 * @property {Object|null} selection        die Auswahl, an der die Bedingung hängt.
 * @property {Object|null} parentSelection  ihre Eltern-Auswahl (bewusst weglassbar, s. Aufrufer).
 * @property {Object|null} force            das Kontingent, in dem ausgewertet wird.
 * @property {string|null} parentCatalogueId  Katalog, gegen den Eintrags-Verweise auflösen
 *   (siehe `resolveContextCatalogueId`).
 * @property {Object} [counts]  die vollständigen Zähltabellen (nur Quelle 1).
 * @property {Record<string, number>} [selectionCounts]  armeeweite Selektions-Zähler (nur Quelle 2).
 * @property {Record<string, number>|null} [forceCategoryCounts]  Kategorie-Zähler der
 *   betrachteten Sicht, inkl. `null`-Sentinel (nur Quelle 2).
 */

/**
 * Baut einen {@link ModifierEvalContext}. Die Zählquelle ist explizit: entweder die
 * vollständigen Tabellen (`counts`), oder wörtliche Scheiben (`categorySlices`), oder
 * keine — nie beides zugleich.
 *
 * @param {Object} parts
 * @param {Object|null} [parts.roster]
 * @param {Object|null} [parts.system]
 * @param {Object|null} [parts.selection]
 * @param {Object|null} [parts.parentSelection]
 * @param {Object|null} [parts.force]
 * @param {string|null} [parts.parentCatalogueId]
 * @param {Object|null} [parts.counts]  vollständige Zähltabellen (`computeRosterCounts`);
 *   `null` gilt als „keine" (z. B. Profil-Sammlung ohne Roster).
 * @param {{selectionCounts: (Record<string, number>|undefined),
 *   forceCategoryCounts: (Record<string, number>|null|undefined)}} [parts.categorySlices]
 *   wörtliche Zähl-Scheiben, unverändert übernommen (inkl. `null`-Sentinel und
 *   veränderlicher Tabellen mitten im Zähl-Lauf).
 * @returns {ModifierEvalContext}
 */
export function buildModifierEvalContext({
  roster, system, selection, parentSelection, force, parentCatalogueId,
  counts, categorySlices
} = {}) {
  if (counts && categorySlices) {
    throw new Error(
      'buildModifierEvalContext: `counts` und `categorySlices` schließen sich aus — ein Leser-Vertrag pro Kontext.'
    );
  }

  /** @type {ModifierEvalContext} */
  const context = { roster, system, selection, parentSelection, force, parentCatalogueId };
  if (counts) {
    context.counts = counts;
  } else if (categorySlices) {
    context.selectionCounts = categorySlices.selectionCounts;
    context.forceCategoryCounts = categorySlices.forceCategoryCounts;
  }
  return context;
}
