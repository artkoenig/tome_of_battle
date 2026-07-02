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
import { groupProfilesByType } from '../../solver/rulesEvaluator';

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

  const openStatblock = (sel) => {
    const rawEntry = findEntryInSystem(system, sel.entryLinkId || sel.selectionEntryId, activeCatalogue?.id);
    const resolved = resolveEntry(system, rawEntry, activeCatalogue?.id);
    if (resolved) {
      setSelectedCatalogEntry(resolved);
    }
  };

  const renderProfileCell = (c, headerKey, sel) => {
    if (!c) return <td key={headerKey} className="font-body">-</td>;

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
        key={headerKey}
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
            openStatblock(sel);
          }
        }}
      >
        {c.value}
      </td>
    );
  };

  const renderProfileTable = (group, sel, key) => {
    const { typeName, profiles, isModel } = group;
    if (!profiles || profiles.length === 0) return null;

    const headers = [];
    profiles.forEach(prof => {
      prof.characteristics?.forEach(c => {
        if (c.name && !headers.includes(c.name)) {
          headers.push(c.name);
        }
      });
    });

    // The model stat block keeps its historical look: no leading name column
    // unless several models share the table. Every other profile type gets a
    // leading column labelled with its own profileTypeName.
    const showNameCol = isModel ? profiles.length > 1 : true;
    const nameHeader = isModel ? 'Modell' : (typeName || 'Profil');

    return (
      <table key={key} className="mini-profile-table">
        <thead>
          <tr>
            {showNameCol && <th>{nameHeader}</th>}
            {headers.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map((prof, pIdx) => (
            <tr key={prof.id || pIdx}>
              {showNameCol && (
                <td className="font-body">
                  {prof.name}
                </td>
              )}
              {headers.map(h => renderProfileCell(prof.characteristics?.find(char => char.name === h), h, sel))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderMiniProfile = (sel) => {
    const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id, roster);
    const groups = groupProfilesByType(profiles);
    if (groups.length === 0) return null;

    return (
      <div
        className="mini-profile clickable"
        onClick={(e) => {
          e.stopPropagation();
          openStatblock(sel);
        }}
        title="Statblock anzeigen"
      >
        {groups.map((group, gIdx) => renderProfileTable(group, sel, group.typeName || gIdx))}
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

  // Returns the upgrades that should actually be shown as chips: the selected
  // upgrades minus anything already rendered as its own profile table (kept only
  // when the item still carries lore). Shared by the upgrade and rule renderers
  // so the rule list can drop chips that a visible upgrade already represents.
  const getVisibleUpgrades = (sel) => {
    const { profiles } = collectUnitProfilesAndRules(system, sel, activeCatalogue?.id, roster);
    const tableProfiles = groupProfilesByType(profiles).filter(g => !g.isModel).flatMap(g => g.profiles);
    const tableSelectionIds = new Set(
      tableProfiles.map(p => p._sourceSelection?.id).filter(Boolean)
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

    // Keep a chip when the item carries lore (a rule description) even if its
    // profile is shown in a table, so the descriptive text stays reachable.
    const hasLore = (res) => {
      if (!res) return false;
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
        if (foundRule) rules = [foundRule];
      }
      return rules.some(r => r.description && r.description.trim());
    };

    // An upgrade carries information of its own when it costs something, brings a
    // profile, or has a rule description. Cost is checked across every cost type
    // (points, casting dice, …), so e.g. a "Level 3 Shaman" priced only in dice
    // still counts as informative.
    const hasOwnValue = (res) => {
      if (!res) return false;
      const hasCost = (res.costs || []).some(c => Math.abs(parseFloat(c.value) || 0) > 0);
      const hasProfile = (res.profiles || []).length > 0;
      return hasCost || hasProfile || hasLore(res);
    };

    // A "wrapper" upgrade only groups child options (e.g. "Magic Items", "Show
    // Spells"): it has selectable children but no cost/profile/rule of its own.
    // Those children are already shown as their own chips, so the wrapper label
    // itself is pure noise and gets dropped. Purely structural — no name match.
    const isEmptyWrapper = (res) => {
      if (!res || hasOwnValue(res)) return false;
      const childCount = (res.selectionEntries?.length || 0) +
                         (res.entryLinks?.length || 0) +
                         (res.selectionEntryGroups?.length || 0);
      return childCount > 0;
    };

    return getSelectedUpgrades(sel).filter(upgrade => {
      const res = upgrade.resolved;
      if (isEmptyWrapper(res)) return false;
      const name = upgrade.name || res?.name;
      const inTable = tableSelectionIds.has(upgrade.id) ||
                      (name && tableProfiles.some(p => isNameMatch(name, p.name)));
      if (!inTable) return true;
      return hasLore(res);
    });
  };

  const renderUnitUpgrades = (sel) => {
    // Non-model profiles are already rendered as their own tables, so those
    // items are removed from the chip list to avoid duplicating the values.
    const selectedUpgrades = getVisibleUpgrades(sel);
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

    // Magic items, virtues and marks are shown as an equipment chip whose
    // tooltip already carries the granted rule's text. When a collected rule
    // shares that item's name it would render as a second, identical chip, so
    // drop it here — the information stays reachable through the upgrade chip.
    const normalizeChipName = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const upgradeChipNames = new Set(
      getVisibleUpgrades(sel).map(u => normalizeChipName(u.name || u.resolved?.name)).filter(Boolean)
    );
    const visibleRules = rules.filter(rule => !upgradeChipNames.has(normalizeChipName(rule.name)));
    if (visibleRules.length === 0) return null;

    return (
      <div className="unit-header-rules">
        {visibleRules.map((rule, rIdx) => {
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
