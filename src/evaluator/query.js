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
 *
 * Zwei Rahmen sind **keine Zaehlrahmen** und werden deshalb vor jeder Rahmen- und
 * Indexarbeit beantwortet: das Feld `limit::<costTypeId>` liest die eingestellte
 * Kostengrenze aus dem Budget ({@link resolveLimitValue}), und
 * `scope="primary-catalogue"` prueft die Identitaet des Armeebuchs, aus dem das
 * umschliessende Kontingent stammt ({@link resolvePrimaryCatalogue}, Issue 077).
 */

import {
  CountedFieldKind,
  ScopeKeyword,
  DiagnosticKind,
  BudgetLimitUnresolvedReason,
  UNRESOLVED_BUDGET,
  normalizeFlags,
  scopeKey,
  diagnostic,
} from './model.js';
import { frameKeyOf } from './evalTree.js';
import { EMPTY_ROSTER_BUDGET } from './rosterBudget.js';

/** Der leere Herkunftsindex der Kontingente — geteilt, weil nur gelesen. */
const EMPTY_PRIMARY_CATALOGUE_INDEX = new Map();

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
 * @param {import('./rosterBudget.js').RosterBudget} [parts.budget]  die
 *   eingestellten Roster-Kostengrenzen (`RosterBudget`). In diesem Slice nur
 *   durchgereicht — die Feldauflösung (`limit::<id>`) liest es erst im
 *   Folge-Slice; fehlt es, gilt das leere Budget.
 * @param {Map<string, string>} [parts.primaryCatalogueByForceDefId]  der
 *   Herkunftsindex der Kontingente (`catalogSet.js`): je Kontingent-Definition
 *   das Armeebuch, das sie deklariert. Er beantwortet den Bezugsrahmen
 *   `primary-catalogue`; fehlt er, gilt die leere Zuordnung — jede solche Query
 *   bleibt dann fail-closed unaufgeloest.
 */
export function createQueryContext({ node, root, index, categoryIds, diagnostics, budget, primaryCatalogueByForceDefId }) {
  return {
    node,
    root,
    index,
    categoryIds: categoryIds ?? new Set(),
    diagnostics,
    budget: budget ?? EMPTY_ROSTER_BUDGET,
    primaryCatalogueByForceDefId: primaryCatalogueByForceDefId ?? EMPTY_PRIMARY_CATALOGUE_INDEX,
  };
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
 * Loest ein `LIMIT_VALUE(costTypeId)`-Feld aus dem Roster-Budget auf — **nicht**
 * aus dem Zaehlindex. Die eingestellte Grenze ist roster-weit: ein Scope ungleich
 * `roster` wird nicht still umgedeutet, sondern als Diagnose gemeldet. Eine nicht
 * budgetierte Kostenart liefert ebenfalls keine `0`, sondern den
 * {@link UNRESOLVED_BUDGET}-Sentinel samt Diagnose — der Konsument feuert dann
 * **fail-closed** nicht (`design.md`, Kontrakt `query.js`).
 *
 * @returns {number|typeof UNRESOLVED_BUDGET} der eingestellte Grenzwert, oder der Sentinel.
 */
function resolveLimitValue(ctx, field, scope) {
  const { costTypeId } = field;
  if (scope !== ScopeKeyword.ROSTER) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_BUDGET_LIMIT, {
      costTypeId,
      reason: BudgetLimitUnresolvedReason.NON_ROSTER_SCOPE,
      scope,
    }));
    return UNRESOLVED_BUDGET;
  }
  const bound = ctx.budget.get(costTypeId);
  if (bound === undefined) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_BUDGET_LIMIT, {
      costTypeId,
      reason: BudgetLimitUnresolvedReason.NOT_BUDGETED,
    }));
    return UNRESOLVED_BUDGET;
  }
  return bound;
}

