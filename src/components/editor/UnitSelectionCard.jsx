import React, { useState } from 'react';
import { Trash2, Copy, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useDebugMode } from '../../hooks/DebugContext';
import SelectionConfigurator from './SelectionConfigurator';
import BottomSheet from './BottomSheet';
import { 
  resolveEntry, 
  findEntryInSystem, 
  calculateRosterCosts,
  collectUnitProfilesAndRules
} from '../../solver/validator';
import { UPGRADE_DETAILS_KEYWORDS } from '../../solver/constants';
import { extractModelProfiles, extractWeaponProfiles, extractArmourProfiles } from '../../solver/rulesEvaluator';

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

export default function UnitSelectionCard({
  selection,
  selectedRosterSelection,
  setSelectedRosterSelection,
  roster,
  system,
  validationErrors,
  costTypeLabel,
  removeUnit,
  copyUnit,
  updateSubSelection,
  activeCatalogue,
  setSelectedCatalogEntry
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

  const renderMiniProfile = (sel) => {
    const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id, roster);
    const modelProfiles = extractModelProfiles(profiles);
    const weaponProfiles = extractWeaponProfiles(profiles);
    const armourProfiles = extractArmourProfiles(profiles);
    if ((!modelProfiles || modelProfiles.length === 0) && (!weaponProfiles || weaponProfiles.length === 0) && (!armourProfiles || armourProfiles.length === 0)) return null;

    return (
      <div 
        className="mini-profile clickable"
        onClick={(e) => {
          e.stopPropagation();
          const rawEntry = findEntryInSystem(system, sel.entryLinkId || sel.selectionEntryId, activeCatalogue?.id);
          const resolved = resolveEntry(system, rawEntry, activeCatalogue?.id);
          if (resolved) {
            setSelectedCatalogEntry(resolved);
          }
        }}
        title="Statblock anzeigen"
      >
        {(() => {
          if (modelProfiles.length === 0) return null;
          const headers = [];
          modelProfiles.forEach(prof => {
            prof.characteristics?.forEach(c => {
              if (c.name && !headers.includes(c.name)) {
                headers.push(c.name);
              }
            });
          });
          const showModelNameCol = modelProfiles.length > 1;

          return (
            <table className="mini-profile-table">
              <thead>
                <tr>
                  {showModelNameCol && <th>Modell</th>}
                  {headers.map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modelProfiles.map((prof, pIdx) => (
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
                              handleMouseEnter(`Modifikationen: ${c.name}`, c.modificationBreakdown.join('\n'), e);
                            }
                          }}
                          onMouseMove={handleMouseMove}
                          onMouseLeave={handleMouseLeave}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (modState && c.modificationBreakdown?.length > 0 && window.innerWidth <= 900) {
                              setActiveInfo({
                                title: `Modifikationen: ${c.name}`,
                                text: (
                                  <ul style={{ margin: 0, paddingLeft: '20px', textAlign: 'left' }}>
                                    {c.modificationBreakdown.map((b, bIdx) => (
                                      <li key={bIdx} className="text-body" style={{ color: 'var(--text-parchment)', marginBottom: '4px' }}>{b}</li>
                                    ))}
                                  </ul>
                                )
                              });
                            } else {
                              const rawEntry = findEntryInSystem(system, sel.entryLinkId || sel.selectionEntryId, activeCatalogue?.id);
                              const resolved = resolveEntry(system, rawEntry, activeCatalogue?.id);
                              if (resolved) {
                                setSelectedCatalogEntry(resolved);
                              }
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
          );
        })()}

        {(() => {
          if (weaponProfiles.length === 0) return null;
          const headers = [];
          weaponProfiles.forEach(prof => {
            prof.characteristics?.forEach(c => {
              if (c.name && !headers.includes(c.name)) {
                headers.push(c.name);
              }
            });
          });

          return (
            <div>
              <table className="mini-profile-table">
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
                                handleMouseEnter(`Modifikationen: ${c.name}`, c.modificationBreakdown.join('\n'), e);
                              }
                            }}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (modState && c.modificationBreakdown?.length > 0 && window.innerWidth <= 900) {
                                setActiveInfo({
                                  title: `Modifikationen: ${c.name}`,
                                  text: (
                                    <ul style={{ margin: 0, paddingLeft: '20px', textAlign: 'left' }}>
                                      {c.modificationBreakdown.map((b, bIdx) => (
                                        <li key={bIdx} className="text-body" style={{ color: 'var(--text-parchment)', marginBottom: '4px' }}>{b}</li>
                                      ))}
                                    </ul>
                                  )
                                });
                              } else {
                                const rawEntry = findEntryInSystem(system, sel.entryLinkId || sel.selectionEntryId, activeCatalogue?.id);
                                const resolved = resolveEntry(system, rawEntry, activeCatalogue?.id);
                                if (resolved) {
                                  setSelectedCatalogEntry(resolved);
                                }
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
        })()}

        {(() => {
          if (armourProfiles.length === 0) return null;
          const headers = [];
          armourProfiles.forEach(prof => {
            prof.characteristics?.forEach(c => {
              if (c.name && !headers.includes(c.name)) {
                headers.push(c.name);
              }
            });
          });

          return (
            <div style={{ marginTop: '10px' }}>
              <table className="mini-profile-table">
                <thead>
                  <tr>
                    <th>Armour</th>
                    {headers.map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {armourProfiles.map((prof, pIdx) => (
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
                                handleMouseEnter(`Modifikationen: ${c.name}`, c.modificationBreakdown.join('\n'), e);
                              }
                            }}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (modState && c.modificationBreakdown?.length > 0 && window.innerWidth <= 900) {
                                setActiveInfo({
                                  title: `Modifikationen: ${c.name}`,
                                  text: (
                                    <ul style={{ margin: 0, paddingLeft: '20px', textAlign: 'left' }}>
                                      {c.modificationBreakdown.map((b, bIdx) => (
                                        <li key={bIdx} className="text-body" style={{ color: 'var(--text-parchment)', marginBottom: '4px' }}>{b}</li>
                                      ))}
                                    </ul>
                                  )
                                });
                              } else {
                                const rawEntry = findEntryInSystem(system, sel.entryLinkId || sel.selectionEntryId, activeCatalogue?.id);
                                const resolved = resolveEntry(system, rawEntry, activeCatalogue?.id);
                                if (resolved) {
                                  setSelectedCatalogEntry(resolved);
                                }
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
        })()}
      </div>
    );
  };

  const getSelectedUpgrades = (sel) => {
    const list = [];
    const collect = (node) => {
      if (!node.selections) return;
      node.selections.forEach(subSel => {
        const entryId = subSel.entryLinkId || subSel.selectionEntryId;
        const entry = findEntryInSystem(system, entryId, activeCatalogue?.id);
        const resolved = resolveEntry(system, entry, activeCatalogue?.id);
        
        const hasEntryChildren = (entryNode) => {
          if (!entryNode) return false;
          return (entryNode.selectionEntries && entryNode.selectionEntries.length > 0) ||
                 (entryNode.entryLinks && entryNode.entryLinks.length > 0) ||
                 (entryNode.selectionEntryGroups && entryNode.selectionEntryGroups.length > 0);
        };
        const isIndependent = resolved && (resolved.type === 'unit' || resolved.type === 'model') && (resolved.collective === false || resolved.collective === 'false') && hasEntryChildren(resolved);
        
        if (resolved && !isIndependent) {
          list.push({
            id: subSel.id,
            name: subSel.name,
            number: subSel.number || 1,
            resolved: resolved
          });
          collect(subSel);
        }
      });
    };
    collect(sel);
    return list;
  };

  const getUpgradeDescription = (res) => {
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
      const upgradeProfiles = res.profiles.filter(p => {
        const typeLower = p.profileTypeName?.toLowerCase() || '';
        return UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k));
      });
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

  const renderUnitUpgrades = (sel) => {
    const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id, roster);
    const weaponProfiles = extractWeaponProfiles(profiles);
    const weaponSelectionIds = new Set(
      weaponProfiles.map(wp => wp._sourceSelection?.id).filter(Boolean)
    );
    const armourProfiles = extractArmourProfiles(profiles);
    const armourSelectionIds = new Set(
      armourProfiles.map(ap => ap._sourceSelection?.id).filter(Boolean)
    );

    const isNameMatch = (selN, profN) => {
      if (!selN || !profN) return false;
      const s = selN.toLowerCase().trim();
      const p = profN.toLowerCase().trim();
      return s === p || 
             (s.endsWith('s') && s.slice(0, -1) === p) ||
             (p.endsWith('s') && p.slice(0, -1) === s) ||
             s.includes(p) ||
             p.includes(s);
    };

    const selectedUpgrades = getSelectedUpgrades(sel).filter(upgrade => {
      if (weaponSelectionIds.has(upgrade.id) || armourSelectionIds.has(upgrade.id)) return false;
      const name = upgrade.name || upgrade.resolved?.name;
      if (name && weaponProfiles.some(wp => isNameMatch(name, wp.name))) {
        return false;
      }
      if (name && armourProfiles.some(ap => isNameMatch(name, ap.name))) {
        return false;
      }
      return true;
    });
    if (selectedUpgrades.length === 0) return null;

    return (
      <div className="unit-header-upgrades">
        {selectedUpgrades.map(upgrade => {
          const descText = getUpgradeDescription(upgrade.resolved);
          return (
            <span 
              key={upgrade.id}
              className={`text-micro upgrade-badge ${descText ? 'has-desc' : 'no-desc'}`}
              onMouseEnter={(e) => descText && handleMouseEnter(upgrade.resolved?.name || upgrade.name, renderUpgradeDetails(upgrade.resolved), e)}
              onMouseMove={descText ? handleMouseMove : null}
              onMouseLeave={descText ? handleMouseLeave : null}
              onClick={(e) => {
                e.stopPropagation();
                if (window.innerWidth <= 900 && descText) {
                  setActiveInfo({ title: upgrade.resolved?.name || upgrade.name, text: renderUpgradeDetails(upgrade.resolved) });
                }
              }}
            >
              {upgrade.number > 1 ? `${upgrade.number}x ` : ''}
              {upgrade.name || upgrade.resolved.name}
              {descText && (
                <Info size={10} className="upgrade-info-icon" />
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const renderUnitRules = (sel) => {
    const { rules } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id, roster);
    if (!rules || rules.length === 0) return null;

    return (
      <div className="unit-header-rules">
        {rules.map((rule, rIdx) => {
          const descText = rule.description || '';
          return (
            <span 
              key={rule.id || rIdx}
              className={`text-micro rule-badge ${descText ? 'has-desc' : 'no-desc'}`}
              onMouseEnter={(e) => descText && handleMouseEnter(rule.name, (
                <div style={{ textAlign: 'left', lineHeight: '1.4' }}>
                  <div>{rule.description}</div>
                  {rule.publicationRef && (
                    <div className="publication-ref" style={{ marginTop: '4px' }}>
                      {rule.publicationRef}
                    </div>
                  )}
                </div>
              ), e)}
              onMouseMove={descText ? handleMouseMove : null}
              onMouseLeave={descText ? handleMouseLeave : null}
              onClick={(e) => {
                e.stopPropagation();
                if (window.innerWidth <= 900 && descText) {
                  setActiveInfo({ 
                    title: rule.name, 
                    text: (
                      <div style={{ textAlign: 'left', lineHeight: '1.4' }}>
                        <div>{rule.description}</div>
                        {rule.publicationRef && (
                          <div className="publication-ref" style={{ marginTop: '4px' }}>
                            {rule.publicationRef}
                          </div>
                        )}
                      </div>
                    ) 
                  });
                }
              }}
            >
              {rule.name}
              {descText && (
                <Sparkles size={10} className="rule-info-icon" />
              )}
            </span>
          );
        })}
      </div>
    );
  };

  const isUnitEditing = selectedRosterSelection?.id === selection.id;
  const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
  const displayPoints = unitCosts[roster.costLimitType] || 0;
  const hasSelectionError = validationErrors.some(e => e.selectionId === selection.id);
  const selectionErrors = validationErrors.filter(e => e.selectionId === selection.id);

  const independentSubUnits = (selection.selections || []).filter(subSel => {
    const entryId = subSel.entryLinkId || subSel.selectionEntryId;
    const entry = findEntryInSystem(system, entryId, activeCatalogue?.id);
    const resolved = resolveEntry(system, entry, activeCatalogue?.id);
    
    const hasEntryChildren = (entryNode) => {
      if (!entryNode) return false;
      return (entryNode.selectionEntries && entryNode.selectionEntries.length > 0) ||
             (entryNode.entryLinks && entryNode.entryLinks.length > 0) ||
             (entryNode.selectionEntryGroups && entryNode.selectionEntryGroups.length > 0);
    };
    
    return resolved && (resolved.type === 'unit' || resolved.type === 'model') && (resolved.collective === false || resolved.collective === 'false') && hasEntryChildren(resolved);
  });

  return (
    <div className={`selection-node ${hasSelectionError ? 'has-error' : ''}`} style={copyUnit ? {} : { marginTop: '8px', border: '1px solid rgba(226, 183, 66, 0.2)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <div 
        className="selection-node-header"
        style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
        onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="selection-node-title">
            <span className="selection-node-name text-ui-title">
              {selection.number > 1 ? `${selection.number}x ` : ''}{selection.name}
              {showDebugIds && (
                <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
              )}
            </span>
          </div>
          <div className="selection-node-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="selection-node-cost font-body">
              {displayPoints} {costTypeLabel}
            </span>
            {copyUnit && (
              <button 
                type="button"
                className="btn-primary square-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  copyUnit(selection.id);
                }}
                title="Kopieren"
              >
                <Copy size={14} />
              </button>
            )}
            <button 
              type="button"
              className="btn-danger square-btn" 
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Möchten Sie diese Einheit wirklich löschen?')) {
                  removeUnit(selection.id);
                }
              }}
              title="Löschen"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {renderMiniProfile(selection)}
        {renderUnitUpgrades(selection)}
        {renderUnitRules(selection)}
      </div>

      {selectionErrors.map((err, idx) => (
        <div key={idx} className="unit-error-alert text-danger text-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(166,28,28,0.04)', borderBottom: '1px solid rgba(166,28,28,0.2)' }}>
          <AlertTriangle size={14} />
          <span>{err.message}</span>
        </div>
      ))}

      {isUnitEditing && (
        <SelectionConfigurator
          selection={selection}
          system={system}
          roster={roster}
          updateSubSelection={updateSubSelection}
          costTypeLabel={costTypeLabel}
          activeCatalogue={activeCatalogue}
          handleMouseEnter={handleMouseEnter}
          handleMouseMove={handleMouseMove}
          handleMouseLeave={handleMouseLeave}
          setActiveInfo={setActiveInfo}
        />
      )}

      {independentSubUnits.length > 0 && (
        <div className="sub-units-container" style={{ paddingLeft: '16px', borderLeft: '2px solid rgba(226, 183, 66, 0.2)', marginTop: '8px' }}>
          {independentSubUnits.map(subSel => (
            <UnitSelectionCard 
              key={subSel.id}
              selection={subSel}
              selectedRosterSelection={selectedRosterSelection}
              setSelectedRosterSelection={setSelectedRosterSelection}
              roster={roster}
              system={system}
              validationErrors={validationErrors}
              costTypeLabel={costTypeLabel}
              removeUnit={(id) => updateSubSelection(selection.id, id, 'remove_instance')}
              copyUnit={null}
              updateSubSelection={updateSubSelection}
              activeCatalogue={activeCatalogue}
              setSelectedCatalogEntry={setSelectedCatalogEntry}
            />
          ))}
        </div>
      )}

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
    </div>
  );
}
