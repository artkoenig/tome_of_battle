import { useState, useEffect } from 'react';

import { calculateRosterCosts, validateRoster, resolveEntry, syncRosterSelectionsWithSystem } from '../solver/validator';
import '../types.js';

/**
 * Hook to manage a roster state, cost calculations, validations and updates.
 * @param {import('../types.js').Roster} initialRoster
 * @param {Object} system
 * @param {Function} saveRosterCallback
 */
export function useRoster(initialRoster, system, saveRosterCallback) {
  const [roster, setRoster] = useState(initialRoster);
  const [costs, setCosts] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);
  const [selectedRosterSelection, setSelectedRosterSelection] = useState(null);
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState(null);

  // Recalculate costs and run validation whenever roster changes (debounced for performance)
  // Save changes to database immediately on change
  useEffect(() => {
    if (roster && system) {
      const rosterModified = syncRosterSelectionsWithSystem(roster, system);

      if (rosterModified) {
        setRoster({ ...roster });
        return;
      }

      // Auto-save roster immediately on change
      if (saveRosterCallback) {
        try {
          const promise = saveRosterCallback(roster);
          if (promise && typeof promise.catch === 'function') {
            promise.catch(e => {
              console.error('Failed to auto-save roster:', e);
            });
          }
        } catch (e) {
          console.error('Failed to auto-save roster:', e);
        }
      }

      const handler = setTimeout(() => {
        const calcCosts = calculateRosterCosts(roster, system);
        setCosts(calcCosts);
        const errors = validateRoster(roster, system);
        setValidationErrors(errors);
      }, 150);

      return () => clearTimeout(handler);
    }
  }, [roster, system, saveRosterCallback]);

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
      costs: resolved.costs || [],
      collective: resolved.collective || entry.collective || false,
      selections: []
    };

    const populateChildren = (def, parentSel) => {
      def.selectionEntries?.forEach(child => {
        const minCon = child.constraints?.find(c => c.type === 'min')?.value || 0;
        if (minCon > 0) {
          const childSel = createSelectionFromDef(child);
          if (childSel) {
            childSel.number = minCon;
            parentSel.selections.push(childSel);
          }
        }
      });

      def.entryLinks?.forEach(child => {
        const minCon = child.constraints?.find(c => c.type === 'min')?.value || 0;
        if (minCon > 0) {
          const childSel = createSelectionFromDef(child);
          if (childSel) {
            childSel.number = minCon;
            parentSel.selections.push(childSel);
          }
        }
      });

      def.selectionEntryGroups?.forEach(group => {
        const minCon = group.constraints?.find(c => c.type === 'min')?.value || 0;
        if (minCon > 0 && (group.selectionEntries?.length > 0 || group.entryLinks?.length > 0)) {
          const firstOption = group.selectionEntries?.[0] || group.entryLinks?.[0];
          const childSel = createSelectionFromDef(firstOption);
          if (childSel) {
            childSel.number = minCon;
            parentSel.selections.push(childSel);
          }
        }
      });
    };

    populateChildren(resolved, selection);
    return selection;
  };

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

    setSelectedRosterSelection(newUnit);
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

    if (selectedRosterSelection?.id === selectionId) {
      setSelectedRosterSelection(null);
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

  const updateSubSelection = (unitSelectionId, option, action, parentCount = 1) => {
    const optionId = option.id;

    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        const updatedSelections = force.selections.map(unit => {
          if (unit.id !== unitSelectionId) return unit;

          const newUnit = { ...unit, selections: [...(unit.selections || [])] };

          const modifySelectionNode = (parentSel) => {
            const list = parentSel.selections || [];
            const idx = list.findIndex(s => (s.entryLinkId || s.selectionEntryId) === optionId);
            
            const amount = 1;

            if (action === 'increment') {
              if (idx > -1) {
                list[idx] = { ...list[idx], number: (list[idx].number || 1) + amount };
              } else {
                const childSel = createSelectionFromDef(option);
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

            return { ...parentSel, selections: list };
          };

          const result = modifySelectionNode(newUnit);
          // Set selection in active editor preview too
          setTimeout(() => setSelectedRosterSelection(result), 0);
          return result;
        });

        return { ...force, selections: updatedSelections };
      });

      return { ...prev, forces: updatedForces };
    });
  };

  const save = async () => {
    try {
      if (saveRosterCallback) await saveRosterCallback(roster);
      alert('Armeeliste erfolgreich gespeichert!');
    } catch (e) {
      console.error(e);
      alert('Fehler beim Speichern der Liste.');
    }
  };

  return {
    roster,
    costs,
    validationErrors,
    selectedRosterSelection,
    setSelectedRosterSelection,
    selectedCatalogEntry,
    setSelectedCatalogEntry,
    addUnit,
    removeUnit,
    copyUnit,
    updateSubSelection,
    save
  };
}
