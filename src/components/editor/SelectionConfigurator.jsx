import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus, Info } from 'lucide-react';
import { resolveEntry, findEntryInSystem, getModifiedConstraintValue, computeRosterCounts, getOptionDisplayCost, getSelectionTotalCost } from '../../solver/validator';
import { getUnitOptions } from '../../solver/optionsCollector';
import BottomSheet from './BottomSheet';
import { useDebugMode } from '../../hooks/DebugContext';
import {
  UPGRADE_DETAILS_KEYWORDS,
  GENERAL_EXACT_KEYWORDS,
  GENERAL_SUBSTRING_KEYWORDS,
  GENERAL_IDS
} from '../../solver/constants';

const findForceOfSelection = (selId, forces) => {
  if (!forces) return null;
  for (const force of forces) {
    const containsSel = (list) => {
      if (!list) return false;
      for (const s of list) {
        if (s.id === selId) return true;
        if (containsSel(s.selections)) return true;
      }
      return false;
    };
    if (containsSel(force.selections)) {
      return force.id;
    }
  }
  return null;
};

export default function SelectionConfigurator({
  selection,
  system,
  roster,
  updateSubSelection,
  costTypeLabel,
  activeCatalogue
}) {
  const { showDebugIds } = useDebugMode();
  const [activeInfo, setActiveInfo] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);

  const updateTooltipPosition = (e) => {
    const tooltipWidth = 320;
    const estimatedHeight = 150;
    let x = e.clientX + 15;
    let y = e.clientY + 15;

    if (x + tooltipWidth > window.innerWidth) {
      x = e.clientX - tooltipWidth - 15;
      if (x < 10) x = 10;
    }

    if (y + estimatedHeight > window.innerHeight) {
      y = e.clientY - estimatedHeight - 15;
      if (y < 10) y = 10;
    }
    return { x, y };
  };

  const handleMouseEnter = (title, text, e) => {
    if (window.innerWidth <= 900) return;
    const pos = updateTooltipPosition(e);
    setHoveredInfo({ title, text, x: pos.x, y: pos.y });
  };

  const handleMouseMove = (e) => {
    if (window.innerWidth <= 900) return;
    const pos = updateTooltipPosition(e);
    setHoveredInfo(prev => prev ? { ...prev, x: pos.x, y: pos.y } : null);
  };

  const handleMouseLeave = () => {
    setHoveredInfo(null);
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
        if (UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) {
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

  // The `getUnitOptions` logic has been extracted to `optionsCollector.js` for testability.
  const options = getUnitOptions(system, activeCatalogue?.id, selection);
  const groupedList = [];
  const groupMap = {};

  options.forEach(item => {
    const groupNameLower = item.groupName?.toLowerCase() || '';
    const isRoleGroup = groupNameLower === 'rolle' || 
                        groupNameLower === 'role' || 
                        groupNameLower === 'rollen' || 
                        groupNameLower === 'roles';

    if (item.groupName && !isRoleGroup) {
      if (!groupMap[item.groupName]) {
        groupMap[item.groupName] = {
          name: item.groupName,
          id: item.groupId,
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

  const isGeneralItem = (item) => {
    if (!item) return false;
    const res = resolveEntry(system, item.option, activeCatalogue.id);
    if (!res) return false;
    const nameLower = res.name?.toLowerCase() || '';
    return GENERAL_EXACT_KEYWORDS.includes(nameLower) || 
           GENERAL_SUBSTRING_KEYWORDS.some(k => nameLower.includes(k)) ||
           GENERAL_IDS.includes(item.option.id) ||
           GENERAL_IDS.includes(res.id);
  };

  const isGeneralGroupOrStandalone = (group) => {
    if (group.standalone) {
      return isGeneralItem(group.item);
    }
    return group.items?.some(isGeneralItem);
  };

  groupedList.sort((a, b) => {
    const aGen = isGeneralGroupOrStandalone(a);
    const bGen = isGeneralGroupOrStandalone(b);
    if (aGen && !bGen) return -1;
    if (!aGen && bGen) return 1;
    return 0;
  });

  return (
    <div className="selection-node-body">
      <h4>Optionen &amp; Ausrüstung konfigurieren</h4>
      <div className="sub-selection-group" style={{ borderLeft: 'none', paddingLeft: 0 }}>
        {groupedList.map((group, gIdx) => {
          if (group.standalone) {
            const { option, parentDefId } = group.item;
            const res = resolveEntry(system, option, activeCatalogue.id);
            if (!res) return null;
            const count = getSubSelectionCount(selection, res.id);
            const basePoints = getOptionDisplayCost(system, option, roster.costLimitType);
            const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
            const unitRawEntry = findEntryInSystem(system, unitEntryId, activeCatalogue.id);
            const unitResolved = resolveEntry(system, unitRawEntry, activeCatalogue.id);

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

            let parentCount = 1;
            if (parentDefId === unitResolved?.id || parentDefId === unitResolved?.targetId || parentDefId === unitEntryId) {
              parentCount = selection.number || 1;
            } else {
              const pSel = selection.selections?.find(s => (s.entryLinkId || s.selectionEntryId) === parentDefId);
              if (pSel) parentCount = pSel.number || 1;
            }

            const isCollective = res.collective || option.collective || false;
            const points = isCollective ? basePoints * parentCount : basePoints;

            const isClickable = !isMandatory;
            const handleRowClick = (e) => {
              if (e.target.closest('button') || e.target.closest('input')) {
                return;
              }
              if (isClickable) {
                if (isBinary) {
                  updateSubSelection(selection.id, option, count > 0 ? 'decrement' : 'increment', parentCount);
                } else {
                  updateSubSelection(selection.id, option, 'increment', parentCount);
                }
              }
            };

            return (
              <div 
                key={res.id} 
                className={`sub-selection-row ${isClickable ? 'clickable' : 'disabled'}`}
                onClick={handleRowClick}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span 
                    style={{ fontWeight: 600, cursor: descText ? 'help' : 'default' }}
                    onMouseEnter={(e) => descText && handleMouseEnter(res.name, descText, e)}
                    onMouseMove={descText ? handleMouseMove : null}
                    onMouseLeave={descText ? handleMouseLeave : null}
                  >
                    {res.name}
                    {showDebugIds && <span className="debug-id-badge clickable">{res.id}</span>}
                  </span>
                  {descText && (
                    <button
                      type="button"
                      className="info-help-btn"
                      onClick={() => {
                        if (window.innerWidth <= 900) {
                          setActiveInfo({ title: res.name, text: descText });
                        }
                      }}
                      onMouseEnter={(e) => handleMouseEnter(res.name, descText, e)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      title="Beschreibung anzeigen"
                      style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--text-gold)', opacity: 0.7, transition: 'opacity 0.2s' }}
                    >
                      <Info size={14} />
                    </button>
                  )}
                </div>
                <div className="sub-selection-controls">
                  {points > 0 && <span className="text-gold font-sans" style={{ fontSize: '0.85rem', marginRight: '4px' }}>+{points} Pkt.</span>}
                  {isBinary ? (
                    <input 
                      type="checkbox" 
                      checked={count > 0 || isMandatory}
                      disabled={isMandatory}
                      onChange={(e) => {
                        if (!isMandatory) {
                          updateSubSelection(selection.id, option, e.target.checked ? 'increment' : 'decrement', parentCount);
                        }
                      }}
                    />
                  ) : (
                    <div className="quantity-control">
                      <button 
                        className="btn-sm" 
                        style={{ padding: '2px 6px' }}
                        onClick={() => updateSubSelection(selection.id, option, 'decrement', parentCount)}
                        disabled={count === 0}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="quantity-value font-sans">{count}</span>
                      <button 
                        className="btn-sm" 
                        style={{ padding: '2px 6px' }}
                        onClick={() => updateSubSelection(selection.id, option, 'increment', parentCount)}
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
                activeCatalogue={activeCatalogue}
                setActiveInfo={setActiveInfo}
                onHoverEnter={handleMouseEnter}
                onHoverMove={handleMouseMove}
                onHoverLeave={handleMouseLeave}
              />
            );
          }
        })}
      </div>

      <BottomSheet
        isOpen={!!activeInfo}
        onClose={() => setActiveInfo(null)}
        title={activeInfo?.title || ''}
        desktopMode="modal"
      >
        <div className="info-popup-body">
          {activeInfo?.text}
        </div>
      </BottomSheet>

      {hoveredInfo && (
        <div 
          className="gothic-tooltip"
          style={{
            left: hoveredInfo.x,
            top: hoveredInfo.y
          }}
        >
          <div className="tooltip-title">{hoveredInfo.title}</div>
          <div className="tooltip-body">{hoveredInfo.text}</div>
        </div>
      )}
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
  getOptionDescription,
  activeCatalogue,
  setActiveInfo,
  onHoverEnter,
  onHoverMove,
  onHoverLeave
}) {
  const { showDebugIds } = useDebugMode();
  const [isExpanded, setIsExpanded] = useState(false);

  const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
  const unitRawEntry = findEntryInSystem(system, unitEntryId, activeCatalogue.id);
  const unitResolved = resolveEntry(system, unitRawEntry, activeCatalogue.id);
  
  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const activeForceId = findForceOfSelection(selection.id, roster.forces);
  const forceCategoryCounts = activeForceId ? (categoryCounts[activeForceId] || {}) : {};

  const selectedItemsSummary = group.items
    .map(({ option }) => {
      const res = resolveEntry(system, option, activeCatalogue.id);
      if (!res) return null;
      const count = getSubSelectionCount(selection, res.id);
      if (count > 0) {
        return count > 1 ? `${count}x ${res.name}` : res.name;
      }
      return null;
    })
    .filter(Boolean)
    .join(', ');

  const isUniqueOptionTakenElsewhere = (targetRes) => {
    const targetIdToCheck = targetRes.targetId || targetRes.id;
    let taken = false;
    
    const checkSelection = (sel, isUnderCurrent) => {
      const underCurrent = isUnderCurrent || (sel.id === selection.id);
      
      if (!underCurrent) {
        const selRaw = findEntryInSystem(system, sel.selectionEntryId || sel.entryLinkId, activeCatalogue.id);
        const selRes = resolveEntry(system, selRaw, activeCatalogue.id);
        const selUnderlyingId = selRes ? (selRes.targetId || selRes.id) : (sel.selectionEntryId || sel.entryLinkId);
        
        if (selUnderlyingId === targetIdToCheck) {
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

  const minLimitRaw = filteredGroupConstraints.find(c => c.type === 'min');
  const minLimit = minLimitRaw ? getModifiedConstraintValue(minLimitRaw, group.modifiers, roster, selectionCounts, forceCategoryCounts) : 0;
  const maxLimitRaw = filteredGroupConstraints.find(c => c.type === 'max');
  const maxLimit = maxLimitRaw ? getModifiedConstraintValue(maxLimitRaw, group.modifiers, roster, selectionCounts, forceCategoryCounts) : Infinity;
  
  const currentCount = group.items.reduce((sum, item) => {
    const res = resolveEntry(system, item.option, activeCatalogue.id);
    return sum + (res ? getSubSelectionCount(selection, res.id) : 0);
  }, 0);

  const currentPoints = group.items.reduce((sum, item) => {
    const res = resolveEntry(system, item.option, activeCatalogue.id);
    const count = res ? getSubSelectionCount(selection, res.id) : 0;
    const points = getOptionDisplayCost(system, item.option, roster.costLimitType);
    return sum + (points * count);
  }, 0);

  let hasGroupError = false;
  
  filteredGroupConstraints.forEach(con => {
    const finalValue = getModifiedConstraintValue(con, group.modifiers, roster, selectionCounts, forceCategoryCounts);
    if (finalValue < 0) return;
    
    let activeCount = currentCount;
    let activePoints = currentPoints;

    if (con.groupItemIds) {
      let sumCount = 0;
      let sumPoints = 0;
      selection.selections?.forEach(sub => {
        const subId = sub.entryLinkId || sub.selectionEntryId;
        if (con.groupItemIds.has(subId)) {
          const count = sub.number || 1;
          const pts = getSelectionTotalCost(sub, roster.costLimitType);
          sumCount += count;
          sumPoints += pts;
        }
      });
      activeCount = sumCount;
      activePoints = sumPoints;
    }

    const isCostField = con.field === 'pts' || con.field === 'ecfa-8486-4f6c-c249' || con.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === con.field);
    if (isCostField) {
      if (con.type === 'max') {
        if (activePoints > finalValue) {
          hasGroupError = true;
        }
      }
    } else {
      if (con.type === 'max') {
        if (activeCount > finalValue) {
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
    const ptsConstraintVal = getModifiedConstraintValue(ptsConstraint, group.modifiers, roster, selectionCounts, forceCategoryCounts);
    limitParts.push(`${currentPoints} / ${ptsConstraintVal} Pkt.`);
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
          border: hasGroupError ? '1px solid var(--color-danger)' : '1px solid var(--border-dark)',
          borderRadius: '4px',
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
          <span className={hasGroupError ? "font-serif text-danger" : "font-serif text-gold"} style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            {group.name} 
            {showDebugIds && group.id && <span className="debug-id-badge clickable" style={{ marginLeft: '6px' }}>def:{group.id}</span>}
            <span style={{ fontSize: '0.8rem', marginLeft: '6px', fontWeight: 400, color: 'var(--text-dim)' }}>{limitText}</span>
          </span>
          {selectedItemsSummary && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-parchment)', opacity: 0.75, fontWeight: 400 }}>
              Auswahl: {selectedItemsSummary}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown size={16} className={hasGroupError ? "text-danger" : "text-gold"} />
        ) : (
          <ChevronRight size={16} className={hasGroupError ? "text-danger" : "text-gold"} />
        )}
      </div>

      {isExpanded && (
        <div style={{ borderLeft: '2px solid var(--border-gold-dim)', marginTop: '6px', paddingLeft: '4px' }}>
          {group.items
            .slice()
            .sort((a, b) => {
               const costType = roster?.costLimitType || 'pts';
               const aPoints = getOptionDisplayCost(system, a.option, costType) || 0;
               const bPoints = getOptionDisplayCost(system, b.option, costType) || 0;
               return bPoints - aPoints; // Descending
            })
            .map(({ option, groupConstraints, parentDefId }) => {
            const res = resolveEntry(system, option, activeCatalogue.id);
            if (!res) return null;
            const count = getSubSelectionCount(selection, res.id);
            const basePoints = getOptionDisplayCost(system, option, roster.costLimitType);
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
            const isExplicitlyMulti = (maxConstraint && maxConstraint.value > 1) || (!maxConstraint && !isMandatory && !isRadio);
            const isBinary = !isExplicitlyMulti && ((maxConstraint && maxConstraint.value === 1) || isRadio);
            const descText = getOptionDescription(res);

            let parentCount = 1;
            const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
            if (parentDefId === unitResolved?.id || parentDefId === unitResolved?.targetId || parentDefId === unitEntryId) {
              parentCount = selection.number || 1;
            } else {
              const pSel = selection.selections?.find(s => (s.entryLinkId || s.selectionEntryId) === parentDefId);
              if (pSel) parentCount = pSel.number || 1;
            }

            const isCollective = res.collective || option.collective || false;
            const points = isCollective ? basePoints * parentCount : basePoints;

            const ptsConstraintGroup = filteredGroupConstraints.find(c => 
              c.type === 'max' && 
              (c.field === 'pts' || c.field === 'ecfa-8486-4f6c-c249' || c.field === roster.costLimitType || system.costTypes?.some(ct => ct.id === c.field))
            );
            const maxPointsLimit = ptsConstraintGroup 
              ? getModifiedConstraintValue(ptsConstraintGroup, group.modifiers, roster, selectionCounts, forceCategoryCounts)
              : Infinity;

            let wouldExceedPointsLimit = false;
            if (maxPointsLimit !== Infinity) {
              let activePoints = currentPoints;
              if (ptsConstraintGroup.groupItemIds) {
                let sumPoints = 0;
                selection.selections?.forEach(sub => {
                  const subId = sub.entryLinkId || sub.selectionEntryId;
                  if (ptsConstraintGroup.groupItemIds.has(subId)) {
                    const count = sub.number || 1;
                    const pts = getSelectionTotalCost(sub, roster.costLimitType);
                    sumPoints += pts;
                  }
                });
                activePoints = sumPoints;
              }

              let pointsDiff = points;
              if (isRadio && count === 0) {
                const selectedOther = group.items.find(otherItem => {
                  const otherRes = resolveEntry(system, otherItem.option, activeCatalogue.id);
                  return otherRes && otherRes.id !== res.id && getSubSelectionCount(selection, otherRes.id) > 0;
                });
                if (selectedOther) {
                  const otherPoints = getOptionDisplayCost(system, selectedOther.option, roster.costLimitType);
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
            const isTakenElsewhere = isRosterUnique && isUniqueOptionTakenElsewhere(res);
            const isSelectDisabled = wouldExceedPointsLimit || isTakenElsewhere;

            const isClickable = !isMandatory && !(count === 0 && isSelectDisabled);
            const handleRowClick = (e) => {
              if (e.target.closest('button') || e.target.closest('input')) {
                return;
              }
              if (isClickable) {
                if (isBinary) {
                  if (isRadio) {
                    if (count > 0) {
                      updateSubSelection(selection.id, option, 'decrement', parentCount);
                    } else {
                      group.items.forEach(otherItem => {
                        const otherRes = resolveEntry(system, otherItem.option, activeCatalogue.id);
                        if (otherRes && otherRes.id !== res.id) {
                          const otherCount = getSubSelectionCount(selection, otherRes.id);
                          if (otherCount > 0) {
                            updateSubSelection(selection.id, otherItem.option, 'decrement', parentCount);
                          }
                        }
                      });
                      updateSubSelection(selection.id, option, 'increment', parentCount);
                    }
                  } else {
                    updateSubSelection(selection.id, option, count > 0 ? 'decrement' : 'increment', parentCount);
                  }
                } else {
                  updateSubSelection(selection.id, option, 'increment', parentCount);
                }
              }
            };

            return (
              <div 
                key={res.id} 
                className={`sub-selection-row ${isClickable ? 'clickable' : 'disabled'}`}
                style={{ opacity: (count === 0 && isSelectDisabled) ? 0.5 : 1 }}
                onClick={handleRowClick}
              >
                <div style={{ paddingLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span 
                    style={{ 
                      fontWeight: 600, 
                      color: (count === 0 && isSelectDisabled) ? 'var(--text-dim)' : 'inherit',
                      cursor: descText ? 'help' : 'default'
                    }}
                    onMouseEnter={(e) => descText && onHoverEnter(res.name, descText, e)}
                    onMouseMove={descText ? onHoverMove : null}
                    onMouseLeave={descText ? onHoverLeave : null}
                  >
                    {res.name}
                    {showDebugIds && <span className="debug-id-badge clickable">{res.id}</span>}
                    {isTakenElsewhere && <span className="text-danger" style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: 600 }}>(Bereits vergeben)</span>}
                  </span>
                  {descText && (
                    <button
                      type="button"
                      className="info-help-btn"
                      onClick={() => {
                        if (window.innerWidth <= 900) {
                          setActiveInfo({ title: res.name, text: descText });
                        }
                      }}
                      onMouseEnter={(e) => onHoverEnter(res.name, descText, e)}
                      onMouseMove={onHoverMove}
                      onMouseLeave={onHoverLeave}
                      title="Beschreibung anzeigen"
                      style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--text-gold)', opacity: 0.7, transition: 'opacity 0.2s' }}
                    >
                      <Info size={14} />
                    </button>
                  )}
                </div>
                <div className="sub-selection-controls">
                  {points > 0 && <span className="text-gold font-sans" style={{ fontSize: '0.85rem', marginRight: '4px' }}>+{points} Pkt.</span>}
                  {isBinary ? (
                    isRadio ? (
                      <input 
                        type="radio" 
                        name={`${selection.id}-${group.name}`}
                        checked={count > 0}
                        disabled={count === 0 && isSelectDisabled}
                        onClick={() => {
                          if (count > 0) {
                            updateSubSelection(selection.id, option, 'decrement', parentCount);
                          } else if (!isSelectDisabled) {
                            group.items.forEach(otherItem => {
                              const otherRes = resolveEntry(system, otherItem.option, activeCatalogue.id);
                              if (otherRes && otherRes.id !== res.id) {
                                const otherCount = getSubSelectionCount(selection, otherRes.id);
                                if (otherCount > 0) {
                                  updateSubSelection(selection.id, otherItem.option, 'decrement', parentCount);
                                }
                              }
                            });
                            updateSubSelection(selection.id, option, 'increment', parentCount);
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
                            updateSubSelection(selection.id, option, e.target.checked ? 'increment' : 'decrement', parentCount);
                          }
                        }}
                      />
                    )
                  ) : (
                    <div className="quantity-control">
                      <button 
                        className="btn-sm" 
                        style={{ padding: '2px 6px' }}
                        onClick={() => updateSubSelection(selection.id, option, 'decrement', parentCount)}
                        disabled={count === 0}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="quantity-value font-sans">{count}</span>
                      <button 
                        className="btn-sm" 
                        style={{ padding: '2px 6px' }}
                        onClick={() => updateSubSelection(selection.id, option, 'increment', parentCount)}
                        disabled={isSelectDisabled}
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
