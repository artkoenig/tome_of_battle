import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Search, Plus, Minus, 
  Heart, Swords, Sparkles, BookOpen 
} from 'lucide-react';
import { saveRoster } from '../db/database';
import { findEntryInSystem, resolveEntry, collectUnitProfilesAndRules, getSelectionTotalCost, findForceEntryById } from '../solver/validator';
import { useDebugMode } from '../hooks/DebugContext';
import BottomSheet from './editor/BottomSheet';
import usePlayState from '../hooks/usePlayState';
import PlayUnitDetails from './play/PlayUnitDetails';

export default function PlayMode({ system, roster: initialRoster, onBack }) {
  const { showDebugIds } = useDebugMode();
  const [roster, setRoster] = useState(initialRoster);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveSummaryOpen, setSaveSummaryOpen] = useState(false);
  const [saveSummaryData, setSaveSummaryData] = useState({ title: '', breakdown: [] });
  const [tooltipState, setTooltipState] = useState({ visible: false, x: 0, y: 0, title: '', content: [] });

  const activeCatalogue = system?.catalogues?.find(c => c.id === roster?.catalogueId);

  const { gameState, adjustTracker, getUnitCurrentWounds, handleAdjustWound } = usePlayState(initialRoster, setRoster, saveRoster);

  const handleMouseEnter = (e, title, content) => {
    if (window.innerWidth <= 900 || content.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipState({
      visible: true,
      x: rect.left,
      y: rect.bottom + 8,
      title,
      content
    });
  };

  const handleMouseLeave = () => {
    setTooltipState(s => ({ ...s, visible: false }));
  };

  const getGroupedAndSortedSelections = () => {
    const groups = [];
    const costType = roster.costLimitType || 'pts';
    
    roster.forces.forEach(force => {
      const forceDef = findForceEntryById(system, force.forceEntryId);
      const categoryLinks = forceDef?.categoryLinks || [];

      // Process defined categories
      categoryLinks.forEach(link => {
        let selections = force.selections?.filter(s => s.category === link.targetId) || [];
        
        // Apply search filter
        selections = selections.filter(sel => {
          const matchesName = sel.name.toLowerCase().includes(searchTerm.toLowerCase());
          const { rules } = collectUnitProfilesAndRules(system, sel, force.catalogueId || roster.catalogueId, roster);
          const matchesRules = rules.some(r => 
            r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            r.description.toLowerCase().includes(searchTerm.toLowerCase())
          );
          return matchesName || matchesRules || searchTerm === '';
        });

        if (selections.length > 0) {
          // Sort descending by points
          selections.sort((a, b) => {
            const aPoints = getSelectionTotalCost(a, costType);
            const bPoints = getSelectionTotalCost(b, costType);
            return bPoints - aPoints;
          });

          const catDef = system.categoryEntries?.find(ce => ce.id === link.targetId);
          const catName = catDef ? catDef.name : link.name || 'Unbekannte Kategorie';

          groups.push({
            id: `${force.id}-${link.targetId}`,
            name: catName,
            selections: selections
          });
        }
      });

      // Process uncategorized selections
      const matchedCategoryIds = new Set(categoryLinks.map(l => l.targetId));
      let uncategorizedSelections = force.selections?.filter(s => !matchedCategoryIds.has(s.category)) || [];
      
      uncategorizedSelections = uncategorizedSelections.filter(sel => {
        const matchesName = sel.name.toLowerCase().includes(searchTerm.toLowerCase());
        const { rules } = collectUnitProfilesAndRules(system, sel, force.catalogueId || roster.catalogueId, roster);
        const matchesRules = rules.some(r => 
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          r.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesName || matchesRules || searchTerm === '';
      });

      if (uncategorizedSelections.length > 0) {
        uncategorizedSelections.sort((a, b) => {
          const aPoints = getSelectionTotalCost(a, costType);
          const bPoints = getSelectionTotalCost(b, costType);
          return bPoints - aPoints;
        });
        
        groups.push({
          id: `${force.id}-uncategorized`,
          name: 'Sonstige Auswahlen',
          selections: uncategorizedSelections
        });
      }
    });

    return groups;
  };

  return (
    <>
      {/* Desktop Header in Play Mode (same style as editor) */}
      <div className="builder-top-bar hide-on-mobile" style={{ marginBottom: '24px' }}>
        <div className="builder-top-bar-left">
          <div className="builder-top-bar-title-section">
            <h2 className="builder-top-bar-title">{roster.name}</h2>
            <span className="builder-top-bar-subtitle">
              <span>{system.name} {activeCatalogue ? '· ' : ''}</span>
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
          <button className="btn-primary" onClick={onBack} style={{ padding: '6px 12px' }}>
            <Swords size={16} /> <span>Ausrüsten</span>
          </button>
        </div>
      </div>

      <div className="play-layout">
        {/* Mobile Play Mode Header */}
        <div className="play-header">
          <button 
            className="btn-sm play-header-back square-btn" 
            onClick={onBack} 
            title="Kriegsplanung (Editieren)"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="play-header-title">Spielmodus</h2>
        </div>

        {/* Active Units Roster Sheets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {getGroupedAndSortedSelections().map(group => (
            <div key={group.id} className="play-category-group">
              <h3 className="font-serif text-gold" style={{ borderBottom: '1px solid var(--border-dark)', paddingBottom: '8px', marginBottom: '16px', fontSize: '1.2rem' }}>
                {group.name}
              </h3>
              <div className="play-units-grid">
                {group.selections.map(selection => (
                  <PlayUnitDetails
                    key={selection.id}
                    selection={selection}
                    system={system}
                    roster={roster}
                    showDebugIds={showDebugIds}
                    gameState={gameState}
                    handleAdjustWound={handleAdjustWound}
                    handleMouseEnter={handleMouseEnter}
                    handleMouseLeave={handleMouseLeave}
                    setSaveSummaryData={setSaveSummaryData}
                    setSaveSummaryOpen={setSaveSummaryOpen}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <BottomSheet
          isOpen={saveSummaryOpen}
          onClose={() => setSaveSummaryOpen(false)}
          title={saveSummaryData.title}
        >
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {saveSummaryData.breakdown.length > 0 ? (
              <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-parchment)', fontSize: '0.9rem' }}>
                {saveSummaryData.breakdown.map((item, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-dim" style={{ fontSize: '0.9rem' }}>Keine Modifikatoren gefunden.</p>
            )}
          </div>
        </BottomSheet>

        {/* Hover Tooltip for Desktop */}
        {tooltipState.visible && (
          <div 
            className="gothic-tooltip"
            style={{ left: `${tooltipState.x}px`, top: `${tooltipState.y}px` }}
          >
            <div className="tooltip-title">{tooltipState.title}</div>
            <div className="tooltip-body">
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {tooltipState.content.map((item, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
