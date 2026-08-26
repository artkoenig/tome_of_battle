import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCategorySection } from '../../viewmodels/editor/useCategorySection';
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
 * Ob die Gruppe überhaupt erscheint, wie sie heißt und was ihr Zähl-Chip zeigt,
 * sagt seit Issue 0164 {@link useCategorySection}; hier steht nur noch das
 * Markup. `ruleGroup` bündelt den Auf-/Zuklapp-Zustand der Listenregel-Gruppe
 * (`{ isExpanded, onToggle }`), den der Editor führt.
 */
export default function RosterCategorySection({
  category,
  force,
  forcePath = null,
  unitCardContext,
  ruleGroup,
  onShowRule
}) {
  const { t } = useTranslation();
  const { isVisible, categoryId, categoryName, selections, isListRuleGroup, badge } =
    useCategorySection({ force, forcePath, category });

  if (!isVisible) return null;

  const isRuleGroupCollapsed = isListRuleGroup && !ruleGroup?.isExpanded;

  return (
    <div className="roster-category-group">
      <div className="roster-category-header">
        <div
          className={`roster-category-title${isListRuleGroup ? ' roster-category-title--collapsible' : ''}`}
          onClick={isListRuleGroup ? ruleGroup?.onToggle : undefined}
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
              count={badge.count}
              min={badge.min}
              max={badge.max}
              hasErrors={badge.hasErrors}
            />
          )}
        </div>
        {!isListRuleGroup && (
          <CategoryUnitAdder
            forceId={force?.id ?? null}
            forcePath={forcePath}
            categoryId={categoryId}
            categoryName={categoryName}
          />
        )}
      </div>

      {isListRuleGroup ? (
        !isRuleGroupCollapsed && (
          <ListRuleChecklist
            forceId={force?.id ?? null}
            forcePath={forcePath}
            categoryId={categoryId}
            onShowRule={onShowRule}
          />
        )
      ) : (
        <UnitCardList selections={selections} cardContext={unitCardContext} />
      )}
    </div>
  );
}
