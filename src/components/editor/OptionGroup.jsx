import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Minus, Info } from 'lucide-react';
import { resolveEntry, findEntryInSystem, getModifiedConstraintValue, computeRosterCounts, getOptionDisplayCost, getSelectionTotalCost } from '../../solver/validator';
import { isUniqueOptionTakenElsewhere, isOptionRosterUnique } from '../../solver/optionsCollector';
import { useDebugMode } from '../../hooks/DebugContext';
import { UPGRADE_DETAILS_KEYWORDS } from '../../solver/constants';

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

export default function OptionGroupComponent({ 
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

  const renderUpgradeDetails = (res) => {
    if (!res) return null;
    const elements = [];

    const isNameSimilar = (nameA, nameB) => {
      if (!nameA || !nameB) return false;
      const cleanA = nameA.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanB = nameB.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanA === cleanB || 
             cleanA.includes(cleanB) || 
             cleanB.includes(cleanA) ||
             (cleanA.includes('waaagh') && cleanB.includes('waaagh')) ||
             cleanA.slice(-10) === cleanB.slice(-10);
    };

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

    // 1. Beschreibung (Rules / Lore)
    if (rules.length > 0) {
      rules.forEach((r, idx) => {
        if (r.description) {
          const label = isNameSimilar(r.name, res.name)
            ? 'Beschreibung'
            : `Beschreibung (${r.name})`;

          elements.push(
            <div key={`rule-${idx}`} style={{ marginTop: '4px' }}>
              <span className="text-gold" style={{ fontWeight: 600 }}>{label}: </span>
              {r.description}
              {r.publicationRef && (
                <span className="publication-ref">
                  {r.publicationRef}
                </span>
              )}
            </div>
          );
        }
      });
    }

    // 2. Sonderregeln & Profilwerte (from Profiles)
    if (res.profiles && res.profiles.length > 0) {
      const profileElements = [];
      res.profiles.forEach((p, idx) => {
        const typeLower = p.profileTypeName?.toLowerCase() || '';
        if (UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) {
          // Find "Special Rules" or "Sonderregeln" characteristic
          const specialRulesChar = p.characteristics?.find(c => {
            const nameLower = (c.name || '').toLowerCase().trim();
            return nameLower === 'special rules' || nameLower === 'special-rules' || nameLower === 'sonderregeln';
          });

          const otherChars = p.characteristics?.filter(c => {
            const nameLower = (c.name || '').toLowerCase().trim();
            return nameLower !== 'special rules' && nameLower !== 'special-rules' && nameLower !== 'sonderregeln';
          }) || [];

          // If there is special rules text, show it under "Sonderregeln:" label
          if (specialRulesChar && specialRulesChar.value && specialRulesChar.value.trim()) {
            profileElements.push(
              <div key={`special-rules-${idx}`} style={{ marginTop: '4px' }}>
                <span className="text-gold" style={{ fontWeight: 600 }}>Sonderregeln: </span>
                {specialRulesChar.value.trim()}
                {p.publicationRef && !res.rules?.some(r => r.publicationRef === p.publicationRef) && (
                  <span className="publication-ref">
                    {p.publicationRef}
                  </span>
                )}
              </div>
            );
          }

          // If there are other non-empty characteristics, show them under "Profil:" label
          const nonBigEmptyChars = otherChars.filter(c => c.value && c.value.trim() && c.value.trim() !== '-');
          if (nonBigEmptyChars.length > 0) {
            const stats = nonBigEmptyChars.map(c => `${c.name}: ${c.value}`).join(', ');
            const label = isNameSimilar(p.name, res.name)
              ? 'Profil'
              : `Profil (${p.name})`;

            profileElements.push(
              <div key={`profile-${idx}`} style={{ marginTop: '4px' }}>
                <span className="text-gold" style={{ fontWeight: 600 }}>{label}: </span>
                {stats}
                {p.publicationRef && !res.rules?.some(r => r.publicationRef === p.publicationRef) && (
                  <span className="publication-ref">
                    {p.publicationRef}
                  </span>
                )}
              </div>
            );
          }
        }
      });
      elements.push(...profileElements);
    }

    // 3. Quelle
    if (res.publicationRef) {
      const hasRuleOrProfileRefs = (res.rules && res.rules.some(r => r.publicationRef)) || (res.profiles && res.profiles.some(p => p.publicationRef));
      if (!hasRuleOrProfileRefs) {
        elements.push(
          <div key="source" style={{ marginTop: '6px' }}>
            <span className="text-gold" style={{ fontWeight: 600 }}>Quelle: </span>
            <span className="publication-ref">
              {res.publicationRef}
            </span>
          </div>
        );
      }
    }

    return (
      <div style={{ textAlign: 'left', lineHeight: '1.4' }}>
        {elements.length > 0 ? elements : <span className="text-dim">Keine Beschreibung vorhanden.</span>}
      </div>
    );
  };

  const unitEntryId = selection.entryLinkId || selection.selectionEntryId;
  const unitRawEntry = findEntryInSystem(system, unitEntryId, activeCatalogue.id);
  const unitResolved = resolveEntry(system, unitRawEntry, activeCatalogue.id);
  
  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const activeForceId = findForceOfSelection(selection.id, roster.forces);
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

  
  const filteredGroupConstraints = group.constraints?.filter(con => {
    if (!con.scope || con.scope === 'parent' || con.scope === 'force' || con.scope === 'roster') {
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
    return (group.modifiers || []).some(mod => {
      if (mod.type !== 'increment' || !mod.repeat) return false;
      const raisesGroupMax = (group.constraints || []).some(c => c.type === 'max' && c.id === mod.field);
      if (!raisesGroupMax) return false;
      const repeatTarget = mod.repeat.childId || mod.repeat.field;
      return repeatTarget === option.id || repeatTarget === res.id || repeatTarget === res.targetId;
    });
  };

  const minLimitRaw = filteredGroupConstraints.find(c => c.type === 'min');
  const minLimit = minLimitRaw ? getModifiedConstraintValue(minLimitRaw, group.modifiers, displayCtx) : 0;
  const maxLimitRaw = filteredGroupConstraints.find(c => c.type === 'max');
  const maxLimit = maxLimitRaw ? getModifiedConstraintValue(maxLimitRaw, group.modifiers, displayCtx) : Infinity;
  
  const currentCount = group.items.reduce((sum, item) => {
    const res = resolveEntry(system, item.option, activeCatalogue.id);
    return sum + (res ? getSubSelectionCount(selection, res.id) : 0);
  }, 0);

  const currentPoints = group.items.reduce((sum, item) => {
    const res = resolveEntry(system, item.option, activeCatalogue.id);
    const count = res ? getSubSelectionCount(selection, res.id) : 0;
    const points = getOptionDisplayCost(system, item.option, roster.costLimitType, displayCtx);
    return sum + (points * count);
  }, 0);

  let hasGroupError = false;
  
  filteredGroupConstraints.forEach(con => {
    const finalValue = getModifiedConstraintValue(con, group.modifiers, displayCtx);
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
          const pts = getSelectionTotalCost(sub, roster.costLimitType, 1, system, roster, activeCatalogue.id, selection, { selectionCounts, categoryCounts });
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
    const ptsConstraintVal = getModifiedConstraintValue(ptsConstraint, group.modifiers, displayCtx);
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
          <span className={hasGroupError ? "text-ui-title text-danger" : "text-ui-title text-gold"}>
            {group.name} 
            {showDebugIds && group.id && <span className="debug-id-badge clickable" style={{ marginLeft: '6px' }}>def:{group.id}</span>}
            <span className="text-micro" style={{ marginLeft: '6px', fontWeight: 400, color: 'var(--text-dim)' }}>{limitText}</span>
          </span>
          {selectedItemsSummary && (
            <span className="text-micro" style={{ color: 'var(--text-parchment)', opacity: 0.75, fontWeight: 400 }}>
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
               const aPoints = getOptionDisplayCost(system, a.option, costType, displayCtx) || 0;
               const bPoints = getOptionDisplayCost(system, b.option, costType, displayCtx) || 0;
               return bPoints - aPoints; // Descending
            })
            .map(({ option, groupConstraints, parentDefId }) => {
            const res = resolveEntry(system, option, activeCatalogue.id);
            if (!res) return null;
            const count = getSubSelectionCount(selection, res.id);
            const basePoints = getOptionDisplayCost(system, option, roster.costLimitType, displayCtx);
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
            
            const isRepeatableByGroupModifier = isRepeatableWithinGroup(option, res);
            // A repeatable item never behaves as an exclusive radio, even though its
            // group is nominally capped at max=1 (the cap is lifted per copy taken).
            const isRadio = !isRepeatableByGroupModifier && groupConstraints?.some(c => c.type === 'max' && c.value === 1);
            const isExplicitlyMulti = (maxConstraint && maxConstraint.value > 1) || isRepeatableByGroupModifier || (!maxConstraint && !isMandatory && !isRadio);
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
              ? getModifiedConstraintValue(ptsConstraintGroup, group.modifiers, displayCtx)
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
            const isRosterUnique = isOptionRosterUnique(res, system);
            const isTakenElsewhere = isRosterUnique && isUniqueOptionTakenElsewhere(res, system, activeCatalogue.id, selection, roster);
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
                        if (otherRes && otherRes.id !== res.id && !isRepeatableWithinGroup(otherItem.option, otherRes)) {
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
                    onMouseEnter={(e) => descText && onHoverEnter(res.name, renderUpgradeDetails(res), e)}
                    onMouseMove={descText ? onHoverMove : null}
                    onMouseLeave={descText ? onHoverLeave : null}
                  >
                    {res.name}
                    {showDebugIds && <span className="debug-id-badge clickable">{res.id}</span>}
                    {isTakenElsewhere && <span className="text-danger text-micro" style={{ marginLeft: '6px', fontWeight: 600 }}>(Bereits vergeben)</span>}
                  </span>
                  {descText && (
                    <button
                      type="button"
                      className="info-help-btn"
                      onClick={() => {
                        if (window.innerWidth <= 900) {
                          setActiveInfo({ title: res.name, text: renderUpgradeDetails(res) });
                        }
                      }}
                      onMouseEnter={(e) => onHoverEnter(res.name, renderUpgradeDetails(res), e)}
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
                  {points > 0 && <span className="text-gold text-label" style={{ marginRight: '4px' }}>+{points} Pkt.</span>}
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
                            updateSubSelection(selection.id, option, 'decrement', parentCount);
                          } else if (!isSelectDisabled) {
                            group.items.forEach(otherItem => {
                              const otherRes = resolveEntry(system, otherItem.option, activeCatalogue.id);
                              if (otherRes && otherRes.id !== res.id && !isRepeatableWithinGroup(otherItem.option, otherRes)) {
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
                        onClick={(e) => e.stopPropagation()}
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
                        className="qty-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateSubSelection(selection.id, option, 'decrement', parentCount);
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
                          updateSubSelection(selection.id, option, 'increment', parentCount);
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
