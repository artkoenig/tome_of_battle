import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { resolveEntry } from '../../solver/validator';

export default function CatalogBrowser({
  system,
  roster,
  activeCatalogue,
  costTypeLabel,
  setSelectedCatalogEntry,
  addUnit,
  onBack
}) {
  // Extract all unit entries grouped by category links
  const getCatalogItemsByCategory = (catId) => {
    if (!activeCatalogue) return [];
    
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

    return items;
  };

  return (
    <div className="builder-sidebar">
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-dark)' }}>
        <button className="btn-sm w-full" onClick={onBack}>
          <ArrowLeft size={16} /> Zurück
        </button>
        <h3 style={{ marginTop: '12px', fontSize: '1.1rem' }}>Bibliothek</h3>
        <p className="text-dim" style={{ fontSize: '0.8rem' }}>{activeCatalogue?.name}</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {system.categoryEntries?.map(cat => {
          const catItems = getCatalogItemsByCategory(cat.id);
          if (catItems.length === 0) return null;

          return (
            <SidebarCategoryComponent
              key={cat.id}
              cat={cat}
              catItems={catItems}
              system={system}
              costLimitType={roster.costLimitType}
              costTypeLabel={costTypeLabel}
              setSelectedCatalogEntry={setSelectedCatalogEntry}
              addUnit={addUnit}
            />
          );
        })}
      </div>
    </div>
  );
}

const SidebarCategoryComponent = ({
  cat,
  catItems,
  system,
  costLimitType,
  costTypeLabel,
  setSelectedCatalogEntry,
  addUnit
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="catalog-category">
      <div 
        className="catalog-category-header" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="catalog-category-title">{cat.name}</span>
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>

      {isExpanded && (
        <div className="catalog-items">
          {catItems.map(item => {
            const res = resolveEntry(system, item);
            if (!res) return null;
            const points = res.costs?.find(c => c.typeId === costLimitType)?.value || 0;
            return (
              <div key={item.id} className="catalog-item" onClick={() => setSelectedCatalogEntry(res)}>
                <span style={{ fontWeight: 600 }}>{res.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="font-sans text-gold" style={{ fontSize: '0.85rem' }}>{points} {costTypeLabel}</span>
                  <button 
                    className="btn-primary btn-sm" 
                    style={{ padding: '2px 6px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      addUnit(item, cat.id);
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
