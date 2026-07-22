import React from 'react';
import { Plus, Minus } from 'lucide-react';
import {
  resolveEntry, findEntryInSystem, computeRosterCounts, getOptionDisplayCost, isIndependentSubUnit,
  isEntryScope, getUnitOptions, isUniqueOptionTakenElsewhere, isOptionRosterUnique,
  isQuirkGeneralEntryId, findForceContainingSelection, resolveCostLimitLabel,
  countSelections, getEffectiveModifiers, getEffectiveConstraintLimit,
  UPGRADE_DETAILS_KEYWORDS, GENERAL_EXACT_KEYWORDS, GENERAL_SUBSTRING_KEYWORDS
} from '../../solver/validator';
import OptionGroupComponent from './OptionGroup';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';
import { resolveRowSelectionId } from './optionNesting';
import { ConstraintKind } from '../../parser/schema/battlescribeSchema.generated.js';


export default function SelectionConfigurator({
  selection,
  system,
  roster,
  subSelectionOperations,
  activeCatalogue,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  setActiveInfo,
  onShowRule,
  isListRule = false
}) {
  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const costTypeLabel = resolveCostLimitLabel(roster, system);
  const activeForce = findForceContainingSelection(roster, selection.id);
  const activeForceId = activeForce?.id ?? null;
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
    const matchesOption = (selection) =>
      (selection.entryLinkId || selection.selectionEntryId) === optionEntryId;
    return countSelections(unitSelection.selections, {
      includeChildSelections: true,
      predicate: matchesOption,
    });
  };

  // The `getUnitOptions` logic has been extracted to `optionsCollector.js` for testability.
  // The visibility context lets the collector omit conditionally hidden options (e.g. the
  // Vampiric Powers groups of unselected bloodlines) instead of surfacing them all.
  const visibilityContext = { roster, selectionCounts, forceCategoryCounts, force: activeForce };
  const options = getUnitOptions(system, activeCatalogue?.id, selection, visibilityContext);
  const groupedList = [];
  const groupMap = {};

  options.forEach(item => {
    const groupNameLower = item.groupName?.toLowerCase() || '';
    const isRoleGroup = groupNameLower === 'rolle' ||
                        groupNameLower === 'role' ||
                        groupNameLower === 'rollen' ||
                        groupNameLower === 'roles';

    // Group by the group's own id, not its display name: several distinct groups can
    // share a name (e.g. the five bloodline-specific "Vampiric Powers" groups) and must
    // stay separate rather than collapsing into one merged group whose modifiers/items
    // get mixed. The name is retained only for display. Falls back to the name when a
    // group carries no id.
    const groupKey = item.groupId || item.groupName;

    if (item.groupName && !isRoleGroup) {
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = {
          name: item.groupName,
          id: item.groupId,
          constraints: item.groupConstraints,
          modifiers: item.groupModifiers,
          // The selection this group is re-emitted from (null for a plain unit group);
          // drives where the group renders — nested under that selection's row.
          ownerSelectionId: item.ownerSelectionId || null,
          items: []
        };
        groupedList.push(groupMap[groupKey]);
      }
      groupMap[groupKey].items.push(item);
    } else {
      groupedList.push({
        standalone: true,
        ownerSelectionId: item.ownerSelectionId || null,
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

  // Partition sections by the selection they hang off: top-level sections belong to the
  // unit, the rest render indented under the row of the selection whose id they carry
  // (optionsCollector's ownerSelectionId). This relationship is the sole nesting driver —
  // no catalogue-, mount- or Barding-specific ids anywhere.
  const sectionsByOwner = new Map();
  const topSections = [];
  groupedList.forEach(section => {
    if (section.ownerSelectionId) {
      const siblings = sectionsByOwner.get(section.ownerSelectionId) || [];
      siblings.push(section);
      sectionsByOwner.set(section.ownerSelectionId, siblings);
    } else {
      topSections.push(section);
    }
  });

  // The sub-options a selected row re-emits, rendered indented directly beneath that row.
  // Recurses to arbitrary depth through renderSection; null for an unselected or childless
  // row. Indentation is purely visual — selection, count, cost and mutation targets stay
  // untouched.
  const renderOwnedChildren = (rowSelectionId) => {
    const children = rowSelectionId ? sectionsByOwner.get(rowSelectionId) : null;
    if (!children || children.length === 0) return null;
    return (
      <div className="nested-option-block">
        {children.map(renderSection)}
      </div>
    );
  };

  const renderSection = (group) => {
          if (group.standalone) {
            const { option, parentDefId, ownerSelectionId } = group.item;
            const res = resolveEntry(system, option, activeCatalogue.id);
            if (!res) return null;
            // A re-emitted sub-option nests under its owning sub-selection; a plain unit
            // option nests under the unit. Count/display keep reading the unit selection.
            const editTargetId = ownerSelectionId || selection.id;
            // The roster selection this row stands for, so its own re-emitted sub-options
            // can nest beneath it (null while unselected).
            const rowSelectionId = resolveRowSelectionId(selection, ownerSelectionId, option, res);
            const count = getSubSelectionCount(selection, res.id);
            const basePoints = getOptionDisplayCost(system, option, roster.costLimitType, displayCtx);
            const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
            const unitRawEntry = findEntryInSystem(system, unitEntryId, activeCatalogue.id);
            const unitResolved = resolveEntry(system, unitRawEntry, activeCatalogue.id);

            const filteredOptionConstraints = res.constraints?.filter(con => {
              if (!con.scope || !isEntryScope(con.scope)) {
                return true;
              }
              return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
                     (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
            }) || [];
            const minConstraint = filteredOptionConstraints.find(c => c.type === ConstraintKind.MIN);
            const maxConstraint = filteredOptionConstraints.find(c => c.type === ConstraintKind.MAX);
            // Effektive (modifier-angepasste) Grenzen statt roher Katalogwerte, damit ein
            // bedingt verändertes min/max Pflicht-/Binär-/Klammerungs-Entscheidungen steuert.
            const optionModifiers = getEffectiveModifiers(res);
            const minLimit = getEffectiveConstraintLimit(minConstraint, optionModifiers, displayCtx, 0);
            const maxLimit = getEffectiveConstraintLimit(maxConstraint, optionModifiers, displayCtx, Infinity);
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


            const isSubUnitWithOwnOptions = isIndependentSubUnit(res);

            // Nicht wählbar, weil noch nicht ausgewählt und aktuell gesperrt.
            const isUnavailable = count === 0 && isSelectDisabled;
            const isClickable = !isMandatory && !isUnavailable;
            const handleRowClick = (e) => {
              if (e.target.closest('button') || e.target.closest('input')) {
                return;
              }
              if (isClickable) {
                if (isSubUnitWithOwnOptions) {
                  if (count < maxLimit && !isSelectDisabled) {
                    subSelectionOperations.addInstance(editTargetId, option);
                  }
                } else if (isBinary) {
                  const isDecrementing = count > 0;
                  if (isDecrementing) {
                    if (count > minLimit) {
                      subSelectionOperations.decreaseCount(editTargetId, option);
                    }
                  } else {
                    if (!isSelectDisabled) {
                      subSelectionOperations.increaseCount(editTargetId, option);
                    }
                  }
                } else {
                  // For standard options, clicking row increments. 
                  // If we wanted right-click to decrement we could, but click is increment.
                  if (count < maxLimit && !isSelectDisabled) {
                    subSelectionOperations.increaseCount(editTargetId, option);
                  }
                }
              }
            };

            return (
              <React.Fragment key={res.id}>
              <div
                className={`sub-selection-row ${isClickable ? 'clickable' : 'disabled'}${isUnavailable ? ' sub-selection-row--unavailable' : ''}`}
                onClick={handleRowClick}
              >
                <div className="sub-selection-label">
                  <span className={`sub-selection-option-name${isUnavailable ? ' sub-selection-option-name--unavailable' : ''}`}>
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
                    {isTakenElsewhere && <span className="text-danger text-micro sub-selection-taken-hint">(Bereits vergeben)</span>}
                  </span>
                </div>
                <div className="sub-selection-controls">
                  {points > 0 && <span className="text-gold text-label sub-selection-cost">+{points} {costTypeLabel}</span>}
                  {isSubUnitWithOwnOptions ? (
                    <button 
                      type="button"
                      className="btn-primary text-label sub-selection-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        subSelectionOperations.addInstance(editTargetId, option);
                      }}
                      disabled={isSelectDisabled || count >= maxLimit}
                    >
                      <Plus size={12} className="sub-selection-add-btn-icon" />
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
                          if (e.target.checked) {
                            subSelectionOperations.increaseCount(editTargetId, option);
                          } else {
                            subSelectionOperations.decreaseCount(editTargetId, option);
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="quantity-control">
                      <button 
                        className="qty-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          subSelectionOperations.decreaseCount(editTargetId, option);
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
                          subSelectionOperations.increaseCount(editTargetId, option);
                        }}
                        disabled={isSelectDisabled || count >= maxLimit}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {renderOwnedChildren(rowSelectionId)}
              </React.Fragment>
            );
          } else {
            return (
              <OptionGroupComponent
                key={group.id || group.name}
                group={group}
                selection={selection}
                system={system}
                roster={roster}
                getSubSelectionCount={getSubSelectionCount}
                subSelectionOperations={subSelectionOperations}
                getOptionDescription={getOptionDescription}
                activeCatalogue={activeCatalogue}
                setActiveInfo={setActiveInfo}
                onHoverEnter={handleMouseEnter}
                onHoverMove={handleMouseMove}
                onHoverLeave={handleMouseLeave}
                onShowRule={onShowRule}
                renderRowChildren={renderOwnedChildren}
              />
            );
          }
  };

  return (
    <div className="selection-node-body">
      {/* Listenregeln sind Einstellungen, keine Ausrüstung: die Überschrift entfällt. */}
      {!isListRule && <h4>Optionen &amp; Ausrüstung konfigurieren</h4>}
      <div className="sub-selection-group sub-selection-group--flush">
        {topSections.map(renderSection)}
      </div>
    </div>
  );
}

