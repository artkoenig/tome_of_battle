import React from 'react';

import RosterSidebar from '../../components/editor/RosterSidebar';
import { withProviders, systemNaming } from './sectionHarnessBase';

/** `RosterSidebar` mit dem Prop-Satz von vor Issue 0164. */
export function RosterSidebarHarness({
  roster, costTotals, costTypes, capabilities, violations, costTypeLabel,
  system, forcePath = null, ...sidebarProps
}) {
  const force = roster?.forces?.[0] ?? { id: 'harness-force' };
  return withProviders({
    report: {
      violations,
      capabilities,
      costTotals,
      description: costTypes ? { costTypes } : null,
      pathByForceId: new Map(forcePath === null ? [] : [[force.id, forcePath]]),
    },
    roster: { ...(roster ?? {}), forces: roster?.forces ?? [force] },
    system: systemNaming(system, roster?.costLimitType, costTypeLabel),
    commands: {},
    children: <RosterSidebar {...sidebarProps} />,
  });
}
