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
 * ── Zwei Rahmen, die nichts zaehlen ──────────────────────────────────────────
 * Zwei Faelle werden **vor** jeder Rahmen- und Indexarbeit beantwortet, weil ihre
 * Antwort nicht aus dem Zaehlindex kommt: das Feld `limit::<costTypeId>` (die
 * eingestellte Kostengrenze aus dem Roster-Budget) und der Bezugsrahmen
 * `primary-catalogue` (der Armee-Katalog des Kontingents, BSData §7.7).
 *
 * ── Keine Antwort ist keine Null ─────────────────────────────────────────────
 * Hat eine Query in diesem Stand **keine** Antwort — unaufloesbarer Rahmen,
 * nicht budgetierte Kostenart, unentscheidbarer primaerer Katalog —, liefert sie
 * den {@link UNRESOLVED_QUERY}-Sentinel statt einer Zahl. Eine `0` waere hier eine
 * Behauptung („nichts gezaehlt"), die `notInstanceOf` als erfuellte Bedingung
 * liest; der Sentinel laesst jeden Konsumenten fail-closed schweigen (Issue 77).
 */

import {
  CountedFieldKind,
  ScopeKeyword,
  DiagnosticKind,
  BudgetLimitUnresolvedReason,
  UNRESOLVED_QUERY,
  normalizeFlags,
  scopeKey,
  diagnostic,
} from './model.js';
import { isOccurrenceOf } from './identity.js';
import { frameKeyOf, primaryCatalogueIdOf } from './evalTree.js';
import { EMPTY_ROSTER_BUDGET } from './rosterBudget.js';

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
 */
export function createQueryContext({ node, root, index, categoryIds, diagnostics, budget }) {
  return {
    node,
    root,
    index,
    categoryIds: categoryIds ?? new Set(),
    diagnostics,
    budget: budget ?? EMPTY_ROSTER_BUDGET,
  };
}

/**
 * Die Antwort auf `primary-catalogue` in der Waehrung des Query-Primitivs: die
 * Identitaetsfrage wird als Zaehlung *geschrieben* (`field="selections" value="1"`),
 * damit `instanceOf`/`notInstanceOf` unveraendert darauf rechnen (§7.7).
 */
const MATCHES_PRIMARY_CATALOGUE = 1;
const DIFFERS_FROM_PRIMARY_CATALOGUE = 0;

/** True, wenn die Ziel-ID eine Kategorie benennt (statt eines Eintrags). */
function isCategoryTarget(targetId, categoryIds) {
  return targetId !== null && targetId !== undefined && categoryIds.has(targetId);
}

/**
 * Der naechste Vorfahre (den Knoten eingeschlossen), der ein **Vorkommen** der
 * Definition `id` ist — also unter dieser Id zaehlt (`identity.js`). Damit findet
 * eine Grenze, die ihren Bezugsrahmen ueber die Eintrags-Id benennt, auch die per
 * Verweis gesetzte Auswahl als benannten Rahmen.
 */
function nearestAncestorWithDefId(node, id) {
  for (let current = node; current !== null && !current.isRoot; current = current.parent) {
    if (isOccurrenceOf(current.def, id)) return current;
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
 * {@link UNRESOLVED_QUERY}-Sentinel samt Diagnose — der Konsument feuert dann
 * **fail-closed** nicht (`design.md`, Kontrakt `query.js`).
 *
 * @returns {number|typeof UNRESOLVED_QUERY} der eingestellte Grenzwert, oder der Sentinel.
 */
function resolveLimitValue(ctx, field, scope) {
  const { costTypeId } = field;
  if (scope !== ScopeKeyword.ROSTER) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_BUDGET_LIMIT, {
      costTypeId,
      reason: BudgetLimitUnresolvedReason.NON_ROSTER_SCOPE,
      scope,
    }));
    return UNRESOLVED_QUERY;
  }
  const bound = ctx.budget.get(costTypeId);
  if (bound === undefined) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_BUDGET_LIMIT, {
      costTypeId,
      reason: BudgetLimitUnresolvedReason.NOT_BUDGETED,
    }));
    return UNRESOLVED_QUERY;
  }
  return bound;
}

