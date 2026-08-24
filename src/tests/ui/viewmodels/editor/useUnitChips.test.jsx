import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useUnitChips } from '../../../../ui/viewmodels/editor/useUnitChips';
import { createRosterProviderWrapper, createEmptyRosterReport } from '../../../../shared/test-utils/rosterProviders';

/**
 * ViewModel-Tests der Chip-Reihen (ADR-0038). Der Katalog ist ein von Hand
 * gebautes System — nur so weit, wie die Auflösung der Detailtexte ihn braucht;
 * welche Chips erscheinen, sagt der Bericht.
 */

const SYSTEM = {
  catalogues: [{
    id: 'cat-main',
    selectionEntries: [
      { id: 'el-lance', name: 'Lanze', costs: [{ name: 'pts', value: '5' }], rules: [], profiles: [] },
      { id: 'el-empty', name: 'Behälter', costs: [], rules: [], profiles: [], selectionEntries: [{ id: 'child', name: 'Kind' }] },
    ],
  }],
};

const SELECTION = {
  id: 'sel-1', name: 'Ritter', entryLinkId: 'el-knight', number: 1,
  selections: [
    { id: 'sub-lance', name: 'Lanze', entryLinkId: 'el-lance', number: 1, selections: [] },
    { id: 'sub-empty', name: 'Behälter', entryLinkId: 'el-empty', number: 1, selections: [] },
  ],
};

const ROSTER = { costLimitType: 'pts', catalogueId: 'cat-main', forces: [{ id: 'f1', selections: [SELECTION] }] };

const renderChips = ({ capabilities, selection = SELECTION }) =>
  renderHook(() => useUnitChips({ selection }), {
    wrapper: createRosterProviderWrapper({
      report: createEmptyRosterReport({
        capabilities,
        pathBySelectionId: new Map([['sel-1', '0/0'], ['sub-lance', '0/0/0'], ['sub-empty', '0/0/1']]),
      }),
      roster: ROSTER,
      system: SYSTEM,
    }),
  });

const unitSlot = (infoElements = []) => ({ anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Ritter', infoElements });

describe('useUnitChips', () => {
  it('zeigt die gewählten Aufwertungen und lässt einen wertlosen Behälter weg', () => {
    const capabilities = new Map([
      ['0/0', unitSlot()],
      ['0/0/0', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Lanze', infoElements: [] }],
      ['0/0/1', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Behälter', infoElements: [] }],
    ]);

    const { result } = renderChips({ capabilities });

    expect(result.current.upgrades.map(u => u.name)).toEqual(['Lanze']);
  });

  it('lässt eine Aufwertung weg, die bereits in einer Profil-Tabelle der Karte steht', () => {
    const capabilities = new Map([
      ['0/0', unitSlot([
        { kind: 'profile', id: 'prof-lance', profileTypeName: 'Weapon', name: 'Lanze', characteristics: [] },
      ])],
      ['0/0/0', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Lanze', infoElements: [{ kind: 'profile', id: 'prof-lance', profileTypeName: 'Weapon', name: 'Lanze', characteristics: [] }] }],
      ['0/0/1', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Behälter', infoElements: [] }],
    ]);

    const { result } = renderChips({ capabilities });

    expect(result.current.upgrades).toEqual([]);
  });

  it('nimmt die Regel-Chips aus der Info-Projektion des Slots', () => {
    const capabilities = new Map([
      ['0/0', unitSlot([{ kind: 'rule', id: 'r1', name: 'Segen', text: 'Rettungswurf 5+' }])],
      ['0/0/0', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Lanze', infoElements: [] }],
      ['0/0/1', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Behälter', infoElements: [] }],
    ]);

    const { result } = renderChips({ capabilities });

    expect(result.current.rules).toEqual([{ key: 'r1', name: 'Segen', text: 'Rettungswurf 5+' }]);
  });

  it('zeigt eine Regel nicht doppelt, wenn sie schon als Aufwertungs-Chip erscheint', () => {
    const capabilities = new Map([
      ['0/0', unitSlot([{ kind: 'rule', id: 'r-lance', name: 'Lanze', text: 'Beim Ansturm +2 Stärke' }])],
      ['0/0/0', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Lanze', infoElements: [] }],
      ['0/0/1', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Behälter', infoElements: [] }],
    ]);

    const { result } = renderChips({ capabilities });

    expect(result.current.upgrades.map(u => u.name)).toEqual(['Lanze']);
    expect(result.current.rules).toEqual([]);
  });

  it('lässt die Untereinheit weg, die ihre eigene Karte trägt', () => {
    const capabilities = new Map([
      ['0/0', unitSlot()],
      ['0/0/0', { anchorKind: 'occupied', isHidden: false, primaryCategoryId: null, name: 'Lanze', isIndependentSubUnit: true, infoElements: [] }],
      ['0/0/1', { anchorKind: 'occupied', isHidden: false, isIndependentSubUnit: false, primaryCategoryId: null, name: 'Behälter', infoElements: [] }],
    ]);

    const { result } = renderChips({ capabilities });

    expect(result.current.upgrades).toEqual([]);
  });
});
