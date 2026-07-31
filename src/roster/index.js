/**
 * Schreibmodell des App-Rosters (Issue 0121, Task 8).
 *
 * `src/roster/` bündelt alles, womit die Oberfläche das App-Roster **erzeugt,
 * editiert und strukturell traversiert**: die Selektions-Fabrik, das
 * Teilbaum-Editing, die Baum-Helfer, die Katalog-Auflösung (`resolveEntry`/
 * `findEntryInSystem`), den Katalog-Abgleich (`rosterSync`) sowie die
 * Struktur- und Anzeige-Helfer, die dafür nötig sind. Was dagegen **bewertet**
 * wird — Verletzungen, Verfügbarkeit, Kosten, Profile —, liefert allein der
 * Bericht der Evaluator-Fassade (`src/evaluator/evaluator.js`, ADR-0034);
 * dieses Modul importiert den Evaluator nie (Trennung wie ADR-0030,
 * maschinell geprüft in `.oxlintrc.json`/`.dependency-cruiser.cjs`).
 *
 * Dieser Index ist eine **Bequemlichkeits-Sammlung**, keine erzwungene
 * Fassade (anders als ADR-0023 für den alten Solver): Importe direkt aus den
 * Fachmodulen sind legitim; Tests sprechen die Fachmodule bewusst direkt an.
 */
export {
  childSelectionsOf, countSelections, findForceContainingSelection,
  findSelectionInRoster, mapSelectionTree, replaceSelectionById
} from './rosterTree.js';
export { findEntryInSystem, foreignCatalogueIdsOf, resolveEntry } from './catalogResolver.js';
export { isListRuleSelection, resolveListRuleGroup } from './listRules.js';
export { canGroupMaxBeRaisedAboveSingleChoice, getEffectiveModifiers } from './modifierEvaluator.js';
export { buildModifierEvalContext } from './modifierContext.js';
export {
  aggregateRosterCategoryCounts, computeRosterCounts,
  resolveCostLimitLabel, resolveCostLimitTypeId
} from './rosterCounter.js';
export {
  classifyGroupItem, classifyStandaloneOption, isGroupSingleChoice, isItemRepeatableWithinGroup
} from './selectionBehavior.js';
export { collectUnitProfilesAndRules } from './profileCollector.js';
export { reconcileImportedSelectionIds, syncRosterSelectionsWithSystem } from './rosterSync.js';
export { findForceEntryById } from './forceEntries.js';
export { isCategoryLinkHidden, isEntryPrimaryInCategory } from './entryVisibility.js';
export { collectUnreachableArmyWideSelectors } from './armyWideSelectors.js';
export { isIndependentSubUnit } from './subUnit.js';
export { getUnitOptions } from './optionsCollector.js';
export { groupProfilesByType } from './rulesEvaluator.js';
export { createSelectionFromDef } from './selectionFactory.js';
export { MODEL_COUNT_PROFILE_TYPES, UPGRADE_DETAILS_KEYWORDS } from './constants.js';
export { withAddedInstance, withChangedOptionCount, withoutInstance } from './subSelectionEditing.js';
