import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

import { usePlayUnit, maxWoundsOf, modelCountOf, profileTableHeadersOf } from './usePlayUnit';

/**
 * Issue 0165, AC1 and AC5 — the ViewModel of the play view's unit card.
 *
 * Everything the card shows comes from the report (ADR-0034), so the fixture is
 * a hand-built `capabilities` map plus `pathBySelectionId`. Wounds and model
 * count are the two answers that still resolve a catalogue entry; they get a
 * minimal hand-built system in the shape `findEntryInSystem` reads.
 *
 * The profile-cell display is the former `components/profileCellClasses.js`,
 * absorbed into `editor/useUnitCard` and reached from here — the editor's table
 * and this one cannot drift apart.
 */

const SELECTION = {
  id: 'u1',
  name: 'Ritter (gespeichert)',
  selectionEntryId: 'e-knight',
  number: 1,
  selections: [
    { id: 'u1-champ', name: 'Champion', selectionEntryId: 'e-champ' },
    { id: 'u1-banner', name: 'Banner', selectionEntryId: 'e-banner' },
  ],
};

const ROSTER = { id: 'r1', catalogueId: 'cat1', costLimitType: 'pts' };
const COST_TYPES = [{ id: 'pts', name: 'Punkte' }];

const CAPABILITIES = new Map([
  ['f/0/u/0', {
    name: 'Ritter des Gral',
    totalCosts: { pts: 240 },
    infoElements: [
      { kind: 'profile', profileTypeName: 'Modell', name: 'Ritter', characteristics: [{ name: 'KG', value: '4' }] },
      { kind: 'rule', name: 'Furchtlos' },
    ],
  }],
  ['f/0/u/0/s/0', { isIndependentSubUnit: true }],
  ['f/0/u/0/s/1', { isIndependentSubUnit: false }],
]);

const PATHS = new Map([
  ['u1', 'f/0/u/0'],
  ['u1-champ', 'f/0/u/0/s/0'],
  ['u1-banner', 'f/0/u/0/s/1'],
]);

const renderUnit = (overrides = {}) => renderHook(() => usePlayUnit({
  selection: SELECTION,
  system: null,
  roster: ROSTER,
  costTypes: COST_TYPES,
  capabilities: CAPABILITIES,
  pathBySelectionId: PATHS,
  getUnitCurrentWounds: () => 1,
  ...overrides,
}));

describe('usePlayUnit', () => {
  it('takes name, cost and profile tables from the report', () => {
    const { result } = renderUnit();

    expect(result.current.name).toBe('Ritter des Gral');
    expect(result.current.totalCost).toBe(240);
    expect(result.current.costLabel).toBe('Punkte');
    expect(result.current.modelGroup.profiles).toHaveLength(1);
    expect(result.current.itemGroups).toEqual([]);
  });

  it('keeps the stored name when the report knows no slot for the selection', () => {
    const { result } = renderUnit({ capabilities: new Map(), pathBySelectionId: new Map() });
    expect(result.current.name).toBe('Ritter (gespeichert)');
    expect(result.current.totalCost).toBe(0);
  });

  it('gives its own card only to the sub-selections the report calls independent', () => {
    const { result } = renderUnit();

    expect(result.current.hasSubUnits).toBe(true);
    expect(result.current.subUnits.map(s => s.id)).toEqual(['u1-champ']);
  });

  it('never counts a card with sub-units as destroyed — they keep their own counter', () => {
    const { result } = renderUnit({ getUnitCurrentWounds: () => 0 });
    expect(result.current.currentWounds).toBe(0);
    expect(result.current.isDead).toBe(false);
  });

  it('counts a card without sub-units as destroyed at zero wounds', () => {
    const { result } = renderUnit({
      selection: { ...SELECTION, selections: [] },
      getUnitCurrentWounds: () => 0,
    });
    expect(result.current.isDead).toBe(true);
  });

  it('toggles the profile section and shows the switch only on a carrier card with tables', () => {
    const { result } = renderUnit();

    expect(result.current.showsDetailsToggle).toBe(true);
    expect(result.current.isDetailsOpen).toBe(false);
    act(() => result.current.toggleDetails());
    expect(result.current.isDetailsOpen).toBe(true);

    const sub = renderUnit({ isSubUnit: true });
    expect(sub.result.current.showsDetailsToggle).toBe(false);
    expect(sub.result.current.showsProfiles).toBe(false);
  });

  it('classifies a profile cell by its modification and only then offers a breakdown', () => {
    const { result } = renderUnit();
    const cellOf = result.current.profileCellOf;

    expect(cellOf({ value: '4' })).toMatchObject({ className: 'font-body', breakdown: null });
    expect(cellOf({ value: '4', originalValue: '4' }).className).toBe('font-body');
    expect(cellOf({ value: '5', originalValue: '4' }).className).toContain('profile-cell--positive');
    expect(cellOf({ value: '3', originalValue: '4' }).className).toContain('profile-cell--negative');
    expect(cellOf({ value: 'Ja', originalValue: 'Nein' }).className).toContain('profile-cell--modified');

    // Ohne Änderung gibt es nichts zu erklären, auch wenn eine Liste dranhängt.
    expect(cellOf({ value: '4', originalValue: '4', modificationBreakdown: ['x'] }).breakdown).toBeNull();
    expect(cellOf({ value: '5', originalValue: '4', modificationBreakdown: ['+1'] }).breakdown).toEqual(['+1']);
  });
});

describe('die Katalog-Antworten der Karte', () => {
  const SYSTEM = {
    catalogues: [{
      id: 'cat1',
      selectionEntries: [
        {
          id: 'e-unit', name: 'Regiment', type: 'unit',
          selectionEntries: [{ id: 'e-model', name: 'Modell', type: 'model', profiles: [{ characteristics: [{ name: 'W', value: '2' }] }] }],
        },
        { id: 'e-model-solo', name: 'Held', type: 'model', profiles: [{ characteristics: [{ name: 'LP', value: '3' }] }] },
      ],
    }],
  };

  it('reads the wound value out of the entry or its children', () => {
    expect(maxWoundsOf(SYSTEM, ROSTER, { selectionEntryId: 'e-model-solo' })).toBe(3);
    expect(maxWoundsOf(SYSTEM, ROSTER, { selectionEntryId: 'e-unit' })).toBe(2);
    // Ein Eintrag, den der Katalog nicht kennt, zählt als eine Wunde.
    expect(maxWoundsOf(SYSTEM, ROSTER, { selectionEntryId: 'fehlt' })).toBe(1);
  });

  it('counts the models of a unit from its model children, else from its own number', () => {
    expect(modelCountOf(SYSTEM, ROSTER, { selectionEntryId: 'e-model-solo', number: 2 })).toBe(2);
    expect(modelCountOf(SYSTEM, ROSTER, {
      selectionEntryId: 'e-unit',
      number: 1,
      selections: [{ selectionEntryId: 'e-model', number: 12 }],
    })).toBe(12);
    expect(modelCountOf(SYSTEM, ROSTER, { selectionEntryId: 'e-unit', number: 5, selections: [] })).toBe(5);
  });

  it('lists every characteristic of a table once, in the order it first appears', () => {
    expect(profileTableHeadersOf([
      { characteristics: [{ name: 'KG' }, { name: 'BF' }] },
      { characteristics: [{ name: 'BF' }, { name: 'S' }] },
    ])).toEqual(['KG', 'BF', 'S']);
  });
});
