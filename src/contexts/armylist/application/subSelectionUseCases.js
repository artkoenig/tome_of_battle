/**
 * Die Anwendungsfälle auf den Unter-Auswahlen einer Einheit (Issue 0188):
 * `addSubSelectionInstance`, `removeSubSelectionInstance`, `changeOptionCount`.
 *
 * Alle drei sind reine Funktionen vom Roster auf das Roster. Sie teilen sich
 * eine Verdrahtung — die Kindliste der Einheit `unitSelectionId` beliebiger
 * Tiefe wird ersetzt —, und die eigentliche Listenregel steht weiter genau
 * einmal im Modell (`subSelectionEditing.js`).
 *
 * Die Slot-Seite des Berichts wird hereingereicht (ADR-0039).
 */

import { childSelectionsOf, replaceSelectionById } from '../model/rosterTree.js';
import {
  withAddedInstance, withoutInstance, withChangedOptionCount
} from '../model/subSelectionEditing.js';
import { catalogueIdContaining, createSelectionFactory } from './rosterSelectionFactory.js';
import '../../../shared/rostermodel/types.js';

/**
 * Ersetzt die Kind-Liste der Einheit `unitSelectionId` — beliebiger Tiefe im
 * Roster — durch das Ergebnis von `changeChildSelections`. Findet sich die
 * Einheit nicht, kommt das Roster unverändert zurück.
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {string} unitSelectionId
 * @param {(childSelections: import('../../../shared/rostermodel/types.js').Selection[]) => import('../../../shared/rostermodel/types.js').Selection[]} changeChildSelections
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
function updateUnitChildSelections(roster, unitSelectionId, changeChildSelections) {
  const forces = roster?.forces ?? [];
  const updatedForces = forces.map(force => {
    const currentSelections = childSelectionsOf(force);
    const updatedSelections = replaceSelectionById(currentSelections, unitSelectionId, unit => ({
      ...unit,
      selections: changeChildSelections(childSelectionsOf(unit))
    }));
    if (updatedSelections === currentSelections) return force;
    return { ...force, selections: updatedSelections };
  });

  return { ...roster, forces: updatedForces };
}

/**
 * Dieselbe Frage wie beim Ausheben, nur unterhalb einer Einheit: eine Option
 * hängt gegebenenfalls unter einem Gruppen-Anker.
 * @param {Object} slots Slot-Seite des Berichts (`report.slots`)
 */
function raiseMembersUnderSelection(slots, selectionId, defId) {
  return slots.findDescendantSlot(slots.pathOfSelection(selectionId), defId)?.raiseMembers ?? [];
}

/** Erzeugt die Selektion einer Option unterhalb von `unitSelectionId`. */
function createOptionSelection(roster, { unitSelectionId, optionDefinition, system, slots }) {
  return createSelectionFactory(system)(
    optionDefinition, null, catalogueIdContaining(roster, unitSelectionId),
    raiseMembersUnderSelection(slots, unitSelectionId, optionDefinition.id)
  );
}

/**
 * Legt eine weitere, eigenständig geführte Instanz einer Option an.
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {{unitSelectionId: string, optionDefinition: Object, system: Object, slots: Object}} command
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
export function addSubSelectionInstance(roster, command) {
  const newInstance = createOptionSelection(roster, command);
  return updateUnitChildSelections(roster, command.unitSelectionId, childSelections =>
    withAddedInstance(childSelections, newInstance));
}

/**
 * Entfernt eine einzeln geführte Instanz anhand ihrer Selection-Id.
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {{unitSelectionId: string, instanceSelectionId: string}} command
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
export function removeSubSelectionInstance(roster, { unitSelectionId, instanceSelectionId }) {
  return updateUnitChildSelections(roster, unitSelectionId, childSelections =>
    withoutInstance(childSelections, instanceSelectionId));
}

/**
 * Verschiebt die Anzahl einer Option unterhalb einer Einheit um `countDelta`.
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {{unitSelectionId: string, optionDefinition: Object, countDelta: number,
 *   system: Object, slots: Object}} command
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
export function changeOptionCount(roster, command) {
  const { unitSelectionId, optionDefinition, countDelta } = command;
  return updateUnitChildSelections(roster, unitSelectionId, childSelections =>
    withChangedOptionCount(
      childSelections,
      optionDefinition.id,
      countDelta,
      () => createOptionSelection(roster, command)
    ));
}
