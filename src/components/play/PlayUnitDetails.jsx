import React, { useState } from 'react';
import { Plus, Minus, Sparkles, BookOpen } from 'lucide-react';
import { findEntryInSystem, resolveEntry, collectUnitProfilesAndRules, getSelectionTotalCost } from '../../solver/validator';
import { MODEL_COUNT_PROFILE_TYPES } from '../../solver/constants';
import {
  getArmourSave as getArmourSaveLogic,
  getWardSave as getWardSaveLogic,
  extractModelProfiles,
  extractUpgradeProfiles,
  extractWeaponProfiles,
  hasBlessing
} from '../../solver/rulesEvaluator';

const getModificationState = (characteristic) => {
  if (!characteristic || characteristic.originalValue === undefined) return null;
  
  const valStr = characteristic.value;
  const origStr = characteristic.originalValue;
  if (valStr === origStr) return null;

  const getNumericValue = (str) => {
    const match = str.match(/-?\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const valNum = getNumericValue(valStr);
  const origNum = getNumericValue(origStr);

  if (valNum !== null && origNum !== null) {
    if (valNum > origNum) return 'positive';
    if (valNum < origNum) return 'negative';
  }
  return 'modified';
};

export default function PlayUnitDetails({
  selection,
  system,
  roster,
  showDebugIds,
  gameState,
  handleAdjustWound,
  handleMouseEnter,
  handleMouseLeave,
  setSaveSummaryData,
  setSaveSummaryOpen
}) {
  const [expandedUpgrades, setExpandedUpgrades] = useState({});
  const [expandedEquipBlocks, setExpandedEquipBlocks] = useState({});
  const [expandedRuleBlocks, setExpandedRuleBlocks] = useState({});

  // Helper to extract maximum wounds of an entry
  const getMaxWounds = (sel) => {
    const entryId = sel.entryLinkId || sel.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);

    if (!resolved) return 1;

    // Search profiles in selection instance or resolved catalog entry
    const searchProfiles = (profiles) => {
      if (!profiles) return null;
      for (const prof of profiles) {
        const char = prof.characteristics?.find(c => 
          ['w', 'wounds', 'l', 'lp', 'lebenspunkte'].includes(c.name.toLowerCase())
        );
        if (char && parseInt(char.value)) {
          return parseInt(char.value);
        }
      }
      return null;
    };

    let w = searchProfiles(sel.profiles) || 
            searchProfiles(resolved.profiles) ||
            searchProfiles(resolved.selectionEntries?.[0]?.profiles);

    if (!w && resolved.selectionEntries) {
      for (const child of resolved.selectionEntries) {
        w = searchProfiles(child.profiles);
        if (w) break;
      }
    }

    return w || 1;
  };

  // Helper to get unit profiles
  const getUnitProfilesAndRules = (sel) => {
    const { profiles, rules } = collectUnitProfilesAndRules(system, sel, roster.catalogueId, roster);
    const modelProfiles = extractModelProfiles(profiles);
    const weaponProfiles = extractWeaponProfiles(profiles);
    return { profiles: modelProfiles, rules, weaponProfiles };
  };

  // Helper to compile chosen upgrades / items
  const getSelectedUpgrades = (sel) => {
    if (!sel.selections) return [];
    return sel.selections.map(subSel => {
      const entryId = subSel.entryLinkId || subSel.selectionEntryId;
      const entry = findEntryInSystem(system, entryId);
      const resolved = resolveEntry(system, entry);
      return {
        id: subSel.id,
        name: subSel.name,
        number: subSel.number || 1,
        resolved: resolved
      };
    }).filter(item => item.resolved);
  };

  const getUpgradeDescription = (res) => {
    if (!res) return '';
    const descriptions = [];
    if (res.rules && res.rules.length > 0) {
      res.rules.forEach(r => {
        if (r.description) {
          const ref = r.publicationRef ? ` ${r.publicationRef}` : '';
          descriptions.push(r.description + ref);
        }
      });
    }
    if (res.profiles && res.profiles.length > 0) {
      const upgradeProfiles = extractUpgradeProfiles(res.profiles);
      upgradeProfiles.forEach(p => {
        p.characteristics?.forEach(c => {
          if (c.value) {
            const ref = p.publicationRef ? ` ${p.publicationRef}` : '';
            descriptions.push(`${c.name}: ${c.value}${ref}`);
          }
        });
      });
    }
    if (descriptions.length === 0 && res.publicationRef) {
      descriptions.push(res.publicationRef);
    }
    return descriptions.join(' | ');
  };

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

    // 1. Beschreibung (Rules / Lore)
    if (res.rules && res.rules.length > 0) {
      res.rules.forEach((r, idx) => {
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
      const upgradeProfiles = extractUpgradeProfiles(res.profiles);
      const profileElements = [];
      upgradeProfiles.forEach((p, idx) => {
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

  const collectSavesData = (sel) => {
    const entryId = sel.entryLinkId || sel.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);
    
    const items = [];
    if (resolved) {
      if (resolved.name) items.push({ name: resolved.name });
      resolved.rules?.forEach(r => items.push({ name: r.name, description: r.description, isRule: true }));
      resolved.profiles?.forEach(p => items.push(p));
    }
    
    if (sel.selections) {
      sel.selections.forEach(subSel => {
        if (subSel.name) items.push({ name: subSel.name });
        const subEntryId = subSel.entryLinkId || subSel.selectionEntryId;
        const subEntry = findEntryInSystem(system, subEntryId);
        const subResolved = resolveEntry(system, subEntry);
        if (subResolved) {
          if (subResolved.name) items.push({ name: subResolved.name });
          subResolved.rules?.forEach(r => items.push({ name: r.name, description: r.description, isRule: true }));
          subResolved.profiles?.forEach(p => items.push(p));
        }
      });
    }
    return items;
  };

  const getArmourSaveInfo = (sel) => {
    const data = collectSavesData(sel);
    const result = getArmourSaveLogic(data, sel.name, roster?.catalogueName, true);
    const display = result.save === 7 || !result.save ? 'Kein' : `${result.save}+`;
    return { display, breakdown: result.breakdown };
  };

  const getWardSaveInfo = (sel) => {
    const data = collectSavesData(sel);
    const result = getWardSaveLogic(data, sel.name, roster?.catalogueName, true);
    const blessing = hasBlessing(data, sel.name, roster?.catalogueName);

    let display = 'Kein';
    const breakdown = [...result.breakdown];

    if (result.save !== null) {
      if (blessing && result.save > 5) {
        display = `${result.save}+ / 5+ (Segen)`;
        if (!breakdown.includes('Segen der Herrin (5+ Rettungswurf)')) breakdown.push('Segen der Herrin (5+ Rettungswurf)');
      } else {
        display = `${result.save}+`;
      }
    } else if (blessing) {
      display = '5+ / 6+ (Segen)';
      if (!breakdown.includes('Segen der Herrin (5+ / 6+ Rettungswurf)')) breakdown.push('Segen der Herrin (5+ / 6+ Rettungswurf)');
    }

    return { display, breakdown };
  };

  const getUnitModelCount = (sel) => {
    const entryId = sel.entryLinkId || sel.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);
    
    if (!resolved) return sel.number || 1;

    if (resolved.type === 'model') {
      return sel.number || 1;
    }

    let totalModels = 0;
    let hasModelChildren = false;

    if (sel.selections && sel.selections.length > 0) {
      sel.selections.forEach(child => {
        const childEntryId = child.entryLinkId || child.selectionEntryId;
        const childEntry = findEntryInSystem(system, childEntryId);
        const childResolved = resolveEntry(system, childEntry);
        
        if (childResolved) {
          const isModel = childResolved.type === 'model' || 
                          child.type === 'model' ||
                          childResolved.profiles?.some(p => 
                            MODEL_COUNT_PROFILE_TYPES.includes(p.profileTypeName?.toLowerCase())
                          );
          
          if (isModel) {
            totalModels += (child.number || 1);
            hasModelChildren = true;
          }
        }
      });
    }

    if (!hasModelChildren) {
      return sel.number || 1;
    }

    return totalModels;
  };

  const getUnitCurrentWounds = (sel, totalMaxWounds) => {
    const id = sel.id;
    const val = gameState.wounds[id];
    if (val === undefined) {
      return totalMaxWounds;
    }
    if (Array.isArray(val)) {
      return val.reduce((sum, w) => sum + w, 0);
    }
    return val;
  };

  const maxWounds = getMaxWounds(selection);
  const modelCount = getUnitModelCount(selection);
  const totalMaxWounds = modelCount * maxWounds;
  const currentWounds = getUnitCurrentWounds(selection, totalMaxWounds);
  const { profiles, rules, weaponProfiles } = getUnitProfilesAndRules(selection);
  const weaponSelectionIds = new Set(
    weaponProfiles.map(wp => wp._sourceSelection?.id).filter(Boolean)
  );
  const selectedUpgrades = getSelectedUpgrades(selection).filter(upgrade => !weaponSelectionIds.has(upgrade.id));
  const asInfo = getArmourSaveInfo(selection);
  const wsInfo = getWardSaveInfo(selection);
  
  const isDead = currentWounds === 0;

  return (
    <div className={`play-unit-card ${isDead ? 'unit-destroyed' : ''}`}>
      {isDead && (
        <div className="destroyed-overlay">
          <span className="destroyed-text">Vernichtet</span>
        </div>
      )}
      <div className="play-unit-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
        <div className="play-unit-title text-ui-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {selection.name}
            {showDebugIds && (
              <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
            )}
          </div>
          <div className="text-ui-title text-gold" style={{ fontWeight: 600 }}>
            {getSelectionTotalCost(selection, roster.costLimitType || 'pts')} Pkt.
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="play-unit-badges">
            <div 
              className="badge badge-success font-body" 
              style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 700, cursor: asInfo.breakdown.length > 0 ? 'help' : 'default' }}
              onMouseEnter={(e) => handleMouseEnter(e, 'Rüstungswurf (AS)', asInfo.breakdown)}
              onMouseLeave={handleMouseLeave}
              onClick={() => {
                if (asInfo.breakdown.length > 0) {
                  setSaveSummaryData({ title: 'Rüstungswurf (AS)', breakdown: asInfo.breakdown });
                  setSaveSummaryOpen(true);
                }
              }}
            >
              AS: {asInfo.display}
            </div>
            <div 
              className="badge badge-warning font-body" 
              style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 700, cursor: wsInfo.breakdown.length > 0 ? 'help' : 'default' }}
              onMouseEnter={(e) => handleMouseEnter(e, 'Rettungswurf (WS)', wsInfo.breakdown)}
              onMouseLeave={handleMouseLeave}
              onClick={() => {
                if (wsInfo.breakdown.length > 0) {
                  setSaveSummaryData({ title: 'Rettungswurf (WS)', breakdown: wsInfo.breakdown });
                  setSaveSummaryOpen(true);
                }
              }}
            >
              WS: {wsInfo.display}
            </div>
          </div>
          
          <div className="play-unit-header-controls" style={{ opacity: isDead ? 0.5 : 1 }}>
            {isDead && <span className="text-danger font-serif" style={{ fontSize: '0.85rem', fontWeight: 700, marginRight: '8px' }}>VERNICHTET</span>}
            <button 
              className="qty-btn" 
              onClick={() => handleAdjustWound(selection.id, -1, totalMaxWounds)}
              disabled={isDead}
            >
              <Minus size={12} />
            </button>
            <span className="font-body" style={{ fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>
              {currentWounds} / {totalMaxWounds}
            </span>
            <button 
              className="qty-btn" 
              onClick={() => handleAdjustWound(selection.id, 1, totalMaxWounds)}
              disabled={currentWounds === totalMaxWounds}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="play-unit-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            {profiles.length > 0 ? (() => {
              const headers = [];
              profiles.forEach(prof => {
                prof.characteristics?.forEach(c => {
                  if (c.name && !headers.includes(c.name)) {
                    headers.push(c.name);
                  }
                });
              });
              const showModelNameCol = profiles.length > 1;

              return (
                <div className="profile-table-container">
                  <table className="profile-table">
                    <thead>
                      <tr>
                        {showModelNameCol && <th>Modell</th>}
                        {headers.map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((prof, pIdx) => (
                        <tr key={prof.id || pIdx}>
                          {showModelNameCol && (
                            <td className="font-body">
                              {prof.name}
                            </td>
                          )}
                          {headers.map(h => {
                            const c = prof.characteristics?.find(char => char.name === h);
                            if (!c) return <td key={h} className="font-body">-</td>;

                            const modState = getModificationState(c);
                            const cellStyle = {};
                            let className = "font-body";
                            if (modState === 'positive') {
                              className += " text-success";
                              cellStyle.backgroundColor = 'rgba(27, 115, 64, 0.12)';
                              cellStyle.fontWeight = 'bold';
                              cellStyle.cursor = 'help';
                            } else if (modState === 'negative') {
                              className += " text-danger";
                              cellStyle.backgroundColor = 'rgba(166, 28, 28, 0.12)';
                              cellStyle.fontWeight = 'bold';
                              cellStyle.cursor = 'help';
                            } else if (modState === 'modified') {
                              className += " text-gold";
                              cellStyle.backgroundColor = 'rgba(226, 183, 66, 0.12)';
                              cellStyle.fontWeight = 'bold';
                              cellStyle.cursor = 'help';
                            }

                            return (
                              <td 
                                key={h} 
                                className={className}
                                style={cellStyle}
                                onMouseEnter={(e) => {
                                  if (modState && c.modificationBreakdown?.length > 0) {
                                    handleMouseEnter(e, `Modifikationen: ${c.name}`, c.modificationBreakdown);
                                  }
                                }}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => {
                                  if (modState && c.modificationBreakdown?.length > 0) {
                                    setSaveSummaryData({ title: `Modifikationen: ${c.name}`, breakdown: c.modificationBreakdown });
                                    setSaveSummaryOpen(true);
                                  }
                                }}
                              >
                                {c.value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })() : (
              <p className="text-dim text-label">Keine Profilwerte gefunden.</p>
            )}

            {weaponProfiles && weaponProfiles.length > 0 && (() => {
              const headers = [];
              weaponProfiles.forEach(prof => {
                prof.characteristics?.forEach(c => {
                  if (c.name && !headers.includes(c.name)) {
                    headers.push(c.name);
                  }
                });
              });

              return (
                <div style={{ marginTop: '10px' }}>
                  <div className="profile-table-container">
                    <table className="profile-table">
                      <thead>
                        <tr>
                          <th>Weapon</th>
                          {headers.map(h => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {weaponProfiles.map((prof, pIdx) => (
                          <tr key={prof.id || pIdx}>
                            <td className="font-body">
                              {prof.name}
                            </td>
                            {headers.map(h => {
                              const c = prof.characteristics?.find(char => char.name === h);
                              if (!c) return <td key={h} className="font-body">-</td>;

                              const modState = getModificationState(c);
                              const cellStyle = {};
                              let className = "font-body";
                              if (modState === 'positive') {
                                className += " text-success";
                                cellStyle.backgroundColor = 'rgba(27, 115, 64, 0.12)';
                                cellStyle.fontWeight = 'bold';
                                cellStyle.cursor = 'help';
                              } else if (modState === 'negative') {
                                className += " text-danger";
                                cellStyle.backgroundColor = 'rgba(166, 28, 28, 0.12)';
                                cellStyle.fontWeight = 'bold';
                                cellStyle.cursor = 'help';
                              } else if (modState === 'modified') {
                                className += " text-gold";
                                cellStyle.backgroundColor = 'rgba(226, 183, 66, 0.12)';
                                cellStyle.fontWeight = 'bold';
                                cellStyle.cursor = 'help';
                              }

                              return (
                                <td
                                  key={h}
                                  className={className}
                                  style={cellStyle}
                                  onMouseEnter={(e) => {
                                    if (modState && c.modificationBreakdown?.length > 0) {
                                      handleMouseEnter(e, `Modifikationen: ${c.name}`, c.modificationBreakdown);
                                    }
                                  }}
                                  onMouseLeave={handleMouseLeave}
                                  onClick={() => {
                                    if (modState && c.modificationBreakdown?.length > 0) {
                                      setSaveSummaryData({ title: `Modifikationen: ${c.name}`, breakdown: c.modificationBreakdown });
                                      setSaveSummaryOpen(true);
                                    }
                                  }}
                                >
                                  {c.value}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rules.length > 0 && (() => {
              const isRulesExpanded = expandedRuleBlocks[selection.id];
              return (
              <div className="play-unit-wound-tracker">
                <h4 
                  className="text-body"
                  style={{ 
                    marginBottom: isRulesExpanded ? '8px' : '0px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                  onClick={() => setExpandedRuleBlocks(prev => ({ ...prev, [selection.id]: !prev[selection.id] }))}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Sonderregeln &amp; Fähigkeiten
                  </span>
                  <span className="hover-gold text-micro" style={{ color: 'var(--text-gold)', fontWeight: 600 }}>
                    {isRulesExpanded ? '▲' : '▼'}
                  </span>
                </h4>
                {isRulesExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {rules.map((rule, rIdx) => (
                      <div key={rIdx} style={{ marginTop: '8px' }}>
                        <strong className="text-gold">
                          {rule.name}
                          {showDebugIds && <span className="debug-id-badge clickable">{rule.id}</span>}
                          :
                        </strong>{' '}
                        <span className="text-body" style={{ color: 'var(--text-parchment)', fontStyle: 'italic' }}>
                          {rule.description}
                          {rule.publicationRef && (
                            <span className="publication-ref">
                              {rule.publicationRef}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })()}

            {selectedUpgrades.length > 0 && (() => {
              const isEquipExpanded = expandedEquipBlocks[selection.id];
              return (
                <div className="play-unit-wound-tracker">
                  <h4 
                    className="text-body"
                    style={{ 
                      marginBottom: isEquipExpanded ? '8px' : '0px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                    onClick={() => setExpandedEquipBlocks(prev => ({ ...prev, [selection.id]: !prev[selection.id] }))}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BookOpen size={14} /> Ausrüstung &amp; Upgrades
                    </span>
                    <span className="hover-gold text-micro" style={{ color: 'var(--text-gold)', fontWeight: 600 }}>
                      {isEquipExpanded ? '▲' : '▼'}
                    </span>
                  </h4>
                  
                  {isEquipExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedUpgrades.map(upgrade => {
                        const desc = getUpgradeDescription(upgrade.resolved);
                        const isExpanded = expandedUpgrades[upgrade.id];
                        
                        return (
                          <div key={upgrade.id} className="text-label">
                            <div 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                cursor: desc ? 'pointer' : 'default',
                                padding: '3px 6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid var(--border-dark)',
                                borderRadius: '4px'
                              }}
                              onClick={() => desc && setExpandedUpgrades(prev => ({ ...prev, [upgrade.id]: !prev[upgrade.id] }))}
                            >
                              <span className="text-gold" style={{ fontWeight: 600 }}>
                                {upgrade.number > 1 ? `${upgrade.number}x ` : ''}{upgrade.name}
                                {showDebugIds && (
                                  <span className="debug-id-badge clickable" title="Definition-ID">def:{upgrade.resolved?.id}</span>
                                )}
                              </span>
                              {desc && (
                                <span className="hover-gold text-micro" style={{ color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                  {isExpanded ? '▲' : '▼'}
                                </span>
                              )}
                            </div>
                            
                            {desc && isExpanded && (
                               <div 
                                 className="text-body"
                                 style={{ 
                                   color: 'var(--text-parchment)',
                                   padding: '6px', 
                                   backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                   borderLeft: '2px solid var(--border-gold-dim)',
                                   marginTop: '2px',
                                   lineHeight: '1.3'
                                 }}
                               >
                                 {renderUpgradeDetails(upgrade.resolved)}
                               </div>
                             )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