/**
 * Beantwortet den Bezugsrahmen `primary-catalogue`: **ist das Armeebuch des
 * umschliessenden Kontingents das in `targetId` genannte?** (Issue 077, Kriterium
 * 1 — aus den Katalogdaten belegt: alle 27 Vorkommen tragen eine Katalog-Wurzel-Id
 * in `childId`.)
 *
 * Er ist **kein Zaehlrahmen**, sondern eine Identitaetspruefung: ein Katalog ist
 * kein Knoten des Instanzbaums, `scopeKey(frameKey, targetId)` faende ihn also
 * nie. Deshalb steht er — wie `limit::<id>` — **vor** jeder Rahmen- und Indexarbeit
 * und damit **unabhaengig von `shared`**: ein Katalog wird durch `shared="false"`
 * nicht enger.
 *
 * Der Antwortvertrag (Issue 077, Abschnitt „Plan"):
 *
 * | Lage                                                       | Ergebnis |
 * | ---                                                        | ---      |
 * | `targetId` ist die Katalog-Id des Kontingents              | 1        |
 * | `targetId` ist eine andere Katalog-Id                      | 0        |
 * | `targetId === null` (Prozent-Nenner „alles im Rahmen")     | 1 — der Rahmen hat genau **einen** Katalog |
 * | kein umschliessendes Kontingent, oder dessen Herkunft steht nicht im Index | 0 **mit** `unresolvedScope` |
 * | ein anderes Feld als `SELECTION_COUNT`                     | `unsupportedField` |
 *
 * Eine Katalog-Id, die in diesem Datensatz gar nicht geladen ist (in den
 * Fixture-Daten kommt das vor), ist ein schlichter **Nicht-Treffer** und kein
 * Datenfehler: die Regel fragt nach der Identitaet des Armeebuchs, nicht nach
 * seiner Anwesenheit.
 *
 * @returns {number} 0 oder 1.
 */
function resolvePrimaryCatalogue(ctx, field, targetId) {
  if (field.kind !== CountedFieldKind.SELECTION_COUNT) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field }));
    return 0;
  }
  const { forceRoot } = ctx.node;
  const catalogueId = forceRoot === null || forceRoot === undefined
    ? undefined
    : ctx.primaryCatalogueByForceDefId.get(forceRoot.def.id);
  if (catalogueId === undefined) {
    // Fail-closed statt stiller Falschauskunft: ohne umschliessendes Kontingent
    // (etwa an der Wurzel) oder wenn dessen Definition aus keinem Armeebuch
    // stammt — z. B. aus der `.gst` — gibt es kein Armeebuch zu vergleichen.
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_SCOPE, {
      scope: ScopeKeyword.PRIMARY_CATALOGUE,
      targetId,
    }));
    return 0;
  }
  if (targetId === null || targetId === undefined) return 1;
  return targetId === catalogueId ? 1 : 0;
}

/**
 * Zaehlt `field` im Rahmen `scope`, gefiltert auf `targetId`, unter `flags` — oder
 * liest, fuer ein `LIMIT_VALUE`-Feld, die eingestellte Grenze aus dem Budget.
 *
 * @param {object} ctx  aus {@link createQueryContext} (traegt `node`, `root`, `index`, `categoryIds`, `diagnostics`, `budget`, `primaryCatalogueByForceDefId`).
 * @param {{ kind: string, costTypeId?: string }} field  aus `SELECTION_COUNT` / `costSumField` / `limitValueField`.
 * @param {string} scope  ein `ScopeKeyword` oder eine Eintrags-/Kategorie-ID.
 * @param {string|null} targetId  Ziel-ID oder `null` fuer "alles im Rahmen".
 * @param {{ shared?: boolean, includeChildSelections?: boolean, includeChildForces?: boolean }} [flags]
 * @returns {number|typeof UNRESOLVED_BUDGET} die Zaehlung/Grenze, oder der
 *   Budget-Sentinel bei einem unaufloesbaren `LIMIT_VALUE`-Feld.
 */
export function query(ctx, field, scope, targetId, flags) {
  // Ein `LIMIT_VALUE`-Feld kommt aus dem Budget, nicht aus dem Zaehlindex — daher
  // vor jeder Rahmen-/Index-Arbeit aufloesen (das Budget ist rahmen-unabhaengig).
  if (field.kind === CountedFieldKind.LIMIT_VALUE) {
    return resolveLimitValue(ctx, field, scope);
  }

  // Der Katalog-Rahmen ist kein Zaehlrahmen, sondern eine Identitaetspruefung —
  // daher ebenfalls vor jeder Rahmen-/Index-Arbeit und unabhaengig von `shared`
  // ({@link resolvePrimaryCatalogue}, Issue 077).
  if (scope === ScopeKeyword.PRIMARY_CATALOGUE) {
    return resolvePrimaryCatalogue(ctx, field, targetId);
  }

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
  if (field.kind === CountedFieldKind.FORCE_COUNT) {
    return tally.forceCount;
  }
  if (field.kind === CountedFieldKind.COST_SUM) {
    return tally.costSums.get(field.costTypeId) ?? 0;
  }
  ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field }));
  return 0;
}
