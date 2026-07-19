import React, { useState, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { resolveEntry, getOptionDisplayCost, getModifiedConstraintValue, getEffectiveModifiers, isSelectionEntryHidden, isEntryPrimaryInCategory } from '../../solver/validator';
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

  // Filter items in the catalogue by category ID
  const getCatalogItemsByCategory = (catId) => {
    const items = [];
    const checkEntry = (entry) => {
      const resolved = resolveEntry(system, entry);
      if (!resolved) return;

      const force = roster.forces?.[0];
      // Use the effective (post-modifier) primary category so units an army
      // recategorises via a `set-primary` modifier (e.g. shared library units
      // pulled into "Core") surface under the right section (ADR 0003 §4).
      const hasCategory = isEntryPrimaryInCategory(entry, catId, { system, roster, selectionCounts, force });

      if (hasCategory) {
        const isHidden = isSelectionEntryHidden(entry, system, roster, selectionCounts, null, force);
        if (!isHidden) {
          items.push(entry);
        }
      }
    };

    activeCatalogue.selectionEntries?.forEach(checkEntry);
    activeCatalogue.entryLinks?.forEach(checkEntry);
    activeCatalogue.sharedSelectionEntries?.forEach(checkEntry);

    // Remove duplicates by resolved ID
    const seen = new Set();
    return items.filter(item => {
      const resolved = resolveEntry(system, item);
      if (seen.has(resolved.id)) return false;
      seen.add(resolved.id);
      return true;
    });
  };

  // When an explicit entry list is supplied (e.g. army-wide selectors that no category
  // surfaces), offer exactly those; otherwise fall back to the entries of the category.
  const availableUnits = (entries || getCatalogItemsByCategory(categoryId))
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
                  <span style={{ color: isMaxedOut ? 'var(--text-dim)' : 'inherit' }}>{res.name}</span>
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
