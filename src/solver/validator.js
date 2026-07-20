/**
 * Fassade des Solvers (Regeln-Engine).
 *
 * Die restliche App importiert ausschließlich von hier; die Implementierung
 * liegt in den Fachmodulen:
 *  - catalogResolver:   Entry-Links/Einträge über Kataloggrenzen auflösen
 *  - modifierEvaluator: Battlescribe-Conditions/Modifier auswerten
 *  - rosterCounter:     Anzahl- und Punkteberechnung über das Roster
 *  - rosterValidator:   Constraint-Validierung des gesamten Rosters
 *  - profileCollector:  Profile/Regeln einer Einheit rekursiv einsammeln
 *  - rosterSync:        gespeicherte Roster mit dem System abgleichen
 *  - forceEntries:      Kontingente (Force Entries) nachschlagen
 *  - entryVisibility:   hidden-Status von Einträgen/Kategorie-Links
 */
export { findEntryInSystem, resolveEntry } from './catalogResolver.js';
export { isListRuleSelection, isListRuleEntryKind, resolveListRuleGroup } from './listRules.js';
export { evaluateCondition, evaluateConditionGroup, getModifiedConstraintValue, getEffectiveModifiers, getEffectiveCategoryLinks, collectTriggeredMessages, getEffectiveName, getEffectiveSelectionName, ValidationSeverity } from './modifierEvaluator.js';
export { getOptionDisplayCost, getSelectionTotalCost, getSelectionOwnCosts, calculateRosterCosts, computeRosterCounts, getExtraResourceTotals, TOP_LEVEL_PARENT_COUNT } from './rosterCounter.js';
export { validateRoster, hasBlockingViolations, countBlockingViolations } from './rosterValidator.js';
export { getEntryAddAvailability, isBlockingAvailabilityViolation } from './entryAvailability.js';
export { isPercentConstraint, isCostField, countSelections, collectScopeSelections, getScopeReferenceTotal, resolveConstraintThreshold, formatConstraintLimit } from './constraintScope.js';
export { collectUnitProfilesAndRules } from './profileCollector.js';
export { syncRosterSelectionsWithSystem, reconcileImportedSelectionIds } from './rosterSync.js';
export { findForceEntryById, getAvailableForceEntries } from './forceEntries.js';
export { isCategoryLinkHidden, isSelectionEntryHidden, getEffectiveEntryCategoryLinks, isEntryPrimaryInCategory, collectPrimaryCategoryEntries } from './entryVisibility.js';
export { collectUnreachableArmyWideSelectors, collectForceScopedMinSelectors, isReachableViaForceCategories } from './armyWideSelectors.js';
