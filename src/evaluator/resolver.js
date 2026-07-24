/**
 * Resolver-Schicht (`docs/evaluator-architecture.md` §3.1), Skeleton-Umfang.
 *
 * Er materialisiert die gelesenen Definitionen zu einer rosterunabhaengigen
 * Sicht mit O(1)-Nachschlag ueber die Definitions-ID. Der volle Umfang
 * (ID-Verweise/Importe/Link-Ketten ueber Katalog-Grenzen, Dokumentreihenfolge)
 * folgt in spaeteren Scheiben; hier wird nur der flache Definitionsbaum
 * indiziert und doppelte IDs werden als Diagnose sichtbar gemacht.
 */

import { DiagnosticKind, diagnostic } from './model.js';

/** Traegt jede Definition des Baums rekursiv in die ID-Karte ein. */
function indexDefinition(definition, byId, diagnostics) {
  if (byId.has(definition.id)) {
    diagnostics.push(diagnostic(DiagnosticKind.DUPLICATE_DEFINITION, { definitionId: definition.id }));
  } else {
    byId.set(definition.id, definition);
  }
  for (const child of definition.children) {
    indexDefinition(child, byId, diagnostics);
  }
}

/**
 * Loest einen gelesenen Katalog zu einer nachschlagbaren, unveraenderlichen
 * Sicht auf.
 *
 * @param {{ entries: object[] }} catalogue Ergebnis von `parseCatalogue`.
 * @returns {{ lookup: (id: string) => object|null, diagnostics: object[] }}
 */
export function resolveCatalogue(catalogue) {
  const byId = new Map();
  const diagnostics = [];
  for (const entry of catalogue.entries) {
    indexDefinition(entry, byId, diagnostics);
  }
  return {
    lookup: id => byId.get(id) ?? null,
    diagnostics,
  };
}
