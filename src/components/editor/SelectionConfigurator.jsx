import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus, Info } from 'lucide-react';
import { resolveEntry, findEntryInSystem, getModifiedConstraintValue, computeRosterCounts, getOptionDisplayCost, getSelectionTotalCost } from '../../solver/validator';
import { getUnitOptions } from '../../solver/optionsCollector';
import BottomSheet from './BottomSheet';
import OptionGroupComponent from './OptionGroup';
import { useDebugMode } from '../../hooks/DebugContext';
import {
  UPGRADE_DETAILS_KEYWORDS,
  GENERAL_EXACT_KEYWORDS,
  GENERAL_SUBSTRING_KEYWORDS,
  GENERAL_IDS
} from '../../solver/constants';


export default function SelectionConfigurator({
  selection,
  system,
  roster,
  updateSubSelection,
  costTypeLabel,
  activeCatalogue,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  setActiveInfo
}) {
  const { showDebugIds } = useDebugMode();

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
                  {points > 0 && <span className="text-gold font-body" style={{ fontSize: '0.85rem', marginRight: '4px' }}>+{points} Pkt.</span>}
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
                      <span className="quantity-value font-body">{count}</span>
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
    </div>
  );
}

