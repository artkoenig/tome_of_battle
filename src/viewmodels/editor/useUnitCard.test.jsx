import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useUnitCard, collectCardSelectionIds, selectionViolationsForCard, parentSelectionIdOf } from './useUnitCard';
import {
  createRosterProviderWrapper,
  createEmptyRosterReport,
  createNoopRosterCommands,
} from '../../test-utils/rosterProviders';

/**
 * ViewModel-Tests der Einheitenkarte (ADR-0038). Der Bericht wird von Hand
 * gestellt: es geht um die Ableitung, nicht um die Engine.
 */

const KNIGHT = {
  id: 'sel-1', name: 'Ritter', entryLinkId: 'el-1', number: 2,
  selections: [
    { id: 'sub-1', name: 'Streitross', entryLinkId: 'el-horse', number: 1, selections: [] },
    { id: 'sub-2', name: 'Knappe', entryLinkId: 'el-squire', number: 1, selections: [] },
  ],
};

const ROSTER = {
  costLimitType: 'pts',
  catalogueId: 'cat-1',
  forces: [{ id: 'force-1', selections: [KNIGHT] }],
};

const capabilities = () => new Map([
  ['0/0', {
    anchorKind: 'occupied',
    name: 'Ritter der Herrin',
    totalCosts: { pts: 120 },
    infoElements: [
      { kind: 'profile', id: 'p1', profileTypeName: 'Model', name: 'Ritter', characteristics: [{ name: 'M', value: '4' }] },
      { kind: 'rule', id: 'r1', name: 'Segen', text: 'Rettungswurf 5+' },
    ],
  }],
  ['0/0/0', { anchorKind: 'occupied', name: 'Streitross', isIndependentSubUnit: false }],
  ['0/0/1', { anchorKind: 'occupied', name: 'Knappe', isIndependentSubUnit: true }],
]);

const pathBySelectionId = () => new Map([['sel-1', '0/0'], ['sub-1', '0/0/0'], ['sub-2', '0/0/1']]);

const violationAt = (path, text) => ({
  origin: 'authorMessage', severity: 'error', text,
  anchor: { defId: 'x', name: 'x', path, anchorKind: 'occupied', isValueUnstable: false },
});

const renderCardModel = ({ selection = KNIGHT, isSubUnit = false, violations = [], commands } = {}) =>
  renderHook(() => useUnitCard({ selection, isSubUnit }), {
    wrapper: createRosterProviderWrapper({
      report: createEmptyRosterReport({
        capabilities: capabilities(),
        pathBySelectionId: pathBySelectionId(),
        violations,
      }),
      roster: ROSTER,
      system: { catalogues: [{ id: 'cat-1' }] },
      commands,
    }),
  });

describe('useUnitCard', () => {
  it('liest Name, Anzahl, Punkte und Profil-Tabellen aus dem Bericht', () => {
    const { result } = renderCardModel();

    expect(result.current.name).toBe('Ritter der Herrin');
    expect(result.current.count).toBe(2);
    expect(result.current.points).toBe(120);
    expect(result.current.profileGroups).toHaveLength(1);
    expect(result.current.profileGroups[0].profiles.map(p => p.id)).toEqual(['p1']);
  });

  it('behält den gespeicherten Namen, solange der Bericht keinen Slot kennt', () => {
    const { result } = renderCardModel({ selection: { id: 'unknown', name: 'Namenlos', selections: [] } });

    expect(result.current.name).toBe('Namenlos');
    expect(result.current.points).toBe(0);
  });

  it('zeigt die Verletzung einer geschachtelten Option, nicht die der eigenständigen Untereinheit', () => {
    const { result } = renderCardModel({
      violations: [
        violationAt('0/0/0', 'Streitross unzulässig'),
        violationAt('0/0/1', 'Knappe unzulässig'),
      ],
    });

    expect(result.current.violations.map(v => v.text)).toEqual(['Streitross unzulässig']);
    expect(result.current.hasError).toBe(true);
  });

  it('nennt als Untereinheiten genau die Kinder, die der Bericht als eigenständig meldet', () => {
    const { result } = renderCardModel();

    expect(result.current.subUnits.map(s => s.id)).toEqual(['sub-2']);
  });

  it('löscht eine Einheit über das Roster-Kommando und bietet das Kopieren an', () => {
    const removeUnit = vi.fn();
    const copyUnit = vi.fn();
    const { result } = renderCardModel({ commands: createNoopRosterCommands({ removeUnit, copyUnit }) });

    result.current.remove();
    result.current.copy();

    expect(removeUnit).toHaveBeenCalledWith('sel-1');
    expect(copyUnit).toHaveBeenCalledWith('sel-1');
  });

  it('löscht eine Untereinheit über ihren Träger und bietet kein Kopieren an', () => {
    const subSelectionOperations = { removeInstance: vi.fn(), addInstance: vi.fn(), increaseCount: vi.fn(), decreaseCount: vi.fn() };
    const { result } = renderCardModel({
      selection: KNIGHT.selections[1],
      isSubUnit: true,
      commands: createNoopRosterCommands({ subSelectionOperations }),
    });

    expect(result.current.copy).toBeNull();
    result.current.remove();
    expect(subSelectionOperations.removeInstance).toHaveBeenCalledWith('sel-1', 'sub-2');
  });
});

describe('Zuordnung Verletzung → Karte', () => {
  it('sammelt den Teilbaum ohne die Teilbäume der eigenständigen Untereinheiten', () => {
    const ids = collectCardSelectionIds(KNIGHT, capabilities(), pathBySelectionId());

    expect([...ids].sort()).toEqual(['sel-1', 'sub-1']);
  });

  it('lässt Verletzungen ohne Selection-Anker fallen', () => {
    const rosterLevel = { origin: 'authorMessage', anchor: { path: null, anchorKind: 'roster' } };
    const malformed = { origin: 'authorMessage' };

    expect(selectionViolationsForCard([rosterLevel, malformed], pathBySelectionId(), KNIGHT, capabilities())).toEqual([]);
  });

  it('findet den Träger einer Unter-Auswahl im Roster', () => {
    expect(parentSelectionIdOf(ROSTER, 'sub-2')).toBe('sel-1');
    expect(parentSelectionIdOf(ROSTER, 'sel-1')).toBeNull();
  });
});
