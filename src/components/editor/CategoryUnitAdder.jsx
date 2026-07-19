import React, { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { resolveEntry, getOptionDisplayCost, getModifiedConstraintValue, getEffectiveModifiers, getEffectiveName, getVisibleCatalogueEntriesForCategory } from '../../solver/validator';
import BottomSheet from './BottomSheet';

export default function CategoryUnitAdder({
  categoryId,
  categoryName,
  system,
  activeCatalogue,
  costTypeLabel,
  costLimitType,
  addUnit,
  roster,
  selectionCounts,
  entries = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  if (!activeCatalogue) return null;

  // When an explicit entry list is supplied (e.g. army-wide selectors that no category
  // surfaces), offer exactly those; otherwise fall back to the entries of the category
  // (effective, post-modifier primary category and current visibility — ADR 0003 §4).
  const availableUnits = (entries || getVisibleCatalogueEntriesForCategory(activeCatalogue, categoryId, {
    system, roster, selectionCounts, force: roster.forces?.[0]
  }))
    .sort((a, b) => {
      const aPoints = getOptionDisplayCost(system, a, costLimitType) || 0;
      const bPoints = getOptionDisplayCost(system, b, costLimitType) || 0;
      return bPoints - aPoints; // Descending
    });

  if (availableUnits.length === 0) return null;

  const displayCtx = {
    roster,
    system,
    selectionCounts,
    parentCatalogueId: activeCatalogue?.id
  };

  return (
    <div ref={wrapperRef} className="category-unit-adder-container">
      <button 
        type="button"
        className="qty-btn" 
        onClick={() => setIsOpen(!isOpen)}
        title={`${categoryName} ausheben`}
      >
        {isOpen ? <X size={12} /> : <Plus size={12} />}
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`${categoryName} ausheben`}
        desktopMode="popover"
        containerRef={wrapperRef}
      >
        <div className="popover-list">
          {availableUnits.map(entry => {
            const res = resolveEntry(system, entry);
            const points = getOptionDisplayCost(system, entry, costLimitType);
            
            let isMaxedOut = false;
            if (selectionCounts) {
              const count = Math.max(selectionCounts[res.id] || 0, (res.targetId ? selectionCounts[res.targetId] || 0 : 0));
              if (res.constraints) {
                const maxCon = res.constraints.find(c => c.type === 'max' && (c.scope === 'roster' || c.scope === 'force' || !c.scope));
                if (maxCon) {
                  const effectiveMax = getModifiedConstraintValue(maxCon, getEffectiveModifiers(res), displayCtx);
                  if (count >= effectiveMax) {
                    isMaxedOut = true;
                  }
                }
              }
            }

            return (
              <div 
                key={res.id} 
                className={`popover-item ${isMaxedOut ? 'disabled' : ''}`}
                style={{ opacity: isMaxedOut ? 0.5 : 1, cursor: isMaxedOut ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (isMaxedOut) return;
                  addUnit(entry, categoryId);
                  setIsOpen(false);
                }}
              >
                <span className="popover-item-name" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: isMaxedOut ? 'var(--text-dim)' : 'inherit' }}>{getEffectiveName(res, displayCtx)}</span>
                  {isMaxedOut && <span className="text-danger text-micro" style={{ marginLeft: '6px', fontWeight: 600 }}>(Nicht verfügbar)</span>}
                </span>
                {points > 0 && (
                  <span className="popover-item-cost font-body text-gold" style={{ color: isMaxedOut ? 'var(--text-dim)' : 'var(--text-gold)' }}>
                    +{points} {costTypeLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
