/**
 * Das Query-Primitiv (`docs/evaluator-architecture.md` §4.5) — die **eine**
 * Stelle, die Bezugsrahmen, Ziele, Flags und Felder versteht. Grenze, Bedingung
 * und Wiederholung rufen ausschliesslich diese Funktion; sie ist die alleinige
 * Zaehlstelle der Engine.
 *
 * Umfang ab Issue 03: alle Bezugsrahmen (roster/force/parent/self sowie
 * Eintrags- und Kategorie-IDs) und alle Flags (`shared`,
 * `includeChildSelections`, `includeChildForces`) — auch in Kombination. Die
 * Domaenenregel „Kategorie-Ziel armeeweit, Eintrags-Ziel pro Kontingent"
 * (BSData §7.7) sitzt an genau dieser Stelle.
 */

import {
  CountedFieldKind,
  ScopeKeyword,
  DiagnosticKind,
  normalizeFlags,
  scopeKey,
  diagnostic,
} from './model.js';
import { frameKeyOf } from './evalTree.js';

/**
 * Buendelt den Auswertungs-Kontext einer Query
 * (`docs/evaluator-architecture.md` §4.5, `QueryContext`).
 *
 * @param {object} parts
 * @param {object} parts.node          die Bezugsinstanz, relativ zu der der Scope aufloest.
 * @param {object} parts.root          die Wurzel des Evaluationsbaums (der ROSTER-Rahmen).
 * @param {{ get: Function }} parts.index  der Zaehlindex.
 * @param {Set<string>} [parts.categoryIds]  die bekannten Kategorie-IDs (Ziel-Typ-Regel).
 * @param {object[]} parts.diagnostics  Sammelliste fuer Auswertungsprobleme.
 */
export function createQueryContext({ node, root, index, categoryIds, diagnostics }) {
  return { node, root, index, categoryIds: categoryIds ?? new Set(), diagnostics };
}

/** True, wenn die Ziel-ID eine Kategorie benennt (statt eines Eintrags). */
function isCategoryTarget(targetId, categoryIds) {
  return targetId !== null && targetId !== undefined && categoryIds.has(targetId);
}

/** Der naechste Vorfahre (den Knoten eingeschlossen), dessen Definition `id` traegt. */
function nearestAncestorWithDefId(node, id) {
  for (let current = node; current !== null && !current.isRoot; current = current.parent) {
    if (current.def?.id === id) return current;
  }
  return null;
}

/**
 * Loest ein Scope-Schluesselwort **oder** eine ID (Eintrag/Kategorie) in seinen
 * Rahmenknoten auf — der geteilte Fall fuer `shared="true"`. `parent` und
 * `shared="false"` werden vom Aufrufer vorab behandelt und erreichen diese
 * Funktion nicht.
 *
 * @returns {object|null} der Rahmenknoten, oder `null`, wenn der Scope nicht aufloest.
 */
function resolveSharedFrame(ctx, scope) {
  switch (scope) {
    case ScopeKeyword.ROSTER:
      return ctx.root;
    case ScopeKeyword.FORCE:
      return ctx.node.forceRoot; // null, wenn der Knoten ueber keinem Kontingent liegt
    case ScopeKeyword.SELF:
      return ctx.node;
    default:
      // Eine Kategorie-ID als Scope benennt den armeeweiten Kategorierahmen (die
      // Wurzel); eine Eintrags-ID den naechsten Vorfahren mit dieser ID.
      return isCategoryTarget(scope, ctx.categoryIds)
        ? ctx.root
        : nearestAncestorWithDefId(ctx.node, scope);
  }
}

/**
 * Bestimmt den Rahmenknoten einer Query aus Scope und Flags.
 *
 * - `parent` ist bereits an die Bezugsinstanz gebunden und geht **vor** `shared`
 *   (ADR-0003 §4): `shared="false"` schraenkt ihn nicht weiter ein.
 * - `shared="false"` bindet sonst unabhaengig vom Scope an den Teilbaum der
 *   tragenden Instanz (der Knoten selbst).
 * - Bei `shared="true"` bestimmt der Scope den Rahmen. Die **Ziel-Typ-Regel**
 *   (§7.7) gilt ausschliesslich fuer `scope="force"` (ADR-0003, ADR-0029): dort
 *   hebt ein **Kategorie-Ziel** den Rahmen armeeweit auf die Wurzel (eine Kategorie
 *   zaehlt ueber alle Kontingente), ein Eintrags-Ziel bleibt pro Kontingent. Andere
 *   Scopes (`self`, Eintrags-/Kategorie-ID) bleiben an ihrem Rahmen gebunden — ein
 *   Kategorie-Ziel weitet sie nicht auf.
 *
 * @returns {object|null} der Rahmenknoten, oder `null` bei nicht aufloesbarem Scope.
 */
function resolveFrame(ctx, scope, targetId, flags) {
  if (scope === ScopeKeyword.PARENT) return ctx.node.parent;
  if (!flags.shared) return ctx.node;

  const frame = resolveSharedFrame(ctx, scope);
  if (
    scope === ScopeKeyword.FORCE &&
    frame !== null &&
    isCategoryTarget(targetId, ctx.categoryIds)
  ) {
    return ctx.root;
  }
  return frame;
}

/**
 * Zaehlt `field` im Rahmen `scope`, gefiltert auf `targetId`, unter `flags`.
 *
 * @param {object} ctx  aus {@link createQueryContext} (traegt `node`, `root`, `index`, `categoryIds`, `diagnostics`).
 * @param {{ kind: string, costTypeId?: string }} field  aus `SELECTION_COUNT` / `costSumField`.
 * @param {string} scope  ein `ScopeKeyword` oder eine Eintrags-/Kategorie-ID.
 * @param {string|null} targetId  Ziel-ID oder `null` fuer "alles im Rahmen".
 * @param {{ shared?: boolean, includeChildSelections?: boolean, includeChildForces?: boolean }} [flags]
 * @returns {number}
 */
export function query(ctx, field, scope, targetId, flags) {
  const effectiveFlags = normalizeFlags(flags);
  const frame = resolveFrame(ctx, scope, targetId, effectiveFlags);
  if (frame === null || frame === undefined) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_SCOPE, { scope, targetId }));
    return 0;
  }

  const key = scopeKey(frameKeyOf(frame), targetId);
  const tally = ctx.index.get(key, effectiveFlags.includeChildSelections, effectiveFlags.includeChildForces);

  if (field.kind === CountedFieldKind.SELECTION_COUNT) {
    return tally.selectionCount;
  }
  if (field.kind === CountedFieldKind.COST_SUM) {
    return tally.costSums.get(field.costTypeId) ?? 0;
  }
  ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field }));
  return 0;
}
