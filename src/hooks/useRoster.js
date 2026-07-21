import { useState, useEffect, useMemo, useRef } from 'react';

import {
  calculateRosterCosts, validateRoster, resolveEntry, syncRosterSelectionsWithSystem,
  childSelectionsOf, findSelectionInRoster, mapSelectionTree, replaceSelectionById
} from '../solver/validator';
import { createSelectionFromDef as buildSelectionFromDef } from '../solver/selectionFactory';
import { withAddedInstance, withoutInstance, withChangedOptionCount } from '../solver/subSelectionEditing';
import { useUndoableState } from './useUndoableState';
import '../types.js';

const AUTOSAVE_DEBOUNCE_MS = 150;

/** Verschiebung der Anzahl, die eine einzelne Nutzeraktion auslöst. */
const COUNT_INCREASE = 1;
const COUNT_DECREASE = -1;

/** Abgeleitete Werte, solange Roster oder System noch nicht vorliegen. */
const NO_COSTS = Object.freeze({});
const NO_VALIDATION_ERRORS = Object.freeze([]);

/**
 * Hook to manage a roster state, cost calculations, validations and updates.
 * @param {import('../types.js').Roster} initialRoster
 * @param {Object} system
 * @param {Function} saveRosterCallback
 */
export function useRoster(initialRoster, system, saveRosterCallback) {
  const {
    state: roster,
    setState: setRoster,
    replace: replaceRoster,
    undo,
    redo,
    canUndo,
    canRedo
  } = useUndoableState(initialRoster);
  const [selectedSelectionId, setSelectedSelectionId] = useState(null);

  // Kosten und Validierungsfehler sind reine Ableitungen aus Roster und System
  // (SSOT) und werden deshalb berechnet statt in eigenem State gespiegelt. Ein
  // gespiegelter State würde die Oberfläche — und mit ihr die aus dem Validator
  // abgeleitete Aushebe-Verfügbarkeit (ADR-0022) — hinter dem Roster zurückhängen
  // lassen.
  const costs = useMemo(
    () => (roster && system ? calculateRosterCosts(roster, system) : NO_COSTS),
    [roster, system]
  );
  const validationErrors = useMemo(
    () => (roster && system ? validateRoster(roster, system) : NO_VALIDATION_ERRORS),
    [roster, system]
  );

  // Die ausgewählte Selection wird per ID aus dem Roster abgeleitet, statt
  // eine (schnell veraltende) Objektreferenz zu halten.
  const selectedRosterSelection = useMemo(
    () => findSelectionInRoster(roster, selectedSelectionId),
    [roster, selectedSelectionId]
  );

  const setSelectedRosterSelection = (selectionOrId) => {
    if (!selectionOrId) {
      setSelectedSelectionId(null);
    } else {
      setSelectedSelectionId(typeof selectionOrId === 'string' ? selectionOrId : selectionOrId.id);
    }
  };

  const saveCallbackRef = useRef(saveRosterCallback);
  saveCallbackRef.current = saveRosterCallback;
  const pendingSaveRef = useRef(null);

  const persistRoster = (rosterToSave) => {
    const cb = saveCallbackRef.current;
    if (!cb) return;
    try {
      const promise = cb(rosterToSave);
      if (promise && typeof promise.catch === 'function') {
        promise.catch(e => {
          console.error('Failed to auto-save roster:', e);
        });
      }
    } catch (e) {
      console.error('Failed to auto-save roster:', e);
    }
  };

  // Katalog-Abgleich und Autosave. Die Verzögerung wirkt ausschließlich auf das
  // Persistieren — Anzeige und Validierung leiten sich synchron aus dem Roster ab.
  useEffect(() => {
    if (!roster || !system) return;

    const syncedRoster = syncRosterSelectionsWithSystem(roster, system);
    if (syncedRoster !== roster) {
      replaceRoster(syncedRoster);
      return;
    }

    pendingSaveRef.current = roster;
    const persistHandler = setTimeout(() => {
      persistRoster(roster);
      pendingSaveRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(persistHandler);
  }, [roster, system, replaceRoster]);

  // Noch ausstehende Änderungen beim Unmount wegschreiben (z. B. bei schneller Navigation)
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        persistRoster(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, []);

  // Geteilte Selektions-Fabrik (SSOT, ADR-0022): system/resolveEntry werden injiziert,
  // sodass Ausheben und Aushebe-Verfügbarkeit dieselbe Pflicht-Kind-Bevölkerung sehen.
  const createSelectionFromDef = (entry, categoryId = null) =>
    buildSelectionFromDef({ system, resolveEntry, entry, categoryId });

  const addUnit = (entry, categoryId) => {
    const newUnit = createSelectionFromDef(entry, categoryId);
    if (!newUnit) return;

    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        return {
          ...force,
          selections: [...(force.selections || []), newUnit]
        };
      });
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
   * @param {(childSelections: import('../types.js').Selection[]) => import('../types.js').Selection[]} changeChildSelections
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
      withAddedInstance(childSelections, createSelectionFromDef(optionDefinition)));

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
        () => createSelectionFromDef(optionDefinition)
      ));

  /**
   * Die benannten Änderungsoperationen auf den Unter-Auswahlen einer Einheit.
   * Die Oberfläche erhält sie als ein Bündel, sodass jede Ebene der
   * Editor-Komponenten genau eine Stütze durchreicht statt vier.
   */
  const subSelectionOperations = {
    addInstance: addSubSelectionInstance,
    removeInstance: removeSubSelectionInstance,
    increaseCount: (unitSelectionId, optionDefinition) =>
      changeSubSelectionCount(unitSelectionId, optionDefinition, COUNT_INCREASE),
    decreaseCount: (unitSelectionId, optionDefinition) =>
      changeSubSelectionCount(unitSelectionId, optionDefinition, COUNT_DECREASE)
  };

  const updateRosterName = (newName) => {
    setRoster(prev => ({
      ...prev,
      name: newName
    }));
  };

  const save = async () => {
    if (saveCallbackRef.current) {
      await saveCallbackRef.current(roster);
    }
  };

  return {
    roster,
    costs,
    validationErrors,
    selectedRosterSelection,
    setSelectedRosterSelection,
    addUnit,
    removeUnit,
    copyUnit,
    subSelectionOperations,
    updateRosterName,
    save,
    undo,
    redo,
    canUndo,
    canRedo
  };
}
