import { useState, useEffect } from 'react';
import { saveRoster } from '../db/database';
import { calculateRosterCosts, validateRoster, resolveEntry } from '../solver/validator';

export function useRoster(initialRoster, system) {
  const [roster, setRoster] = useState(initialRoster);
  const [costs, setCosts] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);
  const [selectedRosterSelection, setSelectedRosterSelection] = useState(null);
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState(null);

  // Recalculate costs and run validation whenever roster changes
  useEffect(() => {
    if (roster && system) {
      const calcCosts = calculateRosterCosts(roster, system);
      setCosts(calcCosts);
      const errors = validateRoster(roster, system);
      setValidationErrors(errors);
    }
  }, [roster, system]);

  // Helper to generate a new unique selection node
  const createSelectionFromDef = (entry, categoryId = null) => {
    const resolved = resolveEntry(system, entry);
    if (!resolved) return null;

    const selection = {
      id: Math.random().toString(36).substr(2, 9),
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
      await saveRoster(roster);
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
    updateSubSelection,
    save
  };
}
