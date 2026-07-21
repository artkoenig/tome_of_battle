/**
 * Fassade des Solvers (Regeln-Engine).
 *
 * Anwendungscode außerhalb von `src/solver/` importiert ausschließlich von
 * hier. Der Anspruch ist nicht bloß Konvention, sondern maschinell
 * durchgesetzt: die Lint-Regel `no-restricted-imports` in `.oxlintrc.json`
 * verbietet den direkten Zugriff auf die Fachmodule. Ausgenommen sind allein
 * Testdateien — sie sprechen einzelne Fachmodule bewusst direkt an, um deren
 * Nahtstellen isoliert zu prüfen oder zu mocken.
 *
 * Die Implementierung liegt in den Fachmodulen:
 *  - rosterTree:        Traversierungs-Primitive des Roster-Baums
 *  - catalogResolver:   Entry-Links/Einträge über Kataloggrenzen auflösen
 *  - modifierEvaluator: Battlescribe-Conditions/Modifier auswerten
 *  - rosterCounter:     Anzahl- und Punkteberechnung über das Roster
 *  - rosterValidator:   Constraint-Validierung des gesamten Rosters
 *  - profileCollector:  Profile/Regeln einer Einheit rekursiv einsammeln
 *  - rosterSync:        gespeicherte Roster mit dem System abgleichen
 *  - forceEntries:      Kontingente (Force Entries) nachschlagen
 *  - entryVisibility:   hidden-Status von Einträgen/Kategorie-Links
 *  - subUnit:           Prädikat „eigenständige Untereinheit"
 *  - battlescribeConstants: geteilte Format-Konstanten (Scopes, Limit-Feldpräfix)
 *  - optionsCollector:  wählbare Optionen einer Einheit einsammeln
 *  - rulesEvaluator:    Profile gruppieren, Rüstungs-/Rettungswürfe herleiten
 *  - selectionFactory:  Auswahl-Knoten aus einer Katalog-Definition erzeugen
 *  - systemQuirks:      systemspezifische Eigenheiten nachschlagen
 *  - constants:         Schlüsselwortlisten der Katalog-Heuristiken
 */
export {
  childSelectionsOf, rootSelectionsOf, effectiveCountOf, traverseSelectionTree, foldSelectionTree,
  findSelectionById, findSelectionInRoster, someSelection, someSelectionInSubtree, countSelections,
  findForceContainingSelection, mapSelectionTree, replaceSelectionById
} from './rosterTree.js';
export { findEntryInSystem, resolveEntry } from './catalogResolver.js';
export { isListRuleSelection, isListRuleEntryKind, resolveListRuleGroup } from './listRules.js';
export { evaluateCondition, evaluateConditionGroup, getModifiedConstraintValue, getEffectiveModifiers, getEffectiveCategoryLinks, collectTriggeredMessages, getEffectiveName, getEffectiveSelectionName, ValidationSeverity } from './modifierEvaluator.js';
export { getOptionDisplayCost, getSelectionTotalCost, getSelectionOwnCosts, calculateRosterCosts, computeRosterCounts, getExtraResourceTotals, resolveCostLimitTypeId, resolveCostTypeLabel, resolveCostLimitLabel, TOP_LEVEL_PARENT_COUNT } from './rosterCounter.js';
export { validateRoster, hasBlockingViolations, countBlockingViolations, VIOLATION_BLOCKS_ADD_AVAILABILITY, classifyBlocksAddAvailability } from './rosterValidator.js';
export { getEntryAddAvailability, isBlockingAvailabilityViolation } from './entryAvailability.js';
export { isPercentConstraint, isCostField, collectScopeSelections, getScopeReferenceTotal, resolveConstraintThreshold, formatConstraintLimit } from './constraintScope.js';
export { collectUnitProfilesAndRules } from './profileCollector.js';
export { syncRosterSelectionsWithSystem, reconcileImportedSelectionIds } from './rosterSync.js';
export { findForceEntryById, getAvailableForceEntries } from './forceEntries.js';
export { isCategoryLinkHidden, isSelectionEntryHidden, getEffectiveEntryCategoryLinks, isEntryPrimaryInCategory, collectPrimaryCategoryEntries } from './entryVisibility.js';
export { collectUnreachableArmyWideSelectors, collectForceScopedMinSelectors, isReachableViaForceCategories } from './armyWideSelectors.js';
export { isIndependentSubUnit, hasEntryChildren } from './subUnit.js';
export { ConstraintScope, NON_ENTRY_SCOPE_KEYWORDS, isEntryScope, ROSTER_LIMIT_FIELD_PREFIX, isRosterLimitField, costTypeIdOfRosterLimitField } from './battlescribeConstants.js';
export { getUnitOptions, isUniqueOptionTakenElsewhere, isOptionRosterUnique } from './optionsCollector.js';
export { groupProfilesByType } from './rulesEvaluator.js';
export { createSelectionFromDef } from './selectionFactory.js';
export { isQuirkGeneralEntryId } from './systemQuirks.js';
export { UPGRADE_DETAILS_KEYWORDS, GENERAL_EXACT_KEYWORDS, GENERAL_SUBSTRING_KEYWORDS, MODEL_COUNT_PROFILE_TYPES } from './constants.js';
export { withAddedInstance, withoutInstance, withChangedOptionCount } from './subSelectionEditing.js';
