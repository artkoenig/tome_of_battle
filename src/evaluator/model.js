/**
 * Geteilte, unveraenderliche Wertdefinitionen der Reinraum-Auswertungs-Engine
 * (`src/evaluator/`, ADR-0030, `docs/evaluator-architecture.md` §4.1).
 *
 * Diese Datei buendelt die Enums, Schluessel-Kodierung und Diagnose-Fabrik, die
 * alle Schichten teilen. Nach dem Walking-Skeleton (Issue 01) traegt sie das
 * verbreiterte Grenz-Vokabular (Issue 02): MIN- und MAX-Grenzen ueber die
 * Selektionsanzahl *und* Kostensummen (Kostenart per ID) sowie Prozentgrenzen.
 * Issue 03 verbreitert den Bezugsrahmen: alle Scope-Schluesselwoerter
 * (roster/force/parent/self) plus Eintrags- und Kategorie-IDs als Ziel, die
 * Zaehl-Flags (`shared`, `includeChildSelections`, `includeChildForces`) und die
 * Definitionsarten, an denen die Join-Schicht Kontingente von Auswahlen und
 * Kategorien unterscheidet.
 */

/** Art einer Grenze: Unter- (MIN) oder Obergrenze (MAX). */
export const LimitKind = Object.freeze({
  MIN: 'min',
  MAX: 'max',
});

/**
 * Diskriminator des gezaehlten Feldes einer Query. `SELECTION_COUNT` zaehlt
 * Selektionen; `COST_SUM` summiert eine Kostenart, die per ID benannt wird
 * (`docs/evaluator-architecture.md` §4.1: `CountedField { SELECTION_COUNT,
 * COST_SUM(costTypeId) }`).
 */
export const CountedFieldKind = Object.freeze({
  SELECTION_COUNT: 'selectionCount',
  COST_SUM: 'costSum',
});

/** Das Feld "Selektionsanzahl" als unveraenderlicher, parameterloser Wert. */
export const SELECTION_COUNT = Object.freeze({ kind: CountedFieldKind.SELECTION_COUNT });

/**
 * Das Feld "Kostensumme einer Kostenart", identifiziert **per ID** (nicht per
 * Name) — die Auspraegung von `COST_SUM(costTypeId)`.
 */
export function costSumField(costTypeId) {
  return Object.freeze({ kind: CountedFieldKind.COST_SUM, costTypeId });
}

/**
 * Bezugsrahmen-Schluesselwoerter (Scope) einer Query
 * (`docs/evaluator-architecture.md` §4.1: `ScopeKeyword { ROSTER, FORCE, PARENT,
 * SELF }`). Ein Scope, der keines dieser Woerter ist, wird als **ID** gelesen:
 * eine Eintrags-ID (naechster Vorfahre mit dieser ID) oder eine Kategorie-ID
 * (armeeweiter Kategorierahmen).
 */
export const ScopeKeyword = Object.freeze({
  ROSTER: 'roster',
  FORCE: 'force',
  PARENT: 'parent',
  SELF: 'self',
});

/**
 * Definitionsart eines Knotens. Die Join-Schicht braucht sie, um Kontingente
 * (Force) von Auswahlen (Entry) und Kategorien zu unterscheiden — nur Forces
 * begrenzen den `force`-Bezugsrahmen und die `includeChildForces`-Ausweitung,
 * nur Kategorien loesen die armeeweite Ziel-Typ-Regel aus (§3.3, BSData §7.7).
 */
export const DefinitionKind = Object.freeze({
  ENTRY: 'entry',
  FORCE: 'force',
  CATEGORY: 'category',
});

/**
 * Die drei Zaehl-Flags einer Query (`docs/evaluator-architecture.md` §4.1,
 * `record CountFlags`). Battlescribe-Vorgabe (XSD `QueryBase`): `shared` ist
 * standardmaessig **true** (armeeweit ueber alle Instanzen der Ziel-Definition),
 * die beiden `includeChild…`-Flags sind standardmaessig **false**.
 */
export const DEFAULT_FLAGS = Object.freeze({
  shared: true,
  includeChildSelections: false,
  includeChildForces: false,
});

/** Fuellt fehlende Flag-Felder mit der Battlescribe-Vorgabe (siehe {@link DEFAULT_FLAGS}). */
export function normalizeFlags(flags) {
  return {
    shared: flags?.shared ?? DEFAULT_FLAGS.shared,
    includeChildSelections: flags?.includeChildSelections ?? DEFAULT_FLAGS.includeChildSelections,
    includeChildForces: flags?.includeChildForces ?? DEFAULT_FLAGS.includeChildForces,
  };
}

/**
 * Sentinel fuer einen suspendierten Grenzwert: eine Prozentgrenze mit leerem
 * Bezugsrahmen (Nenner 0) wird weder erfuellt noch verletzt, sondern
 * ausgesetzt (`docs/evaluator-architecture.md` §4.7, Annahme A4).
 */
export const SUSPENDED = Symbol('suspended');

/** Klassifikation einer Diagnose (Auswertungsproblem, nie still verschluckt). */
export const DiagnosticKind = Object.freeze({
  UNRESOLVED_DEFINITION: 'unresolvedDefinition',
  DUPLICATE_DEFINITION: 'duplicateDefinition',
  UNSUPPORTED_CONSTRAINT: 'unsupportedConstraint',
  UNRESOLVED_SCOPE: 'unresolvedScope',
  UNSUPPORTED_FIELD: 'unsupportedField',
  ZERO_DENOMINATOR: 'zeroDenominator',
});

const SCOPE_KEY_SEPARATOR = '::';
const SCOPE_KEY_NO_TARGET = '*';

/**
 * Kodiert einen Index-Schluessel aus Bezugsrahmen und optionalem Ziel.
 * `null` als Ziel bedeutet "alles in diesem Rahmen" (Index-Schicht §3.4/§4.4).
 */
export function scopeKey(frame, targetId) {
  return `${frame}${SCOPE_KEY_SEPARATOR}${targetId ?? SCOPE_KEY_NO_TARGET}`;
}

/** Erzeugt eine unveraenderliche Diagnose. */
export function diagnostic(kind, detail = {}) {
  return Object.freeze({ kind, ...detail });
}
