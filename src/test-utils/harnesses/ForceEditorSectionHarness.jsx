import React from 'react';

import ForceEditorSection from '../../components/editor/ForceEditorSection';
import { withProviders, systemNaming, describeExtras, budgetFor } from './sectionHarnessBase';

/** `ForceEditorSection` mit dem Prop-Satz von vor Issue 0164. */
export function ForceEditorSectionHarness({
  force, forcePath = null, system, roster, activeCatalogue,
  violations, unresolvedSelections, capabilities, pathBySelectionId,
  costTypeLabel, remainingPoints = null, extraResources,
  addUnit, removeUnit, subSelectionOperations,
  isRuleGroupExpanded, onToggleRuleGroup,
  ...sectionProps
}) {
  const costLimitType = roster?.costLimitType ?? null;
  const extras = describeExtras(extraResources);
  const budget = budgetFor(roster, remainingPoints);
  const costTotals = { ...extras.costTotals };
  if (budget.spent !== null && costLimitType) costTotals[costLimitType] = budget.spent;
  return withProviders({
    report: {
      violations, unresolvedSelections, capabilities, pathBySelectionId,
      costTotals,
      description: { costTypes: extras.costTypes },
      pathByForceId: new Map(forcePath === null ? [] : [[force.id, forcePath]]),
    },
    roster: { ...budget.roster, forces: [force] },
    system: systemNaming(system, costLimitType, costTypeLabel),
    activeCatalogue,
    commands: { addUnit, removeUnit, subSelectionOperations },
    children: (
      <ForceEditorSection
        {...sectionProps}
        force={force}
        forcePath={forcePath}
        ruleGroups={{ isExpanded: isRuleGroupExpanded, onToggle: onToggleRuleGroup }}
      />
    ),
  });
}
