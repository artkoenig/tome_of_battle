import React from 'react';
import {
  computeRosterCounts,
  findForceEntryById,
  findEntryInSystem,
  childSelectionsOf
} from '../../roster';
import { armyWideSelectorSlotsOf } from '../../evaluation/armyWideSelectorSlots';

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
 * (`capabilities`/`violations`, Issue 0121). `forcePath` ist der Slot-Pfad, unter
 * dem der Bericht die Slots dieses Kontingents **führt** (Zuordnung
 * `pathByForceId`, Issue 0121, Task 18) — nicht der Eingabe-Index des Rosters:
 * ein Kontingent vor diesem, dessen Definition der Katalog nicht mehr kennt,
 * hängt gar nicht im Auswertungsbaum und verschiebt alle folgenden Pfade.
 * `forcePath === null` heißt: der Bericht führt für dieses Kontingent keine
 * Slots — es zeigt dann weder Angebote noch Kategorie-Grenzen.
 *
 * `remainingPoints` sind die Punkte, die der Liste zu ihrem eingestellten Wert
 * fehlen (`null` = keine Punktgrenze gesetzt) — die Auffüll-Vorschläge leben
 * von dieser Differenz (Issue 0135). Sie ist roster-weit, wie die Punktgrenze
 * selbst; jedes Kontingent zeigt sie deshalb gleich.
 */
export default function ForceEditorSection({
  force,
  forcePath,
  system,
  roster,
  activeCatalogue,
  violations,
  unresolvedSelections,
  capabilities,
  pathBySelectionId,
  costTypeLabel,
  remainingPoints = null,
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
  // Das Armeebuch **dieses** Kontingents (ein `.ros`-Import bringt verbündete
  // Kontingente mit eigenem Katalog mit), ersatzweise das der Liste — dieselbe
  // Regel wie `useRoster.catalogueIdOfForce`. Der Aushebe-Dialog filtert damit
  // seine Kandidaten nach Herkunft (Issue 0121, Task 19).
  const forceCatalogueId = force.catalogueId || roster.catalogueId || null;
  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const forceCategoryCounts = categoryCounts[force.id] || {};

  // Armeeweite Pflicht-Selektoren, die keine Kontingent-Kategorie anbietet (etwa
  // ein kontingent-gebundener Wurzeleintrag ohne passenden categoryLink), bekommen
  // einen eigenen Konfigurator; alles, was eine Kategorie bereits anbietet, wird
  // dort erledigt. Welche das sind, sagt der **Bericht** (Issue 0156): sichtbare
  // Slots dieses Kontingents mit wirksamem Minimum, deren effektive Kategorien
  // keine Kategorie des Kontingents treffen. Der Katalog-Eintrag daneben ist
  // Schreibmodell — der Aushebe-Dialog reicht ihn an `addUnit` weiter.
  const armyWideSelectorSlots = armyWideSelectorSlotsOf(
    capabilities, forcePath, categoryLinks.map(link => link.targetId));
  const armyWideSelectors = armyWideSelectorSlots.map(capability =>
    findEntryInSystem(system, capability.defId, forceCatalogueId)
    ?? { id: capability.defId, name: capability.name });
  const armyWideSelectorIds = new Set(armyWideSelectorSlots.flatMap(capability =>
    [capability.defId, capability.targetDefId].filter(Boolean)));
  const belongsToArmyWideSelector = s => armyWideSelectorIds.has(s.selectionEntryId || s.entryLinkId);
  const armyWideSelectorSelections = childSelectionsOf(force).filter(belongsToArmyWideSelector);

  const matchedCategoryIds = new Set(categoryLinks.map(l => l.targetId));
  const uncategorizedSelections = childSelectionsOf(force).filter(s =>
    !matchedCategoryIds.has(s.category) && !belongsToArmyWideSelector(s));

  // Die Auffüll-Vorschläge speisen sich aus den wählbaren Slots des Berichts
  // (ADR-0035) — beschränkt auf die Slots DIESES Kontingents; das Panel blendet
  // sich selbst aus, wenn nichts mehr zu füllen ist.
  // Ohne Pfad führt der Bericht für dieses Kontingent keine Slots — dann gibt
  // es auch nichts vorzuschlagen.
  const forceScopedCapabilities = forcePath === null || forcePath === undefined
    ? new Map()
    : new Map(
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
          forceCatalogueId={forceCatalogueId}
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
        forcePath={forcePath ?? null}
        remainingPoints={remainingPoints}
        costLimitTypeId={roster.costLimitType ?? null}
        forceCatalogueId={forceCatalogueId}
        subSelectionOperations={subSelectionOperations}
        costTypeLabel={costTypeLabel}
        pathBySelectionId={pathBySelectionId}
        addUnit={addUnitToThisForce}
        system={system}
        activeCatalogue={activeCatalogue}
      />

      <RosterValidationPanel
        violations={violations}
        unresolvedSelections={unresolvedSelections}
        extraResources={extraResources}
        onPlay={onPlay}
      />
    </div>
  );
}
