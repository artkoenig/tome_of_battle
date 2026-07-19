import { isListConfiguration, isListConfigurationEntry } from './listConfiguration.js';
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

/**
 * Katalog-Pendant zu isListConfigurationCategory: true, sobald jeder aktuell
 * sichtbare Katalog-Eintrag der Kategorie (siehe
 * getVisibleCatalogueEntriesForCategory) eine Listenkonfiguration ist —
 * unabhängig davon, ob schon eine Roster-Selection existiert. Das ist, was
 * eine noch komplett leere Listenkonfigurations-Kategorie (z. B. „Special
 * List Rules" direkt nach dem Import) sofort als Kachel statt über den
 * Aushebe-Dialog rendern lässt (main-issue 35).
 */
export function isListConfigurationCategoryFromEntries({ system, entries, catalogueId = null }) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  return entries.every(entry => isListConfigurationEntry({ system, entry, catalogueId }));
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
// Ein noch nicht gewählter Haupteintrag existiert nicht als Roster-Selection.
// Dieser Platzhalter hat exakt die Form, die createSelectionFromDef (useRoster.js)
// für einen frisch angelegten, noch kinderlosen Eintrag erzeugen würde — mit
// leeren `selections`, also im „Keine"-Zustand — damit getUnitOptions/
// activeOptionIds ihn wie eine echte Selection behandeln können.
function buildVirtualMainEntry(entry) {
  return {
    id: `virtual-${entry.id}`,
    entryLinkId: entry.targetId ? entry.id : null,
    selectionEntryId: entry.targetId ? null : entry.id,
    selections: []
  };
}

/**
 * Baut Haupteinträge entweder aus vorhandenen Roster-Selections (Standardfall,
 * `catalogueEntries` weggelassen — Armeeweite Auswahl/Sonstiges) oder, wenn
 * `catalogueEntries` übergeben wird, aus der vollständigen Katalogdefinition
 * einer Listenkonfigurations-Kategorie: für jeden Katalog-Eintrag wird die
 * passende vorhandene Selection verwendet, oder ein virtueller Platzhalter im
 * „Keine"-Zustand, falls der Spieler diesen Eintrag noch nicht gewählt hat.
 */
function resolveMainEntries(selections, catalogueEntries) {
  if (!catalogueEntries) {
    return (selections || []).map(selection => ({ selection, entryDef: null, isVirtual: false }));
  }

  const existingByEntryId = new Map(
    (selections || []).map(selection => [selection.entryLinkId || selection.selectionEntryId, selection])
  );

  return catalogueEntries.map(entryDef => {
    const existing = existingByEntryId.get(entryDef.id);
    return existing
      ? { selection: existing, entryDef, isVirtual: false }
      : { selection: buildVirtualMainEntry(entryDef), entryDef, isVirtual: true };
  });
}

export function buildConfigurationRadioGroups({ system, selections, catalogueEntries = null, catalogueId = null }) {
  return resolveMainEntries(selections, catalogueEntries).map(({ selection: mainEntry, entryDef, isVirtual }) => {
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
      entryDef,
      isVirtual,
      options,
      selectedOption: options.find(option => option.selected) || null
    };
  });
}
