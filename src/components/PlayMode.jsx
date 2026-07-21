import React, { useState, useCallback } from 'react';
import { ArrowLeft, Swords, BookOpen } from 'lucide-react';
import { saveRoster } from '../db/database';
import { getSelectionTotalCost, findForceEntryById, calculateRosterCosts, getExtraResourceTotals, isListRuleSelection, childSelectionsOf, TOP_LEVEL_PARENT_COUNT } from '../solver/validator';
import BottomSheet from './editor/BottomSheet';
import usePlayState from '../hooks/usePlayState';
import PlayUnitDetails from './play/PlayUnitDetails';
import RulesIndexDialog from './RulesIndexDialog';
import { useRuleUrl } from '../hooks/useRuleUrl';
import GothicTooltip from './GothicTooltip';

export default function PlayMode({ system, roster: initialRoster, onBack, onReportError }) {
  const [roster, setRoster] = useState(initialRoster);
  const [saveSummaryOpen, setSaveSummaryOpen] = useState(false);
  const [saveSummaryData, setSaveSummaryData] = useState({ title: '', breakdown: [] });
  const [tooltipState, setTooltipState] = useState({ visible: false, x: 0, y: 0, title: '', content: [] });

  const activeCatalogue = system?.catalogues?.find(c => c.id === roster?.catalogueId);
  const extraResources = getExtraResourceTotals(system, roster, calculateRosterCosts(roster, system));

  const { getUnitCurrentWounds, handleAdjustWound } = usePlayState(initialRoster, setRoster, saveRoster, onReportError);

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
        getSelectionTotalCost(b, costType, TOP_LEVEL_PARENT_COUNT, costContext) -
        getSelectionTotalCost(a, costType, TOP_LEVEL_PARENT_COUNT, costContext)
      );
    };

    roster.forces.forEach(force => {
      const forceDef = findForceEntryById(system, force.forceEntryId);
      const categoryLinks = forceDef?.categoryLinks || [];
      const catalogueId = force.catalogueId || roster.catalogueId;

      // List rules are list-wide settings, not battlefield units; the play view
      // shows only fielded units, so they are excluded everywhere here.
      const isBattlefieldSelection = (selection) => !isListRuleSelection(system, selection, catalogueId);

      // Process defined categories
      categoryLinks.forEach(link => {
        const selections = childSelectionsOf(force).filter(s => s.category === link.targetId && isBattlefieldSelection(s));

        if (selections.length > 0) {
          sortByCostDescending(selections, force.catalogueId || roster.catalogueId);

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
      const uncategorizedSelections = childSelectionsOf(force).filter(s => !matchedCategoryIds.has(s.category) && isBattlefieldSelection(s));

      if (uncategorizedSelections.length > 0) {
        sortByCostDescending(uncategorizedSelections, force.catalogueId || roster.catalogueId);

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
      <div className="builder-top-bar play-mode-top-bar hide-on-mobile">
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
          <button className="btn btn-primary btn-top-bar" onClick={onBack}>
            <Swords size={16} /> <span>Ausrüsten</span>
          </button>
          <button
            className="btn btn-top-bar play-rulebook-btn"
            onClick={() => window.open('https://6th.whfb.app/?utm_source=6th-builder&utm_medium=referral', '_blank')}
            title="Regelbuch öffnen (neuer Tab)"
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
            className="btn-sm square-btn hide-on-desktop push-end"
            onClick={() => window.open('https://6th.whfb.app/?utm_source=6th-builder&utm_medium=referral', '_blank')}
            title="Regelbuch öffnen (neuer Tab)"
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
        <div className="play-category-list">
          {getGroupedAndSortedSelections().map(group => (
            <div key={group.id} className="play-category-group">
              <h3 className="font-serif text-gold play-category-title">
                {group.name}
              </h3>
              <div className="play-units-grid">
                {group.selections.map(selection => (
                  <PlayUnitDetails
                    key={selection.id}
                    selection={selection}
                    system={system}
                    roster={roster}
                    getUnitCurrentWounds={getUnitCurrentWounds}
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
          <div className="play-save-summary">
            {Array.isArray(saveSummaryData.breakdown) ? (
              saveSummaryData.breakdown.length > 0 ? (
                <ul className="breakdown-list breakdown-list--readable">
                  {saveSummaryData.breakdown.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-dim breakdown-empty-hint">Keine Modifikatoren gefunden.</p>
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
              <ul className="breakdown-list">
                {tooltipState.content.map((item, i) => (
                  <li key={i}>{item}</li>
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
