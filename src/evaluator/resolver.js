/**
 * Resolver-Schicht (`docs/evaluator-architecture.md` §3.1), Skeleton-Umfang.
 *
 * Er materialisiert die gelesenen Definitionen zu einer rosterunabhaengigen
 * Sicht mit O(1)-Nachschlag ueber die Definitions-ID. Indiziert werden Eintraege,
 * Kontingente (`forceEntries`) und Kategorien (`categoryEntries`); die
 * Kategorie-IDs werden zusaetzlich als Menge gefuehrt, damit das Query-Primitiv
 * ein Kategorie-Ziel von einem Eintrags-Ziel unterscheiden kann (Ziel-Typ-Regel
 * §7.7). Der volle Umfang (ID-Verweise/Importe/Link-Ketten ueber Katalog-Grenzen,
 * Dokumentreihenfolge) folgt in spaeteren Scheiben; hier wird nur der flache
 * Definitionsbaum indiziert und doppelte IDs werden als Diagnose sichtbar gemacht.
 */

import { DefinitionKind, DiagnosticKind, diagnostic } from './model.js';

/** Traegt jede Definition des Baums rekursiv in die ID-Karte (und Kategorie-Menge) ein. */
function indexDefinition(definition, byId, categoryIds, diagnostics) {
  if (byId.has(definition.id)) {
    diagnostics.push(diagnostic(DiagnosticKind.DUPLICATE_DEFINITION, { definitionId: definition.id }));
  } else {
    byId.set(definition.id, definition);
    if (definition.kind === DefinitionKind.CATEGORY) {
      categoryIds.add(definition.id);
    }
  }
  for (const child of definition.children) {
    indexDefinition(child, byId, categoryIds, diagnostics);
  }
}

/**
 * Loest einen gelesenen Katalog zu einer nachschlagbaren, unveraenderlichen
 * Sicht auf.
 *
 * @param {{ entries: object[], forces?: object[], categories?: object[] }} catalogue Ergebnis von `parseCatalogue`.
 * @returns {{ lookup: (id: string) => object|null, definitions: object[], categoryIds: Set<string>, diagnostics: object[] }}
 *   `definitions` sind alle eindeutigen Definitionen (Eintraege, Kontingente,
 *   Kategorien inkl. geschachtelter) — die Join-Schicht braucht sie, um
 *   Phantomknoten fuer Pflichtdefinitionen ohne Instanz zu synthetisieren.
 */
export function resolveCatalogue(catalogue) {
  const byId = new Map();
  const categoryIds = new Set();
  const diagnostics = [];
  const allDefinitions = [
    ...catalogue.entries,
    ...(catalogue.forces ?? []),
    ...(catalogue.categories ?? []),
  ];
  for (const definition of allDefinitions) {
    indexDefinition(definition, byId, categoryIds, diagnostics);
  }
  return {
    lookup: id => byId.get(id) ?? null,
    definitions: [...byId.values()],
    categoryIds,
    diagnostics,
  };
}
