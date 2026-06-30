import React, { useEffect, useState } from 'react';
import { Save, Play, AlertTriangle, Check } from 'lucide-react';
import { useRoster } from '../hooks/useRoster';
import { saveRoster } from '../db/database';
import { useDebugMode } from '../hooks/DebugContext';
import { computeRosterCounts, getModifiedConstraintValue, resolveEntry, getSelectionTotalCost } from '../solver/validator';

import CategoryUnitAdder from './editor/CategoryUnitAdder';
import RosterSidebar from './editor/RosterSidebar';
import UnitSelectionCard from './editor/UnitSelectionCard';
import CatalogStatBlock from './editor/CatalogStatBlock';


export default function RosterEditor({ system, roster: initialRoster, _onBack, onPlay }) {
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
  } = useRoster(initialRoster, system, saveRoster);

  const [activeCatalogue, setActiveCatalogue] = useState(null);
  const [toast, _setToast] = useState(null);



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
    <div className="builder-layout">
      {/* 1. Mobile Sticky Status & Validation Header */}
      <div className="mobile-sticky-status-bar" onClick={scrollToErrors}>
        <div className="mobile-status-summary">
          <span className="font-serif text-gold" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            STATUS:
          </span>
          {isRosterValid ? (
            <span className="badge badge-success font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Check size={12} /> BEREIT
            </span>
          ) : (
            <span className="badge badge-danger font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={12} /> {validationErrors.length} FEHLER
            </span>
          )}
        </div>
        <div className="mobile-points-indicator">
          <span className="font-body font-bold" style={{ fontSize: '0.85rem' }}>
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
        <CatalogStatBlock 
          selectedCatalogEntry={selectedCatalogEntry} 
          setSelectedCatalogEntry={setSelectedCatalogEntry} 
        />

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
                                className={categoryErrors.length > 0 ? "badge badge-danger font-body" : "badge font-body"} 
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
                        />
                      </div>

                      {categoryErrors.map((err, idx) => (
                        <div key={idx} className="category-error-alert text-danger font-body" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', marginBottom: '8px', padding: '6px 10px', background: 'rgba(166,28,28,0.06)', borderRadius: '3px', border: '1px solid var(--color-danger)' }}>
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
                                setSelectedCatalogEntry={setSelectedCatalogEntry}
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
                  <h3 className="font-serif text-gold" style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px', fontSize: '1.15rem' }}>Sonstiges</h3>
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
                                setSelectedCatalogEntry={setSelectedCatalogEntry}
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
                  <div className="text-success font-serif" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 600 }}>
                    <Check size={20} />
                    <span>Streitmacht ist regelkonform und bereit für die Schlacht!</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {generalErrors.map((err, idx) => (
                      <div key={idx} className="validation-error-item text-danger font-body" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem' }}>
                        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                        <span>{err.message}</span>
                      </div>
                    ))}
                    {/* Secondary list of category & selection errors for full context */}
                    {validationErrors.filter(e => e.categoryId || e.selectionId).map((err, idx) => (
                      <div key={idx} className="validation-error-item text-danger font-body" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', opacity: 0.8 }}>
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