/**
 * Beantwortet den Bezugsrahmen `primary-catalogue`: **ist der Armee-Katalog des
 * Kontingents, in dem der Knoten sitzt, der genannte Katalog?**
 * (`docs/battlescribe-data-format.md` §7.7).
 *
 * Das ist **keine Zaehlung**: `childId` benennt eine Katalog-Wurzel und damit nie
 * eine auswaehlbare Definition, es gibt also nichts zu zaehlen. `field="selections"
 * value="1"` ist die kanonische Schreibweise der Identitaetsfrage — entsprechend
 * bleiben `shared` und die beiden `includeChild…`-Flags ohne Wirkung. Belegt: 4 der
 * 27 Vorkommen tragen `includeChildSelections="true"` und bedeuten dasselbe wie die
 * uebrigen 23.
 *
 * Die Antwort wird in der Waehrung des Aufrufers gegeben — `1` fuer „ja", `0` fuer
 * „nein" —, damit `instanceOf` (`actual > 0`) und `notInstanceOf` (`actual === 0`)
 * unveraendert darauf rechnen. Ist der primaere Katalog **nicht entscheidbar**,
 * kommt statt einer erfundenen Zahl der {@link UNRESOLVED_QUERY}-Sentinel: die
 * Bedingung haelt dann weder in der einen noch in der anderen Richtung. Die
 * Diagnose dazu steht bereits vom Baumbau im Bericht
 * (`evalTree.js`, `bindPrimaryCatalogues`) — hier waere sie einmal je Bedingung
 * statt einmal je Kontingent.
 *
 * Ein anderes Feld als die Selektionszaehlung ist an diesem Rahmen **unbelegt**
 * (alle 27 Vorkommen tragen `field="selections"`). Was eine Kostensumme „im
 * Bezugsrahmen des primaeren Katalogs" bedeuten soll, sagen die Daten nicht — die
 * Frage wird deshalb gemeldet und nicht mit der Identitaetsantwort beantwortet.
 *
 * @returns {number|typeof UNRESOLVED_QUERY} `1`/`0`, oder der Sentinel.
 */
function resolvePrimaryCatalogue(ctx, field, targetId) {
  if (field.kind !== CountedFieldKind.SELECTION_COUNT) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNSUPPORTED_FIELD, { field, scope: ScopeKeyword.PRIMARY_CATALOGUE }));
    return UNRESOLVED_QUERY;
  }
  const primaryCatalogueId = primaryCatalogueIdOf(ctx.node);
  if (primaryCatalogueId === null) return UNRESOLVED_QUERY;
  return primaryCatalogueId === targetId ? MATCHES_PRIMARY_CATALOGUE : DIFFERS_FROM_PRIMARY_CATALOGUE;
}

/**
 * Zaehlt `field` im Rahmen `scope`, gefiltert auf `targetId`, unter `flags` — oder
 * liest, fuer ein `LIMIT_VALUE`-Feld, die eingestellte Grenze aus dem Budget.
 *
 * @param {object} ctx  aus {@link createQueryContext} (traegt `node`, `root`, `index`, `categoryIds`, `diagnostics`, `budget`).
 * @param {{ kind: string, costTypeId?: string }} field  aus `SELECTION_COUNT` / `costSumField` / `limitValueField`.
 * @param {string} scope  ein `ScopeKeyword` oder eine Eintrags-/Kategorie-ID.
 * @param {string|null} targetId  Ziel-ID oder `null` fuer "alles im Rahmen".
 * @param {{ shared?: boolean, includeChildSelections?: boolean, includeChildForces?: boolean }} [flags]
 * @returns {number|typeof UNRESOLVED_QUERY} die Zaehlung/Grenze/Antwort, oder der
 *   Sentinel, wenn die Query in diesem Stand keine Antwort hat.
 */
export function query(ctx, field, scope, targetId, flags) {
  // Ein `LIMIT_VALUE`-Feld kommt aus dem Budget, nicht aus dem Zaehlindex — daher
  // vor jeder Rahmen-/Index-Arbeit aufloesen (das Budget ist rahmen-unabhaengig).
  if (field.kind === CountedFieldKind.LIMIT_VALUE) {
    return resolveLimitValue(ctx, field, scope);
  }
  // `primary-catalogue` ist kein Zaehlrahmen, sondern eine Identitaetsfrage — aus
  // demselben Grund vor jeder Rahmen-/Index-Arbeit beantwortet (§7.7).
  if (scope === ScopeKeyword.PRIMARY_CATALOGUE) {
    return resolvePrimaryCatalogue(ctx, field, targetId);
  }

  const effectiveFlags = normalizeFlags(flags);
  const frame = resolveFrame(ctx, scope, targetId, effectiveFlags);
  if (frame === null || frame === undefined) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.UNRESOLVED_SCOPE, { scope, targetId }));
    // Fail-closed: ein Rahmen, der nicht aufloest, liefert **keine** Zahl. Frueher
    // stand hier `0` — und `notInstanceOf` (`actual === 0`) las das als „trifft zu",
    // sodass genau die Regeln feuerten, die der unaufloesbare Rahmen ausschliessen
    // sollte (Issue 77). Der Sentinel laesst jeden Konsumenten schweigen, sichtbar
    // begleitet von der Diagnose darueber.
    return UNRESOLVED_QUERY;
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
