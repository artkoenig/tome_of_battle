import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useListRuleChecklist } from '../../../../ui/viewmodels/editor/useListRuleChecklist';
import { createRosterProviderWrapper, createEmptyRosterReport, createNoopRosterCommands } from '../../../../tests/test-utils/rosterProviders';

/**
 * ViewModel-Tests der Listenregel-Ankreuzliste (Issue 0164): Zeilenliste,
 * Sperre und die beiden Schreib-Aktionen, alles aus dem Bericht.
 */

const CATEGORY = 'cat-rules';
const SYSTEM = {
  catalogues: [{
    id: 'cat-main',
    selectionEntries: [
      { id: 'e-switch', name: 'Schalter aus dem Katalog' },
      { id: 'e-mandatory', name: 'Pflicht aus dem Katalog' },
    ],
  }],
};

const ruleSlot = (over = {}) => ({
  anchorKind: 'offerAnchor',
  isIndependentSubUnit: false,
  defId: 'e-switch',
  targetDefId: null,
  name: 'Schalter',
  isHidden: false,
  isListRule: true,
  isMandatoryListRule: false,
  primaryCategoryId: CATEGORY,
  effectiveMax: 1,
  ...over,
});

const renderChecklist = ({ capabilities, selections = [], pathBySelectionId = new Map(), commands } = {}) =>
  renderHook(
    () => useListRuleChecklist({ forceId: 'f1', forcePath: '0', categoryId: CATEGORY }),
    {
      wrapper: createRosterProviderWrapper({
        report: createEmptyRosterReport({ capabilities, pathBySelectionId }),
        roster: { catalogueId: 'cat-main', forces: [{ id: 'f1', selections }] },
        system: SYSTEM,
        activeCatalogue: { id: 'cat-main' },
        commands: createNoopRosterCommands(commands),
      }),
    }
  );

describe('useListRuleChecklist', () => {
  it('zählt jede angebotene Regel auf, angehakt genau dann, wenn sie im Roster steht', () => {
    const { result } = renderChecklist({
      capabilities: new Map([
        ['0/0', ruleSlot({ defId: 'e-switch', targetDefId: 'r-switch', name: 'Schalter' })],
        ['0/1', ruleSlot({ anchorKind: 'occupied', defId: 'e-mandatory', targetDefId: 'r-mand', name: 'Pflicht' })],
      ]),
      selections: [{ id: 'sel-mand' }],
      pathBySelectionId: new Map([['sel-mand', '0/1']]),
    });

    expect(result.current.isListRuleGroup).toBe(true);
    expect(result.current.rows.map(row => [row.name, row.checked]))
      .toEqual([['Schalter', false], ['Pflicht', true]]);
  });

  it('eine Kategorie mit gewöhnlichen Einheiten liefert gar keine Zeilen', () => {
    const { result } = renderChecklist({
      capabilities: new Map([['0/0', ruleSlot({ isListRule: false })]]),
    });

    expect(result.current.isListRuleGroup).toBe(false);
    expect(result.current.rows).toEqual([]);
  });

  it('eine Pflichtregel ist gesperrt, solange sie präsent ist — und sonst nicht', () => {
    const present = renderChecklist({
      capabilities: new Map([['0/0', ruleSlot({
        anchorKind: 'occupied', defId: 'e-mandatory', targetDefId: 'r-mand',
        name: 'Pflicht', isMandatoryListRule: true,
      })]]),
      selections: [{ id: 'sel-mand' }],
      pathBySelectionId: new Map([['sel-mand', '0/0']]),
    });
    expect(present.result.current.rows[0]).toMatchObject({ mandatory: true, isLocked: true });

    const absent = renderChecklist({
      capabilities: new Map([['0/0', ruleSlot({
        defId: 'e-mandatory', targetDefId: 'r-mand', name: 'Pflicht', isMandatoryListRule: true,
      })]]),
    });
    expect(absent.result.current.rows[0]).toMatchObject({ mandatory: true, isLocked: false });
  });

  it('das Anhaken hebt die Regel in das eigene Kontingent aus, das Abhaken entfernt die Auswahl', () => {
    const raiseUnit = vi.fn();
    const removeUnit = vi.fn();
    const { result } = renderChecklist({
      capabilities: new Map([
        ['0/0', ruleSlot({ defId: 'e-switch', targetDefId: 'r-switch' })],
        ['0/1', ruleSlot({ anchorKind: 'occupied', defId: 'e-mandatory', targetDefId: 'r-mand', name: 'Pflicht' })],
      ]),
      selections: [{ id: 'sel-mand' }],
      pathBySelectionId: new Map([['sel-mand', '0/1']]),
      commands: { raiseUnit, removeUnit },
    });

    result.current.rows[0].toggle(true);
    expect(raiseUnit).toHaveBeenCalledWith(
      { id: 'e-switch', name: 'Schalter aus dem Katalog' }, CATEGORY, 'f1');

    result.current.rows[1].toggle(false);
    expect(removeUnit).toHaveBeenCalledWith('sel-mand');
  });

  it('eine gesperrte Pflichtzeile lässt sich auch programmatisch nicht abwählen', () => {
    const removeUnit = vi.fn();
    const { result } = renderChecklist({
      capabilities: new Map([['0/0', ruleSlot({
        anchorKind: 'occupied', defId: 'e-mandatory', targetDefId: 'r-mand',
        name: 'Pflicht', isMandatoryListRule: true,
      })]]),
      selections: [{ id: 'sel-mand' }],
      pathBySelectionId: new Map([['sel-mand', '0/0']]),
      commands: { removeUnit },
    });

    result.current.rows[0].toggle(false);

    expect(removeUnit).not.toHaveBeenCalled();
  });

  it('eine nicht-binäre Regel fällt datengetrieben aus dem Ankreuzfeld heraus', () => {
    const { result } = renderChecklist({
      capabilities: new Map([['0/0', ruleSlot({ effectiveMax: 5, targetDefId: 'r-many' })]]),
    });

    expect(result.current.rows[0].isBinary).toBe(false);
  });

  it('Unteroptionen zeigt nur eine angehakte Behälter-Regel mit eigener Auswahl', () => {
    const { result } = renderChecklist({
      capabilities: new Map([
        ['0/0', ruleSlot({ anchorKind: 'occupied', targetDefId: 'r-container', name: 'Behälter' })],
        ['0/0/0', ruleSlot({ targetDefId: 'r-child', name: 'Unteroption' })],
      ]),
      selections: [{ id: 'sel-container' }],
      pathBySelectionId: new Map([['sel-container', '0/0']]),
    });

    expect(result.current.rows[0]).toMatchObject({ isContainer: true, hasSubOptions: true });
    expect(result.current.rows[0].selection).toEqual({ id: 'sel-container' });
  });
});
