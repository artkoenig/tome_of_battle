/**
 * Eigener, minimaler XML-Leser der Reinraum-Engine (ADR-0030: der Evaluator
 * liest entpacktes `.cat`/`.gst`-XML mit **eigenem** Parser, nie ueber
 * `src/parser/`). Er nutzt allein die Plattform-Primitive `DOMParser` (Browser
 * bzw. jsdom im Test) und erzeugt daraus das engine-eigene Definitionsmodell.
 *
 * Umfang: geschachtelte `selectionEntry`-Elemente mit ihren `costs` (Kostenart
 * per ID), ihren `categoryLinks` (Kategoriezugehoerigkeit per Ziel-ID) und ihren
 * `constraint`-Grenzen — MIN/MAX ueber Selektionsanzahl *und* Kostensummen,
 * Prozentgrenzen, alle Bezugsrahmen und die Zaehl-Flags (Issue 03). Dazu
 * `forceEntries` (Kontingent-Definitionen, auch geschachtelt) und
 * `categoryEntries` (Kategorie-Definitionen), damit die Join-Schicht Kontingente
 * und Kategorien kennt. Kein ZIP-Entpacken, kein XSD-Gate, keine Link-Ketten/
 * Importe (Resolver-Ausbaustufen spaeter).
 */

import {
  LimitKind,
  SELECTION_COUNT,
  costSumField,
  CompareOp,
  ModifierOperation,
  ModifierTargetKind,
  DefinitionKind,
  DiagnosticKind,
  diagnostic,
} from './model.js';

const Tag = Object.freeze({
  SELECTION_ENTRIES: 'selectionEntries',
  SELECTION_ENTRY: 'selectionEntry',
  FORCE_ENTRIES: 'forceEntries',
  FORCE_ENTRY: 'forceEntry',
  CATEGORY_ENTRIES: 'categoryEntries',
  CATEGORY_ENTRY: 'categoryEntry',
  CATEGORY_LINKS: 'categoryLinks',
  CATEGORY_LINK: 'categoryLink',
  CONSTRAINTS: 'constraints',
  CONSTRAINT: 'constraint',
  COSTS: 'costs',
  COST: 'cost',
  MODIFIERS: 'modifiers',
  MODIFIER: 'modifier',
  CONDITIONS: 'conditions',
  CONDITION: 'condition',
  REPEATS: 'repeats',
  REPEAT: 'repeat',
});

const Attr = Object.freeze({
  ID: 'id',
  NAME: 'name',
  TYPE: 'type',
  TYPE_ID: 'typeId',
  TARGET_ID: 'targetId',
  TARGET_KIND: 'targetKind',
  FIELD: 'field',
  VALUE: 'value',
  SCOPE: 'scope',
  OP: 'op',
  OPERATION: 'operation',
  CHILD_ID: 'childId',
  PER_VALUE: 'perValue',
  PERCENT_VALUE: 'percentValue',
  SHARED: 'shared',
  INCLUDE_CHILD_SELECTIONS: 'includeChildSelections',
  INCLUDE_CHILD_FORCES: 'includeChildForces',
});

/** Die gueltigen Vergleichsoperator-Werte einer Bedingung (siehe {@link CompareOp}). */
const COMPARE_OPS = Object.freeze(new Set(Object.values(CompareOp)));

/** Die gueltigen Modifikator-Operationen (siehe {@link ModifierOperation}). */
const MODIFIER_OPERATIONS = Object.freeze(new Set(Object.values(ModifierOperation)));

/** Die numerischen Modifikator-Zielarten, deren `value` eine Zahl ist. */
const NUMERIC_TARGET_KINDS = Object.freeze(new Set([ModifierTargetKind.COST, ModifierTargetKind.LIMIT]));

/** Die booleschen Modifikator-Zielarten, deren `value` an/aus schaltet. */
const BOOLEAN_TARGET_KINDS = Object.freeze(new Set([ModifierTargetKind.CATEGORY, ModifierTargetKind.HIDDEN]));

/** Die gueltigen Modifikator-Zielarten (siehe {@link ModifierTargetKind}). */
const TARGET_KINDS = Object.freeze(new Set(Object.values(ModifierTargetKind)));

/** Battlescribe-XML-Vokabular auf das engine-eigene Enum abgebildet. */
const LIMIT_KIND_BY_XML = Object.freeze({
  max: LimitKind.MAX,
  min: LimitKind.MIN,
});

/** Das `field`-Attribut, das die Selektionsanzahl statt einer Kostenart meint. */
const SELECTION_COUNT_FIELD_XML = 'selections';

const BOOLEAN_TRUE_XML = 'true';
const BOOLEAN_FALSE_XML = 'false';
const XML_MIME_TYPE = 'application/xml';

