import { useState, useEffect, useMemo, useRef } from 'react';

import { calculateRosterCosts, validateRoster, resolveEntry, syncRosterSelectionsWithSystem, materializeListRules } from '../solver/validator';
import { useUndoableState } from './useUndoableState';
import '../types.js';

const AUTOSAVE_DEBOUNCE_MS = 150;

/** Sucht eine Selection (beliebig tief verschachtelt) im Roster per ID. */
const findSelectionInRoster = (roster, selectionId) => {
  if (!roster || !selectionId) return null;
  const findIn = (list) => {
    for (const s of list || []) {
      if (s.id === selectionId) return s;
      const sub = findIn(s.selections);
      if (sub) return sub;
    }
    return null;
  };
  for (const force of roster.forces || []) {
    const found = findIn(force.selections);
    if (found) return found;
  }
  return null;
};

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

  // Helper to generate a new unique selection node
  const createSelectionFromDef = (entry, categoryId = null) => {
    const resolved = resolveEntry(system, entry);
    if (!resolved) return null;

    const selection = {
      id: crypto.randomUUID(),
      entryLinkId: entry.targetId ? entry.id : null,
      selectionEntryId: entry.targetId ? null : entry.id,
      name: resolved.name,
      number: 1,
      category: categoryId,
      collective: resolved.collective || entry.collective || false,
      selections: []
    };

    const getMinConstraintValue = (def) => def.constraints?.find(c => c.type === 'min')?.value || 0;

    const addMandatoryChild = (parentSel, childDef, count) => {
      const childSel = createSelectionFromDef(childDef);
      if (childSel) {
        childSel.number = count;
        parentSel.selections.push(childSel);
      }
    };

    const populateChildren = (def, parentSel) => {
      [...(def.selectionEntries || []), ...(def.entryLinks || [])].forEach(child => {
        const minCon = getMinConstraintValue(child);
        if (minCon > 0) {
          addMandatoryChild(parentSel, child, minCon);
        }
      });

      def.selectionEntryGroups?.forEach(group => {
        const minCon = getMinConstraintValue(group);
        if (minCon > 0 && (group.selectionEntries?.length > 0 || group.entryLinks?.length > 0)) {
          let chosenOption = null;
          if (group.defaultSelectionEntryId) {
            chosenOption = group.selectionEntries?.find(e => e.id === group.defaultSelectionEntryId) ||
                           group.entryLinks?.find(l => l.id === group.defaultSelectionEntryId);
          }
          if (!chosenOption) {
            chosenOption = group.selectionEntries?.[0] || group.entryLinks?.[0];
          }
          addMandatoryChild(parentSel, chosenOption, minCon);
        }
      });
    };

    populateChildren(resolved, selection);
    return selection;
  };

  // Listenregeln (listenweite Einstellungen) werden nicht vom Nutzer ausgehoben,
  // sondern dauerhaft materialisiert: fehlt eine Regel einer Force, wird sie hier
  // idempotent ergänzt. `replace` statt `setRoster`, damit dies keinen Undo-Schritt
  // erzeugt (system-getriebene Normalisierung, wie syncRosterSelectionsWithSystem).
  useEffect(() => {
    if (!roster || !system) return;
    const withListRules = materializeListRules(roster, system, createSelectionFromDef);
    if (withListRules) replaceRoster(withListRules);
    // createSelectionFromDef wird bewusst nicht in die Deps aufgenommen (bei jedem
    // Render neu erzeugt); roster/system/replaceRoster steuern den Lauf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, system, replaceRoster]);

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
    const cloneSelection = (sel) => {
      const newId = crypto.randomUUID();
      const clonedSelections = (sel.selections || []).map(s => cloneSelection(s));
      return {
        ...sel,
        id: newId,
        selections: clonedSelections
      };
    };

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

  const updateSubSelection = (unitSelectionId, optionOrId, action, parentCount = 1) => {
    setRoster(prev => {
      let foundAndUpdated = false;

      const updateDeep = (node) => {
        if (node.id === unitSelectionId) {
          foundAndUpdated = true;
          const list = [...(node.selections || [])];
          const amount = 1;

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
              } else {
                if ((list[instIdx].number || 1) > amount) {
                  list[instIdx] = { ...list[instIdx], number: list[instIdx].number - amount };
                } else {
                  list.splice(instIdx, 1);
                }
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
          return { ...node, selections: list };
        }

        if (node.selections && node.selections.length > 0) {
          let updatedChildren = false;
          const newSelections = node.selections.map(child => {
            if (foundAndUpdated) return child;
            const updatedChild = updateDeep(child);
            if (updatedChild !== child) updatedChildren = true;
            return updatedChild;
          });
          if (updatedChildren) return { ...node, selections: newSelections };
        }
        return node;
      };

      const updatedForces = prev.forces.map(force => {
        let updatedForceSelections = false;
        const newSelections = force.selections.map(unit => {
          const updatedUnit = updateDeep(unit);
          if (updatedUnit !== unit) updatedForceSelections = true;
          return updatedUnit;
        });
        if (updatedForceSelections) return { ...force, selections: newSelections };
        return force;
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
