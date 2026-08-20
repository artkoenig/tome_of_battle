import React from 'react';

import CategoryUnitAdder from '../../components/editor/CategoryUnitAdder';
import { withProviders, systemNaming } from './sectionHarnessBase';

/** `CategoryUnitAdder` mit dem Prop-Satz von vor Issue 0164. */
export function CategoryUnitAdderHarness({
  capabilities, system, activeCatalogue, costTypeLabel, costLimitType, addUnit,
  ...adderProps
}) {
  return withProviders({
    report: { capabilities },
    roster: { costLimitType: costLimitType ?? null, catalogueId: activeCatalogue?.id ?? null },
    system: systemNaming(system, costLimitType, costTypeLabel),
    activeCatalogue,
    // Der Aushebe-Callback trug vor Issue 0164 kein Kontingent — die Hülle
    // reicht die beiden Argumente durch, die ein Test erwartet.
    commands: { addUnit: (entry, categoryId) => addUnit?.(entry, categoryId) },
    children: <CategoryUnitAdder {...adderProps} />,
  });
}
