/**
 * Lesemodell des Regelwerk-Kontexts — die **einzige Tür** nach draußen.
 *
 * Hinter dieser Datei liegen zwei Ordner: `../acl/` übersetzt zwischen App-Roster und
 * Evaluator-Vertrag und hält den Auswertungs-Cache, `./` leitet aus dem Bericht die
 * Formen ab, die die Oberfläche liest. Kein Modul außerhalb von
 * `src/contexts/ruleengine/` importiert eines dieser Module direkt: Viewmodels
 * beziehen alles aus diesem Index (Issue 0186, AC6). Fehlt ein Name, wird er hier
 * re-exportiert statt am Index vorbei importiert.
 *
 * Der Index enthält selbst keine Logik — nur Re-Exporte.
 */

export { evaluateAppRoster, describeSystem } from '../acl/evaluationCache.js';
export { toEvaluatorRoster, slotPathsOf } from '../acl/rosterAdapter.js';

export { SlotIndex, EMPTY_SLOT_INDEX, resolvedDefIdOf } from './slotIndex.js';
export { costLimitTypeIdOf, costLimitLabelOf, extraResourceTotalsOf } from './costDisplays.js';
export { isBlockingViolation, countBlockingViolations, hasBlockingViolations } from './violationStats.js';
export { resolveListRuleGroupFromReport } from './listRuleGroups.js';
export { findMissingMandatoryListRules } from './mandatoryListRules.js';
export { armyWideSelectorSlotsOf } from './armyWideSelectorSlots.js';
export { unresolvedSelectionsOf } from './datasetDiagnostics.js';
export { useEvaluation } from './useEvaluation.js';
export { useRosterReportModel } from './rosterReport.js';
