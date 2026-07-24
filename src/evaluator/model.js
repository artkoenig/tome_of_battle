/**
 * Geteilte, unveraenderliche Wertdefinitionen der Reinraum-Auswertungs-Engine
 * (`src/evaluator/`, ADR-0030, `docs/evaluator-architecture.md` §4.1).
 *
 * Diese Datei buendelt die Enums, Schluessel-Kodierung und Diagnose-Fabrik, die
 * alle Schichten teilen. Fuer den Walking-Skeleton (Issue 01) ist bewusst nur
 * das Vokabular des duennsten Pfades vorhanden: eine MAX-Grenze auf die
 * Selektionsanzahl im ROSTER-Bezugsrahmen. Spaetere Scheiben erweitern die
 * Enums (MIN, COST_SUM, weitere Scopes) an genau dieser Stelle.
 */

/** Art einer Grenze. Skeleton wertet nur MAX aus; MIN folgt in einer spaeteren Scheibe. */
export const LimitKind = Object.freeze({
  MIN: 'min',
  MAX: 'max',
});

/** Gezaehltes Feld einer Query. Skeleton kennt nur die Selektionsanzahl. */
export const CountedField = Object.freeze({
  SELECTION_COUNT: 'selectionCount',
});

/** Bezugsrahmen (Scope) einer Query. Skeleton kennt nur den gesamten Roster. */
export const ScopeKeyword = Object.freeze({
  ROSTER: 'roster',
});

/** Klassifikation einer Diagnose (Auswertungsproblem, nie still verschluckt). */
export const DiagnosticKind = Object.freeze({
  UNRESOLVED_DEFINITION: 'unresolvedDefinition',
  DUPLICATE_DEFINITION: 'duplicateDefinition',
  UNSUPPORTED_CONSTRAINT: 'unsupportedConstraint',
  UNRESOLVED_SCOPE: 'unresolvedScope',
  UNSUPPORTED_FIELD: 'unsupportedField',
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
