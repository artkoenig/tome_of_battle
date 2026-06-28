import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react';
import { resolveEntry, findEntryInSystem } from '../../solver/validator';

export default function SelectionConfigurator({
  selection,
  system,
  roster,
  updateSubSelection,
  costTypeLabel,
  activeCatalogue
}) {
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
        if (typeLower.includes('weapon') || typeLower.includes('magic') || typeLower.includes('items') || typeLower.includes('rüstung') || typeLower.includes('waffe')) {
          const stats = p.characteristics.map(c => `${c.name}: ${c.value}`).join(', ');
          descriptions.push(`${p.name} (${stats})`);
        }
      });
    }
    return descriptions.join(' | ');
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

        if (child.type !== 'model' && (resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0 || resolvedChild.selectionEntryGroups?.length > 0)) {
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

      // 2. Process entry links
      def.entryLinks?.forEach(child => {
        const resolvedChild = resolveEntry(system, child);
        if (!resolvedChild) return;

        if (child.type === 'selectionEntryGroup' || resolvedChild.selectionEntries?.length > 0 || resolvedChild.entryLinks?.length > 0) {
          const combinedConstraints = prepareConstraints(resolvedChild);
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
        const combinedGroupConstraints = prepareConstraints(group);
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
    
    resolved.selectionEntries?.forEach(sub => {
      const subResolved = resolveEntry(system, sub);
      if (subResolved && subResolved.type === 'model') {
        collectOptions(subResolved);
      }
    });

    const collectFromActiveSelections = (currentSel) => {
      currentSel.selections?.forEach(subSel => {
        const subEntryId = subSel.entryLinkId || subSel.selectionEntryId;
        const subRawEntry = findEntryInSystem(system, subEntryId);
        const subResolved = resolveEntry(system, subRawEntry);
        if (subResolved) {
          if (subResolved.selectionEntries?.length > 0 || subResolved.entryLinks?.length > 0 || subResolved.selectionEntryGroups?.length > 0) {
            collectOptions(subResolved);
          }
          collectFromActiveSelections(subSel);
        }
      });
    };
    collectFromActiveSelections(unitSelection);

    return optionsList;
  };

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

  return (
    <div className="selection-node-body">
      <h4>Optionen &amp; Ausrüstung konfigurieren</h4>
      <div className="sub-selection-group" style={{ borderLeft: 'none', paddingLeft: 0 }}>
        {groupedList.map((group, gIdx) => {
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
              <div key={res.id} className="sub-selection-row" style={{ padding: '8px 12px' }}>
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
            return (
              <OptionGroupComponent 
                key={group.name}
                group={group}
                selection={selection}
                system={system}
                roster={roster}
                getSubSelectionCount={getSubSelectionCount}
                updateSubSelection={updateSubSelection}
                costTypeLabel={costTypeLabel}
                getOptionDescription={getOptionDescription}
              />
            );
          }
        })}
      </div>
    </div>
  );
}

function OptionGroupComponent({ 
  group, 
  selection, 
  system, 
  roster, 
  getSubSelectionCount, 
  updateSubSelection, 
  costTypeLabel,
  getOptionDescription
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
  const unitRawEntry = findEntryInSystem(system, unitEntryId);
  const unitResolved = resolveEntry(system, unitRawEntry);
  
  const isUniqueOptionTakenElsewhere = (targetResId) => {
    let taken = false;
    
    const checkSelection = (sel, isUnderCurrent) => {
      const underCurrent = isUnderCurrent || (sel.id === selection.id);
      
      if (!underCurrent) {
        const selRaw = findEntryInSystem(system, sel.selectionEntryId || sel.entryLinkId);
        const selRes = resolveEntry(system, selRaw);
        const selUnderlyingId = selRes ? selRes.id : (sel.selectionEntryId || sel.entryLinkId);
        
        if (selUnderlyingId === targetResId) {
          taken = true;
          return;
        }
      }
      
      sel.selections?.forEach(sub => checkSelection(sub, underCurrent));
    };

    roster.forces?.forEach(force => {
      force.selections?.forEach(sel => checkSelection(sel, false));
    });

    return taken;
  };
  
  const filteredGroupConstraints = group.constraints?.filter(con => {
    if (!con.scope || con.scope === 'parent' || con.scope === 'force' || con.scope === 'roster') {
      return true;
    }
    return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
           (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
  }) || [];

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
        }
      }
    } else {
      if (con.type === 'max') {
        if (activeCount > con.value) {
          hasGroupError = true;
        }
      }
    }
  });

  let limitParts = [];
  const ptsConstraint = filteredGroupConstraints.find(c => 
    c.type === 'max' && 
    (c.field === 'pts' || c.field === 'ecfa-8486-4f6c-c249' || c.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === c.field))
  );
  
  if (ptsConstraint) {
    limitParts.push(`${currentPoints} / ${ptsConstraint.value} Pkt.`);
  } else if (currentPoints > 0) {
    limitParts.push(`${currentPoints} Pkt.`);
  }

  if (maxLimit !== Infinity) {
    limitParts.push(`Max: ${maxLimit}`);
  }

  const limitText = limitParts.length > 0 ? `(${limitParts.join(' | ')})` : '';

  return (
    <div style={{ marginBottom: '12px' }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
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

      {isExpanded && (
        <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--border-gold-dim)', marginTop: '6px' }}>
          {group.items.map(({ option, groupConstraints }) => {
            const res = resolveEntry(system, option);
            if (!res) return null;
            const count = getSubSelectionCount(selection, res.id);
            const points = res.costs?.find(c => c.typeId === roster.costLimitType)?.value || 0;
            const filteredOptionConstraints = res.constraints?.filter(con => {
              if (!con.scope || con.scope === 'parent' || con.scope === 'force' || con.scope === 'roster') {
                return true;
              }
              return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
                     (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
            }) || [];
            const minConstraint = filteredOptionConstraints.find(c => c.type === 'min');
            const maxConstraint = filteredOptionConstraints.find(c => c.type === 'max');
            const minLimitOption = (minConstraint?.value === undefined || minConstraint?.value < 0) ? 0 : minConstraint.value;
            const maxLimitOption = (maxConstraint?.value === undefined || maxConstraint?.value < 0) ? Infinity : maxConstraint.value;
            const isMandatory = minLimitOption > 0 && minLimitOption === maxLimitOption;
            
            const isRadio = groupConstraints?.some(c => c.type === 'max' && c.value === 1);
            const isBinary = (maxConstraint && maxConstraint.value === 1) || isRadio;
            const descText = getOptionDescription(res);

            const ptsConstraintGroup = filteredGroupConstraints.find(c => 
              c.type === 'max' && 
              (c.field === 'pts' || c.field === 'ecfa-8486-4f6c-c249' || c.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === c.field))
            );
            const maxPointsLimit = ptsConstraintGroup ? ptsConstraintGroup.value : Infinity;

            let wouldExceedPointsLimit = false;
            if (maxPointsLimit !== Infinity) {
              let activePoints = currentPoints;
              if (ptsConstraintGroup.groupItemIds) {
                let sumPoints = 0;
                selection.selections?.forEach(sub => {
                  const subId = sub.entryLinkId || sub.selectionEntryId;
                  if (ptsConstraintGroup.groupItemIds.has(subId)) {
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
            const isRosterUnique = res.constraints?.some(c => 
              c.type === 'max' && 
              c.value === 1 && 
              (c.scope === 'roster' || c.scope === 'force')
            );
            const isTakenElsewhere = isRosterUnique && isUniqueOptionTakenElsewhere(res.id);
            const isSelectDisabled = wouldExceedPointsLimit || isTakenElsewhere;

            return (
              <div key={res.id} className="sub-selection-row" style={{ opacity: (count === 0 && isSelectDisabled) ? 0.5 : 1 }}>
                <div>
                  <div>
                    <span style={{ fontWeight: 600, color: (count === 0 && isSelectDisabled) ? 'var(--text-dim)' : 'inherit' }}>
                      {res.name}
                      {isTakenElsewhere && <span className="text-danger" style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: 600 }}>(Bereits vergeben)</span>}
                    </span>
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
                      disabled={count === 0 && isSelectDisabled}
                      onClick={() => {
                        if (count > 0) {
                          updateSubSelection(selection.id, option, 'decrement');
                        } else if (!isSelectDisabled) {
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
                  ) : (
                    <input 
                      type="checkbox" 
                      checked={count > 0 || isMandatory}
                      disabled={isMandatory || (count === 0 && isSelectDisabled)}
                      onChange={(e) => {
                        if (!isMandatory) {
                          updateSubSelection(selection.id, option, e.target.checked ? 'increment' : 'decrement');
                        }
                      }}
                    />
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
