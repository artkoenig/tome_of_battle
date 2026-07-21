import React, { useEffect, useState, useCallback } from 'react';
import { useRoster } from '../hooks/useRoster';
import { saveRoster } from '../db/database';
import { getExtraResourceTotals, resolveCostLimitLabel } from '../solver/validator';

import RosterEditorTopBar from './editor/RosterEditorTopBar';
import ForceEditorSection from './editor/ForceEditorSection';
import RosterSidebar from './editor/RosterSidebar';
import RulesIndexDialog from './RulesIndexDialog';
import { useRuleUrl } from '../hooks/useRuleUrl';

const ruleGroupKeyOf = (forceId, categoryId) => `${forceId}:${categoryId}`;

export default function RosterEditor({ system, roster: initialRoster, onBack, onPlay, onExportRoster, onReportError }) {
  const {
    roster,
    costs,
    validationErrors,
    selectedRosterSelection,
    setSelectedRosterSelection,
    addUnit,
    removeUnit,
    copyUnit,
    subSelectionOperations,
    undo,
    redo,
    canUndo,
    canRedo
  } = useRoster(initialRoster, system, saveRoster, onReportError);

  const [activeCatalogue, setActiveCatalogue] = useState(null);
  // Listenregel-Gruppen sind ausklappbar und **standardmäßig eingeklappt**. Wir
  // verfolgen daher die (pro force+Kategorie) ausdrücklich AUSGEKLAPPTEN Gruppen;
  // ein leeres Set bedeutet: alle eingeklappt.
  const [expandedRuleGroups, setExpandedRuleGroups] = useState(() => new Set());
  const isRuleGroupExpanded = useCallback(
    (forceId, categoryId) => expandedRuleGroups.has(ruleGroupKeyOf(forceId, categoryId)),
    [expandedRuleGroups]
  );
  const toggleRuleGroup = useCallback((forceId, categoryId) => {
    const groupKey = ruleGroupKeyOf(forceId, categoryId);
    setExpandedRuleGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  }, []);
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

  const costTypeLabel = resolveCostLimitLabel(roster, system);

  const currentPoints = costs[roster.costLimitType] || 0;
  const limitPoints = roster.costLimit || 0;
  const remainingPoints = limitPoints - currentPoints;
  const extraResources = getExtraResourceTotals(system, roster, costs);

  const playRoster = useCallback(() => onPlay(roster), [onPlay, roster]);
  const exportRoster = useCallback(() => onExportRoster?.(roster), [onExportRoster, roster]);

  // Der Prop-Satz, den jede Einheitenkarte braucht — an genau einer Stelle
  // gebündelt und unverändert bis zur Karte durchgereicht.
  const unitCardContext = {
    selectedRosterSelection,
    setSelectedRosterSelection,
    roster,
    system,
    validationErrors,
    costTypeLabel,
    removeUnit,
    copyUnit,
    subSelectionOperations,
    activeCatalogue,
    onShowRule
  };

  // Resolve active catalogue definition
  useEffect(() => {
    if (system && roster) {
      const cat = system.catalogues.find(c => c.id === roster.catalogueId);
      setActiveCatalogue(cat);
    }
  }, [system, roster]);

  return (
    <div className="builder-layout-container">
      <RosterEditorTopBar
        roster={roster}
        system={system}
        activeCatalogue={activeCatalogue}
        currentPoints={currentPoints}
        limitPoints={limitPoints}
        costTypeLabel={costTypeLabel}
        onBack={onBack}
        onPlay={playRoster}
        onExport={exportRoster}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="builder-layout">
        <div className="builder-main active-mobile-tab">
          {roster.forces.map(force => (
            <ForceEditorSection
              key={force.id}
              force={force}
              system={system}
              roster={roster}
              activeCatalogue={activeCatalogue}
              validationErrors={validationErrors}
              costTypeLabel={costTypeLabel}
              addUnit={addUnit}
              removeUnit={removeUnit}
              subSelectionOperations={subSelectionOperations}
              unitCardContext={unitCardContext}
              isRuleGroupExpanded={isRuleGroupExpanded}
              onToggleRuleGroup={toggleRuleGroup}
              onShowRule={onShowRule}
              remainingPoints={remainingPoints}
              extraResources={extraResources}
              onPlay={playRoster}
            />
          ))}
        </div>

        {/* Desktop-only Validation Summary Sidebar */}
        <RosterSidebar
          roster={roster}
          system={system}
          costs={costs}
          validationErrors={validationErrors}
          costTypeLabel={costTypeLabel}
          className="desktop-only-sidebar"
        />

        {activeRuleDialog && (
          <RulesIndexDialog
            ruleName={activeRuleDialog.ruleName}
            url={activeRuleDialog.url}
            isOpen={true}
            onClose={closeRulesDialog}
          />
        )}
      </div>
    </div>
  );
}
