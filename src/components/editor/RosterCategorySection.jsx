import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  getModifiedConstraintValue,
  getEffectiveModifiers,
  isCategoryLinkHidden,
  isEntryPrimaryInCategory,
  resolveListRuleGroup,
  childSelectionsOf
} from '../../solver/validator';

import CategoryUnitAdder from './CategoryUnitAdder';
import ListRuleChecklist from './ListRuleChecklist';
import CategoryCountBadge from './CategoryCountBadge';
import UnitCardList from './UnitCardList';

/**
 * Prüft, ob der Katalog des Kontingents überhaupt einen Eintrag kennt, für den
 * diese Kategorie die Primär-Kategorie ist.
 *
 * Maßgeblich ist die **effektive** (nach Modifikatoren wirksame)
 * Primär-Kategorie, damit eine Sektion auch dann erscheint, wenn ihre Einheiten
 * erst durch einen `set-primary`-Modifikator hineinfallen — deckungsgleich mit
 * dem, was der Kategorie-Hinzufüger anbietet (ADR 0003 §4).
 */
function hasPrimaryCatalogItems({ system, roster, force, selectionCounts, categoryId }) {
  const forceCatalogue = system.catalogues?.find(c => c.id === force.catalogueId);
  if (!forceCatalogue) return false;

  const isPrimaryHere = (entry) =>
    isEntryPrimaryInCategory(entry, categoryId, { system, roster, selectionCounts, force });

  return forceCatalogue.selectionEntries?.some(isPrimaryHere) ||
         forceCatalogue.entryLinks?.some(isPrimaryHere) ||
         forceCatalogue.sharedSelectionEntries?.some(isPrimaryHere);
}

/**
 * Eine Kategorie-Gruppe eines Kontingents: Kopfzeile mit Namen, Zähl-Chip und
 * Hinzufüger, darunter entweder die Ankreuzliste der Listenregeln oder die
 * Einheitenkarten der Kategorie.
 *
 * Die Komponente entscheidet auch, ob die Gruppe überhaupt erscheint — die
 * Sichtbarkeit hängt allein von den Daten dieser einen Kategorie ab und gehört
 * daher hierher.
 */
export default function RosterCategorySection({
  categoryLink,
  force,
  system,
  roster,
  activeCatalogue,
  validationErrors,
  selectionCounts,
  forceCategoryCounts,
  costTypeLabel,
  addUnit,
  removeUnit,
  subSelectionOperations,
  unitCardContext,
  isRuleGroupExpanded,
  onToggleRuleGroup,
  onShowRule
}) {
  const categoryId = categoryLink.targetId;
  const isHidden = isCategoryLinkHidden(categoryLink, { system, roster, selectionCounts, forceCategoryCounts });
  const selections = childSelectionsOf(force).filter(s => s.category === categoryId);

  // Eine Listenregel-Gruppe (datengetrieben: Katalogtyp = upgrade, ADR 0003) ist
  // eine listenweite Einstellungsgruppe, kein Einheiten-Slot: ihre Karten haben
  // keine Einheiten-Aktionen und die Gruppe bietet keinen „Einheit hinzufügen“-
  // Knopf. Ein Solver-Aufruf klassifiziert die Gruppe und liefert im selben
  // Katalog-Durchlauf die Zustände je Regel für die ListRuleChecklist.
  const { isListRuleGroup, states: listRuleStates } = resolveListRuleGroup(
    system, activeCatalogue, categoryId, { roster, force }
  );
  const isRuleGroupCollapsed = isListRuleGroup && !isRuleGroupExpanded;

  // Eine ausgeblendete Kategorie ohne Auswahlen hat keinen Anlass zu erscheinen.
  if (isHidden && selections.length === 0) {
    return null;
  }

  const categoryDefinition = system.categoryEntries?.find(ce => ce.id === categoryId);
  const categoryName = categoryDefinition ? categoryDefinition.name : categoryLink.name;
  const categoryErrors = validationErrors.filter(e => e.categoryId === categoryId);
  const count = forceCategoryCounts[categoryId] || 0;

  const displayContext = { roster, system, selectionCounts, forceCategoryCounts };
  const minConstraint = categoryLink.constraints?.find(c => c.type === 'min');
  const maxConstraint = categoryLink.constraints?.find(c => c.type === 'max');
  const linkModifiers = getEffectiveModifiers(categoryLink);
  const minValue = minConstraint ? getModifiedConstraintValue(minConstraint, linkModifiers, displayContext) : 0;
  const maxValue = maxConstraint ? getModifiedConstraintValue(maxConstraint, linkModifiers, displayContext) : Infinity;

  const isPrimaryForAnyEntry = hasPrimaryCatalogItems({ system, roster, force, selectionCounts, categoryId });

  // Kategorien, die für keine Einheit die Primär-Kategorie sind und nichts
  // enthalten, sind reine Regel-Schlagworte (etwa „Charaktermodelle“) statt
  // bedienbarer Slots — sie bleiben vollständig verborgen.
  if (selections.length === 0 && !isPrimaryForAnyEntry) {
    return null;
  }

  // Leere Kategorien bleiben bewusst sichtbar — auch auf dem Desktop, wo sie
  // aufgeräumter wirken würden, wenn man sie ausblendete: mobil ist ihr
  // Hinzufüger der einzige Weg, eine Einheit dieser Kategorie aufzunehmen.
  return (
    <div className="roster-category-group">
      <div className="roster-category-header">
        <div
          className={`roster-category-title${isListRuleGroup ? ' roster-category-title--collapsible' : ''}`}
          onClick={isListRuleGroup ? onToggleRuleGroup : undefined}
          role={isListRuleGroup ? 'button' : undefined}
          aria-expanded={isListRuleGroup ? !isRuleGroupCollapsed : undefined}
          title={isListRuleGroup ? (isRuleGroupCollapsed ? 'Listenregeln ausklappen' : 'Listenregeln einklappen') : undefined}
        >
          {isListRuleGroup && (isRuleGroupCollapsed
            ? <ChevronRight size={18} className="text-gold" aria-hidden="true" />
            : <ChevronDown size={18} className="text-gold" aria-hidden="true" />)}
          <h3 className="text-subheading roster-category-heading">
            {categoryName}
          </h3>
          {/* Der Zähl-Chip entfällt für die Listenregel-Gruppe: die Ankreuzliste
              zeigt den An/Aus-Zustand bereits pro Regel; eine Gesamtzahl ist redundant. */}
          {!isListRuleGroup && (
            <CategoryCountBadge
              count={count}
              minValue={minValue}
              maxValue={maxValue}
              minConstraint={minConstraint}
              maxConstraint={maxConstraint}
              hasErrors={categoryErrors.length > 0}
            />
          )}
        </div>
        {!isListRuleGroup && (
          <CategoryUnitAdder
            categoryId={categoryId}
            categoryName={categoryName}
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
            categoryId={categoryId}
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
        <UnitCardList selections={selections} cardContext={unitCardContext} />
      )}
    </div>
  );
}
