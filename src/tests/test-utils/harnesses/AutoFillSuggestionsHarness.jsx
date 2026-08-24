import React from 'react';

import AutoFillSuggestions from '../../../ui/components/editor/AutoFillSuggestions';
import { withProviders, systemNaming, budgetFor } from './sectionHarnessBase';

/** `AutoFillSuggestions` mit dem Prop-Satz von vor Issue 0164. */
export function AutoFillSuggestionsHarness({
  capabilities, subSelectionOperations, costTypeLabel, forcePath = null,
  remainingPoints = null, costLimitTypeId = null, forceCatalogueId = null,
  pathBySelectionId = null, addUnit = null, system = null, activeCatalogue = null,
}) {
  const forceId = 'harness-force';
  const { roster, spent } = budgetFor(
    { costLimitType: costLimitTypeId, catalogueId: forceCatalogueId ?? activeCatalogue?.id ?? null },
    remainingPoints, costLimitTypeId);
  return withProviders({
    report: {
      capabilities,
      pathBySelectionId: pathBySelectionId ?? new Map(),
      costTotals: spent === null || costLimitTypeId === null ? {} : { [costLimitTypeId]: spent },
      pathByForceId: new Map(forcePath === null ? [] : [[forceId, forcePath]]),
    },
    roster: { ...roster, forces: [{ id: forceId, catalogueId: forceCatalogueId ?? null }] },
    system: systemNaming(system, costLimitTypeId, costTypeLabel),
    activeCatalogue,
    commands: { addUnit: addUnit ?? undefined, subSelectionOperations },
    children: <AutoFillSuggestions forceId={forceId} forcePath={forcePath} />,
  });
}
