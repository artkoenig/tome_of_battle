import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  findEntryInSystem,
  childSelectionsOf
} from '../../roster';
import { resolveListRuleGroupFromReport } from '../../evaluation/listRuleGroups';

import { isBlockingViolation } from '../../evaluation/violationStats';
import { findCategoryAnchorSlot, hasUnitSlotsInCategory } from '../../evaluation/slotLookups';
import CategoryUnitAdder from './CategoryUnitAdder';
import ListRuleChecklist from './ListRuleChecklist';
import CategoryCountBadge from './CategoryCountBadge';
import UnitCardList from './UnitCardList';
import { useTranslation } from '../../i18n/useTranslation';

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
  forcePath,
  forceCatalogueId = null,
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
  onShowRule
}) {
  const { t } = useTranslation();
  const categoryId = categoryLink.targetId;
  // Der Kategorie-Anker dieses Kontingents (Issue 0121, Task 7): der Evaluator
  // verankert eine Kategorie an einem Slot mit `anchorKind: 'categoryAnchor'`,
  // dessen `defId` der `categoryLink` (verlinkter Fall) oder die Kategorie selbst
  // ist (unverlinkter Fall, `report.js`-Ankervertrag). Er trägt den Zähl-Chip —
  // und die Sichtbarkeit: `isHidden` ist der **effektive** Zustand des Berichts
  // (statisches Attribut plus greifende `field="hidden"`-Modifikatoren), nicht
  // mehr eine zweite Katalog-Auswertung in der Oberfläche (Issue 0156).
  const categoryAnchor = findCategoryAnchorSlot(capabilities, forcePath, categoryId)
    ?? findCategoryAnchorSlot(capabilities, forcePath, categoryLink.id);
  const isHidden = categoryAnchor?.isHidden === true;
  const selections = childSelectionsOf(force).filter(s => s.category === categoryId);

  // Eine Listenregel-Gruppe (datengetrieben: Katalogtyp = upgrade, ADR 0003) ist
  // eine listenweite Einstellungsgruppe, kein Einheiten-Slot: ihre Karten haben
  // keine Einheiten-Aktionen und die Gruppe bietet keinen „Einheit hinzufügen“-
  // Knopf. Klassifikation und Zustände je Regel liest der **Bericht** (Issue
  // 0156): welche Definitionen die Kategorie anbietet, welche davon Listenregeln
  // und welche Pflicht sind, und welche gerade belegt sind. Nur der
  // Katalog-Eintrag hinter einer Regel kommt weiter aus dem Schreibmodell — ihn
  // braucht das Anhaken, nicht die Anzeige.
  const selectionByPath = new Map();
  for (const selection of childSelectionsOf(force)) {
    const path = pathBySelectionId?.get(selection.id);
    if (path !== undefined) selectionByPath.set(path, selection);
  }
  const { isListRuleGroup, states: listRuleStates } = resolveListRuleGroupFromReport(
    capabilities, forcePath, categoryId, {
      selectionByPath,
      entryOf: (capability) => findEntryInSystem(system, capability.defId, activeCatalogue?.id)
        ?? { id: capability.defId, name: capability.name },
    }
  );
  const isRuleGroupCollapsed = isListRuleGroup && !isRuleGroupExpanded;

  // Eine ausgeblendete Kategorie ohne Auswahlen hat keinen Anlass zu erscheinen.
  if (isHidden && selections.length === 0) {
    return null;
  }

  const categoryDefinition = system.categoryEntries?.find(ce => ce.id === categoryId);
  const categoryName = categoryDefinition ? categoryDefinition.name : categoryLink.name;
  // Blockierende Verletzungen dieser Kategorie: der Evaluator verankert eine
  // Kategorie-Grenze an einem Kategorie-Anker (`anchorKind: 'categoryAnchor'`),
  // dessen `defId` der `categoryLink` (verlinkter Fall) oder die Kategorie
  // selbst ist (unverlinkter Fall, `report.js`-Ankervertrag).
  const categoryViolations = violations.filter(violation =>
    isBlockingViolation(violation)
    && violation.anchor?.anchorKind === 'categoryAnchor'
    && (violation.anchor.defId === categoryId || violation.anchor.defId === categoryLink.id));
  // Ob diese Kategorie für irgendeine Einheit des Kontingents die
  // Primär-Kategorie ist, sagt der Bericht: er führt je Slot die **effektive**
  // Primär-Kategorie (`primaryCategoryId`), also auch die erst durch einen
  // `set-primary`-Modifikator zugewiesene (ADR 0003 §4, Issue 0156).
  const isPrimaryForAnyEntry = hasUnitSlotsInCategory(capabilities, forcePath, categoryId);

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
          title={isListRuleGroup ? (isRuleGroupCollapsed ? t('editor.listRules.expand') : t('editor.listRules.collapse')) : undefined}
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
              count={categoryAnchor?.current ?? 0}
              min={categoryAnchor?.effectiveMin ?? null}
              max={categoryAnchor?.effectiveMax ?? null}
              hasErrors={categoryViolations.length > 0}
            />
          )}
        </div>
        {!isListRuleGroup && (
          <CategoryUnitAdder
            categoryId={categoryId}
            categoryName={categoryName}
            capabilities={capabilities}
            forcePath={forcePath}
            system={system}
            activeCatalogue={activeCatalogue}
            costTypeLabel={costTypeLabel}
            costLimitType={roster.costLimitType}
            addUnit={addUnit}
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
            capabilities={capabilities}
            forcePath={forcePath}
            pathBySelectionId={pathBySelectionId}
            states={listRuleStates}
            addUnit={addUnit}
            removeUnit={removeUnit}
            subSelectionOperations={subSelectionOperations}
            costTypeLabel={costTypeLabel}
            costLimitType={roster.costLimitType}
            onShowRule={onShowRule}
          />
        )
      ) : (
        <UnitCardList selections={selections} cardContext={unitCardContext} />
      )}
    </div>
  );
}
