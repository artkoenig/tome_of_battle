import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useOptionGroup } from './useOptionGroup';
import {
  createRosterProviderWrapper,
  createEmptyRosterReport,
  createNoopRosterCommands,
} from '../../../shared/test-utils/rosterProviders';

/**
 * ViewModel-Tests der Options-Gruppe (ADR-0038). `group` ist reine Struktur;
 * Zustand, Grenzen, Wahlverhalten und Beschreibung liest das ViewModel am
 * Bericht ab.
 */

const SELECTION_PATH = '0/0';
const ROSTER = { costLimitType: 'pts', catalogueId: 'cat-main', forces: [] };

const slot = (overrides) => ({
  anchorKind: 'offerAnchor',
  isIndependentSubUnit: false,
  primaryCategoryId: null, defId: null, targetDefId: null,
  costs: {}, effectiveMin: null, effectiveMax: null, current: 0,
  isMandatoryUnmet: false, isBlocked: false, isHidden: false,
  isSingleChoice: false, isMaxRaisable: false, isRepeatableWithinGroup: false,
  sortIndex: null, infoElements: [],
  ...overrides,
});

const capabilitiesOf = (records) => new Map(records.map((record, index) => [
  `${SELECTION_PATH}/${index}`, slot(record),
]));

const option = (id, name) => ({ option: { id, name }, ownerSelectionId: null });

const selectionWith = (chosen = []) => ({
  id: 'sel-unit', entryLinkId: 'unit-link', number: 1,
  selections: chosen.map((entryLinkId, index) => ({
    id: `${entryLinkId}-${index}`, entryLinkId, number: 1, selections: [],
  })),
});

const renderGroupModel = ({ group, capabilities, selection = selectionWith(), commands, hasSelectedDescendant = false }) =>
  renderHook(() => useOptionGroup({ group, selection, selectionPath: SELECTION_PATH, hasSelectedDescendant }), {
    wrapper: createRosterProviderWrapper({
      report: createEmptyRosterReport({ capabilities }),
      roster: ROSTER,
      system: { catalogues: [{ id: 'cat-main' }] },
      commands,
    }),
  });

const WEAPONS = {
  id: 'grp-weapons', name: 'Waffen',
  items: [option('opt-sword', 'Schwert'), option('opt-axe', 'Axt')],
};

