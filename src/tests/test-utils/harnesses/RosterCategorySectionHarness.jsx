import React from 'react';

import RosterCategorySection from '../../../ui/components/editor/RosterCategorySection';
import { withProviders, systemNaming } from './sectionHarnessBase';

/** `RosterCategorySection` mit dem Prop-Satz von vor Issue 0164. */
export function RosterCategorySectionHarness({
  force, forcePath = null, forceCatalogueId: _forceCatalogueId,
  system, roster, activeCatalogue, violations, capabilities, pathBySelectionId,
  costTypeLabel, addUnit, removeUnit, subSelectionOperations,
  isRuleGroupExpanded, onToggleRuleGroup,
  ...sectionProps
}) {
  return withProviders({
    report: { violations, capabilities, pathBySelectionId },
    roster: { ...(roster ?? {}), forces: [force] },
    system: systemNaming(system, roster?.costLimitType, costTypeLabel),
    activeCatalogue,
    commands: {
      addUnit: (entry, categoryId) => addUnit?.(entry, categoryId),
      removeUnit,
      subSelectionOperations,
    },
    children: (
      <RosterCategorySection
        {...sectionProps}
        force={force}
        forcePath={forcePath}
        ruleGroup={{ isExpanded: !!isRuleGroupExpanded, onToggle: onToggleRuleGroup }}
      />
    ),
  });
}
