/**
 * Das Query-Primitiv (`docs/evaluator-architecture.md` §4.5) — die eine Stelle,
 * die Scopes und Felder versteht. Limit (und in spaeteren Scheiben Condition
 * und Repeat) rufen ausschliesslich diese Funktion.
 *
 * Umfang: nur der ROSTER-Rahmen, dafuer beide Felder — Selektionsanzahl und
 * Kostensumme je Kostenart (per ID). Flags (`shared`, `includeChildSelections`,
 * ...) und weitere Scopes folgen in spaeteren Scheiben.
 */

import {
  CountedFieldKind,
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
 * @param {{ index: { get: (key: string) => { selectionCount: number, costSums: Map<string, number> } }, diagnostics: object[] }} ctx
 * @param {{ kind: string, costTypeId?: string }} field  Aus `SELECTION_COUNT` / `costSumField`.
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
  if (field.kind === CountedFieldKind.SELECTION_COUNT) {
    return tally.selectionCount;
  }
  if (field.kind === CountedFieldKind.COST_SUM) {
    return tally.costSums.get(field.costTypeId) ?? 0;
  }
  ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field }));
  return 0;
}
