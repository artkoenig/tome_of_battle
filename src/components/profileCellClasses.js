/**
 * Presentation mapping for profile-table cells.
 *
 * A characteristic's modification state (see `getModificationState`) decides how
 * its cell is highlighted. Both profile tables — the roster editor's and the
 * play-mode one — share this mapping so they cannot drift apart, and so the
 * concrete colours stay in the stylesheet layer as ADR-0004 requires.
 */

const BASE_PROFILE_CELL_CLASS = 'font-body';

const CLASSES_BY_MODIFICATION_STATE = {
  positive: 'text-success profile-cell--positive',
  negative: 'text-danger profile-cell--negative',
  modified: 'text-gold profile-cell--modified',
};

/**
 * @param {'positive'|'negative'|'modified'|null|undefined} modificationState
 * @returns {string} className for the profile-table cell
 */
export function getProfileCellClassName(modificationState) {
  const stateClasses = CLASSES_BY_MODIFICATION_STATE[modificationState];
  return stateClasses ? `${BASE_PROFILE_CELL_CLASS} ${stateClasses}` : BASE_PROFILE_CELL_CLASS;
}
