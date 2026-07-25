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

/** Die Definitionsarten, die als Pflicht-Phantom-Anker taugen (anwaehlbare Definitionen). */
const PHANTOM_DEFINITION_KINDS = Object.freeze(new Set([
  DefinitionKind.ENTRY,
  DefinitionKind.FORCE,
  DefinitionKind.CATEGORY,
]));

/**
 * Traegt eine Definition und ihren ganzen Teilbaum (Eintraege, Gruppen, Links)
 * rekursiv in die **globale** `id → Definition`-Tabelle ein und sammelt dabei die
 * fuer die spaeteren Auflösungs-Durchgaenge benoetigten Knoten:
 *
 * - jede Definition (fuer Symboltabelle und Modifikator-Auflösung),
 * - jeden `entryLink` (fuer die transitive Ziel-Auflösung),
 * - die Info-Elemente jedes Knotens (fuer Indizierung/`infoLink`-Auflösung).
 *
 * Eine doppelte ID wird als Diagnose sichtbar (der erste Eintrag gewinnt); die
 * Traversierung setzt trotzdem fort, damit der restliche Teilbaum indiziert wird.
 */
function collectDefinition(definition, collector) {
  const { byId, categoryIds, diagnostics } = collector;
  if (byId.has(definition.id)) {
    diagnostics.push(diagnostic(DiagnosticKind.DUPLICATE_DEFINITION, { definitionId: definition.id }));
  } else {
    byId.set(definition.id, definition);
    if (definition.kind === DefinitionKind.CATEGORY) {
      categoryIds.add(definition.id);
    }
  }
  collector.definitionNodes.push(definition);
  if (definition.kind === DefinitionKind.ENTRY_LINK) {
    collector.entryLinks.push(definition);
  }
  for (const info of definition.infos ?? []) {
    collector.infoRoots.push(info);
  }
  for (const child of definition.children ?? []) {
    collectDefinition(child, collector);
  }
}

/**
 * Sammelt die **Wurzel-Definitionsliste** fuer die Pflicht-Phantom-Synthese: die
 * anwaehlbaren Definitionen (Eintrag/Kontingent/Kategorie), die im Wurzel-Baum
 * erreichbar sind. Die Traversierung steigt nur durch anwaehlbare Definitionen ab
 * — hinter der Grenze einer Gruppe oder eines Links liegende Eintraege sind nur
 * per Verweis bezogen und duerfen keinen Pflicht-Phantom synthetisieren (ADR-0032,
 * Regel „geteilte/verlinkte Eintraege nicht in die Wurzel-Definitionsliste").
 */
function collectRootDefinitions(definition, out, seen) {
  if (!PHANTOM_DEFINITION_KINDS.has(definition.kind)) return;
  if (!seen.has(definition.id)) {
    seen.add(definition.id);
    out.push(definition);
  }
  for (const child of definition.children ?? []) {
    collectRootDefinitions(child, out, seen);
  }
}

/**
 * Loest einen `entryLink` transitiv und **zyklen-sicher** auf sein Ziel auf: folgt
 * einer Link→Link-Kette ueber die globale Tabelle, bis eine echte Definition
 * (Eintrag/Gruppe) erreicht ist, das Ziel fehlt (baumelnd) oder ein Zyklus die
 * Kette schliesst. `visited` verhindert eine Endlosschleife bei selbst- oder
 * gegenseitig referenziellen Links.
 *
 * @returns {object|null} die aufgeloeste Zieldefinition, oder `null` (baumelnd/Zyklus).
 */
