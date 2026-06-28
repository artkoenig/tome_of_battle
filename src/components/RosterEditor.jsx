import React, { useEffect, useState } from 'react';
import { Save, Play, Trash2, Shield, AlertTriangle, Check, BookOpen } from 'lucide-react';
import { useRoster } from '../hooks/useRoster';
import { computeRosterCounts, getModifiedConstraintValue, calculateRosterCosts, resolveEntry, findEntryInSystem } from '../solver/validator';

import CategoryUnitAdder from './editor/CategoryUnitAdder';
import RosterSidebar from './editor/RosterSidebar';
import SelectionConfigurator from './editor/SelectionConfigurator';

export default function RosterEditor({ system, roster: initialRoster, onBack, onPlay }) {
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
    updateSubSelection,
    save
  } = useRoster(initialRoster, system);

  const [activeCatalogue, setActiveCatalogue] = useState(null);
  const [toast, setToast] = useState(null);

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

  const renderMiniProfile = (selection) => {
    const entryId = selection.entryLinkId || selection.selectionEntryId;
    const rawEntry = findEntryInSystem(system, entryId);
    const resolved = resolveEntry(system, rawEntry);
    if (!resolved || !resolved.profiles || resolved.profiles.length === 0) return null;

    const showPrefix = resolved.profiles.length > 1;

    return (
      <div className="mini-profiles-container" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {resolved.profiles.map(prof => {
          return (
            <div key={prof.id} className="mini-profile-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {showPrefix && (
                <span className="text-gold font-serif" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {prof.name}
                </span>
              )}
              <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '2px', width: '100%' }}>
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
            <span className="text-dim" style={{ fontSize: '0.9rem' }}>
              Punktegrenze: {roster.costLimit} {costTypeLabel === 'Pkt.' ? 'Punkte' : costTypeLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={save}>
              <Save size={18} /> Speichern
            </button>
            <button className="btn-primary" onClick={() => onPlay(roster)}>
              <Play size={18} /> In Spielmodus
            </button>
          </div>
        </div>

        {/* Selected Catalog Entry Stat Details */}
        {selectedCatalogEntry && (
          <div className="gothic-panel" style={{ borderStyle: 'solid', borderWidth: '1px', padding: '16px', marginBottom: '24px' }}>
            <div className="flex-between">
              <h3>{selectedCatalogEntry.name} - Statblock</h3>
              <button className="btn-sm" onClick={() => setSelectedCatalogEntry(null)}>Schließen</button>
            </div>
            
            {selectedCatalogEntry.profiles?.map(prof => (
              <div key={prof.id} style={{ marginTop: '12px' }}>
                <span className="font-serif text-gold" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {prof.name} ({prof.profileTypeName})
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
                <strong className="text-gold">{rule.name}:</strong> <span style={{ fontSize: '0.9rem', color: 'var(--text-parchment)' }}>{rule.description}</span>
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

                  // Skip rendering empty categories on desktop if they have no selections (cleaner look), but always render on mobile so users can add them inline!
                  if (selections.length === 0 && count === 0 && minVal === 0 && maxVal === Infinity && categoryErrors.length === 0) {
                    // Hidden on desktop only if it has no limits
                    // To keep mobile fully functional, we render it so they can add units!
                  }

                  return (
                    <div key={link.targetId} className="roster-category-group" style={{ marginBottom: '24px' }}>
                      <div className="roster-category-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 className="font-serif text-gold" style={{ margin: 0, border: 'none', padding: 0, fontSize: '1.15rem' }}>{catName}</h3>
                          {(() => {
                            const limitParts = [];
                            if (minVal > 0) limitParts.push(`Min: ${minVal}`);
                            if (maxVal < Infinity) limitParts.push(`Max: ${maxVal}`);
                            const limitText = limitParts.length > 0 ? `/ ${limitParts.join(', ')}` : '';
                            return (
                              <span className="badge font-sans" style={{ backgroundColor: categoryErrors.length > 0 ? 'var(--color-danger)' : 'rgba(226, 183, 66, 0.1)', color: categoryErrors.length > 0 ? 'white' : 'var(--text-gold)', fontSize: '0.8rem', padding: '2px 8px' }}>
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
                          {selections.map(selection => {
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
                                  style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}
                                  onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <div className="selection-node-title">
                                      <span className="selection-node-name" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selection.name}</span>
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
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  {renderMiniProfile(selection)}
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
                            style={{ cursor: 'pointer', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}
                            onClick={() => setSelectedRosterSelection(isUnitEditing ? null : selection)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              <div className="selection-node-title">
                                <span className="selection-node-name" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selection.name}</span>
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
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {renderMiniProfile(selection)}
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
                      <div key={idx} className="validation-error-item text-danger" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem' }}>
                        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                        <span>{err.message}</span>
                      </div>
                    ))}
                    {/* Secondary list of category & selection errors for full context */}
                    {validationErrors.filter(e => e.categoryId || e.selectionId).map((err, idx) => (
                      <div key={idx} className="validation-error-item text-danger" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', opacity: 0.8 }}>
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
    </div>
  );
}
