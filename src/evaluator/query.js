/**
 * Das Query-Primitiv (`docs/evaluator-architecture.md` §4.5) — die eine Stelle,
 * die Scopes und Felder versteht. Limit (und in spaeteren Scheiben Condition
 * und Repeat) rufen ausschliesslich diese Funktion.
 *
 * Skeleton-Umfang: nur der ROSTER-Rahmen und das Feld Selektionsanzahl. Flags
 * (`shared`, `includeChildSelections`, ...) und weitere Scopes folgen spaeter.
 */

import {
  CountedField,
  ScopeKeyword,
  DiagnosticKind,
  scopeKey,
  diagnostic,
} from './model.js';

/** Loest ein Scope-Schluesselwort in seinen Index-Rahmen auf. */
function resolveFrame(scope) {
  return scope === ScopeKeyword.ROSTER ? ScopeKeyword.ROSTER : null;
}

/**
 * Zaehlt `field` im Rahmen `scope`, gefiltert auf `targetId`.
 *
 * @param {{ index: { get: (key: string) => { selectionCount: number } }, diagnostics: object[] }} ctx
 * @param {string} field  Aus `CountedField`.
 * @param {string} scope  Aus `ScopeKeyword`.
 * @param {string|null} targetId  Ziel-ID oder `null` fuer "alles im Rahmen".
 * @returns {number}
 */
export function query(ctx, field, scope, targetId) {
  const frame = resolveFrame(scope);
  if (frame === null) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_SCOPE, { scope }));
    return 0;
  }
  const tally = ctx.index.get(scopeKey(frame, targetId));
  if (field === CountedField.SELECTION_COUNT) {
    return tally.selectionCount;
  }
  ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field }));
  return 0;
}
