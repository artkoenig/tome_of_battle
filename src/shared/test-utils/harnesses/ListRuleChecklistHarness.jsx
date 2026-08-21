import React from 'react';

import ListRuleChecklist from '../../../ui/components/editor/ListRuleChecklist';
import { withProviders, systemNaming } from './sectionHarnessBase';

/**
 * Ein Bericht, aus dem `resolveListRuleGroupFromReport` genau die übergebenen
 * `states` wieder herstellt: je Regel ein Slot unter dem Kontingent, ein
 * Kind-Slot für einen Behälter, und für eine angehakte Regel eine Auswahl im
 * Kontingent unter demselben Pfad.
 */
const reportFromListRuleStates = (states, categoryId, forcePath) => {
  const capabilities = new Map();
  const pathBySelectionId = new Map();
  const selections = [];
  (states ?? []).forEach((state, index) => {
    const path = `${forcePath}/${index}`;
    capabilities.set(path, {
      anchorKind: state.checked ? 'occupied' : 'offerAnchor',
      isIndependentSubUnit: false,
      defId: state.entry?.id ?? state.resolvedId,
      targetDefId: state.resolvedId,
      name: state.name,
      isHidden: false,
      isListRule: true,
      isMandatoryListRule: state.mandatory === true,
      primaryCategoryId: categoryId,
      effectiveMax: state.isBinary === false ? 5 : 1,
      raiseCosts: {},
    });
    if (state.isContainer) {
      capabilities.set(`${path}/0`, {
        anchorKind: 'offerAnchor', defId: `${state.resolvedId}-child`,
        isIndependentSubUnit: false,
        primaryCategoryId: null,
        name: `${state.name} option`, isHidden: false, raiseCosts: {},
      });
    }
    if (state.selection) {
      pathBySelectionId.set(state.selection.id, path);
      selections.push(state.selection);
    }
  });
  return { capabilities, pathBySelectionId, selections };
};

/** `ListRuleChecklist` mit dem Prop-Satz von vor Issue 0164. */
export function ListRuleChecklistHarness({
  system, activeCatalogue, categoryId, roster, states, forcePath = '0',
  addUnit, removeUnit, subSelectionOperations, costTypeLabel, costLimitType,
  capabilities: _capabilities, pathBySelectionId: _pathBySelectionId, force: _force,
  ...checklistProps
}) {
  const built = reportFromListRuleStates(states, categoryId, forcePath);
  const forceId = 'harness-force';
  return withProviders({
    report: { capabilities: built.capabilities, pathBySelectionId: built.pathBySelectionId },
    roster: {
      ...(roster ?? {}),
      costLimitType: costLimitType ?? roster?.costLimitType ?? null,
      forces: [{ id: forceId, selections: built.selections }],
    },
    // Die Regel-Eintraege standen frueher in `states`; das ViewModel loest sie
    // ueber den Katalog auf, also legt die Huelle sie dort ab.
    system: {
      ...systemNaming(system, costLimitType ?? roster?.costLimitType, costTypeLabel),
      catalogues: [
        {
          id: activeCatalogue?.id ?? 'harness-catalogue',
          selectionEntries: (states ?? []).map(state => state.entry).filter(Boolean),
        },
        ...(system?.catalogues ?? []),
      ],
    },
    activeCatalogue,
    commands: {
      addUnit: (entry, cat) => addUnit?.(entry, cat),
      removeUnit,
      subSelectionOperations,
    },
    children: (
      <ListRuleChecklist
        {...checklistProps}
        forceId={forceId}
        forcePath={forcePath}
        categoryId={categoryId}
      />
    ),
  });
}
