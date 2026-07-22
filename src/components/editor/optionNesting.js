// Helpers that turn the collector's flat `ownerSelectionId` links into the editor's
// visual nesting. A re-emitted sub-option carries the roster-selection id of its
// immediate parent element as `ownerSelectionId` (see optionsCollector.js). To render
// that sub-option indented under its parent's row, we must map a rendered option row
// back to the roster selection it represents, so children pointing at that selection
// id can be placed beneath it. This is purely presentational: it never changes what is
// selected, counted, costed, or mutated.

/**
 * Depth-first lookup of a roster selection by id within a selection subtree.
 *
 * @param {Object|null} rootSelection - the selection subtree to search (e.g. the unit).
 * @param {string|null} targetId - the roster selection id to find.
 * @returns {Object|null} the matching selection, or null.
 */
export const findSelectionById = (rootSelection, targetId) => {
  if (!rootSelection || !targetId) return null;
  if (rootSelection.id === targetId) return rootSelection;
  for (const child of rootSelection.selections || []) {
    const found = findSelectionById(child, targetId);
    if (found) return found;
  }
  return null;
};

/**
 * The roster selection id that a rendered option row currently represents, or null when
 * the option is not selected. Re-emitted sub-options carry exactly this id as their
 * `ownerSelectionId`, which is how the editor derives nesting.
 *
 * @param {Object} rootSelection - the unit selection the editor is configuring.
 * @param {string|null} ownerSelectionId - the id of the selection owning the row's group
 *   (null for a group/option that belongs directly to the unit).
 * @param {Object} option - the collected option definition rendered in the row.
 * @param {Object|null} resolvedOption - the resolved entry for `option`.
 * @returns {string|null} the row's roster selection id, or null when unselected.
 */
export const resolveRowSelectionId = (rootSelection, ownerSelectionId, option, resolvedOption) => {
  const owner = ownerSelectionId ? findSelectionById(rootSelection, ownerSelectionId) : rootSelection;
  if (!owner) return null;
  const optionKey = option?.id;
  const targetKey = resolvedOption?.targetId || resolvedOption?.id;
  const match = (owner.selections || []).find(sel => {
    const key = sel.entryLinkId || sel.selectionEntryId;
    return key === optionKey || key === targetKey || key === resolvedOption?.id;
  });
  return match?.id ?? null;
};
