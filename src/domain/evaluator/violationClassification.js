/**
 * **Fachliche Einordnung einer Meldung** — *was fuer eine Verletzung ist das?*
 * (`design.md`, Kontrakt „Eingeordnete Verletzung"; ADR-0034.)
 *
 * Dieses Modul bildet ein Grenzen-Ergebnis bzw. eine Autor-Meldung auf eine
 * **sprachfreie** Klassifikation ab: Herkunft, Schweregrad, Anker, Art der Grenze,
 * Bezugsrahmen. Es kennt keine Texte, keine Meldungsschluessel und keine Sprache —
 * die Engine ordnet ein, die Oberflaeche formuliert (ADR-0026/0034). Der einzige
 * Text, den es weiterreicht, ist der **Katalogtext** einer Autor-Meldung, und den
 * hat der Autor geschrieben, nicht die Engine.
 *
 * ── Warum ausschliesslich geschlossene Wertevorraete ─────────────────────────
 * Jedes Feld der Einordnung ist entweder eine Zahl, ein Wahrheitswert oder ein
 * Wert aus einer **geschlossenen Aufzaehlung** ({@link MessageOrigin},
 * {@link MessageSeverity}, {@link ConstraintKind}, {@link LimitMeasure},
 * {@link ScopeKind}, {@link MessageAnchorKind}). Damit ist eine Fallunterscheidung
 * in der Oberflaeche **erschoepfend** und ein fehlender Fall auffindbar. Ein freier
 * String — etwa der rohe `scope` einer Grenze, der ein Schluesselwort *oder* eine
 * ID sein kann — zwaenge die Oberflaeche zu genau dem Rateschritt, den diese
 * Schicht ihr abnimmt.
 */

import {
  MessageOrigin,
  MessageSeverity,
  ScopeKeyword,
  ScopeKind,
  isSlotAnchorKind,
  normalizeFlags,
} from './model.js';
import { pathOf } from './evalTree.js';

/**
 * Der Schweregrad einer **abgeleiteten** Meldung. Eine Grenze des Katalogs — und
 * ebenso die engine-eigene Budget-Regel — sagt, was gilt; wird sie gerissen, ist
 * die Liste nicht regelkonform. Das ist ein Fehler, unabhaengig davon, ob ein
 * Mindest- oder ein Hoechstmass betroffen ist: eine unerfuellte Pflicht als blosse
 * Warnung auszuweisen waere eine **Anzeige-Entscheidung**, und die liegt nach
 * ADR-0034 ausserhalb der Engine.
 *
 * Der Schweregrad einer **Autor-Meldung** kommt dagegen aus dem Katalog selbst
 * (`field="error"`/`"warning"`/`"info"`) und wird unveraendert uebernommen.
 */
const DERIVED_MESSAGE_SEVERITY = MessageSeverity.ERROR;

/**
 * Der Schweregrad einer **versteckten Auswahl**. Das BSData-Wiki (*Props:
 * Hidden*) sagt es woertlich: eine versteckte Entitaet ist dem Nutzer nicht
 * sichtbar, „and any already selected entries will cause error showing up in
 * error list". Der Schweregrad steht damit in der Quelle und ist keine
 * Anzeige-Entscheidung dieser Schicht.
 */
const HIDDEN_SELECTION_SEVERITY = MessageSeverity.ERROR;

/** Die Scope-Schluesselwoerter als Menge — ein Scope, der keines ist, ist eine ID. */
const SCOPE_KEYWORDS = new Set(Object.values(ScopeKeyword));

/**
 * Ordnet den Bezugsrahmen einer Grenze ein: seine {@link ScopeKind Art}, bei einem
 * ID-Rahmen die Ziel-ID, und die drei Zaehl-Flags mit den XSD-Vorgaben aufgefuellt
 * (`shared` ist standardmaessig true) — sonst haette die Oberflaeche fuer ein
 * fehlendes Flag wieder eine Vorgabe zu kennen.
 *
 * Ein Rahmen, der kein Schluesselwort ist, ist eine ID; ob sie eine Kategorie oder
 * einen Eintrag benennt, entscheidet **dieselbe** Quelle, an der auch das
 * Query-Primitiv den Rahmen aufloest: die bekannten Kategorie-IDs des Datensatzes.
 */
function classifyScope(limit, categoryIds) {
  const { scope } = limit;
  const flags = Object.freeze(normalizeFlags(limit.flags));
  if (SCOPE_KEYWORDS.has(scope)) {
    return Object.freeze({ kind: scope, targetId: null, flags });
  }
  return Object.freeze({
    kind: categoryIds.has(scope) ? ScopeKind.CATEGORY_ID : ScopeKind.ENTRY_ID,
    targetId: scope,
    flags,
  });
}

/**
 * Ordnet die Grenze selbst ein: Mindest- oder Hoechstmass ({@link ConstraintKind}),
 * ihre {@link LimitMeasure Messgroesse}, die Kostenart einer kostenbezogenen
 * Messgroesse und ihr Bezugsrahmen.
 *
 * `isPercent` ist mehr als eine Formatierungsfrage: bei einer Prozentgrenze ist
 * `bound` der **abgeleitete** absolute Wert, waehrend die Herleitungskette den
 * **Prozentsatz** beschreibt — die Groesse, auf die ein Modifikator wirkt. Ohne
 * dieses Kennzeichen liesen sich Kette und Grenzwert nicht zusammenbringen.
 */
