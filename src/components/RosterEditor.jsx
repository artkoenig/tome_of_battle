import React, { useEffect, useState } from 'react';
import { Play, AlertTriangle, Check, ArrowLeft } from 'lucide-react';
import { useRoster } from '../hooks/useRoster';
import { saveRoster } from '../db/database';
import { useDebugMode } from '../hooks/DebugContext';
import { computeRosterCounts, getModifiedConstraintValue, resolveEntry, findForceEntryById, isCategoryLinkHidden, getExtraResourceTotals } from '../solver/validator';

import CategoryUnitAdder from './editor/CategoryUnitAdder';
import RosterSidebar from './editor/RosterSidebar';
import UnitSelectionCard from './editor/UnitSelectionCard';


export default function RosterEditor({ system, roster: initialRoster, onBack, onPlay }) {
  const { showDebugIds } = useDebugMode();
  const {
    roster,
    costs,
    validationErrors,
    selectedRosterSelection,
    setSelectedRosterSelection,
    addUnit,
    removeUnit,
    copyUnit,
    updateSubSelection
  } = useRoster(initialRoster, system, saveRoster);

  const [activeCatalogue, setActiveCatalogue] = useState(null);
  const [toast, _setToast] = useState(null);



  const costType = system?.costTypes?.find(ct => ct.id === roster?.costLimitType);
  const rawLabel = costType?.name || 'Pkt.';
  const costTypeLabel = (rawLabel.toLowerCase() === 'pts' || rawLabel.toLowerCase() === 'punkte' || rawLabel.toLowerCase() === 'points') ? 'Pkt.' : rawLabel;

  const currentPoints = costs[roster.costLimitType] || 0;
  const limitPoints = roster.costLimit || 0;
  const generalErrors = validationErrors.filter(e => !e.categoryId && !e.selectionId);
  const isRosterValid = validationErrors.length === 0;
  const extraResources = getExtraResourceTotals(system, roster, costs);

  // Resolve active catalogue definition
  useEffect(() => {
    if (system && roster) {
      const cat = system.catalogues.find(c => c.id === roster.catalogueId);
      setActiveCatalogue(cat);
    }
  }, [system, roster]);


  const hasPrimaryCatalogItems = (catId, force) => {
    const activeCatalogue = system.catalogues?.find(c => c.id === force.catalogueId);
    if (!activeCatalogue) return false;

    const checkEntry = (entry) => {
      const resolved = resolveEntry(system, entry, activeCatalogue?.id);
      if (!resolved) return false;
      return (resolved.categoryLinks?.some(link => link.targetId === catId && link.primary) ||
             entry.categoryLinks?.some(link => link.targetId === catId && link.primary));
    };

    return activeCatalogue.selectionEntries?.some(checkEntry) ||
           activeCatalogue.entryLinks?.some(checkEntry) ||
           activeCatalogue.sharedSelectionEntries?.some(checkEntry);
  };

  


  


  return (
    <div className="builder-layout-container">
      {/* 1. Builder Top Bar */}
      <div className="builder-top-bar">
        <div className="builder-top-bar-left">
          <button 
            type="button" 
            className="btn-primary square-btn mobile-only" 
            onClick={onBack}
            title="Heerlager"
          >
            <ArrowLeft size={16} /> <span className="hide-on-mobile">Heerlager</span>
          </button>
          
          <div className="builder-top-bar-title-section">
            <h2 className="builder-top-bar-title">{roster.name}</h2>
            <span className="builder-top-bar-subtitle">
              <span className="hide-on-mobile">{system.name} {activeCatalogue ? '· ' : ''}</span>
              {(() => {
                const forceEntryId = roster.forces?.[0]?.forceEntryId;
                const forceDef = findForceEntryById(system, forceEntryId);
                const suffix = forceDef ? ` (${forceDef.name})` : '';
                return activeCatalogue ? `${activeCatalogue.name}${suffix}` : '';
              })()}
            </span>
          </div>
        </div>
        
        <div className="builder-top-bar-right">
          {/* Points limit indicator */}
          <div className="mobile-points-indicator mobile-only" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <span className="points-display text-subheading">
              {currentPoints} / {limitPoints}
            </span>
            <span className="builder-top-bar-subtitle">
              {costTypeLabel}
            </span>
          </div>

          <button className="btn-primary hide-on-mobile" onClick={() => onPlay(roster)} style={{ padding: '6px 12px' }}>
            <Play size={16} /> <span>Spielmodus</span>
          </button>
        </div>
      </div>

      <div className="builder-layout">
        <div className="builder-main active-mobile-tab">
        {/* Selected Selections on Roster grouped by category links */}
        {roster.forces.map(force => {
          const forceDef = findForceEntryById(system, force.forceEntryId);
          const categoryLinks = forceDef?.categoryLinks || [];
          const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
          const forceCategoryCounts = categoryCounts[force.id] || {};

          const matchedCategoryIds = new Set(categoryLinks.map(l => l.targetId));
          const uncategorizedSelections = force.selections?.filter(s => !matchedCategoryIds.has(s.category)) || [];

          return (
            <div key={force.id} className="force-editor-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {categoryLinks.map(link => {
                  const isHidden = isCategoryLinkHidden(link, system, roster, selectionCounts, forceCategoryCounts);
                  const selections = force.selections?.filter(s => s.category === link.targetId) || [];

                  // If category link is hidden and has no selections, do not render it
                  if (isHidden && selections.length === 0) {
                    return null;
                  }

                  const catDef = system.categoryEntries?.find(ce => ce.id === link.targetId);
                  const catName = catDef ? catDef.name : link.name;
                  const categoryErrors = validationErrors.filter(e => e.categoryId === link.targetId);
                  const count = forceCategoryCounts[link.targetId] || 0;

                  const displayCtx = { roster, system, selectionCounts, forceCategoryCounts };
                  const minConstraint = link.constraints?.find(c => c.type === 'min');
                  const maxConstraint = link.constraints?.find(c => c.type === 'max');
                  const minVal = minConstraint ? getModifiedConstraintValue(minConstraint, link.modifiers, displayCtx) : 0;
                  const maxVal = maxConstraint ? getModifiedConstraintValue(maxConstraint, link.modifiers, displayCtx) : Infinity;

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
                          <h3 className="text-subheading" style={{ margin: 0, border: 'none', padding: 0 }}>
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
                                className={categoryErrors.length > 0 ? "badge badge-danger" : "badge badge-muted"}
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
                          roster={roster}
                          selectionCounts={selectionCounts}
                        />
                      </div>


                      {selections.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {selections
                            .map(selection => {
                            return (
                              <UnitSelectionCard
                                key={selection.id}
                                selection={selection}
                                selectedRosterSelection={selectedRosterSelection}
                                setSelectedRosterSelection={setSelectedRosterSelection}
                                roster={roster}
                                system={system}
                                validationErrors={validationErrors}
                                costTypeLabel={costTypeLabel}
                                removeUnit={removeUnit}
                                copyUnit={copyUnit}
                                updateSubSelection={updateSubSelection}
                                activeCatalogue={activeCatalogue}
                              />
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
                  <h3 className="text-subheading" style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px' }}>Sonstiges</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {uncategorizedSelections.map(selection => {
                      return (
                              <UnitSelectionCard
                                key={selection.id}
                                selection={selection}
                                selectedRosterSelection={selectedRosterSelection}
                                setSelectedRosterSelection={setSelectedRosterSelection}
                                roster={roster}
                                system={system}
                                validationErrors={validationErrors}
                                costTypeLabel={costTypeLabel}
                                removeUnit={removeUnit}
                                copyUnit={copyUnit}
                                updateSubSelection={updateSubSelection}
                                activeCatalogue={activeCatalogue}
                              />
                        );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Centralized General Errors & Validation Summary Panel */}
              <div id="general-errors-section" className="gothic-panel general-errors-panel" style={{ padding: '20px', marginTop: '12px', borderStyle: 'solid', borderWidth: '1px', borderColor: isRosterValid ? 'var(--color-success)' : 'var(--color-danger)' }}>
                <h3 className="font-serif text-gold" style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px' }}>Lagerbericht (Gesamtstatus)</h3>
                
                {isRosterValid ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="text-success text-ui-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <Check size={20} />
                      <span>Streitmacht ist regelkonform und bereit für die Schlacht!</span>
                    </div>
                    <p className="text-body text-dim animate-fade-in" style={{ fontStyle: 'italic', margin: '4px 0 8px 0', lineHeight: '1.4', opacity: 0.85 }}>
                      „Die Schlachtreihen stehen fest, die Kriegstrommeln rufen nach den Tapferen. Führt Eure Streitmacht zum glorreichen Sieg!“
                    </p>
                    {/* Mobile-only Play button */}
                    <div className="mobile-only" style={{ width: '100%' }}>
                      <button 
                        type="button" 
                        className="btn-primary" 
                        onClick={() => onPlay(roster)}
                        style={{ 
                          width: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px', 
                          padding: '10px 16px',
                          fontSize: 'var(--fs-body)'
                        }}
                      >
                        <Play size={18} /> Spielen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {generalErrors.map((err, idx) => (
                      <div key={idx} className="validation-error-item text-danger text-body" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                        <span>{err.message}</span>
                      </div>
                    ))}
                    {/* Secondary list of category & selection errors for full context */}
                    {validationErrors.filter(e => e.categoryId || e.selectionId).map((err, idx) => (
                      <div key={idx} className="validation-error-item text-danger text-body" style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.8 }}>
                        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {extraResources.length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-dark)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {extraResources.map(res => (
                      <div key={res.id} className="flex-between text-label text-dim">
                        <span>{res.name}:</span>
                        <span className="badge badge-muted">{res.total}</span>
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

    </div>
  );
}
