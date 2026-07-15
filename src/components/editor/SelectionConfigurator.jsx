import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { resolveEntry, findEntryInSystem, getModifiedConstraintValue, computeRosterCounts, getOptionDisplayCost, getSelectionTotalCost } from '../../solver/validator';
import { getUnitOptions, isUniqueOptionTakenElsewhere, isOptionRosterUnique } from '../../solver/optionsCollector';
import BottomSheet from './BottomSheet';
import OptionGroupComponent from './OptionGroup';
import {
  UPGRADE_DETAILS_KEYWORDS,
  GENERAL_EXACT_KEYWORDS,
  GENERAL_SUBSTRING_KEYWORDS
} from '../../solver/constants';
import { isQuirkGeneralEntryId } from '../../solver/systemQuirks';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';


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
  setActiveInfo,
  onShowRule
}) {
  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const activeForceId = roster.forces ? roster.forces.find(force => {
    const containsSel = (list) => {
      if (!list) return false;
      for (const s of list) {
        if (s.id === selection.id) return true;
        if (containsSel(s.selections)) return true;
      }
      return false;
    };
    return containsSel(force.selections);
  })?.id : null;
  const forceCategoryCounts = activeForceId ? (categoryCounts[activeForceId] || {}) : {};

  const displayCtx = {
    roster,
    system,
    selectionCounts,
    forceCategoryCounts,
    selection: null,
    parentSelection: selection,
    parentCatalogueId: activeCatalogue?.id
  };

  // Helper to compile a clean description string for an upgrade/magic item
  const getOptionDescription = (res) => {
    if (!res) return '';
    const descriptions = [];

    let rules = res.rules || [];
    if (rules.length === 0 && res.name) {
      const lowerName = res.name.toLowerCase().trim();
      let foundRule = system.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
      if (!foundRule) {
        for (const cat of system.catalogues || []) {
          foundRule = cat.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
          if (foundRule) break;
        }
      }
      if (foundRule) {
        rules = [foundRule];
      }
    }

    if (rules.length > 0) {
      rules.forEach(r => {
        if (r.description) {
          const ref = r.publicationRef ? ` ${r.publicationRef}` : '';
          descriptions.push(`${r.description}${ref}`);
        }
      });
    }
    if (res.profiles && res.profiles.length > 0) {
      res.profiles.forEach(p => {
        const typeLower = p.profileTypeName?.toLowerCase() || '';
        if (UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) {
          const stats = p.characteristics.map(c => `${c.name}: ${c.value}`).join(', ');
          const ref = p.publicationRef ? ` ${p.publicationRef}` : '';
          descriptions.push(`${p.name} (${stats})${ref}`);
        }
      });
    }
    if (descriptions.length === 0 && res.publicationRef) {
      descriptions.push(res.publicationRef);
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
          modifiers: item.groupModifiers,
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
           isQuirkGeneralEntryId(system, item.option.id) ||
           isQuirkGeneralEntryId(system, res.id);
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
            const basePoints = getOptionDisplayCost(system, option, roster.costLimitType, displayCtx);
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

            const isRosterUnique = isOptionRosterUnique(res, system);
            const isTakenElsewhere = isRosterUnique && isUniqueOptionTakenElsewhere(res, system, activeCatalogue.id, selection, roster);
            const isSelectDisabled = isTakenElsewhere;

            const hasEntryChildren = (entry) => {
              if (!entry) return false;
              return (entry.selectionEntries && entry.selectionEntries.length > 0) ||
                     (entry.entryLinks && entry.entryLinks.length > 0) ||
                     (entry.selectionEntryGroups && entry.selectionEntryGroups.length > 0);
            };

            const isIndependentSubUnit = res && (res.type === 'unit' || res.type === 'model') && (res.collective === false || res.collective === 'false') && hasEntryChildren(res);

            const isClickable = !isMandatory && !(count === 0 && isSelectDisabled);
            const handleRowClick = (e) => {
              if (e.target.closest('button') || e.target.closest('input')) {
                return;
              }
              if (isClickable) {
                if (isIndependentSubUnit) {
                  if (count < maxLimit && !isSelectDisabled) {
                    updateSubSelection(selection.id, option, 'add_instance', parentCount);
                  }
                } else if (isBinary) {
                  const isDecrementing = count > 0;
                  if (isDecrementing) {
                    if (count > minLimit) {
                      updateSubSelection(selection.id, option, 'decrement', parentCount);
                    }
                  } else {
                    if (!isSelectDisabled) {
                      updateSubSelection(selection.id, option, 'increment', parentCount);
                    }
                  }
                } else {
                  // For standard options, clicking row increments. 
                  // If we wanted right-click to decrement we could, but click is increment.
                  if (count < maxLimit && !isSelectDisabled) {
                    updateSubSelection(selection.id, option, 'increment', parentCount);
                  }
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span 
                    style={{ 
                      fontWeight: 600, 
                      color: (count === 0 && isSelectDisabled) ? 'var(--text-dim)' : 'inherit'
                    }}
                  >
                    {res.name}
                    <RuleChipIcon
                      name={res.name}
                      hasInfo={!!descText}
                      onShowRule={onShowRule}
                      onInfoClick={() => {
                        if (window.innerWidth <= 900) {
                          setActiveInfo({ title: res.name, text: renderUpgradeDetails(res, system) });
                        }
                      }}
                      onInfoEnter={(e) => handleMouseEnter(res.name, renderUpgradeDetails(res, system), e)}
                      onInfoMove={handleMouseMove}
                      onInfoLeave={handleMouseLeave}
                    />
                    {isTakenElsewhere && <span className="text-danger text-micro" style={{ marginLeft: '6px', fontWeight: 600 }}>(Bereits vergeben)</span>}
                  </span>
                </div>
                <div className="sub-selection-controls">
                  {points > 0 && <span className="text-gold text-label" style={{ marginRight: '4px' }}>+{points} Pkt.</span>}
                  {isIndependentSubUnit ? (
                    <button 
                      type="button"
                      className="btn-primary text-label"
                      style={{ padding: '4px 8px', height: 'auto', display: 'flex', alignItems: 'center' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSubSelection(selection.id, option, 'add_instance', parentCount);
                      }}
                      disabled={isSelectDisabled || count >= maxLimit}
                    >
                      <Plus size={12} style={{ marginRight: '4px' }} />
                      Hinzufügen
                    </button>
                  ) : isBinary ? (
                    <input 
                      type="checkbox" 
                      checked={count > 0 || isMandatory}
                      disabled={isMandatory || (count === 0 && isSelectDisabled) || (count > 0 && count <= minLimit)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (!isMandatory && !(count > 0 && count <= minLimit)) {
                          updateSubSelection(selection.id, option, e.target.checked ? 'increment' : 'decrement', parentCount);
                        }
                      }}
                    />
                  ) : (
                    <div className="quantity-control">
                      <button 
                        className="qty-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSubSelection(selection.id, option, 'decrement', parentCount);
                        }}
                        disabled={count <= minLimit}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="quantity-value font-body">{count}</span>
                      <button 
                        className="qty-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSubSelection(selection.id, option, 'increment', parentCount);
                        }}
                        disabled={isSelectDisabled || count >= maxLimit}
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
                onShowRule={onShowRule}
              />
            );
          }
        })}
      </div>
    </div>
  );
}

