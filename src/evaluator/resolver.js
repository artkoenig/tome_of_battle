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
 *
 * Zusaetzlich baut er eine **globale `id → TargetDescriptor`-Symboltabelle** aus
 * allen Kostenart- und allen Constraint-IDs (mit Disjunktheits-Guard) und loest
 * damit jeden Modifikator-`field` **genau einmal** in sein Ziel auf. Der `field`
 * bleibt roh (xs:string, ADR-0016); die Zuordnung ist statisch und haengt nicht
 * vom effektiven Zustand ab, wird also vor der Fixpunktschleife einmal berechnet
 * (Clean-Room-Abgleich Q1).
 */

import { DefinitionKind, InfoElementKind, ModifierTargetKind, DiagnosticKind, diagnostic } from './model.js';

/** Schluesselwort-`field`-Werte, die das Ziel unmittelbar (ohne Symboltabelle) benennen. */
const FieldKeyword = Object.freeze({
  CATEGORY: 'category',
  HIDDEN: 'hidden',
});

/**
 * Muster einer BattleScribe-Verweis-ID (vier Vierergruppen, z. B.
 * `ecfa-8486-4f6c-c249`). Ein `field`, das diesem Muster folgt, aber in der
 * Symboltabelle fehlt, ist ein **baumelnder** Verweis (Diagnose) — kein
 * Textfeld-Hinweis.
 */
const REFERENCE_ID_PATTERN = /^[0-9a-fA-F]{4}(-[0-9a-fA-F]{4}){3}$/;

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
 * Baut die globale `id → TargetDescriptor`-Symboltabelle aus allen Kostenart-IDs
 * (→ COST) und allen Constraint-IDs (→ LIMIT) der indizierten Definitionen. Ein
 * **Disjunktheits-Guard** meldet jede Ueberschneidung: nur bei disjunktem ID-Raum
 * ist die ID ihr eigener Diskriminator (COST vs LIMIT).
 */
function buildTargetSymbolTable(definitions, diagnostics) {
  const symbolTable = new Map();
  for (const definition of definitions) {
    for (const costTypeId of Object.keys(definition.costs ?? {})) {
      symbolTable.set(costTypeId, { kind: ModifierTargetKind.COST, id: costTypeId });
    }
  }
  for (const definition of definitions) {
    for (const limit of definition.limits ?? []) {
      if (symbolTable.has(limit.id) && symbolTable.get(limit.id).kind === ModifierTargetKind.COST) {
        diagnostics.push(diagnostic(DiagnosticKind.MODIFIER_TARGET_COLLISION, { targetId: limit.id }));
        continue;
      }
      symbolTable.set(limit.id, { kind: ModifierTargetKind.LIMIT, id: limit.id });
    }
  }
  return symbolTable;
}

/**
 * Loest den rohen `field` eines Modifikators **einmal** in seinen
 * `TargetDescriptor` auf. Praezedenz: Schluesselwort zuerst (`category`→CATEGORY,
 * `hidden`→HIDDEN), sonst ein Treffer in der Symboltabelle (Kostenart→COST,
 * Constraint→LIMIT). Ein verbleibender Verweis, der wie eine ID aussieht, aber
 * nirgends aufloest, wird als **baumelnder** Verweis gemeldet (kein Ziel);
 * jeder andere Text ist ein Hinweis-Ziel (NOTE).
 *
 * @returns {{ kind: string, id: string|null }|null} das Ziel, oder `null` bei baumelndem Verweis.
 */
function resolveModifierTarget(field, symbolTable, diagnostics) {
  if (field === FieldKeyword.CATEGORY) return { kind: ModifierTargetKind.CATEGORY, id: null };
  if (field === FieldKeyword.HIDDEN) return { kind: ModifierTargetKind.HIDDEN, id: null };

  const symbol = symbolTable.get(field);
  if (symbol !== undefined) return symbol;

  if (typeof field === 'string' && REFERENCE_ID_PATTERN.test(field)) {
    diagnostics.push(diagnostic(DiagnosticKind.DANGLING_MODIFIER_TARGET, { field }));
    return null;
  }
  return { kind: ModifierTargetKind.NOTE, id: null };
}

/** Reichert jeden Modifikator einer Liste mit seinem aufgeloesten `TargetDescriptor` an. */
function resolveModifierList(modifiers, symbolTable, diagnostics) {
  for (const modifier of modifiers) {
    modifier.target = resolveModifierTarget(modifier.field, symbolTable, diagnostics);
  }
}

/**
 * Reichert eine Modifikatorgruppe **rekursiv** an: ihre eigenen gebuendelten
 * Modifikatoren und die aller verschachtelten Untergruppen (beliebige Tiefe).
 * Ohne diese Rekursion bliebe ein Modifikator einer inneren Gruppe ohne
 * `.target`, und die Apply-Schicht griffe auf `undefined.kind` zu.
 */
function resolveModifierGroup(group, symbolTable, diagnostics) {
  resolveModifierList(group.modifiers, symbolTable, diagnostics);
  for (const nestedGroup of group.modifierGroups ?? []) {
    resolveModifierGroup(nestedGroup, symbolTable, diagnostics);
  }
}

