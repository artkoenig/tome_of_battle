import { getModifiedConstraintValue } from '../roster/modifierEvaluator.js';
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
 * The absolute value a percentage of a reference quantity resolves to: `value% * reference`.
 * The single place the percent arithmetic lives, so every consumer (entry and group
 * percent limits) turns a percentage into an absolute threshold identically.
 */
export function applyPercentage(value, reference) {
  return (value / PERCENT_DIVISOR) * reference;
}
