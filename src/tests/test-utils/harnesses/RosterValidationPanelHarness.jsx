import React from 'react';

import RosterValidationPanel from '../../../ui/components/editor/RosterValidationPanel';
import { withProviders, describeExtras } from './sectionHarnessBase';

/** `RosterValidationPanel` mit dem Prop-Satz von vor Issue 0164. */
export function RosterValidationPanelHarness({
  violations, unresolvedSelections, extraResources, ...panelProps
}) {
  const extras = describeExtras(extraResources);
  return withProviders({
    report: {
      violations,
      unresolvedSelections,
      description: { costTypes: extras.costTypes },
      costTotals: extras.costTotals,
    },
    roster: { costLimitType: 'pts' },
    commands: {},
    children: <RosterValidationPanel {...panelProps} />,
  });
}
