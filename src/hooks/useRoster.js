import { useRosterState } from '../viewmodels/useRosterState';
import '../types.js';

/**
 * Die flache Sicht auf `useRosterState` (Issue 0162): dieselben 21 Felder wie
 * bisher, damit jede Komponente unverändert weiterläuft, bis die ViewModels aus
 * ADR-0038 sie einzeln aus dem Kontext bedienen. Der Zustand selbst — Roster,
 * Auswahl, Kommandos, Bericht — liegt in `src/viewmodels/useRosterState.js`.
 *
 * @param {import('../types.js').Roster} initialRoster
 * @param {Object} system
 * @param {Function} saveRosterCallback
 * @param {(message: string) => void} [reportError] app-wide error channel; a failed
 *   autosave reaches the user through it instead of ending in the console.
 * @param {boolean} [isFreshRoster] true when `initialRoster` was created in this
 *   session (Issue 0138): gates the automatic addition of unconditional mandatory
 *   list rules (§9.9). Omitted or false for every existing caller keeps a
 *   pre-existing roster untouched (AC4) — the safe default.
 */
export function useRoster(initialRoster, system, saveRosterCallback, reportError, isFreshRoster) {
  const {
    roster,
    report,
    selectedRosterSelection,
    setSelectedRosterSelection,
    commands,
    canUndo,
    canRedo
  } = useRosterState(initialRoster, system, saveRosterCallback, reportError, isFreshRoster);

  return {
    roster,
    violations: report.violations,
    slots: report.slots,
    description: report.description,
    costTotals: report.costTotals,
    unresolvedSelections: report.unresolvedSelections,
    selectedRosterSelection,
    setSelectedRosterSelection,
    addUnit: commands.addUnit,
    removeUnit: commands.removeUnit,
    copyUnit: commands.copyUnit,
    subSelectionOperations: commands.subSelectionOperations,
    updateRosterName: commands.updateRosterName,
    save: commands.save,
    undo: commands.undo,
    redo: commands.redo,
    canUndo,
    canRedo
  };
}
