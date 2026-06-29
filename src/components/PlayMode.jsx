import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Search, Plus, Minus, 
  Heart, Swords, Sparkles, BookOpen 
} from 'lucide-react';
import { saveRoster } from '../db/database';
import { findEntryInSystem, resolveEntry, collectUnitProfilesAndRules } from '../solver/validator';
import { useDebugMode } from '../hooks/DebugContext';
import { MODEL_COUNT_PROFILE_TYPES } from '../solver/constants';
import {
  getArmourSave as getArmourSaveLogic,
  getWardSave as getWardSaveLogic,
  extractModelProfiles,
  extractUpgradeProfiles,
  hasBlessing
} from '../solver/rulesEvaluator';
import BottomSheet from './editor/BottomSheet';

export default function PlayMode({ system, roster: initialRoster, onBack }) {
  const { showDebugIds } = useDebugMode();
  const [roster, setRoster] = useState(initialRoster);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUpgrades, setExpandedUpgrades] = useState({});
  const [expandedEquipBlocks, setExpandedEquipBlocks] = useState({});
  const [expandedRuleBlocks, setExpandedRuleBlocks] = useState({});
  const [gameState, setGameState] = useState(() => {
    return initialRoster.gameState || {
      round: 1,
      vp: 0,
      cp: 0,
      wounds: {} // selectionId -> array of current wounds per model
    };
  });
  const [saveSummaryOpen, setSaveSummaryOpen] = useState(false);
  const [saveSummaryData, setSaveSummaryData] = useState({ title: '', breakdown: [] });

  // Save game state to DB whenever it changes
  useEffect(() => {
    const saveState = async () => {
      const updatedRoster = { ...roster, gameState };
      setRoster(updatedRoster);
      try {
        await saveRoster(updatedRoster);
      } catch (e) {
        console.error("Failed to save game state:", e);
      }
    };
    saveState();
  }, [gameState]);

  // Helper to extract maximum wounds of an entry
  const getMaxWounds = (selection) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
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

    let w = searchProfiles(selection.profiles) || 
            searchProfiles(resolved.profiles) ||
            searchProfiles(resolved.selectionEntries?.[0]?.profiles);

    // If not found, check models inside the selection
    if (!w && resolved.selectionEntries) {
      for (const child of resolved.selectionEntries) {
        w = searchProfiles(child.profiles);
        if (w) break;
      }
    }

    return w || 1;
  };

  // Helper to get unit profiles
  const getUnitProfilesAndRules = (selection) => {
    const { profiles, rules } = collectUnitProfilesAndRules(system, selection, initialRoster.catalogueId);
    
    // Filter profiles to only keep model/unit stats profiles
    const modelProfiles = extractModelProfiles(profiles);

    return { profiles: modelProfiles, rules };
  };

  // Helper to compile chosen upgrades / items from a selection instance
  const getSelectedUpgrades = (selection) => {
    if (!selection.selections) return [];
    return selection.selections.map(subSel => {
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

  // Helper to calculate the combined armour save for a unit selection in WFB 6th
  // Helper to compile all names, rules, and profiles of a selection and its sub-selections
  const collectSavesData = (selection) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);
    
    const items = [];
    if (resolved) {
      if (resolved.name) items.push({ name: resolved.name });
      resolved.rules?.forEach(r => items.push({ name: r.name, description: r.description }));
      resolved.profiles?.forEach(p => items.push(p));
    }
    
    if (selection.selections) {
      selection.selections.forEach(subSel => {
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

  const getArmourSaveInfo = (selection) => {
    const data = collectSavesData(selection);
    const result = getArmourSaveLogic(data, selection.name, roster?.catalogueName, true);
    const display = result.save === 7 || !result.save ? 'Kein' : `${result.save}+`;
    return { display, breakdown: result.breakdown };
  };

  const getWardSaveInfo = (selection) => {
    const data = collectSavesData(selection);
    const result = getWardSaveLogic(data, selection.name, roster?.catalogueName, true);
    const blessing = hasBlessing(data, selection.name, roster?.catalogueName);

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

  // Helper to calculate total model count in a unit selection
  const getUnitModelCount = (selection) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);
    
    if (!resolved) return selection.number || 1;

    // If the entry itself is a model, it represents a single selection
    if (resolved.type === 'model') {
      return selection.number || 1;
    }

    let totalModels = 0;
    let hasModelChildren = false;

    if (selection.selections && selection.selections.length > 0) {
      selection.selections.forEach(child => {
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
      return selection.number || 1;
    }

    return totalModels;
  };

  // Get current remaining wounds of the unit
  const getUnitCurrentWounds = (selection, maxWounds, totalMaxWounds) => {
    const id = selection.id;
    const val = gameState.wounds[id];
    if (val === undefined) {
      return totalMaxWounds;
    }
    if (Array.isArray(val)) {
      return val.reduce((sum, w) => sum + w, 0);
    }
    return val;
  };

  const handleAdjustWound = (selectionId, delta, totalMaxWounds) => {
    setGameState(prev => {
      const woundsMap = { ...prev.wounds };
      const current = prev.wounds[selectionId];
      let currentVal = totalMaxWounds;
      
      if (current !== undefined) {
        if (Array.isArray(current)) {
          currentVal = current.reduce((sum, w) => sum + w, 0);
        } else {
          currentVal = current;
        }
      }
      
      const newVal = Math.max(0, Math.min(totalMaxWounds, currentVal + delta));
      woundsMap[selectionId] = newVal;

      return {
        ...prev,
        wounds: woundsMap
      };
    });
  };

  // VP and Round tracker commands
  const adjustTracker = (field, delta) => {
    setGameState(prev => ({
      ...prev,
      [field]: Math.max(0, prev[field] + delta)
    }));
  };

  // Filter roster selections based on search query
  const getFilteredSelections = () => {
    const list = [];
    roster.forces.forEach(force => {
      force.selections?.forEach(sel => {
        const matchesName = sel.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Also check if rules matches search
        const { rules } = getUnitProfilesAndRules(sel);
        const matchesRules = rules.some(r => 
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          r.description.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (matchesName || matchesRules || searchTerm === '') {
          list.push(sel);
        }
      });
    });
    return list;
  };

  return (
    <div className="play-layout">
      {/* Play Mode Header */}
      <div className="play-header">
        <button className="btn-sm play-header-back" onClick={onBack} title="Kriegsplanung (Editieren)">
          <ArrowLeft size={16} />
        </button>
        <h2 className="play-header-title">Spielmodus</h2>
      </div>


      {/* Active Units Roster Sheets */}
      <div className="play-units-grid">
        {getFilteredSelections().map(selection => {
          const maxWounds = getMaxWounds(selection);
          const modelCount = getUnitModelCount(selection);
          const totalMaxWounds = modelCount * maxWounds;
          const currentWounds = getUnitCurrentWounds(selection, maxWounds, totalMaxWounds);
          const { profiles, rules } = getUnitProfilesAndRules(selection);
          const selectedUpgrades = getSelectedUpgrades(selection);
          const asInfo = getArmourSaveInfo(selection);
          const wsInfo = getWardSaveInfo(selection);
          
          const isUnitWounded = currentWounds < totalMaxWounds;
          const isDead = currentWounds === 0;
          const healthPct = (currentWounds / totalMaxWounds) * 100;

          return (
            <div key={selection.id} className="play-unit-card">
              {/* Unit Header */}
              <div className="play-unit-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                <div className="play-unit-title">
                  {selection.name}
                  {showDebugIds && (
                    <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
                  )}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="play-unit-badges">
                    <div 
                      className="badge badge-success font-sans" 
                      style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 700, cursor: asInfo.breakdown.length > 0 ? 'help' : 'default' }}
                      title={asInfo.breakdown.length > 0 ? asInfo.breakdown.join('\n') : undefined}
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
                      className="badge badge-warning font-sans" 
                      style={{ fontSize: '0.75rem', padding: '4px 8px', fontWeight: 700, cursor: wsInfo.breakdown.length > 0 ? 'help' : 'default' }}
                      title={wsInfo.breakdown.length > 0 ? wsInfo.breakdown.join('\n') : undefined}
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
                    <span className="font-sans" style={{ fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>
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

              {/* Unit Body */}
              <div className="play-unit-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Stat Profiles Table */}
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
                                    <td key={c.name} className="font-sans">{c.value}</td>
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

                  {/* Extras: Sonderregeln & Ausrüstung */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Sonderregeln */}
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
                          <span className="font-sans hover-gold" style={{ fontSize: '0.75rem', color: 'var(--text-gold)', fontWeight: 600 }}>
                            {isRulesExpanded ? '▲' : '▼'}
                          </span>
                        </h4>
                        {isRulesExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {rules.map((rule, rIdx) => (
                              <div key={rIdx} style={{ fontSize: '0.85rem' }}>
                                <strong className="text-gold">
                                  {rule.name}
                                  {showDebugIds && <span className="debug-id-badge clickable">{rule.id}</span>}
                                  :
                                </strong>{' '}
                                <span style={{ color: 'var(--text-parchment)' }}>{rule.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })()}

                    {/* Ausrüstung & Upgrades */}
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
                            <span className="font-sans hover-gold" style={{ fontSize: '0.75rem', color: 'var(--text-gold)', fontWeight: 600 }}>
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
                                        <span className="font-sans hover-gold" style={{ fontSize: '0.75rem', color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                          {isExpanded ? '▲' : '▼'}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {desc && isExpanded && (
                                      <div 
                                        className="text-dim" 
                                        style={{ 
                                          fontFamily: 'var(--font-body)', 
                                          fontSize: '0.85rem', 
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
        })}
      </div>

      <BottomSheet
        isOpen={saveSummaryOpen}
        onClose={() => setSaveSummaryOpen(false)}
        title={saveSummaryData.title}
      >
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {saveSummaryData.breakdown.length > 0 ? (
            <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-parchment)', fontSize: '0.9rem' }}>
              {saveSummaryData.breakdown.map((item, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-dim" style={{ fontSize: '0.9rem' }}>Keine Modifikatoren gefunden.</p>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
