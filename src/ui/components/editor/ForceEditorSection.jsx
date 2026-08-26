import React from 'react';
import { useForceSection } from '../../viewmodels/editor/useForceSection';

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
 * Die Komponente komponiert nur — jede fachliche Entscheidung liegt in
 * {@link useForceSection} oder im ViewModel der jeweiligen Untersektion.
 * `forcePath` ist der Slot-Pfad, unter dem der Bericht die Slots dieses
 * Kontingents **führt** (Zuordnung `pathByForceId`, Issue 0121, Task 18) —
 * nicht der Eingabe-Index des Rosters: ein Kontingent vor diesem, dessen
 * Definition der Katalog nicht mehr kennt, hängt gar nicht im Auswertungsbaum
 * und verschiebt alle folgenden Pfade. `forcePath === null` heißt: der Bericht
 * führt für dieses Kontingent keine Slots — es zeigt dann weder Angebote noch
 * Kategorie-Grenzen.
 *
 * `ruleGroups` ist der Auf-/Zuklapp-Zustand der Listenregel-Gruppen, den der
 * Editor führt: `{ isExpanded(forceId, categoryId), onToggle(forceId, categoryId) }`.
 */
export default function ForceEditorSection({
  force,
  forcePath = null,
  unitCardContext,
  ruleGroups,
  onShowRule,
  onPlay
}) {
  const { t } = useTranslation();
  const armyWideSectionTitle = t('editor.section.armyWide');
  const uncategorizedSectionTitle = t('editor.section.uncategorized');
  const { categories, armyWideEntries, armyWideSelections, uncategorizedSelections } =
    useForceSection({ force, forcePath });

  return (
    <div className="force-editor-section">
      {categories.map(category => (
        <RosterCategorySection
          key={category.id}
          category={category}
          force={force}
          forcePath={forcePath}
          unitCardContext={unitCardContext}
          ruleGroup={{
            isExpanded: ruleGroups?.isExpanded?.(force.id, category.id) ?? false,
            onToggle: () => ruleGroups?.onToggle?.(force.id, category.id)
          }}
          onShowRule={onShowRule}
        />
      ))}

      {armyWideEntries.length > 0 && (
        <div className="roster-category-group">
          <div className="roster-category-header">
            <h3 className="text-subheading roster-category-heading">{armyWideSectionTitle}</h3>
            <CategoryUnitAdder
              forceId={force.id}
              forcePath={forcePath}
              categoryName={armyWideSectionTitle}
              entries={armyWideEntries}
            />
          </div>
          <UnitCardList selections={armyWideSelections} cardContext={unitCardContext} />
        </div>
      )}

      {uncategorizedSelections.length > 0 && (
        <div className="roster-category-group">
          <h3 className="text-subheading roster-category-heading--standalone">{uncategorizedSectionTitle}</h3>
          <UnitCardList selections={uncategorizedSelections} cardContext={unitCardContext} />
        </div>
      )}

      <AutoFillSuggestions forceId={force.id} forcePath={forcePath} />

      <RosterValidationPanel onPlay={onPlay} />
    </div>
  );
}
