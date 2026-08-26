/**
 * Schreibmodell des App-Rosters (Issue 0121, Task 8).
 *
 * `src/contexts/armylist/model/` bündelt alles, womit die Oberfläche das App-Roster **erzeugt,
 * editiert und strukturell traversiert**: die Selektions-Fabrik, das
 * Teilbaum-Editing, die Baum-Helfer, die Katalog-Auflösung (`resolveEntry`/
 * `findEntryInSystem`), den Katalog-Abgleich (`rosterSync`) sowie die
 * Struktur- und Anzeige-Helfer, die dafür nötig sind. Was dagegen **bewertet**
 * wird — Verletzungen, Verfügbarkeit, Kosten, Profile —, liefert allein der
 * Bericht der Evaluator-Fassade (`src/contexts/ruleengine/evaluator.js`, ADR-0034);
 * dieses Modul importiert den Evaluator nie (Trennung wie ADR-0030,
 * maschinell geprüft in `.oxlintrc.json`/`.cast/rules.json`).
 *
 * Dieser Index ist eine **Bequemlichkeits-Sammlung**, keine erzwungene
 * Fassade (anders als ADR-0023 für den alten Solver): Importe direkt aus den
 * Fachmodulen sind legitim; Tests sprechen die Fachmodule bewusst direkt an.
 *
 * Seit Issue 0188 führt der Index die **Baum-Helfer** nicht mehr: `childSelectionsOf`,
 * `countSelections`, `mapSelectionTree`, `replaceSelectionById` und die
 * Unter-Auswahl-Operationen sind Werkzeug des Schreibmodells und seiner
 * Anwendungsfälle (`src/contexts/armylist/application/`). Die Oberfläche stellt
 * dem Aggregat stattdessen benannte Fragen — `unitsOfForce`, `subSelectionsOf`,
 * `countOptionInstances` —, und die cast-Regel `baum-helfer-nicht-in-der-ui`
 * hält den direkten Weg zu.
 */
export {
  findForceContainingSelection, findSelectionInRoster, subSelectionsOf, unitsOfForce
} from './rosterTree.js';
export { findEntryInSystem, foreignCatalogueIdsOf, resolveEntry } from './catalogResolver.js';
export {
  resolveCostLimitLabel, resolveCostLimitTypeId, resolveCostTypeLabel
} from './costTypeLabels.js';
export { reconcileImportedSelectionIds, syncRosterSelectionsWithSystem } from './rosterSync.js';
export { findForceEntryById } from './forceEntries.js';
export { getUnitOptions } from './optionsCollector.js';
export { groupProfilesByType } from './profileGrouping.js';
export { createSelectionFromDef } from './selectionFactory.js';
export { MODEL_COUNT_PROFILE_TYPES, UPGRADE_DETAILS_KEYWORDS } from './constants.js';
export { countOptionInstances } from './subSelectionEditing.js';
