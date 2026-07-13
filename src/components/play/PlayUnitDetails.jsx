import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { findEntryInSystem, resolveEntry, collectUnitProfilesAndRules, getSelectionTotalCost } from '../../solver/validator';
import { MODEL_COUNT_PROFILE_TYPES } from '../../solver/constants';
import {
  getArmourSave as getArmourSaveLogic,
  getWardSave as getWardSaveLogic,
  groupProfilesByType,
  hasBlessing
} from '../../solver/rulesEvaluator';
import { UnitUpgradesChips, UnitRulesChips } from '../editor/UnitChips';

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
  setSaveSummaryOpen,
  isSubUnit = false
}) {


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

  const independentSubUnits = (selection.selections || []).filter(subSel => {
    const entryId = subSel.entryLinkId || subSel.selectionEntryId;
    const entry = findEntryInSystem(system, entryId, roster?.catalogueId);
    const resolved = resolveEntry(system, entry, roster?.catalogueId);
    
    const hasEntryChildren = (entryNode) => {
      if (!entryNode) return false;
      return (entryNode.selectionEntries && entryNode.selectionEntries.length > 0) ||
             (entryNode.entryLinks && entryNode.entryLinks.length > 0) ||
             (entryNode.selectionEntryGroups && entryNode.selectionEntryGroups.length > 0);
    };
    
    return resolved && (resolved.type === 'unit' || resolved.type === 'model') && (resolved.collective === false || resolved.collective === 'false') && hasEntryChildren(resolved);
  });

  const hasSubUnits = independentSubUnits.length > 0;

  // Helper to get unit profiles, grouped generically by profile type name.
  const getUnitProfilesAndRules = (sel) => {
    const { profiles, rules } = collectUnitProfilesAndRules(system, sel, roster.catalogueId, roster);
    return { groups: groupProfilesByType(profiles), rules };
  };

  const renderProfileCell = (c, headerKey) => {
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
  };

  const renderProfileTable = (group, key) => {
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

    const showNameCol = isModel ? profiles.length > 1 : true;
    const nameHeader = isModel ? 'Modell' : (typeName || 'Profil');

    return (
      <div key={key} className="profile-table-container">
        <table className="profile-table">
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
                {headers.map(h => renderProfileCell(prof.characteristics?.find(char => char.name === h), h))}
              </tr>
            ))}
          </tbody>
        </table>
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
  const { groups, rules } = getUnitProfilesAndRules(selection);
  const modelGroup = groups.find(g => g.isModel);
  const itemGroups = groups.filter(g => !g.isModel);


  const asInfo = getArmourSaveInfo(selection);
  const wsInfo = getWardSaveInfo(selection);
  
  const isDead = hasSubUnits ? false : (currentWounds === 0);

  return (
    <div 
      className={`play-unit-card ${isDead ? 'unit-destroyed' : ''}`}
      style={isSubUnit ? { border: '1px solid rgba(226, 183, 66, 0.2)', backgroundColor: 'rgba(0,0,0,0.2)', boxShadow: 'none' } : {}}
    >
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
            {getSelectionTotalCost(selection, roster.costLimitType || 'pts', 1, system, roster, roster.catalogueId)} Pkt.
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
          
          {!hasSubUnits && (
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
          )}
        </div>
      </div>

      <div className="play-unit-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!isSubUnit && (
            <div>
              {modelGroup
                ? renderProfileTable(modelGroup, 'model')
                : <p className="text-dim text-label">Keine Profilwerte gefunden.</p>}
              {itemGroups.map((group, gIdx) => renderProfileTable(group, group.typeName || gIdx))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
            <UnitUpgradesChips
              selection={selection}
              system={system}
              activeCatalogueId={roster.catalogueId}
              roster={roster}
              handleMouseEnter={(title, text, e) => handleMouseEnter(e, title, text)}
              handleMouseMove={null}
              handleMouseLeave={handleMouseLeave}
              onClickDetails={(title, text) => {
                setSaveSummaryData({ title, breakdown: text });
                setSaveSummaryOpen(true);
              }}
              showDebugIds={showDebugIds}
            />
            <UnitRulesChips
              selection={selection}
              system={system}
              activeCatalogueId={roster.catalogueId}
              roster={roster}
              handleMouseEnter={(title, text, e) => handleMouseEnter(e, title, text)}
              handleMouseMove={null}
              handleMouseLeave={handleMouseLeave}
              onClickDetails={(title, text) => {
                setSaveSummaryData({ title, breakdown: text });
                setSaveSummaryOpen(true);
              }}
              showDebugIds={showDebugIds}
            />
          </div>
          {hasSubUnits && (
            <div className="sub-units-container" style={{ paddingLeft: '12px', borderLeft: '2px solid rgba(226, 183, 66, 0.2)', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {independentSubUnits.map(subSel => (
                <PlayUnitDetails 
                  key={subSel.id}
                  selection={subSel}
                  system={system}
                  roster={roster}
                  showDebugIds={showDebugIds}
                  gameState={gameState}
                  handleAdjustWound={handleAdjustWound}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setSaveSummaryData={setSaveSummaryData}
                  setSaveSummaryOpen={setSaveSummaryOpen}
                  isSubUnit={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
