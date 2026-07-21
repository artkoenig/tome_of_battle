import React, { useState } from 'react';
import { Plus, Minus, ReceiptText } from 'lucide-react';
import {
  findEntryInSystem, resolveEntry, collectUnitProfilesAndRules, getSelectionTotalCost,
  getEffectiveSelectionName, isIndependentSubUnit, MODEL_COUNT_PROFILE_TYPES,
  groupProfilesByType, resolveCostLimitTypeId
} from '../../solver/validator';
import { UnitUpgradesChips, UnitRulesChips } from '../editor/UnitChips';
import { getProfileCellClassName } from '../profileCellClasses';

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
  getUnitCurrentWounds,
  handleAdjustWound,
  handleMouseEnter,
  handleMouseLeave,
  setSaveSummaryData,
  setSaveSummaryOpen,
  isSubUnit = false,
  onShowRule
}) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
    
    
    return isIndependentSubUnit(resolved);
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
    const className = getProfileCellClassName(modState);

    return (
      <td
        key={headerKey}
        className={className}
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

  const maxWounds = getMaxWounds(selection);
  const modelCount = getUnitModelCount(selection);
  const totalMaxWounds = modelCount * maxWounds;
  const currentWounds = getUnitCurrentWounds(selection.id, totalMaxWounds);
  const { groups } = getUnitProfilesAndRules(selection);
  const modelGroup = groups.find(g => g.isModel);
  const itemGroups = groups.filter(g => !g.isModel);

  const isDead = hasSubUnits ? false : (currentWounds === 0);
  const totalCost = getSelectionTotalCost(selection, resolveCostLimitTypeId(roster, system), 1, { system, roster, currentCatalogueId: roster.catalogueId });

  return (
    <div 
      className={`play-unit-card ${isDead ? 'unit-destroyed' : ''} ${isSubUnit ? 'play-unit-card--sub' : ''}`}
    >
      {isDead && (
        <div className="destroyed-overlay">
          <span className="destroyed-text">Vernichtet</span>
        </div>
      )}
      <div className="play-unit-header">
        <div className="play-unit-title text-ui-title">
          <div>
            {getEffectiveSelectionName(selection, { system, roster, currentCatalogueId: roster?.catalogueId })}
          </div>
          <div className="flex-row gap-8">
            {totalCost > 0 && (
              <div className="text-ui-title text-gold text-strong">
                {totalCost} Pkt.
              </div>
            )}
          </div>
        </div>

        <div className="flex-between">
          {/* Der Wundenzähler steht links im Kartenkopf, wo zuvor die AS/WS-Badges
              standen: er ist im Spiel das am häufigsten bediente Element. Der
              Platzhalter hält die Position auch bei Einheiten ohne eigenen Zähler
              (Untereinheiten führen ihn selbst), damit der Profil-Schalter rechts bleibt. */}
          {hasSubUnits ? (
            <div />
          ) : (
            <div className={`play-unit-header-controls${isDead ? ' play-unit-header-controls--dimmed' : ''}`}>
              {isDead && <span className="text-danger font-serif play-unit-destroyed-label">VERNICHTET</span>}
              <button
                className="qty-btn"
                onClick={() => handleAdjustWound(selection.id, -1, totalMaxWounds)}
                disabled={isDead}
              >
                <Minus size={12} />
              </button>
              <span className="font-body play-unit-wound-value">
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
          <div className="flex-row gap-8">
            {!isSubUnit && (modelGroup || itemGroups.length > 0) && (
              <button
                type="button"
                className={`square-btn unit-card-details-toggle ${isDetailsOpen ? 'is-active' : ''}`}
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                title={isDetailsOpen ? 'Profile ausblenden' : 'Profile anzeigen'}
                aria-expanded={isDetailsOpen}
              >
                <ReceiptText size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="play-unit-body">
        <div className="flex-col gap-8">
          <div className={`play-unit-profiles ${isDetailsOpen ? 'is-open' : ''}`}>
            {!isSubUnit && (
              <div>
                {modelGroup
                  ? renderProfileTable(modelGroup, 'model')
                  : <p className="text-dim text-label">Keine Profilwerte gefunden.</p>}
                {itemGroups.map((group, gIdx) => renderProfileTable(group, group.typeName || gIdx))}
              </div>
            )}
          </div>

          <div className="play-unit-chips">
            <UnitUpgradesChips
              selection={selection}
              system={system}
              activeCatalogueId={roster.catalogueId}
              roster={roster}
              handleMouseEnter={(title, text, e) => handleMouseEnter(e, title, text)}
              handleMouseMove={null}
              handleMouseLeave={handleMouseLeave}
              onClickDetails={(title, text) => {
                if (window.innerWidth <= 900) {
                  setSaveSummaryData({ title, breakdown: text });
                  setSaveSummaryOpen(true);
                }
              }}
              onShowRule={onShowRule}
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
                if (window.innerWidth <= 900) {
                  setSaveSummaryData({ title, breakdown: text });
                  setSaveSummaryOpen(true);
                }
              }}
              onShowRule={onShowRule}
            />
          </div>
          {hasSubUnits && (
            <div className="sub-units-container play-unit-sub-units">
              {independentSubUnits.map(subSel => (
                <PlayUnitDetails 
                  key={subSel.id}
                  selection={subSel}
                  system={system}
                  roster={roster}
                  getUnitCurrentWounds={getUnitCurrentWounds}
                  handleAdjustWound={handleAdjustWound}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setSaveSummaryData={setSaveSummaryData}
                  setSaveSummaryOpen={setSaveSummaryOpen}
                  isSubUnit={true}
                  onShowRule={onShowRule}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