/**
 * Bildet das `field`-Attribut einer Grenze auf das engine-eigene Feld ab.
 * `"selections"` meint die Selektionsanzahl; jeder andere Wert ist die **ID**
 * einer Kostenart (Battlescribe kodiert Kosten-Grenzen ueber die Kostenart-ID
 * im `field`-Attribut) und wird zu `COST_SUM(costTypeId)`.
 */
function readField(fieldAttr) {
  if (fieldAttr === null || fieldAttr === '') return undefined;
  return fieldAttr === SELECTION_COUNT_FIELD_XML ? SELECTION_COUNT : costSumField(fieldAttr);
}

/** Direkte Kind-Elemente eines Elements mit gegebenem Tag-Namen. */
function directChildren(element, tagName) {
  const result = [];
  if (!element) return result;
  for (const child of element.children) {
    if (child.tagName === tagName) result.push(child);
  }
  return result;
}

/** Elemente unter einem Wrapper-Tag (z. B. entry > constraints > constraint). */
function wrappedChildren(element, wrapperTag, tagName) {
  const wrapper = directChildren(element, wrapperTag)[0];
  return directChildren(wrapper, tagName);
}

/**
 * Liest ein Boolean-Attribut mit gegebener Vorgabe. Ein fehlendes oder leeres
 * Attribut faellt auf `defaultValue` zurueck (Battlescribe-XSD-Vorgaben, z. B.
 * `shared` standardmaessig true).
 */
function readBoolean(element, attr, defaultValue) {
  const raw = element.getAttribute(attr);
  if (raw === BOOLEAN_TRUE_XML) return true;
  if (raw === BOOLEAN_FALSE_XML) return false;
  return defaultValue;
}

/**
 * Liest die Zaehl-Flags einer Query. Vorgabe nach XSD `QueryBase`: `shared` ist
 * true, `includeChildSelections`/`includeChildForces` sind false.
 */
function readFlags(element) {
  return {
    shared: readBoolean(element, Attr.SHARED, true),
    includeChildSelections: readBoolean(element, Attr.INCLUDE_CHILD_SELECTIONS, false),
    includeChildForces: readBoolean(element, Attr.INCLUDE_CHILD_FORCES, false),
  };
}

/**
 * Liest das `scope`-Attribut. Ein Bezugsrahmen ist entweder ein Schluesselwort
 * (roster/force/parent/self — deren XML-Wert dem engine-eigenen Wert gleicht)
 * oder eine **ID** (Eintrag/Kategorie), die unveraendert durchgereicht wird. Ein
 * leeres Attribut ist kein gueltiger Scope.
 */
function readScope(scopeAttr) {
  return scopeAttr ? scopeAttr : undefined;
}

/**
 * Liest eine einzelne `<constraint>` in eine `LimitDef` oder meldet eine
 * Diagnose, falls ihr Vokabular ausserhalb des Umfangs liegt — nie still
 * verschluckt (`docs/evaluator-architecture.md` §5, Risiko 4).
 */
function readConstraint(constraintEl, diagnostics) {
  const id = constraintEl.getAttribute(Attr.ID);
  const kind = LIMIT_KIND_BY_XML[constraintEl.getAttribute(Attr.TYPE)];
  const field = readField(constraintEl.getAttribute(Attr.FIELD));
  const scope = readScope(constraintEl.getAttribute(Attr.SCOPE));
  const value = Number.parseFloat(constraintEl.getAttribute(Attr.VALUE));
  const isPercent = constraintEl.getAttribute(Attr.PERCENT_VALUE) === BOOLEAN_TRUE_XML;

  if (kind === undefined || field === undefined || scope === undefined || Number.isNaN(value)) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_CONSTRAINT, {
      constraintId: id,
      type: constraintEl.getAttribute(Attr.TYPE),
      field: constraintEl.getAttribute(Attr.FIELD),
      scope: constraintEl.getAttribute(Attr.SCOPE),
    }));
    return null;
  }
  return { id, kind, field, scope, value, isPercent, flags: readFlags(constraintEl) };
}

/** Liest die Grenzen eines Eintrags. */
function readLimits(entryEl, diagnostics) {
  return wrappedChildren(entryEl, Tag.CONSTRAINTS, Tag.CONSTRAINT)
    .map(constraintEl => readConstraint(constraintEl, diagnostics))
    .filter(limit => limit !== null);
}

/**
 * Liest die Basiskosten eines Eintrags als Abbildung Kostenart-ID → Wert.
 * Kostenarten werden **per ID** (`typeId`), nie per Name, gefuehrt.
 */
function readCosts(entryEl) {
  const costs = {};
  for (const costEl of wrappedChildren(entryEl, Tag.COSTS, Tag.COST)) {
    const costTypeId = costEl.getAttribute(Attr.TYPE_ID);
    const value = Number.parseFloat(costEl.getAttribute(Attr.VALUE));
    if (costTypeId !== null && !Number.isNaN(value)) {
      costs[costTypeId] = value;
    }
  }
  return costs;
}

