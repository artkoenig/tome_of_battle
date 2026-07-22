import { getSelectionTotalCost, TOP_LEVEL_PARENT_COUNT } from './rosterCounter.js';
import { getModifiedConstraintValue } from './modifierEvaluator.js';
import { countSelections, rootSelectionsOf, childSelectionsOf } from './rosterTree.js';
import { SELECTIONS_FIELD } from '../parser/xmlParser.js';
import { ConstraintScope } from './battlescribeConstants.js';
import '../types.js';

/**
 * BattleScribe encodes an unbounded/unset numeric constraint as a negative value
 * (the catalogues use `-1`); such a value must never drive a selection decision as
 * if it were a real count, so it collapses to the caller's fallback.
 */
const UNBOUNDED_CONSTRAINT_SENTINEL = 0;

/**
 * The effective (modifier-adjusted) value of a single min/max constraint, normalised
 * for the selection / recruit / autofill decisions that consume it. A missing
 * constraint, or an effective value BattleScribe treats as unbounded/unset
 * (undefined/null or negative), collapses to `fallback`.
 *
 * This is the single seam through which the behaviour path (radio-vs-checkbox,
 * mandatory, quantity clamps) reads a limit, so it can never drift from the
 * modifier-aware label/validation path that already uses `getModifiedConstraintValue`.
 * `modifiers` are the effective modifiers of the constraint's own source (an option's
 * or a group's `getEffectiveModifiers`), and `ctx` gates their conditions.
 *
 * @param {Object|null|undefined} constraint the min/max constraint, or absent.
 * @param {Object[]} modifiers effective modifiers of the constraint's source.
 * @param {Object} [ctx] evaluation context gating the modifier conditions.
 * @param {number} [fallback] value for a missing/unbounded constraint.
 * @returns {number}
 */
export function getEffectiveConstraintLimit(constraint, modifiers, ctx = {}, fallback = UNBOUNDED_CONSTRAINT_SENTINEL) {
  if (!constraint) return fallback;
  const value = getModifiedConstraintValue(constraint, modifiers, ctx);
  return (value === undefined || value === null || value < 0) ? fallback : value;
}

/**
 * Evaluation of the BattleScribe constraint attributes `percentValue`,
 * `includeChildSelections` and `includeChildForces` (XSD `QueryBase`).
 *
 * These pure helpers keep the reference-quantity arithmetic out of the roster
 * validator, so the semantics can be unit-tested in isolation of the (large)
 * validation traversal.
 */

const PERCENT_DIVISOR = 100;

/**
 * A constraint whose value is a percentage of a reference quantity rather than
 * an absolute number. Schema-valid data signals this via the `percentValue`
 * boolean (ConstraintKind is only min/max). The legacy `percent` pseudo-type is
 * still recognised so any hand-built data keeps working.
 */
export function isPercentConstraint(constraint) {
  return constraint?.percentValue === true || constraint?.type === 'percent';
}

const PERCENT_SUFFIX = ' %';

/**
 * Formats an already-resolved constraint limit for display. A `percentValue`
 * constraint carries a percentage (e.g. 25 meaning 25 %), so the bare number is
 * indistinguishable from an absolute count of 25; appending the percent sign
 * makes the parsed `percentValue` flag actually visible in the UI. Absolute
 * constraints are returned unchanged.
 */
export function formatConstraintLimit(value, constraint) {
  return isPercentConstraint(constraint) ? `${value}${PERCENT_SUFFIX}` : `${value}`;
}

/**
 * True when the constraint counts a cost (points/resources), false when it
 * counts a number of selections. The single source of truth for the
 * "is this field a cost?" question across validator and UI.
 *
 * A field is a cost when it is the roster's configured cost-limit type or any
 * cost type the game system declares. `selections` (or an unknown field) is
 * treated as a selection count — no cost-type id may be assumed, since
 * `cost/@typeId` references an id the catalogue author chooses freely.
 */
export function isCostField(field, system, roster = null) {
  if (!field || field === SELECTIONS_FIELD) return false;
  if (roster && field === roster.costLimitType) return true;
  return !!system?.costTypes?.some(costType => costType.id === field);
}

/**
 * The top-level selections that make up a constraint's scope container.
 * - `roster`: every force's selections (the whole roster).
 * - `force` : the subject's own force, or — when `includeChildForces` is set —
 *   every force in the roster. `includeChildForces` officially widens the count
 *   to the force's descendant forces; the `.ros` import flattens nested forces
 *   into roster-level siblings (ADR-0011 §5), so no descendant relation survives
 *   in the roster model. "Every force" is the closest available superset.
 * - otherwise (`parent`/ancestor): the immediate parent selection's children,
 *   falling back to the force's selections.
 */
export function collectScopeSelections({ roster, force, scope, parentSelection, includeChildForces = false }) {
  if (scope === ConstraintScope.ROSTER) {
    return rootSelectionsOf(roster);
  }
  if (scope === ConstraintScope.FORCE) {
    return includeChildForces ? rootSelectionsOf(roster) : childSelectionsOf(force);
  }
  // An ancestor scope prefers the immediate parent's children, but a parent that
  // carries no `selections` at all falls back to the force's own selections.
  if (parentSelection?.selections) return childSelectionsOf(parentSelection);
  return childSelectionsOf(force);
}

/**
 * The reference quantity a `percentValue` constraint is measured against: the
 * total of the constraint's `field` across its scope.
 * - Cost field: the summed cost in scope. For a roster-wide percentage of the
 *   roster's limited cost type, the configured points budget (`costLimit`) is
 *   the natural reference and is used when available.
 * - Selection field: the total number of selections in scope, honouring
 *   `includeChildSelections`.
 */
export function getScopeReferenceTotal({ constraint, roster, system, force, parentSelection, forceCatalogueId, counts }) {
  const { field, scope, includeChildForces, includeChildSelections } = constraint;
  const scopeSelections = collectScopeSelections({ roster, force, scope, parentSelection, includeChildForces });

  if (isCostField(field, system, roster)) {
    if (scope === ConstraintScope.ROSTER && field === roster?.costLimitType && roster?.costLimit) {
      return roster.costLimit;
    }
    return scopeSelections.reduce(
      (sum, selection) => sum + getSelectionTotalCost(selection, field, TOP_LEVEL_PARENT_COUNT, {
        system, roster, currentCatalogueId: forceCatalogueId, parentSelection, counts
      }),
      0
    );
  }

  return countSelections(scopeSelections, { includeChildSelections });
}

/**
 * The absolute threshold a constraint's value resolves to. For a percentage
 * constraint this is `value% * reference`; otherwise it is the value itself.
 */
export function resolveConstraintThreshold({ constraint, value, roster, system, force, parentSelection, forceCatalogueId, counts }) {
  if (!isPercentConstraint(constraint)) return value;
  const reference = getScopeReferenceTotal({ constraint, roster, system, force, parentSelection, forceCatalogueId, counts });
  return (value / PERCENT_DIVISOR) * reference;
}
