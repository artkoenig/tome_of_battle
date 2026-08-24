/**
 * The write commands of the editor (Issue 0176, cut out of `useRosterState.js`).
 *
 * `createRosterCommands` is a plain factory: it hangs on the report and the
 * roster, not on the state apparatus. `useRosterState` rebuilds this bundle in
 * every render and calls into it through `currentCommandsRef`, which is what
 * keeps the **exported** commands identity-stable (ADR-0038).
 */

import {
  childSelectionsOf,
  mapSelectionTree,
  replaceSelectionById,
  withAddedInstance,
  withoutInstance,
  withChangedOptionCount,
} from '../../domain/roster';
import { catalogueIdOfForce, catalogueIdContaining, createSelectionFactory } from './rosterSelectionFactory';
import '../../domain/types.js';

/** Ohne benanntes Ziel-Kontingent hebt die App in das erste des Rosters aus. */
const FALLBACK_FORCE_INDEX = 0;

/**
 * Das eine Kontingent, in das eine ausgehobene Einheit gehört: das der aktiven
 * Ansicht, ersatzweise das erste des Rosters. Ein `.ros`-Import bringt beliebig
 * viele Kontingente mit, deshalb muss das Ziel eindeutig bestimmt sein.
 * @param {import('../../domain/types.js').Force[]} forces
 * @param {string|null} targetForceId
 * @returns {import('../../domain/types.js').Force|null}
 */
export function findTargetForce(forces, targetForceId) {
  if (!forces?.length) return null;
  return forces.find(force => force.id === targetForceId) ?? forces[FALLBACK_FORCE_INDEX];
}

/**
 * The write commands for one render of the state node.
 * @param {Object} args
 * @param {import('../../domain/types.js').Roster} args.roster
 * @param {Object} args.system
 * @param {import('../../domain/evaluation/slotIndex.js').SlotIndex} args.slots
 * @param {Function} args.setRoster undoable roster writer
 * @param {string|null} args.selectedSelectionId
 * @param {(selectionId: string|null) => void} args.setSelectedSelectionId
 * @param {(roster: import('../../domain/types.js').Roster) => Promise<void>} args.saveNow
 */
