import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Save, Play, Plus, Minus, Trash2, 
  ChevronDown, ChevronRight, ShieldAlert, Check, BookOpen 
} from 'lucide-react';
import { saveRoster } from '../db/database';
import { 
  calculateRosterCosts, 
  validateRoster, 
  findEntryInCatalogue, 
  findEntryInSystem,
  resolveEntry 
} from '../solver/validator';

export default function RosterEditor({ system, roster: initialRoster, onBack, onPlay }) {
  const [roster, setRoster] = useState(initialRoster);
  const costType = system?.costTypes?.find(ct => ct.id === roster?.costLimitType);
  const costTypeLabel = costType 
    ? (costType.name.toLowerCase() === 'pts' ? 'Pkt.' : costType.name)
    : 'Pkt.';

  const [activeCatalogue, setActiveCatalogue] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedRosterSelection, setSelectedRosterSelection] = useState(null);
  const [selectedCatalogEntry, setSelectedCatalogEntry] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [costs, setCosts] = useState({});
  const [expandedOptionGroups, setExpandedOptionGroups] = useState({});

  const toggleOptionGroup = (unitId, groupName) => {
    const key = `${unitId}-${groupName}`;
    setExpandedOptionGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isOptionGroupExpanded = (unitId, groupName) => {
    const key = `${unitId}-${groupName}`;
    return expandedOptionGroups[key] !== false; // true by default
  };

  // Resolve active catalogue definition
  useEffect(() => {
    if (system && roster) {
      const cat = system.catalogues.find(c => c.id === roster.catalogueId);
      setActiveCatalogue(cat);
    }
  }, [system, roster]);

  // Recalculate costs and run validation whenever roster changes
  useEffect(() => {
    if (roster && system) {
      const calcCosts = calculateRosterCosts(roster, system);
      setCosts(calcCosts);
      const errors = validateRoster(roster, system);
      setValidationErrors(errors);
    }
  }, [roster, system]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

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
      selections: []
    };

    // Pre-populate children with min > 0 constraints
    const populateChildren = (def, parentSel) => {
      // Parse child entries
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

      // Parse child entry links
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

      // Parse child groups (pre-populate first option in group if min > 0)
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

  const handleAddUnit = (entry, categoryId) => {
    const newUnit = createSelectionFromDef(entry, categoryId);
    if (!newUnit) return;

    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        // Add to the first force (simple rosters usually have one force)
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

    // Select the newly added unit for upgrade configuration
    setSelectedRosterSelection(newUnit);
  };

  const handleRemoveUnit = (selectionId) => {
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

  const handleSave = async () => {
    try {
      await saveRoster(roster);
      alert('Armeeliste erfolgreich gespeichert!');
    } catch (e) {
      console.error(e);
      alert('Fehler beim Speichern der Liste.');
    }
  };

  // Extract all unit entries grouped by category links
  const getCatalogItemsByCategory = (catId) => {
    if (!activeCatalogue) return [];
    
    // Find entryLinks or selectionEntries that link to this category
    const items = [];
    const checkEntry = (entry) => {
      // Find direct categories or entry links
      const resolved = resolveEntry(system, entry);
      if (!resolved) return;

      // In BSData, category association can be in constraints or linked Category
      // We look at entry link names or catalog organization.
      // Often catalog selection entries have categoryLinks
      const hasCategory = resolved.categoryLinks?.some(link => link.targetId === catId) ||
                          entry.categoryLinks?.some(link => link.targetId === catId);

      if (hasCategory) {
        items.push(entry);
      }
    };

    activeCatalogue.selectionEntries?.forEach(checkEntry);
    activeCatalogue.entryLinks?.forEach(checkEntry);
    activeCatalogue.sharedSelectionEntries?.forEach(checkEntry);

    return items;
  };

  // Helper to compile a clean description string for an upgrade/magic item
  const getOptionDescription = (res) => {
    if (!res) return '';
    const descriptions = [];
    if (res.rules && res.rules.length > 0) {
      res.rules.forEach(r => {
        if (r.description) descriptions.push(r.description);
      });
    }
    if (res.profiles && res.profiles.length > 0) {
      res.profiles.forEach(p => {
        const typeLower = p.profileTypeName?.toLowerCase() || '';
        if (['magic item', 'weapon', 'armour', 'enchanted item', 'arcane item', 'talisman', 'magic weapon', 'magic armour', 'virtue', 'runes', 'special rule', 'gegenstand', 'virtues', 'tugend'].some(t => typeLower.includes(t))) {
          p.characteristics?.forEach(c => {
            if (c.value) descriptions.push(`${c.name}: ${c.value}`);
          });
        }
      });
    }
    return descriptions.join(' | ');
  };

  // Find all possible upgrade / sub-selection options for a unit definition
  const getUnitOptions = (unitSelection) => {
    if (!activeCatalogue) return [];
    const entryId = unitSelection.entryLinkId || unitSelection.selectionEntryId;
    const rawEntry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, rawEntry);
    
    if (!resolved) return [];

    // Recursive helper to find all nested entry IDs for a group
    const collectGroupItemIds = (gDef, groupItemIds = new Set(), visited = new Set()) => {
      if (!gDef || visited.has(gDef.id)) return groupItemIds;
      if (gDef.id) visited.add(gDef.id);

      gDef.selectionEntries?.forEach(item => {
        groupItemIds.add(item.id);
        const res = resolveEntry(system, item);
        if (res) groupItemIds.add(res.id);
      });
      gDef.entryLinks?.forEach(link => {
        groupItemIds.add(link.id);
        groupItemIds.add(link.targetId);
        const res = resolveEntry(system, link);
        if (res) {
          groupItemIds.add(res.id);
          collectGroupItemIds(res, groupItemIds, visited);
        }
      });
      gDef.selectionEntryGroups?.forEach(subG => {
        collectGroupItemIds(subG, groupItemIds, visited);
      });
      return groupItemIds;
    };

    // Helper to prepare constraints with groupItemIds attached
    const prepareConstraints = (gDef) => {
      if (!gDef || !gDef.constraints) return [];
      const itemIds = collectGroupItemIds(gDef);
      return gDef.constraints.map(con => ({
        ...con,
        groupItemIds: itemIds
      }));
    };

    const optionsList = [];

    // Recursive options collector
    const collectOptions = (def, currentGroupName = null, parentConstraints = null) => {
      // 1. Process selection entries
      def.selectionEntries?.forEach(child => {
        const resolvedChild = resolveEntry(system, child);
        if (!resolvedChild) return;

        // If it's a nested container/upgrade folder (not a model, and has children)
        if (child.type !== 'model' && (resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0 || resolvedChild.selectionEntryGroups?.length > 0)) {
          // Recurse into it to flatten it!
          collectOptions(resolvedChild, currentGroupName || resolvedChild.name, prepareConstraints(resolvedChild).concat(parentConstraints || []));
        } else {
          // Standard upgrade option
          optionsList.push({ 
            option: child, 
            parentDefId: def.id, 
            groupName: currentGroupName, 
            groupConstraints: parentConstraints 
          });
        }
      });

      // 2. Process entry links
      def.entryLinks?.forEach(child => {
        const resolvedChild = resolveEntry(system, child);
        if (!resolvedChild) return;

        if (child.type === 'selectionEntryGroup' || resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0) {
          // It links to a group (shared or direct). We collect its items under the group name.
          const combinedConstraints = [...prepareConstraints(resolvedChild), ...prepareConstraints(def), ...(parentConstraints || [])];
          resolvedChild.selectionEntries?.forEach(subChild => {
            optionsList.push({ 
              option: subChild, 
              parentDefId: def.id, 
              groupName: resolvedChild.name || child.name, 
              groupConstraints: combinedConstraints 
            });
          });
          resolvedChild.entryLinks?.forEach(subChild => {
            optionsList.push({ 
              option: subChild, 
              parentDefId: def.id, 
              groupName: resolvedChild.name || child.name, 
              groupConstraints: combinedConstraints 
            });
          });
        } else if (resolvedChild.type !== 'model' && (resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0 || resolvedChild.selectionEntryGroups?.length > 0)) {
          // Recurse into this linked folder as well!
          collectOptions(resolvedChild, currentGroupName || resolvedChild.name, prepareConstraints(resolvedChild).concat(parentConstraints || []));
        } else {
          optionsList.push({ 
            option: child, 
            parentDefId: def.id, 
            groupName: currentGroupName, 
            groupConstraints: parentConstraints 
          });
        }
      });

       // 3. Process selection entry groups
      def.selectionEntryGroups?.forEach(group => {
        const combinedGroupConstraints = [...prepareConstraints(group), ...prepareConstraints(def), ...(parentConstraints || [])];
        group.selectionEntries?.forEach(child => {
          optionsList.push({ 
            option: child, 
            parentDefId: def.id, 
            groupName: group.name, 
            groupConstraints: combinedGroupConstraints 
          });
        });
        group.entryLinks?.forEach(child => {
          const resolvedChild = resolveEntry(system, child);
          if (resolvedChild && (resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0)) {
            // Recurse into nested groups
            const combinedChildConstraints = [...prepareConstraints(resolvedChild), ...combinedGroupConstraints];
            resolvedChild.selectionEntries?.forEach(sub => {
              optionsList.push({ 
                option: sub, 
                parentDefId: def.id, 
                groupName: resolvedChild.name || child.name || group.name, 
                groupConstraints: combinedChildConstraints 
              });
            });
            resolvedChild.entryLinks?.forEach(sub => {
              optionsList.push({ 
                option: sub, 
                parentDefId: def.id, 
                groupName: resolvedChild.name || child.name || group.name, 
                groupConstraints: combinedChildConstraints 
              });
            });
          } else {
            optionsList.push({ 
              option: child, 
              parentDefId: def.id, 
              groupName: group.name, 
              groupConstraints: combinedGroupConstraints 
            });
          }
        });
      });
    };

    collectOptions(resolved);
    
    // Also include nested sub-models options if any
    resolved.selectionEntries?.forEach(sub => {
      const subResolved = resolveEntry(system, sub);
      if (subResolved && subResolved.type === 'model') {
        collectOptions(subResolved);
      }
    });

    return optionsList;
  };

  const getSubSelectionCount = (unitSelection, optionEntryId) => {
    const findCount = (list) => {
      let count = 0;
      for (const item of list) {
        if ((item.entryLinkId || item.selectionEntryId) === optionEntryId) {
          count += item.number || 1;
        }
        if (item.selections) {
          count += findCount(item.selections);
        }
      }
      return count;
    };
    return findCount(unitSelection.selections || []);
  };

  const updateSubSelection = (unitSelectionId, option, action) => {
    const optionResolved = resolveEntry(system, option);
    const optionId = option.id;

    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        const updatedSelections = force.selections.map(unit => {
          if (unit.id !== unitSelectionId) return unit;

          // Clone unit
          const newUnit = { ...unit, selections: [...(unit.selections || [])] };

          const modifySelectionNode = (parentSel) => {
            const list = parentSel.selections || [];
            const idx = list.findIndex(s => (s.entryLinkId || s.selectionEntryId) === optionId);

            if (action === 'increment') {
              if (idx > -1) {
                list[idx] = { ...list[idx], number: (list[idx].number || 1) + 1 };
              } else {
                const childSel = createSelectionFromDef(option);
                if (childSel) {
                  list.push(childSel);
                }
              }
            } else if (action === 'decrement') {
              if (idx > -1) {
                if ((list[idx].number || 1) > 1) {
                  list[idx] = { ...list[idx], number: list[idx].number - 1 };
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

  return (
    <div className="builder-layout">
      {/* 1. Sidebar - Catalog List */}
      <div className="builder-sidebar">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-dark)' }}>
          <button className="btn-sm w-full" onClick={onBack}>
            <ArrowLeft size={16} /> Zurück
          </button>
          <h3 style={{ marginTop: '12px', fontSize: '1.1rem' }}>Bibliothek</h3>
          <p className="text-dim" style={{ fontSize: '0.8rem' }}>{activeCatalogue?.name}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {system.categoryEntries?.map(cat => {
            const catItems = getCatalogItemsByCategory(cat.id);
            if (catItems.length === 0) return null;

            const isExpanded = expandedCategories[cat.id];

            return (
              <div key={cat.id} className="catalog-category">
                <div 
                  className="catalog-category-header" 
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span className="catalog-category-title">{cat.name}</span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>

                {isExpanded && (
                  <div className="catalog-items">
                    {catItems.map(item => {
                      const res = resolveEntry(system, item);
                      if (!res) return null;
                      const points = res.costs?.find(c => c.typeId === roster.costLimitType)?.value || 0;
                      return (
                        <div key={item.id} className="catalog-item" onClick={() => setSelectedCatalogEntry(res)}>
                          <span style={{ fontWeight: 600 }}>{res.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="font-sans text-gold" style={{ fontSize: '0.85rem' }}>{points} {costTypeLabel}</span>
                            <button 
                              className="btn-primary btn-sm" 
                              style={{ padding: '2px 6px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddUnit(item, cat.id);
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Main Editing Roster Pane */}
      <div className="builder-main">
        <div className="roster-header-editor">
          <div>
            <h2 style={{ margin: 0, border: 'none', padding: 0 }}>{roster.name}</h2>
            <span className="text-dim" style={{ fontSize: '0.9rem' }}>
              Punktegrenze: {roster.costLimit} {costTypeLabel === 'Pkt.' ? 'Punkte' : costTypeLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleSave}>
              <Save size={18} /> Speichern
            </button>
            <button className="btn-primary" onClick={() => onPlay(roster)}>
              <Play size={18} /> In Spielmodus
            </button>
          </div>
        </div>

        {/* Selected Catalog Entry Stat Details */}
        {selectedCatalogEntry && (
          <div className="gothic-panel" style={{ borderStyle: 'solid', borderWidth: '1px', padding: '16px', marginBottom: '24px' }}>
            <div className="flex-between">
              <h3>{selectedCatalogEntry.name} - Statblock</h3>
              <button className="btn-sm" onClick={() => setSelectedCatalogEntry(null)}>Schließen</button>
            </div>
            
            {/* Render profiles parsed from BSData */}
            {selectedCatalogEntry.profiles?.map(prof => (
              <div key={prof.id} style={{ marginTop: '12px' }}>
                <span className="font-serif text-gold" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {prof.name} ({prof.profileTypeName})
                </span>
                <div className="profile-table-container">
                  <table className="profile-table">
                    <thead>
                      <tr>
                        {prof.characteristics.map(c => (
                          <th key={c.name}>{c.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {prof.characteristics.map(c => (
                          <td key={c.name} className="font-sans">{c.value}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {selectedCatalogEntry.rules?.map(rule => (
              <div key={rule.id} style={{ marginTop: '8px' }}>
                <strong className="text-gold">{rule.name}:</strong> <span style={{ fontSize: '0.9rem', color: 'var(--text-parchment)' }}>{rule.description}</span>
              </div>
            ))}
          </div>
        )}

        {/* Selected Selections on Roster */}
        {roster.forces.map(force => (
          <div key={force.id}>
            {force.selections?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--border-dark)', borderRadius: '4px' }}>
                <BookOpen size={40} className="text-dim" style={{ marginBottom: '12px' }} />
                <h3>Deine Armeeliste ist leer</h3>
                <p className="text-dim">Wähle Einheiten aus der linken Bibliothek aus, um sie deiner Streitmacht hinzuzufügen.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {force.selections?.map(selection => {
                  const isUnitEditing = selectedRosterSelection?.id === selection.id;
                  const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
                  const displayPoints = unitCosts[roster.costLimitType] || 0;
                  const categoryName = system.categoryEntries?.find(c => c.id === selection.category)?.name || 'Einheit';
                  
                  const hasSelectionError = validationErrors.some(e => e.selectionId === selection.id);

                  return (
                    <div 
                      key={selection.id} 
                      className={`selection-node ${hasSelectionError ? 'has-error' : ''}`}
                    >
                      <div 
                        className="selection-node-header"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
                      >
                        <div className="selection-node-title">
                          <span className="selection-node-category">{categoryName}</span>
                          <span className="selection-node-name">{selection.name}</span>
                        </div>
                        <div className="selection-node-right">
                          <span className="selection-node-cost font-sans">
                            {displayPoints} {costTypeLabel}
                          </span>
                          <button 
                            className="btn-danger btn-sm" 
                            style={{ padding: '4px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveUnit(selection.id);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {isUnitEditing && (
                        <div className="selection-node-body">
                          <h4>Optionen &amp; Ausrüstung konfigurieren</h4>
                          <div className="sub-selection-group" style={{ borderLeft: 'none', paddingLeft: 0 }}>
                            {(() => {
                              const options = getUnitOptions(selection);
                              const groupedList = [];
                              const groupMap = {};

                              options.forEach(item => {
                                if (item.groupName) {
                                  if (!groupMap[item.groupName]) {
                                    groupMap[item.groupName] = {
                                      name: item.groupName,
                                      constraints: item.groupConstraints,
                                      items: []
                                    };
                                    groupedList.push(groupMap[item.groupName]);
                                  }
                                  groupMap[item.groupName].items.push(item);
                                } else {
                                  groupedList.push({
                                    standalone: true,
                                    item: item
                                  });
                                }
                              });

                              return groupedList.map((group, gIdx) => {
                                if (group.standalone) {
                                  const { option } = group.item;
                                  const res = resolveEntry(system, option);
                                  if (!res) return null;
                                  const count = getSubSelectionCount(selection, res.id);
                                  const points = res.costs?.find(c => c.typeId === roster.costLimitType)?.value || 0;
                                  const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
                                  const unitRawEntry = findEntryInSystem(system, unitEntryId);
                                  const unitResolved = resolveEntry(system, unitRawEntry);
                                  const filteredOptionConstraints = res.constraints?.filter(con => {
                                    if (!con.scope || con.scope === 'parent' || con.scope === 'force' || con.scope === 'roster') {
                                      return true;
                                    }
                                    return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
                                           (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
                                  }) || [];
                                  const minConstraint = filteredOptionConstraints.find(c => c.type === 'min');
                                  const maxConstraint = filteredOptionConstraints.find(c => c.type === 'max');
                                  const minLimit = (minConstraint?.value === undefined || minConstraint?.value < 0) ? 0 : minConstraint.value;
                                  const maxLimit = (maxConstraint?.value === undefined || maxConstraint?.value < 0) ? Infinity : maxConstraint.value;
                                  const isMandatory = minLimit > 0 && minLimit === maxLimit;
                                  const isBinary = maxLimit === 1;
                                  const descText = getOptionDescription(res);

                                  return (
                                    <div key={res.id} className="sub-selection-row" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-dark)' }}>
                                      <div>
                                        <div>
                                          <span style={{ fontWeight: 600 }}>{res.name}</span>
                                          {points > 0 && <span className="text-gold font-sans" style={{ fontSize: '0.85rem', marginLeft: '8px' }}>+{points} Pkt.</span>}
                                        </div>
                                         {descText && (
                                           <div className="text-dim" style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', marginTop: '4px', fontStyle: 'italic', maxWidth: '420px', lineHeight: '1.3' }}>
                                             {descText}
                                           </div>
                                         )}
                                      </div>
                                      <div className="sub-selection-controls">
                                        {isBinary ? (
                                           <input 
                                             type="checkbox" 
                                             checked={count > 0 || isMandatory}
                                             disabled={isMandatory}
                                             onChange={(e) => {
                                               if (!isMandatory) {
                                                 updateSubSelection(selection.id, option, e.target.checked ? 'increment' : 'decrement');
                                               }
                                             }}
                                           />
                                        ) : (
                                          <div className="quantity-control">
                                            <button 
                                              className="btn-sm" 
                                              style={{ padding: '2px 6px' }}
                                              onClick={() => updateSubSelection(selection.id, option, 'decrement')}
                                              disabled={count === 0}
                                            >
                                              <Minus size={12} />
                                            </button>
                                            <span className="quantity-value font-sans">{count}</span>
                                            <button 
                                              className="btn-sm" 
                                              style={{ padding: '2px 6px' }}
                                              onClick={() => updateSubSelection(selection.id, option, 'increment')}
                                            >
                                              <Plus size={12} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                } else {
                                   const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
                                   const unitRawEntry = findEntryInSystem(system, unitEntryId);
                                   const unitResolved = resolveEntry(system, unitRawEntry);
                                   const filteredGroupConstraints = group.constraints?.filter(con => {
                                     if (!con.scope || con.scope === 'parent' || con.scope === 'force' || con.scope === 'roster') {
                                       return true;
                                     }
                                     return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
                                            (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
                                   }) || [];

                                   const isExpanded = isOptionGroupExpanded(selection.id, group.name);
                                   const minLimitRaw = filteredGroupConstraints.find(c => c.type === 'min')?.value;
                                   const minLimit = (minLimitRaw === undefined || minLimitRaw < 0) ? 0 : minLimitRaw;
                                   const maxLimitRaw = filteredGroupConstraints.find(c => c.type === 'max')?.value;
                                   const maxLimit = (maxLimitRaw === undefined || maxLimitRaw < 0) ? Infinity : maxLimitRaw;
                                   
                                   const currentCount = group.items.reduce((sum, item) => {
                                     const res = resolveEntry(system, item.option);
                                     return sum + (res ? getSubSelectionCount(selection, res.id) : 0);
                                   }, 0);

                                   const currentPoints = group.items.reduce((sum, item) => {
                                     const res = resolveEntry(system, item.option);
                                     const count = res ? getSubSelectionCount(selection, res.id) : 0;
                                     const points = res?.costs?.find(c => c.typeId === roster.costLimitType || c.typeId === 'pts')?.value || 0;
                                     return sum + (points * count);
                                   }, 0);

                                   let hasGroupError = false;
                                   let groupLimitInfo = '';
                                   
                                   filteredGroupConstraints.forEach(con => {
                                     if (con.value < 0) return;
                                     
                                     let activeCount = currentCount;
                                     let activePoints = currentPoints;

                                     if (con.groupItemIds) {
                                       let sumCount = 0;
                                       let sumPoints = 0;
                                       selection.selections?.forEach(sub => {
                                         const subId = sub.entryLinkId || sub.selectionEntryId;
                                         if (con.groupItemIds.has(subId)) {
                                           const count = sub.number || 1;
                                           const pts = sub.costs?.find(c => c.typeId === roster.costLimitType || c.typeId === 'pts')?.value || 0;
                                           sumCount += count;
                                           sumPoints += (pts * count);
                                         }
                                       });
                                       activeCount = sumCount;
                                       activePoints = sumPoints;
                                     }

                                     const isCostField = con.field === 'pts' || con.field === 'ecfa-8486-4f6c-c249' || con.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === con.field);
                                     if (isCostField) {
                                       if (con.type === 'max') {
                                         if (activePoints > con.value) {
                                           hasGroupError = true;
                                           groupLimitInfo = `(Max: ${con.value} Pkt. | Aktuell: ${activePoints} Pkt.)`;
                                         } else {
                                           groupLimitInfo = `(Max: ${con.value} Pkt. | Rest: ${con.value - activePoints} Pkt.)`;
                                         }
                                       }
                                     } else {
                                       if (con.type === 'max') {
                                         if (activeCount > con.value) {
                                           hasGroupError = true;
                                           groupLimitInfo = `(Max: ${con.value} | Aktuell: ${activeCount})`;
                                         } else {
                                           groupLimitInfo = `(Max: ${con.value} | Rest: ${con.value - activeCount})`;
                                         }
                                       }
                                     }
                                   });

                                   const limitText = groupLimitInfo || (maxLimit !== Infinity ? `(Max: ${maxLimit})` : '');

                                   return (
                                     <div key={group.name} style={{ marginBottom: '12px' }}>
                                       {/* Collapsible Group Header */}
                                       <div 
                                         onClick={() => toggleOptionGroup(selection.id, group.name)}
                                         style={{
                                           backgroundColor: hasGroupError ? 'rgba(239, 68, 68, 0.05)' : 'rgba(226, 183, 66, 0.04)',
                                           border: hasGroupError ? '1px solid var(--text-danger)' : '1px solid var(--border-dark)',
                                           borderRadius: '4px',
                                           padding: '8px 12px',
                                           cursor: 'pointer',
                                           display: 'flex',
                                           justifyContent: 'space-between',
                                           alignItems: 'center',
                                           userSelect: 'none'
                                         }}
                                       >
                                         <span className={hasGroupError ? "font-serif text-danger" : "font-serif text-gold"} style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                                           {group.name} <span style={{ fontSize: '0.8rem', marginLeft: '6px', fontWeight: 400 }}>{limitText}</span>
                                         </span>
                                         {isExpanded ? (
                                           <ChevronDown size={16} className={hasGroupError ? "text-danger" : "text-gold"} />
                                         ) : (
                                           <ChevronRight size={16} className={hasGroupError ? "text-danger" : "text-gold"} />
                                         )}
                                       </div>

                                      {/* Group Content */}
                                      {isExpanded && (
                                        <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--border-gold-dim)', marginTop: '6px' }}>
                                          {group.items.map(({ option, groupConstraints }) => {
                                            const res = resolveEntry(system, option);
                                            if (!res) return null;
                                            const count = getSubSelectionCount(selection, res.id);
                                            const points = res.costs?.find(c => c.typeId === roster.costLimitType)?.value || 0;
                                            const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
                                            const unitRawEntry = findEntryInSystem(system, unitEntryId);
                                            const unitResolved = resolveEntry(system, unitRawEntry);
                                            const filteredOptionConstraints = res.constraints?.filter(con => {
                                              if (!con.scope || con.scope === 'parent' || con.scope === 'force' || con.scope === 'roster') {
                                                return true;
                                              }
                                              return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
                                                     (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
                                            }) || [];
                                            const minConstraint = filteredOptionConstraints.find(c => c.type === 'min');
                                            const maxConstraint = filteredOptionConstraints.find(c => c.type === 'max');
                                            const minLimit = (minConstraint?.value === undefined || minConstraint?.value < 0) ? 0 : minConstraint.value;
                                            const maxLimit = (maxConstraint?.value === undefined || maxConstraint?.value < 0) ? Infinity : maxConstraint.value;
                                            const isMandatory = minLimit > 0 && minLimit === maxLimit;
                                            
                                            const isRadio = groupConstraints?.some(c => c.type === 'max' && c.value === 1);
                                            const isBinary = (maxConstraint && maxConstraint.value === 1) || isRadio;
                                            const isCheckbox = isBinary && !isRadio;
                                            const descText = getOptionDescription(res);

                                            // Calculate points constraint for the group to disable options that exceed it
                                            const ptsConstraint = filteredGroupConstraints.find(c => 
                                              c.type === 'max' && 
                                              (c.field === 'pts' || c.field === 'ecfa-8486-4f6c-c249' || c.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === c.field))
                                            );
                                            const maxPointsLimit = ptsConstraint ? ptsConstraint.value : Infinity;

                                            let wouldExceedPointsLimit = false;
                                            if (maxPointsLimit !== Infinity) {
                                              let activePoints = currentPoints;
                                              if (ptsConstraint.groupItemIds) {
                                                let sumPoints = 0;
                                                selection.selections?.forEach(sub => {
                                                  const subId = sub.entryLinkId || sub.selectionEntryId;
                                                  if (ptsConstraint.groupItemIds.has(subId)) {
                                                    const count = sub.number || 1;
                                                    const pts = sub.costs?.find(c => c.typeId === roster.costLimitType || c.typeId === 'pts')?.value || 0;
                                                    sumPoints += (pts * count);
                                                  }
                                                });
                                                activePoints = sumPoints;
                                              }

                                              let pointsDiff = points;
                                              if (isRadio && count === 0) {
                                                const selectedOther = group.items.find(otherItem => {
                                                  const otherRes = resolveEntry(system, otherItem.option);
                                                  return otherRes && otherRes.id !== res.id && getSubSelectionCount(selection, otherRes.id) > 0;
                                                });
                                                if (selectedOther) {
                                                  const otherRes = resolveEntry(system, selectedOther.option);
                                                  const otherPoints = otherRes?.costs?.find(c => c.typeId === roster.costLimitType || c.typeId === 'pts')?.value || 0;
                                                  pointsDiff = points - otherPoints;
                                                }
                                              }
                                              if (activePoints + pointsDiff > maxPointsLimit) {
                                                wouldExceedPointsLimit = true;
                                              }
                                            }

                                            return (
                                              <div key={res.id} className="sub-selection-row" style={{ opacity: (count === 0 && wouldExceedPointsLimit) ? 0.5 : 1 }}>
                                                <div>
                                                  <div>
                                                    <span style={{ fontWeight: 600, color: (count === 0 && wouldExceedPointsLimit) ? 'var(--text-dim)' : 'inherit' }}>{res.name}</span>
                                                    {points > 0 && <span className="text-gold font-sans" style={{ fontSize: '0.85rem', marginLeft: '8px' }}>+{points} Pkt.</span>}
                                                  </div>
                                                   {descText && (
                                                     <div className="text-dim" style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', marginTop: '4px', fontStyle: 'italic', maxWidth: '420px', lineHeight: '1.3' }}>
                                                       {descText}
                                                     </div>
                                                   )}
                                                </div>
                                                <div className="sub-selection-controls">
                                                  {isRadio ? (
                                                    <input 
                                                      type="radio" 
                                                      name={`${selection.id}-${group.name}`}
                                                      checked={count > 0}
                                                      disabled={count === 0 && wouldExceedPointsLimit}
                                                      onClick={() => {
                                                        if (count > 0) {
                                                          updateSubSelection(selection.id, option, 'decrement');
                                                        } else if (!wouldExceedPointsLimit) {
                                                          group.items.forEach(otherItem => {
                                                            const otherRes = resolveEntry(system, otherItem.option);
                                                            if (otherRes && otherRes.id !== res.id) {
                                                              const otherCount = getSubSelectionCount(selection, otherRes.id);
                                                              if (otherCount > 0) {
                                                                updateSubSelection(selection.id, otherItem.option, 'decrement');
                                                              }
                                                            }
                                                          });
                                                          updateSubSelection(selection.id, option, 'increment');
                                                        }
                                                      }}
                                                      onChange={() => {}}
                                                    />
                                                  ) : isCheckbox ? (
                                                     <input 
                                                       type="checkbox" 
                                                       checked={count > 0 || isMandatory}
                                                       disabled={isMandatory || (count === 0 && wouldExceedPointsLimit)}
                                                       onChange={(e) => {
                                                         if (!isMandatory && !(e.target.checked && wouldExceedPointsLimit)) {
                                                           updateSubSelection(selection.id, option, e.target.checked ? 'increment' : 'decrement');
                                                         }
                                                       }}
                                                     />
                                                  ) : (
                                                    <div className="quantity-control">
                                                      <button 
                                                        className="btn-sm" 
                                                        style={{ padding: '2px 6px' }}
                                                        onClick={() => updateSubSelection(selection.id, option, 'decrement')}
                                                        disabled={count === 0}
                                                      >
                                                        <Minus size={12} />
                                                      </button>
                                                      <span className="quantity-value font-sans">{count}</span>
                                                      <button 
                                                        className="btn-sm" 
                                                        style={{ padding: '2px 6px' }}
                                                        onClick={() => updateSubSelection(selection.id, option, 'increment')}
                                                        disabled={wouldExceedPointsLimit}
                                                      >
                                                        <Plus size={12} />
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 3. Right Sidebar - Roster Validation & Info */}
      <div className="builder-right-bar">
        <h3>Lagerbericht</h3>
        <div style={{ margin: '16px 0', borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px' }}>
          <div className="flex-between font-serif text-gold" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
            <span>Gesamtkosten:</span>
            <span className="font-sans">
              {costs[roster.costLimitType] || 0} / {roster.costLimit} {costTypeLabel}
            </span>
          </div>
          <div className="flex-between text-dim" style={{ fontSize: '0.85rem' }}>
            <span>Status:</span>
            {validationErrors.length === 0 ? (
              <span className="badge badge-success">Gültig</span>
            ) : (
              <span className="badge badge-danger">Fehlerhaft ({validationErrors.length})</span>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Detachement Anforderungen</h4>
          {system.forceEntries?.[0]?.categoryLinks?.map(catLink => {
            const catName = system.categoryEntries?.find(c => c.id === catLink.targetId)?.name || catLink.name;
            const count = roster.forces[0]?.selections?.filter(s => s.category === catLink.targetId).length || 0;
            const minConRaw = catLink.constraints?.find(c => c.type === 'min')?.value;
            const minCon = (minConRaw === undefined || minConRaw < 0) ? 0 : minConRaw;
            const maxConRaw = catLink.constraints?.find(c => c.type === 'max')?.value;
            const maxCon = (maxConRaw === undefined || maxConRaw < 0) ? Infinity : maxConRaw;
            
            const isInvalid = count < minCon || count > maxCon;

            return (
              <div 
                key={catLink.id} 
                className="flex-between" 
                style={{ 
                  fontSize: '0.85rem', 
                  padding: '6px 0', 
                  color: isInvalid ? 'var(--color-danger)' : 'var(--text-parchment)'
                }}
              >
                <span>{catName}:</span>
                <span className="font-sans" style={{ fontWeight: 700 }}>
                  {count} (Min: {minCon} / Max: {maxCon === Infinity ? '∞' : maxCon})
                  {isInvalid ? ' ❌' : '  '}
                </span>
              </div>
            );
          })}
        </div>

        {/* Validation Errors Detailed List */}
        <div>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '10px' }}>Regelverstöße</h4>
          {validationErrors.length === 0 ? (
            <p className="text-success" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} /> Alle Riten eingehalten. Roster ist bereit für die Schlacht.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {validationErrors.map((err, idx) => (
                <div key={idx} className="validation-error-item">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <ShieldAlert size={14} className="text-danger" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{err.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
