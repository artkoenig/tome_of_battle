import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Search, Plus, Minus, Shield, 
  Heart, Swords, Sparkles, BookOpen 
} from 'lucide-react';
import { saveRoster } from '../db/database';
import { findEntryInCatalogue, findEntryInSystem, resolveEntry } from '../solver/validator';
import { useDebugMode } from '../hooks/DebugContext';

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
    const modelProfiles = profiles.filter(p => {
      const typeLower = p.profileTypeName?.toLowerCase() || '';
      return ['profile', 'profil', 'unit', 'einheit', 'creature', 'kreatur', 'monster', 'charakteristik', 'charakterwerte', 'mount', 'reittier'].some(t => typeLower.includes(t)) && 
             !['magic item', 'equipment', 'ausrüstung', 'magic weapon', 'armour', 'rüstung', 'weapon', 'waffe', 'virtue', 'talisman', 'item', 'special rule', 'banner', 'standarte', 'runes', 'runen'].some(t => typeLower.includes(t));
    });

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
      res.profiles.forEach(p => {
        const typeLower = p.profileTypeName?.toLowerCase() || '';
        if (['magic item', 'weapon', 'armour', 'enchanted item', 'arcane item', 'talisman', 'magic weapon', 'magic armour', 'virtue', 'runes', 'special rule', 'gegenstand', 'virtues', 'tugend'].some(t => typeLower.includes(t))) {
          p.characteristics?.forEach(c => {
            if (c.value) descriptions.push(`${c.name}: ${c.value}`);
          });
        }
      });
    }
    return descriptions.join(' | ');
  };

  // Helper to calculate the combined armour save for a unit selection in WFB 6th
  const getArmourSave = (selection) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);
    
    let hasShield = false;
    let armourValue = 7; // 7 means no armour
    let isMounted = false;
    let isBarded = false;

    // Helper to check text for keywords
    const scanText = (text) => {
      if (!text) return;
      const t = text.toLowerCase();
      
      // Shields
      if (t.includes('shield') || t.includes('schild')) {
        hasShield = true;
      }
      
      // Armours
      if (t.includes('full plate') || t.includes('plattenrüstung') || t.includes('gromril') || t.includes('chaos armour') || t.includes('chaos-rüstung')) {
        armourValue = Math.min(armourValue, 4);
      } else if (t.includes('heavy armour') || t.includes('schwere rüstung')) {
        armourValue = Math.min(armourValue, 5);
      } else if (t.includes('light armour') || t.includes('leichte rüstung')) {
        armourValue = Math.min(armourValue, 6);
      }

      // Mounts (cavalry mount types in 6th edition)
      if (t.includes('horse') || t.includes('steed') || t.includes('ross') || t.includes('pony') || t.includes('pegasus') || t.includes('cold one') || t.includes('wolf') || t.includes('boar') || t.includes('mount') || t.includes('reittier') || t.includes('streitross') || t.includes('schlachtross') || t.includes('nightmare') || t.includes('nachtmahr') || t.includes('kampfechse') || t.includes('einhorn') || t.includes('unicorn') || t.includes('hirsch') || t.includes('stag') || t.includes('wildschwein') || t.includes('chaosross') || t.includes('skelettpferd') || t.includes('skelettroß')) {
        // Exclude monster mounts
        if (!t.includes('hippogryph') && !t.includes('griffon') && !t.includes('dragon') && !t.includes('drache') && !t.includes('manticore') && !t.includes('wyvern')) {
          isMounted = true;
        }
      }

      // Barding
      if (t.includes('barded') || t.includes('barding') || t.includes('harnisch') || t.includes('rosharnisch') || t.includes('gepanzert') || t.includes('gepanzertes')) {
        isBarded = true;
      }
    };

    // 1. Scan resolved main entry details
    if (resolved) {
      scanText(resolved.name);
      resolved.rules?.forEach(r => scanText(r.name + ' ' + r.description));
      resolved.profiles?.forEach(p => {
        scanText(p.name);
        p.characteristics?.forEach(c => scanText(c.name + ' ' + c.value));
        if (p.profileTypeName?.toLowerCase().includes('cavalry') || p.profileTypeName?.toLowerCase().includes('kavallerie')) {
          isMounted = true;
        }
      });
    }

    // 2. Scan selected sub-selections/upgrades
    if (selection.selections) {
      selection.selections.forEach(subSel => {
        scanText(subSel.name);
        const subEntryId = subSel.entryLinkId || subSel.selectionEntryId;
        const subEntry = findEntryInSystem(system, subEntryId);
        const subResolved = resolveEntry(system, subEntry);
        if (subResolved) {
          scanText(subResolved.name);
          subResolved.rules?.forEach(r => scanText(r.name + ' ' + r.description));
          subResolved.profiles?.forEach(p => {
            scanText(p.name);
            p.characteristics?.forEach(c => scanText(c.name + ' ' + c.value));
            if (p.profileTypeName?.toLowerCase().includes('cavalry') || p.profileTypeName?.toLowerCase().includes('kavallerie')) {
              isMounted = true;
            }
          });
        }
      });
    }

    // If we have barding, the model must be mounted!
    if (isBarded) {
      isMounted = true;
    }

    // 3. Calculate Armour Save according to 6th Edition rules:
    // None = none (7)
    // Shield or Light armour = 6+
    // Shield & Light armour or Heavy armour = 5+
    // Shield & Heavy armour = 4+
    // Cavalry Mount = +1 save, minimum base save of 6+
    // Barded Mount = +1 save
    let save = 7;

    if (armourValue < 7) {
      save = armourValue;
    }

    if (isMounted) {
      if (save === 7) {
        save = 6;
      } else {
        save = save - 1;
      }
    }

    if (hasShield) {
      if (save === 7) {
        save = 6;
      } else {
        save = save - 1;
      }
    }

    if (isBarded && save < 7) {
      save = save - 1;
    }

    if (save === 7) {
      return 'Kein';
    }
    return `${save}+`;
  };

  // Helper to calculate the ward save for a unit selection in WFB 6th
  const getWardSave = (selection) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    const entry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, entry);
    
    let bestWard = null;
    let hasBlessing = false;

    // Helper to parse numeric ward saves from text
    const scanTextForWardSave = (text) => {
      if (!text) return;
      const t = text.toLowerCase();
      
      // Look for patterns like "5+ ward save", "5+ rettungswurf"
      const m1 = t.match(/(\d)\+\s*(?:ward save|rettungswurf|rettung)/);
      if (m1) {
        const val = parseInt(m1[1]);
        if (val >= 1 && val <= 6) {
          bestWard = bestWard ? Math.min(bestWard, val) : val;
        }
      }
      
      // Look for patterns like "ward save of 5+", "rettungswurf von 5+"
      const m2 = t.match(/(?:ward save|rettungswurf|rettung)\s*(?:of|von)?\s*(\d)\+/);
      if (m2) {
        const val = parseInt(m2[1]);
        if (val >= 1 && val <= 6) {
          bestWard = bestWard ? Math.min(bestWard, val) : val;
        }
      }

      // Check for Blessing of the Lady (Segen der Herrin)
      if (t.includes('blessing of the lady') || t.includes('segen der herrin') || t.includes('grail vow') || t.includes('gralsgelübde') || t.includes('segen')) {
        hasBlessing = true;
      }
    };

    // 1. Scan resolved main entry details
    if (resolved) {
      scanTextForWardSave(resolved.name);
      resolved.rules?.forEach(r => scanTextForWardSave(r.name + ' ' + r.description));
      resolved.profiles?.forEach(p => {
        scanTextForWardSave(p.name);
        p.characteristics?.forEach(c => scanTextForWardSave(c.name + ' ' + c.value));
      });
    }

    // 2. Scan selected sub-selections/upgrades
    if (selection.selections) {
      selection.selections.forEach(subSel => {
        scanTextForWardSave(subSel.name);
        const subEntryId = subSel.entryLinkId || subSel.selectionEntryId;
        const subEntry = findEntryInSystem(system, subEntryId);
        const subResolved = resolveEntry(system, subEntry);
        if (subResolved) {
          scanTextForWardSave(subResolved.name);
          subResolved.rules?.forEach(r => scanTextForWardSave(r.name + ' ' + r.description));
          subResolved.profiles?.forEach(p => {
            scanTextForWardSave(p.name);
            p.characteristics?.forEach(c => scanTextForWardSave(c.name + ' ' + c.value));
          });
        }
      });
    }

    // 3. Format result
    if (bestWard !== null) {
      if (hasBlessing && bestWard > 5) {
        return `${bestWard}+ / 5+ (Segen)`;
      }
      return `${bestWard}+`;
    }

    if (hasBlessing) {
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
                            ['unit', 'model', 'monster', 'creature', 'war machine', 'character', 'rider', 'mount'].includes(p.profileTypeName?.toLowerCase())
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
                      <>
                        <span className="debug-id-badge" title="Instanz-ID">inst:{selection.id}</span>
                        <span className="debug-id-badge" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
                      </>
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
                            {showDebugIds && <span className="debug-id-badge">{prof.id}</span>}
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
                                {showDebugIds && <span className="debug-id-badge">{rule.id}</span>}
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
                                          <>
                                            <span className="debug-id-badge" title="Instanz-ID">inst:{upgrade.id}</span>
                                            <span className="debug-id-badge" title="Definition-ID">def:{upgrade.resolved?.id}</span>
                                          </>
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