function classifyLimit(limit, measure, categoryIds) {
  return Object.freeze({
    kind: limit.kind,
    measure,
    costTypeId: limit.field?.costTypeId ?? null,
    isPercent: limit.isPercent === true,
    scope: classifyScope(limit, categoryIds),
  });
}

/**
 * Ordnet den **Anker** einer Meldung ein: an welcher Stelle sie haengt. Neben
 * Definitions-ID und effektivem Namen traegt er den stabilen Pfad des Slots, seine
 * {@link MessageAnchorKind Ankerart} und das Merkmal „Wert nicht stabil".
 *
 * Der roster-weite Anker der Budget-Regel ist kein Baumknoten und hat deshalb
 * `path: null` — abgelesen an seiner Ankerart ({@link isSlotAnchorKind}), nicht an
 * einem fehlgeschlagenen Pfadversuch.
 */
function classifyAnchor(anchor, { effective, unstableNodes }) {
  const { anchorKind } = anchor;
  return Object.freeze({
    defId: anchor.def.id,
    name: effective.nameOf(anchor),
    path: isSlotAnchorKind(anchorKind) ? pathOf(anchor) : null,
    anchorKind,
    isValueUnstable: unstableNodes.has(anchor),
  });
}

/**
 * Ordnet ein unerfuelltes Grenzen-Ergebnis als **abgeleitete Meldung** ein.
 *
 * Neben der Einordnung traegt sie das gewohnte Ergebnis-Tripel (Ist-Wert,
 * Grenzwert, Differenz) und die **Herleitungskette** des Grenzwerts, aus der die
 * Ursachen gelesen werden (`causes.js`, ADR-0027). Die Grenz-Id steht als
 * `limitId` neben der Einordnung — sie ist die Identitaet der Grenze, die
 * Einordnung sagt, *was fuer eine* Grenze das ist.
 *
 * @param {object} result  ein Ergebnis aus `constraints.js` bzw. `budget.js`.
 * @param {{ effective: object, unstableNodes: Set<object>, categoryIds: Set<string> }} context
 * @returns {object} die eingeordnete Meldung (ohne das optionale Ursachen-Feld).
 */
export function classifyDerivedViolation(result, context) {
  return {
    origin: MessageOrigin.DERIVED_LIMIT,
    severity: DERIVED_MESSAGE_SEVERITY,
    anchor: classifyAnchor(result.anchor, context),
    limitId: result.limit.id,
    limit: classifyLimit(result.limit, result.measure, context.categoryIds),
    actual: result.actual,
    bound: result.bound,
    delta: result.delta,
    derivation: result.derivation ?? null,
  };
}

/**
 * Ordnet eine **Autor-Meldung** des Katalogs ein. Ihr Schweregrad kommt aus dem
 * Zielfeld des Modifikators, ihr Text unveraendert aus dem Katalog — mit
 * aufgeloesten Text-Tokens (`authorMessages.js`, ADR-0028), aber ohne jede
 * Uebersetzung oder Umformulierung.
 *
 * Sie traegt **keines** der Grenzen-Felder: es gibt keine Grenze, keinen Ist-Wert
 * und keine Herleitung. Welche Felder besetzt sind, sagt die Herkunft.
 *
 * @param {object} node  der tragende Knoten.
 * @param {{ severity: string, text: string }} message  die gerenderte Meldung.
 * @param {{ effective: object, unstableNodes: Set<object> }} context
 * @returns {object} die eingeordnete Meldung.
 */
export function classifyAuthorMessage(node, message, context) {
  return {
    origin: MessageOrigin.AUTHOR_MESSAGE,
    severity: message.severity,
    anchor: classifyAnchor(node, context),
    text: message.text,
  };
}

/**
 * Ordnet eine **gewaehlte, aber effektiv versteckte Auswahl** ein: die
 * Gegenrichtung zur Min-Unterdrueckung an versteckten Traegern (Issue 0088).
 * Was der Nutzer gar nicht haette angeboten bekommen duerfen, aber in seiner
 * Liste liegt, ist ein Fehler — typisch nach einem Wechsel der Armee-Variante,
 * der die Altauswahl liegen laesst.
 *
 * Sie traegt **keines** der Grenzen-Felder und keinen Text: die Aussage steckt
 * ganz im Anker, und der benennt die Auswahl ueber ihre Definitions- bzw.
 * Link-Id und ihren stabilen Pfad — nicht ueber den Anzeigenamen, der nur zur
 * Darstellung daneben steht.
 *
 * @param {object} node  der belegte Slot, dessen Definition versteckt ist.
 * @param {{ effective: object, unstableNodes: Set<object> }} context
 * @returns {object} die eingeordnete Meldung.
 */
export function classifyHiddenSelection(node, context) {
  return {
    origin: MessageOrigin.HIDDEN_SELECTION,
    severity: HIDDEN_SELECTION_SEVERITY,
    anchor: classifyAnchor(node, context),
  };
}