describe('useOptionGroup', () => {
  it('bildet je Struktur-Item die Zeile seines Slots und lässt versteckte weg', () => {
    const capabilities = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 2, current: 0 },
      { defId: 'opt-sword', name: 'Schwert', costs: { pts: 3 } },
      { defId: 'opt-axe', name: 'Axt', isHidden: true },
    ]);

    const { result } = renderGroupModel({ group: WEAPONS, capabilities });

    expect(result.current.rows.map(r => r.name)).toEqual(['Schwert']);
    expect(result.current.rows[0].points).toBe(3);
  });

  it('zeigt den Live-Zähler einer Mehrfachauswahl und „Max: N" bei echter Einzelwahl', () => {
    const many = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 2, current: 1 },
      { defId: 'opt-sword', name: 'Schwert' },
      { defId: 'opt-axe', name: 'Axt' },
    ]);
    const single = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 1, current: 0, isSingleChoice: true },
      { defId: 'opt-sword', name: 'Schwert' },
      { defId: 'opt-axe', name: 'Axt' },
    ]);

    expect(renderGroupModel({ group: WEAPONS, capabilities: many }).result.current.limitText).toBe('(1 / 2)');
    expect(renderGroupModel({ group: WEAPONS, capabilities: single }).result.current.limitText).toBe('(Max: 1)');
  });

  it('macht aus einer echten Einzelwahl Radios und aus einer max-hebbaren Gruppe Kästchen', () => {
    const single = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 1, current: 0, isSingleChoice: true },
      { defId: 'opt-sword', name: 'Schwert', effectiveMax: 1 },
      { defId: 'opt-axe', name: 'Axt', effectiveMax: 1 },
    ]);
    const raisable = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 1, current: 0, isMaxRaisable: true },
      { defId: 'opt-sword', name: 'Schwert', effectiveMax: 1 },
      { defId: 'opt-axe', name: 'Axt', effectiveMax: 1 },
    ]);

    expect(renderGroupModel({ group: WEAPONS, capabilities: single }).result.current.rows.every(r => r.isRadio)).toBe(true);
    expect(renderGroupModel({ group: WEAPONS, capabilities: raisable }).result.current.rows.some(r => r.isRadio)).toBe(false);
  });

  it('meldet den Gruppen-Fehler des Ankers', () => {
    const capabilities = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 1, current: 2 },
      { defId: 'opt-sword', name: 'Schwert' },
      { defId: 'opt-axe', name: 'Axt' },
    ]);

    expect(renderGroupModel({ group: WEAPONS, capabilities }).result.current.hasGroupError).toBe(true);
  });

  it('startet aufgeklappt, sobald die Gruppe oder eine gehaltene Gruppe etwas trägt', () => {
    const capabilities = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 2, current: 1 },
      { defId: 'opt-sword', anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Schwert' },
      { defId: 'opt-axe', name: 'Axt' },
    ]);

    expect(renderGroupModel({ group: WEAPONS, capabilities }).result.current.isExpanded).toBe(false);
    expect(renderGroupModel({ group: WEAPONS, capabilities, selection: selectionWith(['opt-sword']) })
      .result.current.isExpanded).toBe(true);
    expect(renderGroupModel({ group: WEAPONS, capabilities, hasSelectedDescendant: true })
      .result.current.isExpanded).toBe(true);
  });

  it('klappt auf Verlangen um', () => {
    const capabilities = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen' },
      { defId: 'opt-sword', name: 'Schwert' },
      { defId: 'opt-axe', name: 'Axt' },
    ]);
    const { result } = renderGroupModel({ group: WEAPONS, capabilities });

    act(() => result.current.toggleExpanded());
    expect(result.current.isExpanded).toBe(true);
  });

  it('tauscht bei einer Einzelwahl die belegte Geschwister-Zeile aus', () => {
    const subSelectionOperations = {
      addInstance: vi.fn(), removeInstance: vi.fn(), increaseCount: vi.fn(), decreaseCount: vi.fn(),
    };
    const capabilities = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen', effectiveMax: 1, current: 1, isSingleChoice: true },
      { defId: 'opt-sword', anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Schwert', effectiveMax: 1 },
      { defId: 'opt-axe', name: 'Axt', effectiveMax: 1 },
    ]);

    const { result } = renderGroupModel({
      group: WEAPONS,
      capabilities,
      selection: selectionWith(['opt-sword']),
      commands: createNoopRosterCommands({ subSelectionOperations }),
    });
    result.current.rows.find(r => r.name === 'Axt').onRadioClick();

    expect(subSelectionOperations.decreaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-sword' }));
    expect(subSelectionOperations.increaseCount)
      .toHaveBeenCalledWith('sel-unit', expect.objectContaining({ id: 'opt-axe' }));
  });

  it('nimmt die Beschreibung einer Zeile aus der Info-Projektion ihres Slots', () => {
    const capabilities = capabilitiesOf([
      { defId: 'grp-weapons', anchorKind: 'groupAnchor', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Waffen' },
      {
        defId: 'opt-sword', name: 'Schwert',
        infoElements: [{ kind: 'rule', name: 'Schwert', text: 'Ein Schwert eben', source: null }],
      },
      { defId: 'opt-axe', name: 'Axt' },
    ]);

    const { result } = renderGroupModel({ group: WEAPONS, capabilities });

    expect(result.current.rows.find(r => r.name === 'Schwert').descText).toBe('Ein Schwert eben');
    expect(result.current.rows.find(r => r.name === 'Axt').descText).toBe('');
  });
});
