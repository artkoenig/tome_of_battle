import { getSelectionTotalCost, TOP_LEVEL_PARENT_COUNT } from './rosterCounter.js';
import { countSelections, rootSelectionsOf, childSelectionsOf } from './rosterTree.js';
import { SELECTIONS_FIELD } from '../parser/xmlParser.js';
import '../types.js';

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
 * Cost-field aliases that are always points even when the game system does not
 * list them among its declared cost types: the generic `'pts'` id and the legacy
 * BattleScribe points cost-type UUID that older WFB data carries verbatim.
 */
const POINTS_COST_FIELD = 'pts';
const LEGACY_POINTS_COST_TYPE_ID = 'ecfa-8486-4f6c-c249';

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
 * A field is a cost when it is the generic `'pts'` id, the legacy points UUID,
 * the roster's configured cost-limit type, or any declared system cost type.
 * `selections` (or an unknown field) is treated as a selection count.
 */
export function isCostField(field, system, roster = null) {
  if (!field || field === SELECTIONS_FIELD) return false;
  if (field === POINTS_COST_FIELD || field === LEGACY_POINTS_COST_TYPE_ID) return true;
  if (roster && field === roster.costLimitType) return true;
  return !!system?.costTypes?.some(costType => costType.id === field);
}

/**
 * The top-level selections that make up a constraint's scope container.
 * - `roster`: every force's selections (the whole roster).
 * - `force` : the subject's own force, or — when `includeChildForces` is set —
 *   every force in the roster (child forces are flattened as roster siblings).
 * - otherwise (`parent`/ancestor): the immediate parent selection's children,
 *   falling back to the force's selections.
 */
export function collectScopeSelections({ roster, force, scope, parentSelection, includeChildForces = false }) {
  if (scope === 'roster') {
    return rootSelectionsOf(roster);
  }
  if (scope === 'force') {
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
    if (scope === 'roster' && field === roster?.costLimitType && roster?.costLimit) {
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
