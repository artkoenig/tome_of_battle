import { isListConfiguration } from './listConfiguration.js';
import { resolveEntry } from './catalogResolver.js';
import { getUnitOptions } from './optionsCollector.js';

/**
 * Editor-facing view model for the in CONTEXT.md defined „Listenkonfiguration".
 *
 * Child-Issue 01 introduced the classification predicate `isListConfiguration`
 * for a single selection. This module builds on it — it never re-derives the
 * classification — to answer the two questions the Heerlager editor needs:
 *   1. Should a whole category render as one collapsible configuration card
 *      instead of individual unit cards? (`isListConfigurationCategory`)
 *   2. Which radio options does each list-configuration main entry
 *      („Haupteintrag") expose, and which one is currently active on the
 *      roster? (`buildConfigurationRadioGroups`)
 */

/**
 * A category renders as a single list-configuration card exactly when it holds
 * at least one selection and every one of its selections is classified as a
 * list configuration. A category that also contains a real playable unit stays
 * on the normal unit-card path.
 */
export function isListConfigurationCategory({ system, force, selections, catalogueId = null }) {
  if (!Array.isArray(selections) || selections.length === 0) return false;
  return selections.every(selection =>
    isListConfiguration({ system, force, selection, catalogueId })
  );
}

// A stored sub-selection references its option through entryLinkId (linked
// entries) or selectionEntryId (inline entries); both equal the option def's own
// id, which is what the editor's increment/decrement actions key on.
function activeOptionIds(mainEntrySelection) {
  return new Set(
    (mainEntrySelection.selections || []).map(child => child.entryLinkId || child.selectionEntryId)
  );
}

/**
 * Builds one radio group per list-configuration main entry: every selectable
 * option together with the flag whether it is currently active on the roster.
 * The implicit „Keine" (none) choice is represented by `selectedOption === null`
 * rather than as an option row, so the card can render it once per group.
 *
 * Options are collected without a visibility context (the raw, unfiltered set):
 * list-configuration switches expose plain radio choices that are never
 * conditionally hidden, and staying context-free keeps this builder pure and
 * independent of roster-count computation.
 */
export function buildConfigurationRadioGroups({ system, selections, catalogueId = null }) {
  return (selections || []).map(mainEntry => {
    const optionItems = getUnitOptions(system, catalogueId, mainEntry, null);
    const selectedIds = activeOptionIds(mainEntry);

    const options = optionItems.map(item => {
      const resolved = resolveEntry(system, item.option, catalogueId);
      return {
        optionId: item.option.id,
        name: resolved?.name || item.option.name,
        def: item.option,
        selected: selectedIds.has(item.option.id)
      };
    });

    return {
      mainEntrySelectionId: mainEntry.id,
      options,
      selectedOption: options.find(option => option.selected) || null
    };
  });
}