/**
 * Liest die Kategoriezugehoerigkeit eines Eintrags als Menge von Kategorie-IDs
 * (Ziel-ID des `categoryLink`, nie der Name — ADR-0003). Das sind die
 * **Basis**-Kategorien; Modifikatoren leiten daraus in Slice 04 die effektiven ab.
 */
function readCategoryIds(entryEl) {
  return wrappedChildren(entryEl, Tag.CATEGORY_LINKS, Tag.CATEGORY_LINK)
    .map(linkEl => linkEl.getAttribute(Attr.TARGET_ID))
    .filter(targetId => targetId !== null && targetId !== '');
}

/**
 * Liest eine einzelne `<condition>` einer Bedingung in ihre `ConditionDef` oder
 * meldet eine Diagnose, falls ihr Vokabular ausserhalb des Umfangs liegt. Ein
 * fehlendes `childId` bedeutet "alles im Rahmen" (Ziel `null`).
 */
function readCondition(conditionEl, diagnostics) {
  const op = conditionEl.getAttribute(Attr.OP);
  const field = readField(conditionEl.getAttribute(Attr.FIELD));
  const scope = readScope(conditionEl.getAttribute(Attr.SCOPE));
  const value = Number.parseFloat(conditionEl.getAttribute(Attr.VALUE));
  if (!COMPARE_OPS.has(op) || field === undefined || scope === undefined || Number.isNaN(value)) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_CONDITION, {
      op,
      field: conditionEl.getAttribute(Attr.FIELD),
      scope: conditionEl.getAttribute(Attr.SCOPE),
    }));
    return null;
  }
  return {
    op,
    field,
    scope,
    targetChildId: conditionEl.getAttribute(Attr.CHILD_ID),
    value,
    flags: readFlags(conditionEl),
  };
}

/** Liest die Bedingungen eines Modifikators (leer, wenn keine vorhanden). */
function readConditions(modifierEl, diagnostics) {
  return wrappedChildren(modifierEl, Tag.CONDITIONS, Tag.CONDITION)
    .map(conditionEl => readCondition(conditionEl, diagnostics))
    .filter(condition => condition !== null);
}

/**
 * Liest eine einzelne `<repeat>` einer Wiederholung in ihre `RepeatDef` oder
 * meldet eine Diagnose. `perValue` muss eine Zahl ungleich 0 sein (0 gaebe eine
 * Division durch null).
 */
function readRepeat(repeatEl, diagnostics) {
  const field = readField(repeatEl.getAttribute(Attr.FIELD));
  const scope = readScope(repeatEl.getAttribute(Attr.SCOPE));
  const perValue = Number.parseFloat(repeatEl.getAttribute(Attr.PER_VALUE));
  if (field === undefined || scope === undefined || Number.isNaN(perValue) || perValue === 0) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_REPEAT, {
      field: repeatEl.getAttribute(Attr.FIELD),
      scope: repeatEl.getAttribute(Attr.SCOPE),
      perValue: repeatEl.getAttribute(Attr.PER_VALUE),
    }));
    return null;
  }
  return {
    field,
    scope,
    targetChildId: repeatEl.getAttribute(Attr.CHILD_ID),
    perValue,
    flags: readFlags(repeatEl),
  };
}

/** Liest die Wiederholungen eines Modifikators (leer, wenn keine vorhanden). */
function readRepeats(modifierEl, diagnostics) {
  return wrappedChildren(modifierEl, Tag.REPEATS, Tag.REPEAT)
    .map(repeatEl => readRepeat(repeatEl, diagnostics))
    .filter(repeat => repeat !== null);
}

/**
 * Liest den `value` eines Modifikators je nach Zielart: numerisch fuer Kosten-
 * und Grenz-Ziele, boolesch fuer Kategorie- und Sichtbarkeits-Ziele, sonst als
 * Text (Hinweis).
 */
function readModifierValue(targetKind, rawValue) {
  if (NUMERIC_TARGET_KINDS.has(targetKind)) return Number.parseFloat(rawValue);
  if (BOOLEAN_TARGET_KINDS.has(targetKind)) return rawValue === BOOLEAN_TRUE_XML;
  return rawValue;
}

/**
 * Liest einen einzelnen `<modifier>` in seine `ModifierDef` (samt Bedingungen und
 * Wiederholungen) oder meldet eine Diagnose, falls Operation oder Zielart
 * ausserhalb des Umfangs liegen — nie still verschluckt.
 */
