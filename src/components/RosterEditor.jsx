import React, { useEffect, useState } from 'react';
import { Save, Play, Trash2, AlertTriangle, Check, Copy } from 'lucide-react';
import { useRoster } from '../hooks/useRoster';
import { useDebugMode } from '../hooks/DebugContext';
import { computeRosterCounts, getModifiedConstraintValue, calculateRosterCosts, resolveEntry, findEntryInSystem, collectUnitProfilesAndRules, getSelectionTotalCost } from '../solver/validator';
import { UPGRADE_DETAILS_KEYWORDS, MODEL_COUNT_PROFILE_TYPES } from '../solver/constants';

import CategoryUnitAdder from './editor/CategoryUnitAdder';
import RosterSidebar from './editor/RosterSidebar';
import SelectionConfigurator from './editor/SelectionConfigurator';

export default function RosterEditor({ system, roster: initialRoster, onBack, onPlay }) {
  const { showDebugIds } = useDebugMode();
  const {
    roster,
    costs,
    validationErrors,
    selectedRosterSelection,
    setSelectedRosterSelection,
    selectedCatalogEntry,
    setSelectedCatalogEntry,
    addUnit,
    removeUnit,
    copyUnit,
    updateSubSelection,
    save
  } = useRoster(initialRoster, system);

  const [activeCatalogue, setActiveCatalogue] = useState(null);
  const [toast, setToast] = useState(null);
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
        if (UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) {
          const stats = p.characteristics.map(c => `${c.name}: ${c.value}`).join(', ');
          descriptions.push(`${p.name} (${stats})`);
        }
      });
    }
    return descriptions.join(' | ');
  };

  const costType = system?.costTypes?.find(ct => ct.id === roster?.costLimitType);
  const costTypeLabel = costType 
    ? (costType.name.toLowerCase() === 'pts' ? 'Pkt.' : costType.name)
    : 'Pkt.';

  const currentPoints = costs[roster.costLimitType] || 0;
  const limitPoints = roster.costLimit || 0;
  const generalErrors = validationErrors.filter(e => !e.categoryId && !e.selectionId);
  const isRosterValid = validationErrors.length === 0;

  // Resolve active catalogue definition
  useEffect(() => {
    if (system && roster) {
      const cat = system.catalogues.find(c => c.id === roster.catalogueId);
      setActiveCatalogue(cat);
    }
  }, [system, roster]);

  const handleUnitAddedToast = (unitName) => {
    setToast(`${unitName} zur Streitmacht hinzugefügt!`);
    setTimeout(() => {
      setToast(null);
    }, 1800);
  };

  const scrollToErrors = () => {
    const el = document.getElementById('general-errors-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const hasPrimaryCatalogItems = (catId, force) => {
    const activeCatalogue = system.catalogues?.find(c => c.id === force.catalogueId);
    if (!activeCatalogue) return false;

    const checkEntry = (entry) => {
      const resolved = resolveEntry(system, entry);
      if (!resolved) return false;
      return (resolved.categoryLinks?.some(link => link.targetId === catId && link.primary) ||
             entry.categoryLinks?.some(link => link.targetId === catId && link.primary));
    };

    return activeCatalogue.selectionEntries?.some(checkEntry) ||
           activeCatalogue.entryLinks?.some(checkEntry) ||
           activeCatalogue.sharedSelectionEntries?.some(checkEntry);
  };

  const renderMiniProfile = (selection) => {
    const { profiles } = collectUnitProfilesAndRules(system, selection, activeCatalogue?.id);
    
    // Filter profiles to keep only the actual model/unit profiles (ignore weapons/magic items here)
    const unitProfiles = profiles.filter(p => {
      const typeLower = p.profileTypeName?.toLowerCase() || '';
      return MODEL_COUNT_PROFILE_TYPES.some(t => typeLower.includes(t)) || typeLower === 'profile';
    });

    if (!unitProfiles || unitProfiles.length === 0) return null;

    const showPrefix = unitProfiles.length > 1;

    return (
      <div className="mini-profiles-container" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', paddingRight: '24px' }}>
        {unitProfiles.map(prof => {
          return (
            <div key={prof.id} className="mini-profile-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {showPrefix && (
                <span className="text-gold font-serif" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {prof.name}
                </span>
              )}
              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '2px', width: '100%', maxWidth: '360px' }}>
                {prof.characteristics.map(c => (
                  <div 
                    key={c.name} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      background: 'rgba(226, 183, 66, 0.04)', 
                      border: '1px solid var(--border-dark)', 
                      borderRadius: '3px',
                      minWidth: '28px',
                      padding: '2px 4px',
                      flex: 1
                    }}
                  >
                    <span className="text-gold font-sans" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>
                      {c.name}
                    </span>
                    <span className="font-sans" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-parchment)', marginTop: '1px' }}>
                      {c.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getSelectedUpgrades = (selection) => {
    const list = [];
    const collect = (sel) => {
      if (!sel.selections) return;
      sel.selections.forEach(subSel => {
        const entryId = subSel.entryLinkId || subSel.selectionEntryId;
        const entry = findEntryInSystem(system, entryId, activeCatalogue?.id);
        const resolved = resolveEntry(system, entry, activeCatalogue?.id);
        if (resolved) {
          list.push({
            id: subSel.id,
            name: subSel.name,
            number: subSel.number || 1,
            resolved: resolved
          });
        }
        collect(subSel);
      });
    };
    collect(selection);
    return list;
  };

  const renderUnitUpgrades = (selection) => {
    const selectedUpgrades = getSelectedUpgrades(selection);
    if (selectedUpgrades.length === 0) return null;

    return (
      <div 
        className="unit-header-upgrades" 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '6px', 
          marginTop: '4px',
          marginBottom: '2px',
          width: '100%',
          paddingRight: '24px'
        }}
      >
        {selectedUpgrades.map(upgrade => {
          const descText = getUpgradeDescription(upgrade.resolved);
          return (
            <span 
              key={upgrade.id}
              style={{
                fontSize: '0.72rem',
                backgroundColor: 'rgba(226, 183, 66, 0.06)',
                border: '1px solid rgba(226, 183, 66, 0.22)',
                color: 'var(--text-parchment)',
                padding: '2px 6px',
                borderRadius: '3px',
                fontFamily: 'var(--font-sans)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: descText ? 'help' : 'default'
              }}
              onMouseEnter={(e) => descText && handleMouseEnter(upgrade.name, descText, e)}
              onMouseMove={descText ? handleMouseMove : null}
              onMouseLeave={descText ? handleMouseLeave : null}
            >
              {upgrade.number > 1 && (
                <span style={{ color: 'var(--text-gold)', fontWeight: 700 }}>
                  {upgrade.number}x
                </span>
              )}
              <span style={{ opacity: 0.9 }}>{upgrade.name}</span>
              {showDebugIds && (
                <span className="debug-id-badge clickable" style={{ margin: 0, padding: '0 2px', fontSize: '0.6rem' }}>
                  def:{upgrade.resolved?.id}
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="builder-layout">
      {/* 1. Mobile Sticky Status & Validation Header */}
      <div className="mobile-sticky-status-bar" onClick={scrollToErrors}>
        <div className="mobile-status-summary">
          <span className="font-serif text-gold" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            STATUS:
          </span>
          {isRosterValid ? (
            <span className="badge badge-success font-sans" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Check size={12} /> BEREIT
            </span>
          ) : (
            <span className="badge badge-danger font-sans" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={12} /> {validationErrors.length} FEHLER
            </span>
          )}
        </div>
        <div className="mobile-points-indicator">
          <span className="font-sans font-bold" style={{ fontSize: '0.85rem' }}>
            {currentPoints} / {limitPoints} {costTypeLabel}
          </span>
          <div className="points-progress-bar">
            <div 
              className={`points-progress-fill ${currentPoints > limitPoints ? 'overflow' : ''}`}
              style={{ width: `${Math.min(100, (currentPoints / (limitPoints || 1)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Main Editing Roster Pane */}
      <div className="builder-main active-mobile-tab">
        <div className="roster-header-editor">
          <div>
            <h2 style={{ margin: 0, border: 'none', padding: 0 }}>{roster.name}</h2>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={save}>
              <Save size={18} /> Speichern
            </button>
            <button className="btn-primary" onClick={() => onPlay(roster)}>
              <Play size={18} /> Spielmodus
            </button>
          </div>
        </div>

        {/* Selected Catalog Entry Stat Details */}
        {selectedCatalogEntry && (
          <div className="gothic-panel" style={{ borderStyle: 'solid', borderWidth: '1px', padding: '16px', marginBottom: '24px' }}>
            <div className="flex-between">
              <h3>
                {selectedCatalogEntry.name}
                {showDebugIds && <span className="debug-id-badge clickable">{selectedCatalogEntry.id}</span>}
                {' '} - Statblock
              </h3>
              <button className="btn-sm" onClick={() => setSelectedCatalogEntry(null)}>Schließen</button>
            </div>
            
            {selectedCatalogEntry.profiles?.map(prof => (
              <div key={prof.id} style={{ marginTop: '12px' }}>
                <span className="font-serif text-gold" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
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
            ))}

            {selectedCatalogEntry.rules?.map(rule => (
              <div key={rule.id} style={{ marginTop: '8px' }}>
                <strong className="text-gold">
                  {rule.name}
                  {showDebugIds && <span className="debug-id-badge clickable">{rule.id}</span>}
                  :
                </strong> <span style={{ fontSize: '0.9rem', color: 'var(--text-parchment)' }}>{rule.description}</span>
              </div>
            ))}
          </div>
        )}

        {/* Selected Selections on Roster grouped by category links */}
        {roster.forces.map(force => {
          const forceDef = system.forceEntries?.find(fe => fe.id === force.forceEntryId);
          const categoryLinks = forceDef?.categoryLinks || [];
          const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
          const forceCategoryCounts = categoryCounts[force.id] || {};

          const matchedCategoryIds = new Set(categoryLinks.map(l => l.targetId));
          const uncategorizedSelections = force.selections?.filter(s => !matchedCategoryIds.has(s.category)) || [];

          return (
            <div key={force.id} className="force-editor-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {categoryLinks.map(link => {
                  const catDef = system.categoryEntries?.find(ce => ce.id === link.targetId);
                  const catName = catDef ? catDef.name : link.name;
                  const selections = force.selections?.filter(s => s.category === link.targetId) || [];
                  const categoryErrors = validationErrors.filter(e => e.categoryId === link.targetId);
                  const count = forceCategoryCounts[link.targetId] || 0;

                  const minConstraint = link.constraints?.find(c => c.type === 'min');
                  const maxConstraint = link.constraints?.find(c => c.type === 'max');
                  const minVal = minConstraint ? getModifiedConstraintValue(minConstraint, link.modifiers, roster, selectionCounts, forceCategoryCounts) : 0;
                  const maxVal = maxConstraint ? getModifiedConstraintValue(maxConstraint, link.modifiers, roster, selectionCounts, forceCategoryCounts) : Infinity;

                  const isPrimaryForAny = hasPrimaryCatalogItems(link.targetId, force);

                  // Completely hide category groups that are not primary for any unit and have no current selections,
                  // as these are secondary rule tags (like "Characters") rather than functional UI slots.
                  if (selections.length === 0 && !isPrimaryForAny) {
                    return null;
                  }

                  // Skip rendering empty categories on desktop if they have no selections (cleaner look), but always render on mobile so users can add them inline!
                  if (selections.length === 0 && count === 0 && minVal === 0 && maxVal === Infinity && categoryErrors.length === 0) {
                    // Hidden on desktop only if it has no limits
                    // To keep mobile fully functional, we render it so they can add units!
                  }

                  return (
                    <div key={link.targetId} className="roster-category-group" style={{ marginBottom: '24px' }}>
                      <div className="roster-category-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 className="font-serif text-gold" style={{ margin: 0, border: 'none', padding: 0, fontSize: '1.15rem' }}>
                            {catName}
                            {showDebugIds && (
                              <>
                                <span className="debug-id-badge clickable" title="Definition-ID (Kategorie)">def:{link.targetId}</span>
                                {link.id && <span className="debug-id-badge clickable" title="Link-ID (Limits)">link:{link.id}</span>}
                              </>
                            )}
                          </h3>
                          {(() => {
                            const limitParts = [];
                            if (minVal > 0) limitParts.push(`Min: ${minVal}`);
                            if (maxVal < Infinity) limitParts.push(`Max: ${maxVal}`);
                            const limitText = limitParts.length > 0 ? `/ ${limitParts.join(', ')}` : '';
                            return (
                              <span 
                                className={categoryErrors.length > 0 ? "badge badge-danger font-sans" : "badge font-sans"} 
                                style={{ 
                                  fontSize: '0.8rem', 
                                  padding: '2px 8px',
                                  ...(categoryErrors.length > 0 ? {} : {
                                    backgroundColor: 'rgba(226, 183, 66, 0.05)',
                                    border: '1px solid rgba(226, 183, 66, 0.2)',
                                    color: 'var(--text-gold)'
                                  })
                                }}
                              >
                                {count} {limitText}
                              </span>
                            );
                          })()}
                        </div>
                        <CategoryUnitAdder
                          categoryId={link.targetId}
                          categoryName={catName}
                          system={system}
                          activeCatalogue={activeCatalogue}
                          costTypeLabel={costTypeLabel}
                          costLimitType={roster.costLimitType}
                          addUnit={addUnit}
                          onUnitAdded={handleUnitAddedToast}
                        />
                      </div>

                      {categoryErrors.map((err, idx) => (
                        <div key={idx} className="category-error-alert text-danger font-sans" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', marginBottom: '8px', padding: '6px 10px', background: 'rgba(166,28,28,0.06)', borderRadius: '3px', border: '1px solid var(--color-danger)' }}>
                          <AlertTriangle size={14} />
                          <span>{err.message}</span>
                        </div>
                      ))}

                      {selections.length === 0 ? (
                        <div className="text-dim font-serif" style={{ fontSize: '0.85rem', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
                          Keine Auswahlen vorhanden
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {selections
                            .slice()
                            .sort((a, b) => {
                              const costType = roster.costLimitType || 'pts';
                              const aPoints = getSelectionTotalCost(a, costType);
                              const bPoints = getSelectionTotalCost(b, costType);
                              return bPoints - aPoints; // Descending
                            })
                            .map(selection => {
                            const isUnitEditing = selectedRosterSelection?.id === selection.id;
                            const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
                            const displayPoints = unitCosts[roster.costLimitType] || 0;
                            const hasSelectionError = validationErrors.some(e => e.selectionId === selection.id);
                            const selectionErrors = validationErrors.filter(e => e.selectionId === selection.id);

                            return (
                              <div 
                                key={selection.id} 
                                className={`selection-node ${hasSelectionError ? 'has-error' : ''}`}
                              >
                                <div 
                                  className="selection-node-header"
                                  style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
                                  onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <div className="selection-node-title">
                                      <span className="selection-node-name" style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                                        {selection.name}
                                        {showDebugIds && (
                                          <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="selection-node-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <span className="selection-node-cost font-sans">
                                        {displayPoints} {costTypeLabel}
                                      </span>
                                      <button 
                                        type="button"
                                        className="btn-danger btn-sm" 
                                        style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                                  <button 
                                    type="button"
                                    className="btn-primary btn-sm" 
                                    style={{
                                      position: 'absolute',
                                      bottom: '12px',
                                      right: '14px',
                                      padding: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 10
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyUnit(selection.id);
                                    }}
                                    title="Kopieren"
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>

                                {selectionErrors.map((err, idx) => (
                                  <div key={idx} className="unit-error-alert text-danger font-sans" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(166,28,28,0.04)', borderBottom: '1px solid rgba(166,28,28,0.2)' }}>
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
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* Uncategorized Selections (Fallback) */}
              {uncategorizedSelections.length > 0 && (
                <div className="roster-category-group" style={{ marginBottom: '24px' }}>
                  <h3 className="font-serif text-gold" style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px', fontSize: '1.15rem' }}>Sonstiges</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {uncategorizedSelections.map(selection => {
                      const isUnitEditing = selectedRosterSelection?.id === selection.id;
                      const unitCosts = calculateRosterCosts({ forces: [{ selections: [selection] }] }, system);
                      const displayPoints = unitCosts[roster.costLimitType] || 0;

                      return (
                        <div key={selection.id} className="selection-node">
                          <div 
                            className="selection-node-header"
                            style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
                            onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              <div className="selection-node-title">
                                <span className="selection-node-name" style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                                  {selection.name}
                                  {showDebugIds && (
                                    <span className="debug-id-badge clickable" title="Definition-ID">def:{selection.entryLinkId || selection.selectionEntryId}</span>
                                  )}
                                </span>
                              </div>
                              <div className="selection-node-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span className="selection-node-cost font-sans">
                                  {displayPoints} {costTypeLabel}
                                </span>
                                <button 
                                  type="button"
                                  className="btn-danger btn-sm" 
                                  style={{ padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeUnit(selection.id);
                                  }}
                                  title="Löschen"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {renderMiniProfile(selection)}
                            {renderUnitUpgrades(selection)}
                            <button 
                              type="button"
                              className="btn-primary btn-sm" 
                              style={{
                                position: 'absolute',
                                bottom: '12px',
                                right: '14px',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyUnit(selection.id);
                              }}
                              title="Kopieren"
                            >
                              <Copy size={14} />
                            </button>
                          </div>

                          {isUnitEditing && (
                            <SelectionConfigurator
                              selection={selection}
                              system={system}
                              roster={roster}
                              updateSubSelection={updateSubSelection}
                              costTypeLabel={costTypeLabel}
                              activeCatalogue={activeCatalogue}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Centralized General Errors & Validation Summary Panel */}
              <div id="general-errors-section" className="gothic-panel general-errors-panel" style={{ padding: '20px', marginTop: '12px', borderStyle: 'solid', borderWidth: '1px', borderColor: isRosterValid ? 'var(--color-success)' : 'var(--color-danger)' }}>
                <h3 className="font-serif text-gold" style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px' }}>Lagerbericht (Gesamtstatus)</h3>
                
                {isRosterValid ? (
                  <div className="text-success font-serif" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 600 }}>
                    <Check size={20} />
                    <span>Streitmacht ist regelkonform und bereit für die Schlacht!</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {generalErrors.map((err, idx) => (
                      <div key={idx} className="validation-error-item text-danger font-sans" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem' }}>
                        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                        <span>{err.message}</span>
                      </div>
                    ))}
                    {/* Secondary list of category & selection errors for full context */}
                    {validationErrors.filter(e => e.categoryId || e.selectionId).map((err, idx) => (
                      <div key={idx} className="validation-error-item text-danger font-sans" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', opacity: 0.8 }}>
                        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Desktop-only Validation Summary Sidebar */}
      <RosterSidebar
        roster={roster}
        system={system}
        costs={costs}
        validationErrors={validationErrors}
        costTypeLabel={costTypeLabel}
        className="desktop-only-sidebar"
      />

      {/* 5. Floating Toast Notification */}
      {toast && (
        <div className="gothic-toast">
          <span>{toast}</span>
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
    </div>
  );
}
