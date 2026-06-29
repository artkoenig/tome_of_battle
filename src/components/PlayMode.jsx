import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Search, Plus, Minus, 
  Heart, Swords, Sparkles, BookOpen 
} from 'lucide-react';
import { saveRoster } from '../db/database';
import { findEntryInSystem, resolveEntry } from '../solver/validator';
import { useDebugMode } from '../hooks/DebugContext';
import { MODEL_COUNT_PROFILE_TYPES } from '../solver/constants';
import {
  getArmourSave as getArmourSaveLogic,
  getWardSave as getWardSaveLogic,
  extractModelProfiles,
  extractUpgradeProfiles,
  hasBlessing
} from '../solver/rulesEvaluator';

export default function PlayMode({ system, roster: initialRoster, onBack }) {
  const { showDebugIds } = useDebugMode();
  const [roster, setRoster] = useState(initialRoster);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUpgrades, setExpandedUpgrades] = useState({});
  const [expandedEquipBlocks, setExpandedEquipBlocks] = useState({});
  const [gameState, setGameState] = useState(() => {
    return initialRoster.gameState || {
      round: 1,
      vp: 0,
      cp: 0,
      wounds: {} // selectionId -> array of current wounds per model
    };
  });

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
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);

    if (!resolved) return { profiles: [], rules: [] };

    // Accumulate profiles/rules from the main entry and its immediate models
    const profiles = [...(selection.profiles || []), ...(resolved.profiles || [])];
    const rules = [...(selection.rules || []), ...(resolved.rules || [])];

    resolved.selectionEntries?.forEach(child => {
      const childResolved = resolveEntry(system, child);
      if (childResolved) {
        if (childResolved.profiles) profiles.push(...childResolved.profiles);
        if (childResolved.rules) rules.push(...childResolved.rules);
      }
    });

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

  const getArmourSave = (selection) => {
    const data = collectSavesData(selection);
    const save = getArmourSaveLogic(data, selection.name, roster?.catalogueName);
    if (save === 7 || !save) return 'Kein';
    return `${save}+`;
  };

  const getWardSave = (selection) => {
    const data = collectSavesData(selection);
    const save = getWardSaveLogic(data, selection.name, roster?.catalogueName);
    const blessing = hasBlessing(data, selection.name, roster?.catalogueName);

    if (save !== null) {
      if (blessing && save > 5) {
        return `${save}+ / 5+ (Segen)`;
      }
      return `${save}+`;
    }

    if (blessing) {
      return '5+ / 6+ (Segen)';
    }

    return 'Kein';
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
        <button className="btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> Kriegsplanung (Editieren)
        </button>
        <h2 style={{ margin: 0, border: 'none', padding: 0 }}>Schlachttagebuch</h2>
        <div className="badge badge-success" style={{ padding: '6px 12px' }}>
          Spielmodus aktiv (Locked)
        </div>
      </div>

      {/* Tracker Hub */}
      <div className="tracker-hub">
        <div className="tracker-card">
          <div className="tracker-title">Runde</div>
          <div className="tracker-controls">
            <button className="btn-sm" onClick={() => adjustTracker('round', -1)}>
              <Minus size={16} />
            </button>
            <span className="tracker-value">{gameState.round}</span>
            <button className="btn-sm" onClick={() => adjustTracker('round', 1)}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="tracker-card">
          <div className="tracker-title">Siegpunkte (VP)</div>
          <div className="tracker-controls">
            <button className="btn-sm" onClick={() => adjustTracker('vp', -1)}>
              <Minus size={16} />
            </button>
            <span className="tracker-value">{gameState.vp}</span>
            <button className="btn-sm" onClick={() => adjustTracker('vp', 1)}>
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="tracker-card">
          <div className="tracker-title">Befehlspunkte (CP)</div>
          <div className="tracker-controls">
            <button className="btn-sm" onClick={() => adjustTracker('cp', -1)}>
              <Minus size={16} />
            </button>
            <span className="tracker-value">{gameState.cp}</span>
            <button className="btn-sm" onClick={() => adjustTracker('cp', 1)}>
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Search & Rules Lookup */}
      <div className="gothic-panel" style={{ padding: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Search className="text-gold" size={20} />
          <input 
            type="text" 
            placeholder="Einheit oder Sonderregel im Deckblatt suchen..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', border: '1px solid var(--border-gold-dim)' }}
          />
        </div>
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
          
          const isUnitWounded = currentWounds < totalMaxWounds;
          const isDead = currentWounds === 0;
          const healthPct = (currentWounds / totalMaxWounds) * 100;

          return (
            <div key={selection.id} className="play-unit-card">
              {/* Unit Header */}
              <div className="play-unit-header">
                <div className="play-unit-header-left">
                  <span className="play-unit-title">
                    {selection.name}
                    {showDebugIds && (
                      <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
                    )}
                  </span>
                  <span className="text-dim" style={{ fontSize: '0.85rem' }}>
                    {modelCount} Modell(e) | Max LP: {maxWounds}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Heart className={isUnitWounded ? "text-danger" : "text-success"} size={18} />
                  <span className="font-sans" style={{ fontWeight: 700 }}>
                    {currentWounds} / {totalMaxWounds} LP
                  </span>
                </div>
              </div>

              {/* Unit Body */}
              <div className="play-unit-body">
                <div className="play-unit-details">
                  
                  {/* Left Column: Stat Profiles Table & rules */}
                  <div>
                    {profiles.length > 0 ? (
                      profiles.map((prof, pIdx) => (
                        <div key={pIdx} style={{ marginBottom: '12px' }}>
                          <span className="text-gold font-serif" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            {prof.name}
                            {showDebugIds && <span className="debug-id-badge clickable">{prof.id}</span>}
                            {' '}({prof.profileTypeName})
                          </span>
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

                    {/* Schutzwürfe (AS & WS Badges) */}
                    <div style={{ 
                      marginTop: '8px', 
                      marginBottom: '16px', 
                      display: 'flex', 
                      gap: '8px'
                    }}>
                      <div className="badge badge-success font-sans" style={{ fontSize: '0.85rem', padding: '6px 12px', fontWeight: 700 }}>
                        AS: {getArmourSave(selection)}
                      </div>
                      <div className="badge badge-warning font-sans" style={{ fontSize: '0.85rem', padding: '6px 12px', fontWeight: 700 }}>
                        WS: {getWardSave(selection)}
                      </div>
                    </div>

                    {/* Sonderregeln */}
                    {rules.length > 0 && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-dark)', paddingTop: '12px' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={14} /> Sonderregeln &amp; Fähigkeiten
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      </div>
                    )}

                  </div>

                  {/* Right Column: Single Wound Tracker for Unit & Equipment */}
                  <div>
                    <div className="play-unit-wound-tracker" style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Swords size={14} /> Lebenspunkte-Zähler
                      </h4>
                      
                      <div style={{ opacity: isDead ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                        <div className="wound-tracker-row">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            Gesamt-LP {isDead && <span className="text-danger">(VERNICHTET)</span>}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                              className="btn-sm" 
                              style={{ padding: '2px 6px' }}
                              onClick={() => handleAdjustWound(selection.id, -1, totalMaxWounds)}
                              disabled={isDead}
                            >
                              <Minus size={12} />
                            </button>
                            <span className="font-sans" style={{ minWidth: '36px', textAlign: 'center', fontWeight: 700 }}>
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
                        
                        <div className="wound-bar-container">
                          <div 
                            className="wound-bar-fill" 
                            style={{ 
                              width: `${healthPct}%`,
                              backgroundColor: healthPct < 30 ? 'var(--color-danger)' : healthPct < 70 ? 'var(--color-warning)' : 'var(--color-success)'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Ausrüstung & Upgrades */}
                    {selectedUpgrades.length > 0 && (() => {
                      const isEquipExpanded = expandedEquipBlocks[selection.id];
                      return (
                        <div className="play-unit-wound-tracker">
                          <h4 
                            style={{ 
                              fontSize: '0.9rem', 
                              marginBottom: isEquipExpanded ? '12px' : '0px', 
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                                        padding: '4px 8px',
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
                                          padding: '8px', 
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
    </div>
  );
}
