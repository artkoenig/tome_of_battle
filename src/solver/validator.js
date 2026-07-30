/**
 * Fassade des Solvers (Alt-Engine der Validierung, ADR-0030: wird abgelöst).
 *
 * Seit Issue 0121 (Task 8) ist das Schreibmodell des Rosters — Fabrik,
 * Baum-Helfer, Auflösung, Abgleich, Struktur-Konstanten — nach `src/roster/`
 * umgezogen; Produktivcode außerhalb von `src/solver/` importiert aus dieser
 * Fassade **nichts** mehr. Sie besteht nur noch für die verbliebenen
 * Validierungs-Tests der Alt-Engine (und für Alt-Test-Mocks, die diesen
 * Modulpfad ersetzen) und schrumpft auf genau deren Bedarf; sie stirbt mit
 * `src/solver/` in Task 10.
 */
export { validateRoster, hasBlockingViolations, VIOLATION_BLOCKS_ADD_AVAILABILITY, classifyBlocksAddAvailability } from './rosterValidator.js';
export { getEntryAddAvailability, isBlockingAvailabilityViolation } from './entryAvailability.js';
export { evaluateCondition, getModifiedConstraintValue } from '../roster/modifierEvaluator.js';
