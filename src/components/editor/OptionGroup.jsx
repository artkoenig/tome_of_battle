import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus } from 'lucide-react';
import { resolveEntry, findEntryInSystem, getModifiedConstraintValue, getEffectiveConstraintLimit, canGroupMaxBeRaisedAboveSingleChoice, computeRosterCounts, getOptionDisplayCost, getSelectionTotalCost, getEffectiveModifiers, getEffectiveName, formatConstraintLimit, isCostField, resolveCostLimitTypeId, resolveCostLimitLabel, TOP_LEVEL_PARENT_COUNT, isEntryScope, isUniqueOptionTakenElsewhere, isOptionRosterUnique, findForceContainingSelection } from '../../solver/validator';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';
import { ConstraintKind } from '../../parser/schema/battlescribeSchema.generated.js';

export default function OptionGroupComponent({ 
  group, 
  selection, 
  system, 
  roster, 
  getSubSelectionCount, 
  subSelectionOperations,
  getOptionDescription,
  activeCatalogue,
  setActiveInfo,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onShowRule
}) {
  // Start expanded when the group already holds a selection, so choices made
  // aren't hidden behind a collapsed header. This also surfaces nested quantity
  // controls that only appear once a wrapper option is chosen — e.g. picking
  // "Power Stone" reveals its "Power Stones" 1–4 stepper in a sub-section, which
  // would otherwise stay collapsed and read as "can't add more".
  const [isExpanded, setIsExpanded] = useState(() =>
    (group.items || []).some(({ option }) => {
      const res = resolveEntry(system, option, activeCatalogue.id);
      return res ? getSubSelectionCount(selection, res.id) > 0 : false;
    })
  );

  const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
  const unitRawEntry = findEntryInSystem(system, unitEntryId, activeCatalogue.id);
  const unitResolved = resolveEntry(system, unitRawEntry, activeCatalogue.id);
  
  const costLimitTypeId = resolveCostLimitTypeId(roster, system);
  const costTypeLabel = resolveCostLimitLabel(roster, system);

  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const activeForceId = findForceContainingSelection(roster, selection.id)?.id ?? null;
  const forceCategoryCounts = activeForceId ? (categoryCounts[activeForceId] || {}) : {};

  const displayCtx = {
    roster,
    system,
    selectionCounts,
    forceCategoryCounts,
    selection: null,
    parentSelection: selection,
    parentCatalogueId: activeCatalogue.id
  };

  // Resolve the group's modifiers through the shared seam so modifierGroup-gated
  // constraint modifiers (min/max/points-limit) are honoured here exactly as the
  // rosterValidator honours them — otherwise the group-limit display, repeatable
  // detection and error styling would contradict the validation.
  const groupModifiers = getEffectiveModifiers(group);

  const selectedItemsSummary = group.items
    .map(({ option }) => {
      const res = resolveEntry(system, option, activeCatalogue.id);
      if (!res) return null;
      const count = getSubSelectionCount(selection, res.id);
      if (count > 0) {
        const optionName = getEffectiveName(res, displayCtx);
        return count > 1 ? `${count}x ${optionName}` : optionName;
      }
      return null;
    })
    .filter(Boolean)
    .join(', ');

  
  const filteredGroupConstraints = group.constraints?.filter(con => {
    if (!con.scope || !isEntryScope(con.scope)) {
      return true;
    }
    return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
           (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
  }) || [];

  // An item is "repeatable" inside an otherwise max=1 group when the group carries
  // an increment modifier (with a <repeat>) that raises the group's own max
  // constraint for every selection of this very item. That is Battlescribe's
  // encoding for the common magic items you may take more than one of — e.g.
  // Dispel Scroll or Power Stone, which do not count against the "one item per
  // category" limit. Such items must render as quantity steppers rather than as
  // mutually-exclusive radios, and must be excluded from the radio group.
  const isRepeatableWithinGroup = (option, res) => {
    if (!res) return false;
    return groupModifiers.some(mod => {
      if (mod.type !== 'increment' || !mod.repeat) return false;
      const raisesGroupMax = (group.constraints || []).some(c => c.type === ConstraintKind.MAX && c.id === mod.field);
      if (!raisesGroupMax) return false;
      const repeatTarget = mod.repeat.childId || mod.repeat.field;
      return repeatTarget === option.id || repeatTarget === res.id || repeatTarget === res.targetId;
    });
  };

  const maxLimitRaw = filteredGroupConstraints.find(c => c.type === ConstraintKind.MAX);
  const maxLimit = maxLimitRaw ? getModifiedConstraintValue(maxLimitRaw, groupModifiers, displayCtx) : Infinity;
  
  const currentCount = group.items.reduce((sum, item) => {
    const res = resolveEntry(system, item.option, activeCatalogue.id);
    return sum + (res ? getSubSelectionCount(selection, res.id) : 0);
  }, 0);

  // Radio-vs-Checkbox-Leitregel (mit Nutzer abgestimmt): Eine Gruppe rendert als
  // Mehrfachauswahl (Checkboxen), sobald ihr effektives Max > 1 ist ODER ein Modifier
  // ihr Max über 1 heben KANN — Letzteres löst den Rüstung+Schild-Teufelskreis, weil das
  // aktuelle effektive Max ohne Schild 1 wäre. Nur eine echt fix auf 1 gedeckelte Gruppe
  // ohne solchen Modifier bleibt gegenseitig ausschließendes Radio. Das `increment`+
  // `<repeat>`-Stepper-Muster bleibt davon unberührt (siehe isRepeatableWithinGroup).
  const isGroupMaxRaisable = canGroupMaxBeRaisedAboveSingleChoice(group);
  const isGroupSingleChoice = maxLimit !== Infinity && maxLimit <= 1 && !isGroupMaxRaisable;

  // Effektive Gruppen-Zähl-Obergrenze (Punkte-Caps werden separat behandelt). Sie klammert
  // das Hinzufügen weiterer, noch nicht gewählter Optionen und deaktiviert die Gruppe ganz,
  // sobald sie bedingt auf 0 sinkt.
  const groupCountMaxConstraint = filteredGroupConstraints.find(
    c => c.type === ConstraintKind.MAX && !isCostField(c.field, system, roster)
  );
  const effectiveGroupCountMax = groupCountMaxConstraint
    ? getEffectiveConstraintLimit(groupCountMaxConstraint, groupModifiers, displayCtx, Infinity)
    : Infinity;

  const currentPoints = group.items.reduce((sum, item) => {
    const res = resolveEntry(system, item.option, activeCatalogue.id);
    const count = res ? getSubSelectionCount(selection, res.id) : 0;
    const points = getOptionDisplayCost(system, item.option, costLimitTypeId, displayCtx);
    return sum + (points * count);
  }, 0);

  let hasGroupError = false;
  
  filteredGroupConstraints.forEach(con => {
    const finalValue = getModifiedConstraintValue(con, groupModifiers, displayCtx);
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
          const pts = getSelectionTotalCost(sub, roster.costLimitType, TOP_LEVEL_PARENT_COUNT, {
            system, roster, currentCatalogueId: activeCatalogue.id, parentSelection: selection, counts: { selectionCounts, categoryCounts }
          });
          sumCount += count;
          sumPoints += pts;
        }
      });
      activeCount = sumCount;
      activePoints = sumPoints;
    }

    const fieldMeasuresCost = isCostField(con.field, system, roster);
    if (fieldMeasuresCost) {
      if (con.type === ConstraintKind.MAX) {
        if (activePoints > finalValue) {
          hasGroupError = true;
        }
      }
    } else {
      if (con.type === ConstraintKind.MAX) {
        if (activeCount > finalValue) {
          hasGroupError = true;
        }
      }
    }
  });

  let limitParts = [];
  const ptsConstraint = filteredGroupConstraints.find(c =>
    c.type === ConstraintKind.MAX && isCostField(c.field, system, roster)
  );
  
  if (ptsConstraint) {
    const ptsConstraintVal = getModifiedConstraintValue(ptsConstraint, groupModifiers, displayCtx);
    limitParts.push(`${currentPoints} / ${ptsConstraintVal} ${costTypeLabel}`);
  } else if (currentPoints > 0) {
    limitParts.push(`${currentPoints} ${costTypeLabel}`);
  }

  if (maxLimit !== Infinity) {
    // Mehrfachauswahl-Gruppen zeigen einen Live-Zähler „N / M" (wie NewRecruit „2/2"),
    // damit erkennbar bleibt, wie viele der erlaubten Optionen belegt sind. Eine echte
    // Einzelwahl (Radio) behält die schlichte „Max: N"-Anzeige.
    const isCountableMultiSelect = !isGroupSingleChoice && !isCostField(maxLimitRaw?.field, system, roster);
    limitParts.push(
      isCountableMultiSelect
        ? `${currentCount} / ${formatConstraintLimit(maxLimit, maxLimitRaw)}`
        : `Max: ${formatConstraintLimit(maxLimit, maxLimitRaw)}`
    );
  }

  const limitText = limitParts.length > 0 ? `(${limitParts.join(' | ')})` : '';

  return (
    <div className="option-group">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`option-group-header${hasGroupError ? ' option-group-header--error' : ''}`}
      >
        <div className="option-group-titles">
          <span className={hasGroupError ? "text-ui-title text-danger" : "text-ui-title text-gold"}>
            {group.name} 
            <span className="text-micro option-group-limit">{limitText}</span>
          </span>
          {selectedItemsSummary && (
            <span className="text-micro option-group-summary">
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
        <div className="option-group-items">
          {group.items
            .slice()
            .sort((a, b) => {
               const aPoints = getOptionDisplayCost(system, a.option, costLimitTypeId, displayCtx) || 0;
               const bPoints = getOptionDisplayCost(system, b.option, costLimitTypeId, displayCtx) || 0;
               return bPoints - aPoints; // Descending
            })
            .map(({ option, parentDefId }) => {
            const res = resolveEntry(system, option, activeCatalogue.id);
            if (!res) return null;
            const count = getSubSelectionCount(selection, res.id);
            const basePoints = getOptionDisplayCost(system, option, costLimitTypeId, displayCtx);
            const filteredOptionConstraints = res.constraints?.filter(con => {
              if (!con.scope || !isEntryScope(con.scope)) {
                return true;
              }
              return (unitResolved?.id === con.scope || unitResolved?.targetId === con.scope) ||
                     (unitResolved?.categoryLinks?.some(cl => cl.targetId === con.scope));
            }) || [];
            const minConstraint = filteredOptionConstraints.find(c => c.type === ConstraintKind.MIN);
            const maxConstraint = filteredOptionConstraints.find(c => c.type === ConstraintKind.MAX);
            // Option-Grenzen aus effektiven (modifier-angepassten) Werten — konsistent mit
            // Label/Validierung, statt aus rohen Katalogwerten.
            const optionModifiers = getEffectiveModifiers(res);
            const minLimitOption = getEffectiveConstraintLimit(minConstraint, optionModifiers, displayCtx, 0);
            const maxLimitOption = getEffectiveConstraintLimit(maxConstraint, optionModifiers, displayCtx, Infinity);
            const isMandatory = minLimitOption > 0 && minLimitOption === maxLimitOption;

            const isCollective = res.collective || option.collective || false;
            const optionName = getEffectiveName(res, displayCtx);
            const isRepeatableByGroupModifier = isRepeatableWithinGroup(option, res);
            // A repeatable item never behaves as an exclusive radio, even though its
            // group is nominally capped at max=1 (the cap is lifted per copy taken). A
            // genuinely single-choice group (effective max 1, no max-raising modifier)
            // renders radios; a max-raisable group renders checkboxes (armour+shield).
            const isRadio = !isRepeatableByGroupModifier && isGroupSingleChoice;
            // A stepper (quantity control) requires a positive quantity signal. Without an
            // explicit max, only a real minimum (min>0, e.g. Ungors) or a collective
            // (per-model) upgrade qualifies; a plain optional upgrade with neither min nor
            // max is binary and renders as a checkbox (e.g. Barding, a single mount/rune).
            const hasQuantitySignal = minLimitOption > 0 || isCollective;
            const isExplicitlyMulti = (maxConstraint && maxLimitOption > 1) || isRepeatableByGroupModifier || (!maxConstraint && !isRadio && hasQuantitySignal);
            const isBinary = !isExplicitlyMulti && ((maxConstraint && maxLimitOption === 1) || isRadio || !maxConstraint);
            const descText = getOptionDescription(res);

            let parentCount = 1;
            const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
            if (parentDefId === unitResolved?.id || parentDefId === unitResolved?.targetId || parentDefId === unitEntryId) {
              parentCount = selection.number || 1;
            } else {
              const pSel = selection.selections?.find(s => (s.entryLinkId || s.selectionEntryId) === parentDefId);
              if (pSel) parentCount = pSel.number || 1;
            }

            const points = isCollective ? basePoints * parentCount : basePoints;

            const ptsConstraintGroup = filteredGroupConstraints.find(c =>
              c.type === ConstraintKind.MAX && isCostField(c.field, system, roster)
            );
            const maxPointsLimit = ptsConstraintGroup 
              ? getModifiedConstraintValue(ptsConstraintGroup, groupModifiers, displayCtx)
              : Infinity;

            let wouldExceedPointsLimit = false;
            if (maxPointsLimit !== Infinity) {
              let activePoints = currentPoints;
              if (ptsConstraintGroup.groupItemIds) {
                let sumPoints = 0;
                selection.selections?.forEach(sub => {
                  const subId = sub.entryLinkId || sub.selectionEntryId;
                  if (ptsConstraintGroup.groupItemIds.has(subId)) {
                    const pts = getSelectionTotalCost(sub, roster.costLimitType, TOP_LEVEL_PARENT_COUNT, {
                      system, roster, currentCatalogueId: activeCatalogue.id, parentSelection: selection, counts: { selectionCounts, categoryCounts }
                    });
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
                  const otherPoints = getOptionDisplayCost(system, selectedOther.option, roster.costLimitType, displayCtx);
                  pointsDiff = points - otherPoints;
                }
              }
              if (activePoints + pointsDiff > maxPointsLimit) {
                wouldExceedPointsLimit = true;
              }
            }
            const isRosterUnique = isOptionRosterUnique(res, system);
            const isTakenElsewhere = isRosterUnique && isUniqueOptionTakenElsewhere(res, system, activeCatalogue.id, selection, roster);
            // Effektive Gruppen-Zähl-Obergrenze durchsetzen (senkender Fall / Deaktivierung):
            // Ist die Gruppe an ihrem effektiven Max, ist das Hinzufügen einer weiteren, noch
            // nicht gewählten Option gesperrt; ein Max von 0 deaktiviert die Gruppe ganz.
            // Radios tauschen die aktuelle Wahl (Netto 0) und werden nicht gesperrt (außer bei
            // Max 0). Bei einer max-HEBBAREN Gruppe greift die Klammerung bewusst NICHT: das
            // aktuelle effektive Max wäre 1, und gerade das Hinzufügen der koppelnden Option
            // (z. B. Schild) hebt es — eine Klammerung am aktuellen Max erzeugte erneut den
            // Teufelskreis. Über-Auswahl fängt dort der Validator ab.
            const isGroupCountCapReached = effectiveGroupCountMax !== Infinity && currentCount >= effectiveGroupCountMax;
            const wouldExceedGroupCountMax = !isGroupMaxRaisable &&
              (effectiveGroupCountMax === 0 || (!isRadio && count === 0 && isGroupCountCapReached));
            const isSelectDisabled = wouldExceedPointsLimit || isTakenElsewhere || wouldExceedGroupCountMax;

            // Nicht wählbar, weil noch nicht ausgewählt und aktuell gesperrt.
            const isUnavailable = count === 0 && isSelectDisabled;
            const isClickable = !isMandatory && !isUnavailable;
            const handleRowClick = (e) => {
              if (e.target.closest('button') || e.target.closest('input')) {
                return;
              }
              if (isClickable) {
                if (isBinary) {
                  if (isRadio) {
                    if (count > 0) {
                      subSelectionOperations.decreaseCount(selection.id, option);
                    } else {
                      group.items.forEach(otherItem => {
                        const otherRes = resolveEntry(system, otherItem.option, activeCatalogue.id);
                        if (otherRes && otherRes.id !== res.id && !isRepeatableWithinGroup(otherItem.option, otherRes)) {
                          const otherCount = getSubSelectionCount(selection, otherRes.id);
                          if (otherCount > 0) {
                            subSelectionOperations.decreaseCount(selection.id, otherItem.option);
                          }
                        }
                      });
                      subSelectionOperations.increaseCount(selection.id, option);
                    }
                  } else {
                    if (count > 0) {
                      subSelectionOperations.decreaseCount(selection.id, option);
                    } else {
                      subSelectionOperations.increaseCount(selection.id, option);
                    }
                  }
                } else {
                  subSelectionOperations.increaseCount(selection.id, option);
                }
              }
            };

            return (
              <div 
                key={res.id} 
                className={`sub-selection-row ${isClickable ? 'clickable' : 'disabled'}${isUnavailable ? ' sub-selection-row--unavailable' : ''}`}
                onClick={handleRowClick}
              >
                <div className="sub-selection-label sub-selection-label--indented">
                  <span className={`sub-selection-option-name${isUnavailable ? ' sub-selection-option-name--unavailable' : ''}`}>
                    {optionName}
                    <RuleChipIcon
                      name={res.name}
                      hasInfo={!!descText}
                      onShowRule={onShowRule}
                      onInfoClick={() => {
                        if (window.innerWidth <= 900) {
                          setActiveInfo({ title: res.name, text: renderUpgradeDetails(res, system) });
                        }
                      }}
                      onInfoEnter={(e) => onHoverEnter(res.name, renderUpgradeDetails(res, system), e)}
                      onInfoMove={onHoverMove}
                      onInfoLeave={onHoverLeave}
                    />
                    {isTakenElsewhere && <span className="text-danger text-micro sub-selection-taken-hint">(Bereits vergeben)</span>}
                  </span>
                </div>
                <div className="sub-selection-controls">
                  {points > 0 && <span className="text-gold text-label sub-selection-cost">+{points} {costTypeLabel}</span>}
                  {isBinary ? (
                    isRadio ? (
                      <input 
                        type="radio" 
                        name={`${selection.id}-${group.name}`}
                        checked={count > 0}
                        disabled={count === 0 && isSelectDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (count > 0) {
                            subSelectionOperations.decreaseCount(selection.id, option);
                          } else if (!isSelectDisabled) {
                            group.items.forEach(otherItem => {
                              const otherRes = resolveEntry(system, otherItem.option, activeCatalogue.id);
                              if (otherRes && otherRes.id !== res.id && !isRepeatableWithinGroup(otherItem.option, otherRes)) {
                                const otherCount = getSubSelectionCount(selection, otherRes.id);
                                if (otherCount > 0) {
                                  subSelectionOperations.decreaseCount(selection.id, otherItem.option);
                                }
                              }
                            });
                            subSelectionOperations.increaseCount(selection.id, option);
                          }
                        }}
                        onChange={() => {}}
                      />
                    ) : (
                      <input 
                        type="checkbox" 
                        checked={count > 0 || isMandatory}
                        disabled={isMandatory || (count === 0 && isSelectDisabled)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (!isMandatory) {
                            if (e.target.checked) {
                              subSelectionOperations.increaseCount(selection.id, option);
                            } else {
                              subSelectionOperations.decreaseCount(selection.id, option);
                            }
                          }
                        }}
                      />
                    )
                  ) : (
                    <div className="quantity-control">
                      <button 
                        className="qty-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          subSelectionOperations.decreaseCount(selection.id, option);
                        }}
                        disabled={count === 0}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="quantity-value font-body">{count}</span>
                      <button 
                        className="qty-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          subSelectionOperations.increaseCount(selection.id, option);
                        }}
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