function followEntryLink(targetId, byId, visited) {
  let currentId = targetId;
  while (currentId !== null && currentId !== undefined && !visited.has(currentId)) {
    visited.add(currentId);
    const target = byId.get(currentId);
    if (target === undefined) return null;
    if (target.kind === DefinitionKind.ENTRY_LINK) {
      currentId = target.targetId;
      continue;
    }
    return target;
  }
  return null;
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
 * von dessen Dokumentposition (und dessen Herkunftskatalog) findet.
 */
function indexAndResolveInfos(infoRoots, byId, diagnostics) {
  for (const info of infoRoots) indexInfoElement(info, byId, diagnostics);
  for (const info of infoRoots) resolveInfoElement(info, byId, diagnostics);
}

/**
 * Loest einen gelesenen Katalog (oder das zusammengefuehrte Aggregat mehrerer
 * Dokumente, ADR-0032) zu einer nachschlagbaren, unveraenderlichen Sicht auf.
 *
 * Alle mitgegebenen Quellen — Wurzel-Eintraege/Kontingente/Kategorien **und** die
 * per Verweis bzw. geteilt bezogenen Definitionen (`sharedEntries`) — fliessen in
 * **eine** globale `id → Definition`-Tabelle. Darueber loesen `infoLink`- und
 * `entryLink`-Ziele transitiv und zyklen-sicher auf, katalog-intern wie
 * kataloguebergreifend (der ID-Raum ist disjunkte GUIDs, ADR-0032).
 *
 * Die **Wurzel-Definitionsliste** (`definitions`) umfasst nur die anwaehlbaren,
 * im Wurzel-Baum erreichbaren Definitionen — geteilte/verlinkte Eintraege stehen
 * im `lookup`, aber nicht hier, damit ihre `min`-Grenze keine falsche
 * Pflichtverletzung synthetisiert.
 *
 * @param {{ entries?: object[], forces?: object[], categories?: object[], sharedEntries?: object[], infos?: object[] }} catalogue Ergebnis von `parseCatalogue` oder `mergeCatalogues`.
 * @returns {{ lookup: (id: string) => object|null, definitions: object[], categoryIds: Set<string>, diagnostics: object[] }}
 */
export function resolveCatalogue(catalogue) {
  const collector = {
    byId: new Map(),
    categoryIds: new Set(),
    diagnostics: [],
    definitionNodes: [],
    entryLinks: [],
    infoRoots: [...(catalogue.infos ?? [])],
  };
  const rootForest = [
    ...(catalogue.entries ?? []),
    ...(catalogue.forces ?? []),
    ...(catalogue.categories ?? []),
  ];
  for (const definition of [...rootForest, ...(catalogue.sharedEntries ?? [])]) {
    collectDefinition(definition, collector);
  }
  const { byId, categoryIds, diagnostics, definitionNodes, entryLinks, infoRoots } = collector;

  // Pflicht-Phantom-Quelle: nur die im Wurzel-Baum erreichbaren anwaehlbaren
  // Definitionen (nicht die geteilten/verlinkten — die stehen nur im `lookup`).
  const definitions = [];
  const seen = new Set();
  for (const definition of rootForest) {
    collectRootDefinitions(definition, definitions, seen);
  }

  // Modifikator-Ziele einmal ueber die globale Symboltabelle aufloesen — fuer alle
  // Definitionsknoten, damit auch ein per Verweis in den Baum gezogener Knoten sein
  // `.target` traegt (die Apply-Schicht griffe sonst auf `undefined.kind` zu).
  const symbolTable = buildTargetSymbolTable(definitionNodes, diagnostics);
  resolveModifierTargets(definitionNodes, symbolTable, diagnostics);

  // Info-Definitionen indizieren und `infoLink`s aufloesen (zwei Durchgaenge).
  indexAndResolveInfos(infoRoots, byId, diagnostics);

  // `entryLink`-Ziele ueber dieselbe globale Tabelle aufloesen (transitiv,
  // zyklen-sicher); ein nach der Zusammenfuehrung baumelndes Ziel bleibt Diagnose.
  for (const link of entryLinks) {
    const target = followEntryLink(link.targetId, byId, new Set([link.id]));
    link.resolved = target;
    if (target === null) {
      diagnostics.push(diagnostic(DiagnosticKind.DANGLING_ENTRY_LINK, { targetId: link.targetId }));
    }
  }

  return {
    lookup: id => byId.get(id) ?? null,
    definitions,
    categoryIds,
    diagnostics,
  };
}
