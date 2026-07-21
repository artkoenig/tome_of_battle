import { useState, useEffect, useMemo, useRef } from 'react';

import {
  calculateRosterCosts, validateRoster, resolveEntry, syncRosterSelectionsWithSystem,
  childSelectionsOf, findSelectionInRoster, mapSelectionTree, replaceSelectionById
} from '../solver/validator';
import { createSelectionFromDef as buildSelectionFromDef } from '../solver/selectionFactory';
import { useUndoableState } from './useUndoableState';
import '../types.js';

const AUTOSAVE_DEBOUNCE_MS = 150;

/** Schrittweite, um die eine Options-Aktion die Anzahl einer Auswahl verändert. */
const SELECTION_STEP = 1;

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
  const [costs, setCosts] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);
  const [selectedSelectionId, setSelectedSelectionId] = useState(null);

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

  // Debounced: Autosave, Kostenberechnung und Validierung bei jeder Roster-Änderung
  useEffect(() => {
    if (!roster || !system) return;

    const rosterModified = syncRosterSelectionsWithSystem(roster, system);
    if (rosterModified) {
      replaceRoster({ ...roster });
      return;
    }

    pendingSaveRef.current = roster;
    const handler = setTimeout(() => {
      persistRoster(roster);
      pendingSaveRef.current = null;

      setCosts(calculateRosterCosts(roster, system));
      setValidationErrors(validateRoster(roster, system));
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(handler);
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
   * Die neue Kind-Liste einer Einheit nach einer Options-Aktion. Rein: die
   * übergebene Liste bleibt unberührt, zurück kommt stets eine neue.
   */
  const applySubSelectionAction = (currentSelections, optionOrId, action) => {
    const list = [...currentSelections];
    const amount = SELECTION_STEP;

    if (action === 'add_instance') {
      const childSel = createSelectionFromDef(optionOrId);
      if (childSel) {
        childSel.number = amount;
        list.push(childSel);
      }
    } else if (action === 'remove_instance') {
      const removeIdx = list.findIndex(s => s.id === optionOrId);
      if (removeIdx > -1) {
        list.splice(removeIdx, 1);
      }
    } else if (action === 'increment_instance' || action === 'decrement_instance') {
      const instIdx = list.findIndex(s => s.id === optionOrId);
      if (instIdx > -1) {
        if (action === 'increment_instance') {
          list[instIdx] = { ...list[instIdx], number: (list[instIdx].number || 1) + amount };
        } else if ((list[instIdx].number || 1) > amount) {
          list[instIdx] = { ...list[instIdx], number: list[instIdx].number - amount };
        } else {
          list.splice(instIdx, 1);
        }
      }
    } else {
      // Original increment/decrement logic (optionOrId is an option def)
      const optionId = optionOrId.id;
      const idx = list.findIndex(s => (s.entryLinkId || s.selectionEntryId) === optionId);

      if (action === 'increment') {
        if (idx > -1) {
          list[idx] = { ...list[idx], number: (list[idx].number || 1) + amount };
        } else {
          const childSel = createSelectionFromDef(optionOrId);
          if (childSel) {
            childSel.number = amount;
            list.push(childSel);
          }
        }
      } else if (action === 'decrement') {
        if (idx > -1) {
          if ((list[idx].number || 1) > amount) {
            list[idx] = { ...list[idx], number: list[idx].number - amount };
          } else {
            list.splice(idx, 1);
          }
        }
      }
    }
    return list;
  };

  const updateSubSelection = (unitSelectionId, optionOrId, action) => {
    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        const currentSelections = childSelectionsOf(force);
        const updatedSelections = replaceSelectionById(currentSelections, unitSelectionId, unit => ({
          ...unit,
          selections: applySubSelectionAction(childSelectionsOf(unit), optionOrId, action)
        }));
        if (updatedSelections === currentSelections) return force;
        return { ...force, selections: updatedSelections };
      });

      return { ...prev, forces: updatedForces };
    });
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
    updateSubSelection,
    updateRosterName,
    save,
    undo,
    redo,
    canUndo,
    canRedo
  };
}