function readModifier(modifierEl, diagnostics) {
  const operation = modifierEl.getAttribute(Attr.OPERATION);
  const targetKind = modifierEl.getAttribute(Attr.TARGET_KIND);
  const rawValue = modifierEl.getAttribute(Attr.VALUE);
  const value = readModifierValue(targetKind, rawValue);
  const numericValueInvalid = NUMERIC_TARGET_KINDS.has(targetKind) && Number.isNaN(value);
  if (!MODIFIER_OPERATIONS.has(operation) || !TARGET_KINDS.has(targetKind) || numericValueInvalid) {
    diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_MODIFIER, {
      operation,
      targetKind,
      value: rawValue,
    }));
    return null;
  }
  return {
    operation,
    target: { kind: targetKind, id: modifierEl.getAttribute(Attr.TARGET_ID) },
    value,
    conditions: readConditions(modifierEl, diagnostics),
    repeats: readRepeats(modifierEl, diagnostics),
  };
}

/**
 * Liest die Modifikatoren eines Knotens **in Dokumentreihenfolge** — die
 * Reihenfolge im Array ist die Semantik (`docs/evaluator-architecture.md` §4.1).
 */
function readModifiers(element, diagnostics) {
  return wrappedChildren(element, Tag.MODIFIERS, Tag.MODIFIER)
    .map(modifierEl => readModifier(modifierEl, diagnostics))
    .filter(modifier => modifier !== null);
}

/** Liest einen `<selectionEntry>` samt Kosten, Kategorien, Grenzen und Modifikatoren. */
function readEntry(entryEl, diagnostics) {
  return {
    id: entryEl.getAttribute(Attr.ID),
    name: entryEl.getAttribute(Attr.NAME),
    kind: DefinitionKind.ENTRY,
    costs: readCosts(entryEl),
    categoryIds: readCategoryIds(entryEl),
    limits: readLimits(entryEl, diagnostics),
    modifiers: readModifiers(entryEl, diagnostics),
    children: readEntries(entryEl, diagnostics),
  };
}

/** Liest alle direkten `<selectionEntry>`-Kinder eines Elements. */
function readEntries(element, diagnostics) {
  return wrappedChildren(element, Tag.SELECTION_ENTRIES, Tag.SELECTION_ENTRY)
    .map(entryEl => readEntry(entryEl, diagnostics));
}

/**
 * Liest einen `<forceEntry>` (Kontingent-Definition) samt eigener Grenzen und
 * geschachtelter Kontingente. Kontingente tragen keine Selektion bei; ihre
 * Kinder im Definitionsbaum sind ihre Unter-Kontingente.
 */
function readForceEntry(forceEl, diagnostics) {
  return {
    id: forceEl.getAttribute(Attr.ID),
    name: forceEl.getAttribute(Attr.NAME),
    kind: DefinitionKind.FORCE,
    limits: readLimits(forceEl, diagnostics),
    modifiers: readModifiers(forceEl, diagnostics),
    children: readForceEntries(forceEl, diagnostics),
  };
}

/** Liest alle direkten `<forceEntry>`-Kinder eines Elements. */
function readForceEntries(element, diagnostics) {
  return wrappedChildren(element, Tag.FORCE_ENTRIES, Tag.FORCE_ENTRY)
    .map(forceEl => readForceEntry(forceEl, diagnostics));
}

/** Liest eine `<categoryEntry>` (Kategorie-Definition) samt eigener Grenzen. */
function readCategoryEntry(categoryEl, diagnostics) {
  return {
    id: categoryEl.getAttribute(Attr.ID),
    name: categoryEl.getAttribute(Attr.NAME),
    kind: DefinitionKind.CATEGORY,
    limits: readLimits(categoryEl, diagnostics),
    modifiers: readModifiers(categoryEl, diagnostics),
    children: [],
  };
}

/** Liest alle `<categoryEntry>`-Definitionen des Katalogs. */
function readCategoryEntries(element, diagnostics) {
  return wrappedChildren(element, Tag.CATEGORY_ENTRIES, Tag.CATEGORY_ENTRY)
    .map(categoryEl => readCategoryEntry(categoryEl, diagnostics));
}

/**
 * Liest Katalog-XML in das engine-eigene Definitionsmodell.
 *
 * @param {string} catalogXml Entpacktes `.cat`/`.gst`-XML.
 * @returns {{ id: string|null, name: string|null, entries: object[], forces: object[], categories: object[], diagnostics: object[] }}
 */
export function parseCatalogue(catalogXml) {
  const diagnostics = [];
  const document = new DOMParser().parseFromString(catalogXml, XML_MIME_TYPE);
  const root = document.documentElement;
  return {
    id: root.getAttribute(Attr.ID),
    name: root.getAttribute(Attr.NAME),
    entries: readEntries(root, diagnostics),
    forces: readForceEntries(root, diagnostics),
    categories: readCategoryEntries(root, diagnostics),
    diagnostics,
  };
}
