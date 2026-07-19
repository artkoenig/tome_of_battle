import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Search, Plus, Minus, 
  Heart, Swords, BookOpen
} from 'lucide-react';
import { saveRoster } from '../db/database';
import { findEntryInSystem, resolveEntry, collectUnitProfilesAndRules, getSelectionTotalCost, findForceEntryById, calculateRosterCosts, getExtraResourceTotals, isListConfiguration } from '../solver/validator';
import BottomSheet from './editor/BottomSheet';
import usePlayState from '../hooks/usePlayState';
import PlayUnitDetails from './play/PlayUnitDetails';
import RulesIndexDialog from './RulesIndexDialog';
import { useRuleUrl } from '../hooks/useRuleUrl';
import GothicTooltip from './GothicTooltip';

export default function PlayMode({ system, roster: initialRoster, onBack }) {
  const [roster, setRoster] = useState(initialRoster);
  const [searchTerm, setSearchTerm] = useState('');
  const [saveSummaryOpen, setSaveSummaryOpen] = useState(false);
  const [saveSummaryData, setSaveSummaryData] = useState({ title: '', breakdown: [] });
  const [tooltipState, setTooltipState] = useState({ visible: false, x: 0, y: 0, title: '', content: [] });

  const activeCatalogue = system?.catalogues?.find(c => c.id === roster?.catalogueId);
  const extraResources = getExtraResourceTotals(system, roster, calculateRosterCosts(roster, system));

  const { gameState, adjustTracker, getUnitCurrentWounds, handleAdjustWound } = usePlayState(initialRoster, setRoster, saveRoster);

  // Central resolver that honors the global whfb6 linking setting (see ADR-0015):
  // returns a rule URL only when linking is enabled and a mapping exists, else null.
  const resolveRuleUrl = useRuleUrl();

  // Holds the rule whose external index is currently shown, together with the URL
  // resolved at open time. Capturing the URL here (rather than re-resolving on each
  // render) keeps an already-open dialog intact when the setting is toggled off,
  // as required by the feature's out-of-scope note.
  const [activeRuleDialog, setActiveRuleDialog] = useState(null);

  const onShowRule = useCallback((ruleName) => {
    const ruleUrl = resolveRuleUrl(ruleName);
    if (!ruleUrl) return;
    setActiveRuleDialog({ ruleName, url: ruleUrl });
  }, [resolveRuleUrl]);

  const closeRulesDialog = useCallback(() => {
    setActiveRuleDialog(null);
  }, []);

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

    // Orders selections in place by total cost, descending. The cost context is built
    // once per sort here rather than rebuilt for every pairwise comparison the sort makes.
    const sortByCostDescending = (selections, catalogueId) => {
      const costContext = { system, roster, currentCatalogueId: catalogueId };
      selections.sort((a, b) =>
        getSelectionTotalCost(b, costType, 1, costContext) -
        getSelectionTotalCost(a, costType, 1, costContext)
      );
    };

    roster.forces.forEach(force => {
      const forceDef = findForceEntryById(system, force.forceEntryId);
      const categoryLinks = forceDef?.categoryLinks || [];
      const catalogueId = force.catalogueId || roster.catalogueId;

      // List configurations (army-wide Battlescribe switches such as "Allow
      // experimental rules?") are not playable units, so they are dropped from
      // every play-view group up front (see docs/adr / CONTEXT.md).
      const playableSelections = (force.selections || []).filter(
        selection => !isListConfiguration({ system, force, selection, catalogueId })
      );

      // Process defined categories
      categoryLinks.forEach(link => {
        let selections = playableSelections.filter(s => s.category === link.targetId);
        
        // Apply search filter
        selections = selections.filter(sel => {
          const matchesName = sel.name.toLowerCase().includes(searchTerm.toLowerCase());
          const { rules } = collectUnitProfilesAndRules(system, sel, catalogueId, roster);
          const matchesRules = rules.some(r => 
            r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            r.description.toLowerCase().includes(searchTerm.toLowerCase())
          );
          return matchesName || matchesRules || searchTerm === '';
        });

        if (selections.length > 0) {
          sortByCostDescending(selections, catalogueId);

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
      let uncategorizedSelections = playableSelections.filter(s => !matchedCategoryIds.has(s.category));
      
      uncategorizedSelections = uncategorizedSelections.filter(sel => {
        const matchesName = sel.name.toLowerCase().includes(searchTerm.toLowerCase());
        const { rules } = collectUnitProfilesAndRules(system, sel, catalogueId, roster);
        const matchesRules = rules.some(r => 
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          r.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesName || matchesRules || searchTerm === '';
      });

      if (uncategorizedSelections.length > 0) {
        sortByCostDescending(uncategorizedSelections, catalogueId);

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
          <button className="btn btn-primary" onClick={onBack} style={{ padding: '6px 12px' }}>
            <Swords size={16} /> <span>Ausrüsten</span>
          </button>
          <button
            className="btn"
            onClick={() => window.open('https://6th.whfb.app/?utm_source=6th-builder&utm_medium=referral', '_blank')}
            title="Regelbuch öffnen (neuer Tab)"
            style={{ padding: '6px 12px', marginLeft: '8px' }}
          >
            <BookOpen size={16} /> <span>Regelbuch</span>
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
          <button
            className="btn-sm square-btn hide-on-desktop"
            onClick={() => window.open('https://6th.whfb.app/?utm_source=6th-builder&utm_medium=referral', '_blank')}
            title="Regelbuch öffnen (neuer Tab)"
            style={{ marginLeft: 'auto' }}
          >
            <BookOpen size={16} />
          </button>
        </div>

        {/* Army-wide resource totals (e.g. Casting/Dispel Dice) */}
        {extraResources.length > 0 && (
          <div className="play-resource-bar">
            {extraResources.map(res => (
              <span key={res.id} className="badge badge-muted">
                {res.total} {res.name}
              </span>
            ))}
          </div>
        )}

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
                    gameState={gameState}
                    handleAdjustWound={handleAdjustWound}
                    handleMouseEnter={handleMouseEnter}
                    handleMouseLeave={handleMouseLeave}
                    setSaveSummaryData={setSaveSummaryData}
                    setSaveSummaryOpen={setSaveSummaryOpen}
                    onShowRule={onShowRule}
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
            {Array.isArray(saveSummaryData.breakdown) ? (
              saveSummaryData.breakdown.length > 0 ? (
                <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-parchment)', fontSize: '0.9rem' }}>
                  {saveSummaryData.breakdown.map((item, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-dim" style={{ fontSize: '0.9rem' }}>Keine Modifikatoren gefunden.</p>
              )
            ) : (
              saveSummaryData.breakdown
            )}
          </div>
        </BottomSheet>

        {/* Hover Tooltip for Desktop */}
        {tooltipState.visible && (
          <GothicTooltip title={tooltipState.title} x={tooltipState.x} y={tooltipState.y}>
            {Array.isArray(tooltipState.content) ? (
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {tooltipState.content.map((item, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{item}</li>
                ))}
              </ul>
            ) : (
              tooltipState.content
            )}
          </GothicTooltip>
        )}

        {activeRuleDialog && (
          <RulesIndexDialog
            ruleName={activeRuleDialog.ruleName}
            url={activeRuleDialog.url}
            isOpen={true}
            onClose={closeRulesDialog}
          />
        )}
      </div>
    </>
  );
}