/**
 * Reichert jeden Modifikator jeder Definition mit seinem einmal aufgeloesten
 * `TargetDescriptor` an (`modifier.target`) — die eigenstaendigen Modifikatoren
 * **und** die von Modifikatorgruppen gebuendelten, verschachtelte Untergruppen
 * eingeschlossen (Slice 02, Kontrakt `ModifierGroupDef`). Baumelnde Verweise
 * tragen `null` — die Apply-Schicht ueberspringt sie stumm, weil die Diagnose
 * hier bereits gemeldet ist.
 */
function resolveModifierTargets(definitions, symbolTable, diagnostics) {
  for (const definition of definitions) {
    resolveModifierList(definition.modifiers ?? [], symbolTable, diagnostics);
    for (const group of definition.modifierGroups ?? []) {
      resolveModifierGroup(group, symbolTable, diagnostics);
    }
  }
}

/**
 * Sammelt die Info-Elemente aller Wurzeln, an denen sie haengen: die katalogweit
 * geteilten (`catalogue.infos`) und die je Definition (`definition.infos`, ueber
 * Eintraege/Kontingente/Kategorien inkl. geschachtelter, die bereits alle in
 * `definitions` stehen). Nur die oberste Ebene — die Rekursion in Info-Gruppen
 * uebernehmen die Indizierung und die Link-Aufloesung selbst.
 */
function collectInfoRoots(catalogue, definitions) {
  const roots = [...(catalogue.infos ?? [])];
  for (const definition of definitions) {
    roots.push(...(definition.infos ?? []));
  }
  return roots;
}

/**
 * Traegt eine Info-**Definition** (Profil/Regel/Info-Gruppe) rekursiv in die
 * ID-Karte ein, damit `lookup(targetId)` sie findet. Info-Gruppen indizieren ihre
 * verschachtelten Elemente mit. Info-**Links** sind Verweise, keine Definitionen —
 * sie werden nicht indiziert. Eine doppelte ID wird als Diagnose sichtbar.
 */
function indexInfoElement(info, byId, diagnostics) {
  if (info.kind === InfoElementKind.INFO_LINK) return;
  if (byId.has(info.id)) {
    diagnostics.push(diagnostic(DiagnosticKind.DUPLICATE_DEFINITION, { definitionId: info.id }));
  } else {
    byId.set(info.id, info);
  }
  if (info.kind === InfoElementKind.INFO_GROUP) {
    for (const nested of info.infos) indexInfoElement(nested, byId, diagnostics);
  }
}

/**
 * Loest einen `infoLink` ueber `lookup(targetId)` auf sein Ziel (Profil/Regel/
 * Info-Gruppe) auf und macht das verlinkte Element als `info.resolved` verfuegbar.
 * Ein Ziel, das nirgends indiziert ist, ist ein **baumelnder** Verweis (Diagnose,
 * `resolved` bleibt `null`). In einer Info-Gruppe verschachtelte Links werden
 * mit aufgeloest.
 */
function resolveInfoElement(info, byId, diagnostics) {
  if (info.kind === InfoElementKind.INFO_LINK) {
    const target = byId.get(info.targetId) ?? null;
    if (target === null) {
      diagnostics.push(diagnostic(DiagnosticKind.DANGLING_INFO_LINK, { targetId: info.targetId }));
    }
    info.resolved = target;
    return;
  }
  if (info.kind === InfoElementKind.INFO_GROUP) {
    for (const nested of info.infos) resolveInfoElement(nested, byId, diagnostics);
  }
}

/**
 * Indiziert alle Info-Definitionen in die ID-Karte und loest anschliessend alle
 * `infoLink`-Verweise auf. Zwei Durchgaenge, damit ein Link ein Ziel unabhaengig
 * von dessen Dokumentposition findet.
 */
function indexAndResolveInfos(catalogue, definitions, byId, diagnostics) {
  const infoRoots = collectInfoRoots(catalogue, definitions);
  for (const info of infoRoots) indexInfoElement(info, byId, diagnostics);
  for (const info of infoRoots) resolveInfoElement(info, byId, diagnostics);
}

/**
 * Loest einen gelesenen Katalog zu einer nachschlagbaren, unveraenderlichen
 * Sicht auf.
 *
 * @param {{ entries: object[], forces?: object[], categories?: object[], infos?: object[] }} catalogue Ergebnis von `parseCatalogue`.
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
  const definitions = [...byId.values()];
  const symbolTable = buildTargetSymbolTable(definitions, diagnostics);
  resolveModifierTargets(definitions, symbolTable, diagnostics);
  // Info-Definitionen zusaetzlich indizieren und `infoLink`s aufloesen. `definitions`
  // (Eintraege/Kontingente/Kategorien fuer die Join-Schicht) wird vorher fixiert,
  // damit die Info-Definitionen zwar per `lookup` auffindbar sind, die Definitionsliste
  // aber unveraendert bleibt.
  indexAndResolveInfos(catalogue, definitions, byId, diagnostics);
  return {
    lookup: id => byId.get(id) ?? null,
    definitions,
    categoryIds,
    diagnostics,
  };
}
