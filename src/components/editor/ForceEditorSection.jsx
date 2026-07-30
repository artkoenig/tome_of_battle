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

/**
 * Ein Kontingent („force“) der Liste: seine Kategorie-Gruppen, die armeeweiten
 * Auswahlen, die Auffangsektion für Auswahlen ohne Kategorie, die
 * Auffüll-Vorschläge und der Lagerbericht.
 *
 * Die Komponente komponiert nur — jede fachliche Entscheidung liegt in der
 * jeweiligen Untersektion oder im Bericht der Evaluator-Fassade
 * (`capabilities`/`violations`, Issue 0121). `forcePath` ist der Slot-Pfad des
 * Kontingents im Bericht (Pfad-Schema der Fassade: `forces[i]` → `"i"`).
 */
export default function ForceEditorSection({
  force,
  forcePath,
  system,
  roster,
  activeCatalogue,
  violations,
  capabilities,
  pathBySelectionId,
  costTypeLabel,
  addUnit,
  removeUnit,
  subSelectionOperations,
  unitCardContext,
  isRuleGroupExpanded,
  onToggleRuleGroup,
  onShowRule,
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

  // Die Auffüll-Vorschläge speisen sich aus den Pflicht-Signalen des Berichts
  // (ADR-0035) — beschränkt auf die Slots DIESES Kontingents; das Panel blendet
  // sich selbst aus, wenn keine Pflicht offen ist.
  const forceScopedCapabilities = new Map(
    [...(capabilities ?? [])].filter(([path]) =>
      path === forcePath || path.startsWith(`${forcePath}/`))
  );

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
          forcePath={forcePath}
          forceDef={forceDefinition}
          system={system}
          roster={roster}
          activeCatalogue={activeCatalogue}
          violations={violations}
          capabilities={capabilities}
          pathBySelectionId={pathBySelectionId}
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
              capabilities={capabilities}
              forcePath={forcePath}
              system={system}
              activeCatalogue={activeCatalogue}
              costTypeLabel={costTypeLabel}
              costLimitType={roster.costLimitType}
              addUnit={addUnitToThisForce}
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

      <AutoFillSuggestions
        capabilities={forceScopedCapabilities}
        subSelectionOperations={subSelectionOperations}
        costTypeLabel={costTypeLabel}
        pathBySelectionId={pathBySelectionId}
        addUnit={addUnitToThisForce}
        system={system}
        activeCatalogue={activeCatalogue}
      />

      <RosterValidationPanel
        violations={violations}
        extraResources={extraResources}
        onPlay={onPlay}
      />
    </div>
  );
}
