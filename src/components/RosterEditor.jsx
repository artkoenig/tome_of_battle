import React, { useEffect, useState, useCallback } from 'react';
import { Play, AlertTriangle, Check, ArrowLeft, Download, Undo2, Redo2, ChevronDown, ChevronRight } from 'lucide-react';
import { useRoster } from '../hooks/useRoster';
import { saveRoster } from '../db/database';
import { computeRosterCounts, getModifiedConstraintValue, getEffectiveModifiers, findForceEntryById, isCategoryLinkHidden, isEntryPrimaryInCategory, getExtraResourceTotals, formatConstraintLimit, collectUnreachableArmyWideSelectors, hasBlockingViolations, ValidationSeverity, resolveListRuleGroup, childSelectionsOf } from '../solver/validator';

import CategoryUnitAdder from './editor/CategoryUnitAdder';
import ListRuleChecklist from './editor/ListRuleChecklist';
import RosterSidebar from './editor/RosterSidebar';
import UnitSelectionCard from './editor/UnitSelectionCard';
import AutoFillSuggestions from './editor/AutoFillSuggestions';
import RulesIndexDialog from './RulesIndexDialog';
import { useRuleUrl } from '../hooks/useRuleUrl';


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
  const [toast, _setToast] = useState(null);
  // Listenregel-Gruppen sind ausklappbar und **standardmäßig eingeklappt**. Wir
  // verfolgen daher die (pro force+Kategorie) ausdrücklich AUSGEKLAPPTEN Gruppen;
  // ein leeres Set bedeutet: alle eingeklappt.
  const [expandedRuleGroups, setExpandedRuleGroups] = useState(() => new Set());
  const toggleRuleGroup = (groupKey) => {
    setExpandedRuleGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  };
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

  const costType = system?.costTypes?.find(ct => ct.id === roster?.costLimitType);
  const rawLabel = costType?.name || 'Pkt.';
  const costTypeLabel = (rawLabel.toLowerCase() === 'pts' || rawLabel.toLowerCase() === 'punkte' || rawLabel.toLowerCase() === 'points') ? 'Pkt.' : rawLabel;

  const currentPoints = costs[roster.costLimitType] || 0;
  const limitPoints = roster.costLimit || 0;
  const remainingPoints = limitPoints - currentPoints;
  const generalErrors = validationErrors.filter(e => !e.categoryId && !e.selectionId);
  // Nur blockierende Verstöße (severity 'error') sperren das Spielen; rein informative
  // Hinweise (warning/info) erscheinen zwar in der Liste, gelten aber als regelkonform.
  const isRosterValid = !hasBlockingViolations(validationErrors);
  const advisoryMessages = validationErrors.filter(e => e.severity !== ValidationSeverity.ERROR);
  const extraResources = getExtraResourceTotals(system, roster, costs);

  // Resolve active catalogue definition
  useEffect(() => {
    if (system && roster) {
      const cat = system.catalogues.find(c => c.id === roster.catalogueId);
      setActiveCatalogue(cat);
    }
  }, [system, roster]);


  const hasPrimaryCatalogItems = (catId, force, selectionCounts) => {
    const activeCatalogue = system.catalogues?.find(c => c.id === force.catalogueId);
    if (!activeCatalogue) return false;

    // Effective (post-modifier) primary category, so a section still renders when
    // all its units are recategorised into it by a `set-primary` modifier — matching
    // what the category adder offers (ADR 0003 §4).
    const checkEntry = (entry) => isEntryPrimaryInCategory(entry, catId, { system, roster, selectionCounts, force });

    return activeCatalogue.selectionEntries?.some(checkEntry) ||
           activeCatalogue.entryLinks?.some(checkEntry) ||
           activeCatalogue.sharedSelectionEntries?.some(checkEntry);
  };

  


  


  return (
    <div className="builder-layout-container">
      {/* 1. Builder Top Bar */}
      <div className="builder-top-bar">
        <button
          type="button"
          className="btn-primary square-btn mobile-only"
          onClick={onBack}
          title="Heerlager"
        >
          <ArrowLeft size={16} /> <span className="hide-on-mobile">Heerlager</span>
        </button>

        <div className="builder-top-bar-middle">
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

          {/* Points limit indicator */}
          <div className="mobile-points-indicator mobile-only">
            <span className="points-display builder-top-bar-title">
              {currentPoints}&nbsp;/ {limitPoints}
            </span>
            <span className="builder-top-bar-subtitle">
              {costTypeLabel}
            </span>
          </div>
        </div>

        <div className="builder-top-bar-actions">
          <button
            type="button"
            className="btn-secondary square-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Rückgängig"
            aria-label="Rückgängig"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="btn-secondary square-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Wiederherstellen"
            aria-label="Wiederherstellen"
          >
            <Redo2 size={16} />
          </button>
          <button className="btn-primary btn-top-bar hide-on-mobile" onClick={() => onPlay(roster)}>
            <Play size={16} /> <span>Spielen</span>
          </button>
          <button className="btn-secondary btn-top-bar hide-on-mobile" onClick={() => onExportRoster?.(roster)}>
            <Download size={16} /> <span>Exportieren</span>
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

          // Army-wide mandatory selectors that no force category surfaces (e.g. a
          // force-scoped root entry without a matching categoryLink) get their own
          // configurator; selectors that a category already offers are handled there.
          const armyWideSelectors = collectUnreachableArmyWideSelectors({
            system, catalogueId: force.catalogueId || roster.catalogueId, forceDef,
            roster, selectionCounts, forceCategoryCounts, force
          });
          const armyWideSelectorIds = new Set(armyWideSelectors.map(entry => entry.id));
          const belongsToArmyWideSelector = s => armyWideSelectorIds.has(s.selectionEntryId || s.entryLinkId);
          const armyWideSelectorSelections = childSelectionsOf(force).filter(belongsToArmyWideSelector);

          const matchedCategoryIds = new Set(categoryLinks.map(l => l.targetId));
          const uncategorizedSelections = childSelectionsOf(force).filter(s =>
            !matchedCategoryIds.has(s.category) && !belongsToArmyWideSelector(s));

          return (
            <div key={force.id} className="force-editor-section">
              {categoryLinks.map(link => {
                  const isHidden = isCategoryLinkHidden(link, system, roster, selectionCounts, forceCategoryCounts);
                  const selections = childSelectionsOf(force).filter(s => s.category === link.targetId);

                  // A list-rule group (data-driven: catalog type = upgrade, ADR 0003)
                  // is a list-wide settings group, not a unit slot: its cards drop the
                  // per-card unit actions and the group offers no "add unit" button. One
                  // solver call classifies the group and, in the same catalog traversal,
                  // yields the per-rule checklist states we hand down to ListRuleChecklist.
                  const { isListRuleGroup, states: listRuleStates } = resolveListRuleGroup(
                    system, activeCatalogue, link.targetId, { roster, force }
                  );
                  const ruleGroupKey = `${force.id}:${link.targetId}`;
                  const isRuleGroupCollapsed = isListRuleGroup && !expandedRuleGroups.has(ruleGroupKey);

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
                  const linkModifiers = getEffectiveModifiers(link);
                  const minVal = minConstraint ? getModifiedConstraintValue(minConstraint, linkModifiers, displayCtx) : 0;
                  const maxVal = maxConstraint ? getModifiedConstraintValue(maxConstraint, linkModifiers, displayCtx) : Infinity;

                  const isPrimaryForAny = hasPrimaryCatalogItems(link.targetId, force, selectionCounts);

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
                    <div key={link.targetId} className="roster-category-group">
                      <div className="roster-category-header">
                        <div
                          className={`roster-category-title${isListRuleGroup ? ' roster-category-title--collapsible' : ''}`}
                          onClick={isListRuleGroup ? () => toggleRuleGroup(ruleGroupKey) : undefined}
                          role={isListRuleGroup ? 'button' : undefined}
                          aria-expanded={isListRuleGroup ? !isRuleGroupCollapsed : undefined}
                          title={isListRuleGroup ? (isRuleGroupCollapsed ? 'Listenregeln ausklappen' : 'Listenregeln einklappen') : undefined}
                        >
                          {isListRuleGroup && (isRuleGroupCollapsed
                            ? <ChevronRight size={18} className="text-gold" aria-hidden="true" />
                            : <ChevronDown size={18} className="text-gold" aria-hidden="true" />)}
                          <h3 className="text-subheading roster-category-heading">
                            {catName}
                          </h3>
                          {/* Der Zähl-Chip entfällt für die Listenregel-Gruppe: die Ankreuzliste
                              zeigt den An/Aus-Zustand bereits pro Regel; eine Gesamtzahl ist redundant. */}
                          {!isListRuleGroup && (() => {
                            const limitParts = [];
                            if (minVal > 0) limitParts.push(`Min: ${formatConstraintLimit(minVal, minConstraint)}`);
                            if (maxVal < Infinity) limitParts.push(`Max: ${formatConstraintLimit(maxVal, maxConstraint)}`);
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
                        {!isListRuleGroup && (
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
                            force={force}
                          />
                        )}
                      </div>


                      {isListRuleGroup ? (
                        !isRuleGroupCollapsed && (
                          <ListRuleChecklist
                            system={system}
                            activeCatalogue={activeCatalogue}
                            categoryId={link.targetId}
                            roster={roster}
                            states={listRuleStates}
                            addUnit={addUnit}
                            removeUnit={removeUnit}
                            subSelectionOperations={subSelectionOperations}
                            costTypeLabel={costTypeLabel}
                            costLimitType={roster.costLimitType}
                            selectionCounts={selectionCounts}
                            onShowRule={onShowRule}
                          />
                        )
                      ) : (
                        selections.length > 0 && (
                          <div className="unit-card-list">
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
                                  subSelectionOperations={subSelectionOperations}
                                  activeCatalogue={activeCatalogue}
                                  onShowRule={onShowRule}
                                />
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}

              {/* Army-wide mandatory selectors not reachable through any force category */}
              {armyWideSelectors.length > 0 && (
                <div className="roster-category-group">
                  <div className="roster-category-header">
                    <h3 className="text-subheading roster-category-heading">Armeeweite Auswahl</h3>
                    <CategoryUnitAdder
                      categoryName="Armeeweite Auswahl"
                      entries={armyWideSelectors}
                      system={system}
                      activeCatalogue={activeCatalogue}
                      costTypeLabel={costTypeLabel}
                      costLimitType={roster.costLimitType}
                      addUnit={addUnit}
                      roster={roster}
                      selectionCounts={selectionCounts}
                      force={force}
                    />
                  </div>
                  {armyWideSelectorSelections.length > 0 && (
                    <div className="unit-card-list">
                      {armyWideSelectorSelections.map(selection => (
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
                          subSelectionOperations={subSelectionOperations}
                          activeCatalogue={activeCatalogue}
                          onShowRule={onShowRule}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Uncategorized Selections (Fallback) */}
              {uncategorizedSelections.length > 0 && (
                <div className="roster-category-group">
                  <h3 className="text-subheading roster-category-heading--standalone">Sonstiges</h3>
                  <div className="unit-card-list">
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
                                subSelectionOperations={subSelectionOperations}
                                activeCatalogue={activeCatalogue}
                                onShowRule={onShowRule}
                              />
                        );
                    })}
                  </div>
                </div>
              )}

              {remainingPoints > 0 && remainingPoints <= 50 && (
                <AutoFillSuggestions
                  roster={roster}
                  system={system}
                  activeCatalogue={activeCatalogue}
                  remainingPoints={remainingPoints}
                  subSelectionOperations={subSelectionOperations}
                  costTypeLabel={costTypeLabel}
                />
              )}

              {/* 3. Centralized General Errors & Validation Summary Panel */}
              <div
                id="general-errors-section"
                className={`gothic-panel general-errors-panel ${isRosterValid ? 'general-errors-panel--valid' : 'general-errors-panel--invalid'}`}
              >
                <h3 className="font-serif text-gold general-errors-title">Lagerbericht (Gesamtstatus)</h3>
                
                {isRosterValid ? (
                  <div className="flex-col gap-12">
                    <div className="text-success text-ui-title flex-row gap-8 text-strong">
                      <Check size={20} />
                      <span>Streitmacht ist regelkonform und bereit für die Schlacht!</span>
                    </div>
                    <p className="text-body text-dim animate-fade-in roster-valid-flavour">
                      „Die Schlachtreihen stehen fest, die Kriegstrommeln rufen nach den Tapferen. Führt Eure Streitmacht zum glorreichen Sieg!“
                    </p>
                    {/* Mobile-only Play button */}
                    <div className="mobile-only w-full">
                      <button
                        type="button"
                        className="btn-primary roster-play-btn-mobile"
                        onClick={() => onPlay(roster)}
                      >
                        <Play size={18} /> Spielen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="validation-error-list">
                    {generalErrors.map((err, idx) => (
                      <div key={idx} className="validation-error-item text-danger text-body flex-row gap-10">
                        <AlertTriangle size={18} className="no-shrink" />
                        <span>{err.message}</span>
                      </div>
                    ))}
                    {/* Secondary list of category & selection errors for full context */}
                    {validationErrors.filter(e => (e.categoryId || e.selectionId) && e.severity === ValidationSeverity.ERROR).map((err, idx) => (
                      <div key={idx} className="validation-error-item validation-error-item--secondary text-danger text-body flex-row gap-10">
                        <AlertTriangle size={18} className="no-shrink" />
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Rein informative Hinweise des Katalogautors (warning/info) — sichtbar,
                    aber ohne die Liste zu blockieren; daher unabhängig von isRosterValid. */}
                {advisoryMessages.length > 0 && (
                  <div className="validation-error-list validation-error-list--advisory">
                    {advisoryMessages.map((err, idx) => (
                      <div key={idx} className="validation-error-item text-dim text-body flex-row gap-10">
                        <AlertTriangle size={18} className="no-shrink" />
                        <span>{err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {extraResources.length > 0 && (
                  <div className="roster-extra-resources">
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
