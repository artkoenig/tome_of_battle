import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { resolveEntry } from '../../solver/validator';

export default function CategoryUnitAdder({
  categoryId,
  categoryName,
  system,
  activeCatalogue,
  costTypeLabel,
  costLimitType,
  addUnit,
  onUnitAdded
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  if (!activeCatalogue) return null;

  // Filter items in the catalogue by category ID
  const getCatalogItemsByCategory = (catId) => {
    const items = [];
    const checkEntry = (entry) => {
      const resolved = resolveEntry(system, entry);
      if (!resolved) return;

      const hasCategory = resolved.categoryLinks?.some(link => link.targetId === catId) ||
                          entry.categoryLinks?.some(link => link.targetId === catId);

      if (hasCategory) {
        items.push(entry);
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

  const availableUnits = getCatalogItemsByCategory(categoryId);

  if (availableUnits.length === 0) return null;

  return (
    <div ref={wrapperRef} className="category-unit-adder-container">
      <button 
        type="button"
        className="btn-circle-gold btn-sm" 
        onClick={() => setIsOpen(!isOpen)}
        title={`${categoryName} ausheben`}
        style={{ width: '28px', height: '28px', borderRadius: '50%', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {isOpen ? <X size={14} /> : <Plus size={14} />}
      </button>

      {isOpen && (
        <div className="category-unit-adder-popover">
          <div className="popover-list">
            {availableUnits.map(entry => {
              const res = resolveEntry(system, entry);
              const points = res.costs?.find(c => c.typeId === costLimitType || c.typeId === 'pts')?.value || 0;
              return (
                <div 
                  key={res.id} 
                  className="popover-item"
                  onClick={() => {
                    addUnit(entry);
                    setIsOpen(false);
                    if (onUnitAdded) onUnitAdded(res.name);
                  }}
                >
                  <span className="popover-item-name">{res.name}</span>
                  <span className="popover-item-cost font-sans text-gold">
                    {points > 0 ? `+${points} ${costTypeLabel}` : `0 ${costTypeLabel}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
