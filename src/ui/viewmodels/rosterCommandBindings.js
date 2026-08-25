/**
 * The write commands of the editor as **bindings**, not as behaviour
 * (Issue 0188, successor of `rosterCommands.js`).
 *
 * Every command here does three things and nothing else: it calls one use case
 * of the list context (`src/contexts/armylist/application/`), it hands the
 * result to the undoable roster writer, and it keeps the UI's own selection
 * state in step. The selection tree is rewritten in the use case, never here.
 *
 * `useRosterState` rebuilds this bundle in every render and calls into it
 * through `currentCommandsRef`, which is what keeps the **exported** commands
 * identity-stable (ADR-0038).
 */

import { raiseUnit } from '../../contexts/armylist/application/raiseUnit.js';
import { removeUnit as removeUnitFrom } from '../../contexts/armylist/application/removeUnit.js';
import { copyUnit as copyUnitIn } from '../../contexts/armylist/application/copyUnit.js';
import { renameRoster } from '../../contexts/armylist/application/renameRoster.js';
import {
  addSubSelectionInstance as addInstanceTo,
  removeSubSelectionInstance as removeInstanceFrom,
  changeOptionCount,
} from '../../contexts/armylist/application/subSelectionUseCases.js';
import '../../shared/rostermodel/types.js';

/**
 * The write commands for one render of the state node.
 * @param {Object} args
 * @param {import('../../shared/rostermodel/types.js').Roster} args.roster
 * @param {Object} args.system
 * @param {import('../../contexts/ruleengine/readmodel/index.js').SlotIndex} args.slots
 * @param {Function} args.setRoster undoable roster writer
 * @param {string|null} args.selectedSelectionId
 * @param {(selectionId: string|null) => void} args.setSelectedSelectionId
 * @param {(roster: import('../../shared/rostermodel/types.js').Roster) => Promise<void>} args.saveNow
 */
export function bindRosterCommands({
  roster, system, slots, setRoster, selectedSelectionId, setSelectedSelectionId, saveNow,
}) {
  /**
   * Hebt `entry` aus und markiert die entstandene Einheit.
   * @param {Object} entry Katalogeintrag, aus dem die Selektion gebaut wird
   * @param {string} categoryId Kategorie, unter der die Einheit geführt wird
   * @param {string|null} [targetForceId] Kontingent der aktiven Ansicht; ohne
   *   Angabe das erste Kontingent des Rosters
   */
  const addUnit = (entry, categoryId, targetForceId = null) => {
    const { roster: nextRoster, unit } = raiseUnit(roster, {
      entry, categoryId, targetForceId, system, slots,
    });
    if (!unit) return;

    setRoster(nextRoster);
    setSelectedSelectionId(unit.id);
  };

  const removeUnit = (selectionId) => {
    setRoster(prev => removeUnitFrom(prev, selectionId));

    if (selectedSelectionId === selectionId) {
      setSelectedSelectionId(null);
    }
  };

  const copyUnit = (selectionId) => setRoster(prev => copyUnitIn(prev, selectionId));

  const addSubSelectionInstance = (unitSelectionId, optionDefinition) =>
    setRoster(prev => addInstanceTo(prev, { unitSelectionId, optionDefinition, system, slots }));

  const removeSubSelectionInstance = (unitSelectionId, instanceSelectionId) =>
    setRoster(prev => removeInstanceFrom(prev, { unitSelectionId, instanceSelectionId }));

  const changeSubSelectionCount = (unitSelectionId, optionDefinition, countDelta) =>
    setRoster(prev => changeOptionCount(
      prev, { unitSelectionId, optionDefinition, countDelta, system, slots }
    ));

  const updateRosterName = (newName) => setRoster(prev => renameRoster(prev, newName));

  const save = async () => {
    await saveNow(roster);
  };

  return {
    addUnit,
    removeUnit,
    copyUnit,
    addSubSelectionInstance,
    removeSubSelectionInstance,
    changeSubSelectionCount,
    updateRosterName,
    save,
  };
}
