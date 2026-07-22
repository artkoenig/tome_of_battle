import React from 'react';
import {
  computeRosterCounts,
  findForceEntryById,
  collectUnreachableArmyWideSelectors,
  childSelectionsOf
} from '../../solver/validator';

import CategoryUnitAdder from './CategoryUnitAdder';
import AutoFillSuggestions from './AutoFillSuggestions';
import RosterCategorySection from './RosterCategorySection';
import RosterValidationPanel from './RosterValidationPanel';
import UnitCardList from './UnitCardList';
import { useTranslation } from '../../i18n/useTranslation';

// Ab dieser Restpunktzahl lohnt ein Auffüll-Vorschlag: darunter ist noch etwas
// bezahlbar, darüber wäre der Vorschlag beliebig.
const AUTO_FILL_SUGGESTION_THRESHOLD = 50;

/**
 * Ein Kontingent („force“) der Liste: seine Kategorie-Gruppen, die armeeweiten
 * Auswahlen, die Auffangsektion für Auswahlen ohne Kategorie, die
 * Auffüll-Vorschläge und der Lagerbericht.
 *
 * Die Komponente komponiert nur — jede fachliche Entscheidung liegt in der
 * jeweiligen Untersektion oder im Solver.
 */
export default function ForceEditorSection({
  force,
  system,
  roster,
  activeCatalogue,
  validationErrors,
  costTypeLabel,
  addUnit,
  removeUnit,
  subSelectionOperations,
  unitCardContext,
  isRuleGroupExpanded,
  onToggleRuleGroup,
  onShowRule,
  remainingPoints,
  extraResources,
  onPlay
}) {
  const { t } = useTranslation();
  const armyWideSectionTitle = t('editor.section.armyWide');
  const uncategorizedSectionTitle = t('editor.section.uncategorized');
  const forceDefinition = findForceEntryById(system, force.forceEntryId);
  const categoryLinks = forceDefinition?.categoryLinks || [];
  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const forceCategoryCounts = categoryCounts[force.id] || {};

  // Armeeweite Pflicht-Selektoren, die keine Kontingent-Kategorie anbietet (etwa
  // ein kontingent-gebundener Wurzeleintrag ohne passenden categoryLink), bekommen
  // einen eigenen Konfigurator; alles, was eine Kategorie bereits anbietet, wird dort erledigt.
  const armyWideSelectors = collectUnreachableArmyWideSelectors({
    system, catalogueId: force.catalogueId || roster.catalogueId, forceDef: forceDefinition,
    roster, selectionCounts, forceCategoryCounts, force
  });
  const armyWideSelectorIds = new Set(armyWideSelectors.map(entry => entry.id));
  const belongsToArmyWideSelector = s => armyWideSelectorIds.has(s.selectionEntryId || s.entryLinkId);
  const armyWideSelectorSelections = childSelectionsOf(force).filter(belongsToArmyWideSelector);

  const matchedCategoryIds = new Set(categoryLinks.map(l => l.targetId));
  const uncategorizedSelections = childSelectionsOf(force).filter(s =>
    !matchedCategoryIds.has(s.category) && !belongsToArmyWideSelector(s));

  const showAutoFillSuggestions = remainingPoints > 0 && remainingPoints <= AUTO_FILL_SUGGESTION_THRESHOLD;

  // Das Ziel-Kontingent ist genau hier bekannt: jede Sektion rendert eines. Die
  // Untersektionen heben damit weiter über zwei Argumente aus und müssen den
  // Kontingent-Bezug nicht durchreichen.
  const addUnitToThisForce = (entry, categoryId) => addUnit(entry, categoryId, force.id);

  return (
    <div className="force-editor-section">
      {categoryLinks.map(categoryLink => (
        <RosterCategorySection
          key={categoryLink.targetId}
          categoryLink={categoryLink}
          force={force}
          system={system}
          roster={roster}
          activeCatalogue={activeCatalogue}
          validationErrors={validationErrors}
          selectionCounts={selectionCounts}
          forceCategoryCounts={forceCategoryCounts}
          costTypeLabel={costTypeLabel}
          addUnit={addUnitToThisForce}
          removeUnit={removeUnit}
          subSelectionOperations={subSelectionOperations}
          unitCardContext={unitCardContext}
          isRuleGroupExpanded={isRuleGroupExpanded(force.id, categoryLink.targetId)}
          onToggleRuleGroup={() => onToggleRuleGroup(force.id, categoryLink.targetId)}
          onShowRule={onShowRule}
        />
      ))}

      {armyWideSelectors.length > 0 && (
        <div className="roster-category-group">
          <div className="roster-category-header">
            <h3 className="text-subheading roster-category-heading">{armyWideSectionTitle}</h3>
            <CategoryUnitAdder
              categoryName={armyWideSectionTitle}
              entries={armyWideSelectors}
              system={system}
              activeCatalogue={activeCatalogue}
              costTypeLabel={costTypeLabel}
              costLimitType={roster.costLimitType}
              addUnit={addUnitToThisForce}
              roster={roster}
              selectionCounts={selectionCounts}
              force={force}
            />
          </div>
          <UnitCardList selections={armyWideSelectorSelections} cardContext={unitCardContext} />
        </div>
      )}

      {uncategorizedSelections.length > 0 && (
        <div className="roster-category-group">
          <h3 className="text-subheading roster-category-heading--standalone">{uncategorizedSectionTitle}</h3>
          <UnitCardList selections={uncategorizedSelections} cardContext={unitCardContext} />
        </div>
      )}

      {showAutoFillSuggestions && (
        <AutoFillSuggestions
          roster={roster}
          system={system}
          activeCatalogue={activeCatalogue}
          remainingPoints={remainingPoints}
          subSelectionOperations={subSelectionOperations}
          costTypeLabel={costTypeLabel}
        />
      )}

      <RosterValidationPanel
        validationErrors={validationErrors}
        extraResources={extraResources}
        onPlay={onPlay}
      />
    </div>
  );
}
