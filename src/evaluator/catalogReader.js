/**
 * Eigener, minimaler XML-Leser der Reinraum-Engine (ADR-0030: der Evaluator
 * liest entpacktes `.cat`/`.gst`-XML mit **eigenem** Parser, nie ueber
 * `src/parser/`). Er nutzt allein die Plattform-Primitive `DOMParser` (Browser
 * bzw. jsdom im Test) und erzeugt daraus das engine-eigene Definitionsmodell.
 *
 * Umfang (Issue 01/02): geschachtelte `selectionEntry`-Elemente mit ihren
 * `costs` (Kostenart per ID) und ihren `constraint`-Grenzen — MIN/MAX ueber
 * Selektionsanzahl *und* Kostensummen sowie Prozentgrenzen. Kein ZIP-Entpacken,
 * kein XSD-Gate, keine Link-Ketten/Importe (Resolver-Ausbaustufen spaeter).
 */

import {
  LimitKind,
  SELECTION_COUNT,
  costSumField,
  ScopeKeyword,
  DiagnosticKind,
  diagnostic,
} from './model.js';

const Tag = Object.freeze({
  SELECTION_ENTRIES: 'selectionEntries',
  SELECTION_ENTRY: 'selectionEntry',
  CONSTRAINTS: 'constraints',
  CONSTRAINT: 'constraint',
  COSTS: 'costs',
  COST: 'cost',
});

const Attr = Object.freeze({
  ID: 'id',
  NAME: 'name',
  TYPE: 'type',
  TYPE_ID: 'typeId',
  FIELD: 'field',
  VALUE: 'value',
  SCOPE: 'scope',
  PERCENT_VALUE: 'percentValue',
});

/** Battlescribe-XML-Vokabular auf das engine-eigene Enum abgebildet. */
const LIMIT_KIND_BY_XML = Object.freeze({
  max: LimitKind.MAX,
  min: LimitKind.MIN,
});

/** Das `field`-Attribut, das die Selektionsanzahl statt einer Kostenart meint. */
const SELECTION_COUNT_FIELD_XML = 'selections';

const SCOPE_BY_XML = Object.freeze({
  roster: ScopeKeyword.ROSTER,
});

const BOOLEAN_TRUE_XML = 'true';
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
 * Liest eine einzelne `<constraint>` in eine `LimitDef` oder meldet eine
 * Diagnose, falls ihr Vokabular ausserhalb des Skeleton-Umfangs liegt — nie
 * still verschluckt (`docs/evaluator-architecture.md` §5, Risiko 4).
 */
function readConstraint(constraintEl, diagnostics) {
  const id = constraintEl.getAttribute(Attr.ID);
  const kind = LIMIT_KIND_BY_XML[constraintEl.getAttribute(Attr.TYPE)];
  const field = readField(constraintEl.getAttribute(Attr.FIELD));
  const scope = SCOPE_BY_XML[constraintEl.getAttribute(Attr.SCOPE)];
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
  return { id, kind, field, scope, value, isPercent };
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

/** Liest einen `<selectionEntry>` samt Kosten und geschachtelter Kind-Eintraege. */
function readEntry(entryEl, diagnostics) {
  return {
    id: entryEl.getAttribute(Attr.ID),
    name: entryEl.getAttribute(Attr.NAME),
    costs: readCosts(entryEl),
    limits: readLimits(entryEl, diagnostics),
    children: readEntries(entryEl, diagnostics),
  };
}

/** Liest alle direkten `<selectionEntry>`-Kinder eines Elements. */
function readEntries(element, diagnostics) {
  return wrappedChildren(element, Tag.SELECTION_ENTRIES, Tag.SELECTION_ENTRY)
    .map(entryEl => readEntry(entryEl, diagnostics));
}

/**
 * Liest Katalog-XML in das engine-eigene Definitionsmodell.
 *
 * @param {string} catalogXml Entpacktes `.cat`/`.gst`-XML.
 * @returns {{ id: string|null, name: string|null, entries: object[], diagnostics: object[] }}
 */
export function parseCatalogue(catalogXml) {
  const diagnostics = [];
  const document = new DOMParser().parseFromString(catalogXml, XML_MIME_TYPE);
  const root = document.documentElement;
  return {
    id: root.getAttribute(Attr.ID),
    name: root.getAttribute(Attr.NAME),
    entries: readEntries(root, diagnostics),
    diagnostics,
  };
}