export function createRosterCommands({
  roster, system, slots, setRoster, selectedSelectionId, setSelectedSelectionId, saveNow,
}) {
  const createSelectionFromDef = createSelectionFactory(system);

  /** Die Pflicht-Mitglieder, die der Bericht dem Angebot `defId` unter `forceId` gibt. */
  const raiseMembersInForce = (forceId, defId) =>
    slots.findChildSlot(slots.pathOfForce(forceId), defId)?.raiseMembers ?? [];

  /** Dieselbe Frage unterhalb einer Einheit: eine Option hängt ggf. unter einem Gruppen-Anker. */
  const raiseMembersUnderSelection = (selectionId, defId) =>
    slots.findDescendantSlot(slots.pathOfSelection(selectionId), defId)?.raiseMembers ?? [];

  /**
   * Hebt `entry` in genau ein Kontingent aus.
   * @param {Object} entry Katalogeintrag, aus dem die Selektion gebaut wird
   * @param {string} categoryId Kategorie, unter der die Einheit geführt wird
   * @param {string} [targetForceId] Kontingent der aktiven Ansicht; ohne Angabe
   *   das erste Kontingent des Rosters
   */
  const addUnit = (entry, categoryId, targetForceId = null) => {
    const force = findTargetForce(roster?.forces, targetForceId);
    const newUnit = createSelectionFromDef(
      entry, categoryId, catalogueIdOfForce(roster, force),
      raiseMembersInForce(force?.id, entry.id)
    );
    if (!newUnit) return;

    setRoster(prev => {
      const targetForce = findTargetForce(prev.forces, targetForceId);
      if (!targetForce) return prev;

      const updatedForces = prev.forces.map(force => (
        force === targetForce
          ? { ...force, selections: [...childSelectionsOf(force), newUnit] }
          : force
      ));
      return {
        ...prev,
        forces: updatedForces
      };
    });

    setSelectedSelectionId(newUnit.id);
  };

  const removeUnit = (selectionId) => {
    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        return {
          ...force,
          selections: force.selections.filter(s => s.id !== selectionId)
        };
      });
      return {
        ...prev,
        forces: updatedForces
      };
    });

    if (selectedSelectionId === selectionId) {
      setSelectedSelectionId(null);
    }
  };

  const copyUnit = (selectionId) => {
    // Jede Selection des Teilbaums erhält eine frische Id, damit die Kopie mit
    // dem Original nicht kollidiert.
    const cloneSelection = (unit) => mapSelectionTree(unit, (selection, clonedChildren) => ({
      ...selection,
      id: crypto.randomUUID(),
      selections: clonedChildren
    }));

    setRoster(prev => {
      let unitToCopy = null;
      for (const force of prev.forces) {
        unitToCopy = force.selections?.find(s => s.id === selectionId);
        if (unitToCopy) break;
      }
      if (!unitToCopy) return prev;

      const clonedUnit = cloneSelection(unitToCopy);

      const updatedForces = prev.forces.map(force => {
        if (force.selections?.some(s => s.id === selectionId)) {
          const idx = force.selections.findIndex(s => s.id === selectionId);
          const newSelections = [...force.selections];
          newSelections.splice(idx + 1, 0, clonedUnit);
          return {
            ...force,
            selections: newSelections
          };
        }
        return force;
      });

      return {
        ...prev,
        forces: updatedForces
      };
    });
  };

  /**
   * Ersetzt die Kind-Liste der Einheit `unitSelectionId` — beliebiger Tiefe im
   * Roster — durch das Ergebnis von `changeChildSelections`. Die gemeinsame
   * Verdrahtung aller Unter-Auswahl-Operationen mit dem Roster-State.
   * @param {string} unitSelectionId
   * @param {(childSelections: import('../../domain/types.js').Selection[]) => import('../../domain/types.js').Selection[]} changeChildSelections
   */
  const updateUnitChildSelections = (unitSelectionId, changeChildSelections) => {
    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        const currentSelections = childSelectionsOf(force);
        const updatedSelections = replaceSelectionById(currentSelections, unitSelectionId, unit => ({
          ...unit,
          selections: changeChildSelections(childSelectionsOf(unit))
        }));
        if (updatedSelections === currentSelections) return force;
        return { ...force, selections: updatedSelections };
      });

      return { ...prev, forces: updatedForces };
    });
  };

  /** Legt eine weitere, eigenständig geführte Instanz einer Option an. */
  const addSubSelectionInstance = (unitSelectionId, optionDefinition) =>
    updateUnitChildSelections(unitSelectionId, childSelections =>
      withAddedInstance(childSelections, createSelectionFromDef(
        optionDefinition, null, catalogueIdContaining(roster, unitSelectionId),
        raiseMembersUnderSelection(unitSelectionId, optionDefinition.id)
      )));

  /** Entfernt eine einzeln geführte Instanz anhand ihrer Selection-Id. */
  const removeSubSelectionInstance = (unitSelectionId, instanceSelectionId) =>
    updateUnitChildSelections(unitSelectionId, childSelections =>
      withoutInstance(childSelections, instanceSelectionId));

  const changeSubSelectionCount = (unitSelectionId, optionDefinition, countDelta) =>
    updateUnitChildSelections(unitSelectionId, childSelections =>
      withChangedOptionCount(
        childSelections,
        optionDefinition.id,
        countDelta,
        () => createSelectionFromDef(
          optionDefinition, null, catalogueIdContaining(roster, unitSelectionId),
          raiseMembersUnderSelection(unitSelectionId, optionDefinition.id)
        )
      ));

  const updateRosterName = (newName) => {
    setRoster(prev => ({
      ...prev,
      name: newName
    }));
  };

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
