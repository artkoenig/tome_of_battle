import React, { useState } from 'react';
import { Plus, Minus, Sparkles, BookOpen } from 'lucide-react';
import { findEntryInSystem, resolveEntry, collectUnitProfilesAndRules, getSelectionTotalCost } from '../../solver/validator';
import { MODEL_COUNT_PROFILE_TYPES } from '../../solver/constants';
import {
  getArmourSave as getArmourSaveLogic,
  getWardSave as getWardSaveLogic,
  extractModelProfiles,
  extractUpgradeProfiles,
  hasBlessing
} from '../../solver/rulesEvaluator';

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
    const { profiles, rules } = collectUnitProfilesAndRules(system, sel, roster.catalogueId);
    const modelProfiles = extractModelProfiles(profiles);
    return { profiles: modelProfiles, rules };
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
        if (r.description) descriptions.push(r.description);
      });
    }
    if (res.profiles && res.profiles.length > 0) {
      const upgradeProfiles = extractUpgradeProfiles(res.profiles);
      upgradeProfiles.forEach(p => {
        p.characteristics?.forEach(c => {
          if (c.value) descriptions.push(`${c.name}: ${c.value}`);
        });
      });
    }
    return descriptions.join(' | ');
  };

  const collectSavesData = (sel) => {
    const entryId = sel.entryLinkId || sel.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);
    
    const items = [];
    if (resolved) {
      if (resolved.name) items.push({ name: resolved.name });
      resolved.rules?.forEach(r => items.push({ name: r.name, description: r.description }));
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
          subResolved.rules?.forEach(r => items.push({ name: r.name, description: r.description }));
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
  const { profiles, rules } = getUnitProfilesAndRules(selection);
  const selectedUpgrades = getSelectedUpgrades(selection);
  const asInfo = getArmourSaveInfo(selection);
  const wsInfo = getWardSaveInfo(selection);
  
  const isDead = currentWounds === 0;

  return (
    <div className="play-unit-card">
      <div className="play-unit-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
        <div className="play-unit-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {selection.name}
            {showDebugIds && (
              <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
            )}
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--text-gold)', fontWeight: 600 }}>
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
              className="btn-sm" 
              style={{ padding: '2px 6px' }}
              onClick={() => handleAdjustWound(selection.id, -1, totalMaxWounds)}
              disabled={isDead}
            >
              <Minus size={12} />
            </button>
            <span className="font-body" style={{ fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>
              {currentWounds} / {totalMaxWounds}
            </span>
            <button 
              className="btn-sm" 
              style={{ padding: '2px 6px' }}
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
            {profiles.length > 0 ? (
              profiles.map((prof, pIdx) => (
                <div key={pIdx} style={{ marginBottom: '6px' }}>
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
                            <td key={c.name} className="font-body">{c.value}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-dim" style={{ fontSize: '0.85rem' }}>Keine Profilwerte gefunden.</p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rules.length > 0 && (() => {
              const isRulesExpanded = expandedRuleBlocks[selection.id];
              return (
              <div className="play-unit-wound-tracker">
                <h4 
                  style={{ 
                    fontSize: '0.9rem', 
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
                  <span className="font-body hover-gold" style={{ fontSize: '0.75rem', color: 'var(--text-gold)', fontWeight: 600 }}>
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
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-parchment)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>{rule.description}</span>
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
                    style={{ 
                      fontSize: '0.9rem', 
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
                    <span className="font-body hover-gold" style={{ fontSize: '0.75rem', color: 'var(--text-gold)', fontWeight: 600 }}>
                      {isEquipExpanded ? '▲' : '▼'}
                    </span>
                  </h4>
                  
                  {isEquipExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedUpgrades.map(upgrade => {
                        const desc = getUpgradeDescription(upgrade.resolved);
                        const isExpanded = expandedUpgrades[upgrade.id];
                        
                        return (
                          <div key={upgrade.id} style={{ fontSize: '0.85rem' }}>
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
                                <span className="font-body hover-gold" style={{ fontSize: '0.75rem', color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                  {isExpanded ? '▲' : '▼'}
                                </span>
                              )}
                            </div>
                            
                            {desc && isExpanded && (
                              <div 
                                style={{ 
                                  fontFamily: 'var(--font-body)', 
                                  fontSize: '0.9rem', 
                                  color: 'var(--text-parchment)',
                                  padding: '6px', 
                                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                  borderLeft: '2px solid var(--border-gold-dim)',
                                  marginTop: '2px',
                                  fontStyle: 'italic',
                                  lineHeight: '1.3'
                                }}
                              >
                                {desc}
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
