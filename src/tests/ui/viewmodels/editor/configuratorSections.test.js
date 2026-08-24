import { describe, it, expect, vi } from 'vitest';

import { buildSections, holdsSelection, isRoleGroupName } from '../../../../ui/viewmodels/editor/configuratorSections';
import { createEmptyRosterReport } from '../../../../shared/test-utils/rosterProviders';

/**
 * Der Abschnittsbaum des Konfigurators, ohne Hook und ohne Provider.
 *
 * Der Bericht wird von Hand gestellt und das geparste System kennt die Struktur
 * dieses Rahmens nicht — dann sagt allein der Bericht, was auf der Karte steht
 * (das Sicherheitsnetz des Konfigurators).
 */

const slot = (overrides) => ({
  anchorKind: 'offerAnchor',
  primaryCategoryId: null, defId: null, targetDefId: null,
  costs: {}, effectiveMin: null, effectiveMax: null, current: 0,
  isMandatoryUnmet: false, isBlocked: false, isHidden: false,
  isIndependentSubUnit: false, sortIndex: null, infoElements: [],
  ...overrides,
});

const SELECTION = { id: 'sel-1', name: 'Ritter', entryLinkId: 'el-1', number: 1, selections: [] };

const contextFor = (capabilities) => ({
  slots: createEmptyRosterReport({
    capabilities,
    pathBySelectionId: new Map([[SELECTION.id, '0/0']]),
  }).slots,
  system: { catalogues: [{ id: 'cat-main' }] },
  activeCatalogueId: 'cat-main',
  costTypeId: 'pts',
  costTypeLabel: 'pts',
  subSelectionOperations: {
    increaseCount: vi.fn(), decreaseCount: vi.fn(), addInstance: vi.fn(), removeInstance: vi.fn(),
  },
});

describe('buildSections', () => {
  it('macht aus jedem Options-Slot des Rahmens eine Zeile und lässt versteckte weg', () => {
    const capabilities = new Map([
      ['0/0', slot({ anchorKind: 'occupied', defId: 'unit', name: 'Ritter' })],
      ['0/0/0', slot({ defId: 'opt-lance', name: 'Lanze', costs: { pts: 5 } })],
      ['0/0/1', slot({ defId: 'opt-secret', name: 'Geheim', isHidden: true })],
    ]);

    const sections = buildSections(SELECTION, '0/0', contextFor(capabilities));

    expect(sections.map(s => s.name)).toEqual(['Lanze']);
    expect(sections[0].points).toBe(5);
  });

  it('behält einen Gruppen-Anker als eigenen Abschnitt, wenn der Sammler den Rahmen nicht kennt', () => {
    const capabilities = new Map([
      ['0/0', slot({ anchorKind: 'occupied', defId: 'unit', name: 'Ritter' })],
      ['0/0/0', slot({ anchorKind: 'groupAnchor', defId: 'grp', name: 'Waffen' })],
    ]);

    const sections = buildSections(SELECTION, '0/0', contextFor(capabilities));

    const groups = sections.filter(s => s.kind === 'group');
    expect(groups.map(s => s.group.name)).toEqual(['Waffen']);
  });

  it('sortiert die Abschnitte aufsteigend nach sortIndex, den ungetaggten Rest dahinter', () => {
    const capabilities = new Map([
      ['0/0', slot({ anchorKind: 'occupied', defId: 'unit', name: 'Ritter' })],
      ['0/0/0', slot({ defId: 'opt-a', name: 'Ohne' })],
      ['0/0/1', slot({ defId: 'opt-b', name: 'Zweite', sortIndex: 2 })],
      ['0/0/2', slot({ defId: 'opt-c', name: 'Erste', sortIndex: 1 })],
    ]);

    const sections = buildSections(SELECTION, '0/0', contextFor(capabilities));

    expect(sections.map(s => s.name)).toEqual(['Erste', 'Zweite', 'Ohne']);
  });

  it('führt einen Slot nur einmal, auch wenn Link und Ziel dieselbe Definition treffen', () => {
    const capabilities = new Map([
      ['0/0', slot({ anchorKind: 'occupied', defId: 'unit', name: 'Ritter' })],
      ['0/0/0', slot({ defId: 'el-lance', targetDefId: 'opt-lance', name: 'Lanze' })],
    ]);

    const sections = buildSections(SELECTION, '0/0', contextFor(capabilities));

    expect(sections.filter(s => s.kind === 'standalone')).toHaveLength(1);
  });
});

describe('holdsSelection', () => {
  it('sieht eine gewählte gruppenlose Zeile', () => {
    expect(holdsSelection({ kind: 'standalone', count: 1 })).toBe(true);
    expect(holdsSelection({ kind: 'standalone', count: 0 })).toBe(false);
  });

  it('sieht eine Wahl in einer Untergruppe', () => {
    const frameSelection = {
      id: 'sel-1', selections: [{ id: 'row-1', entryLinkId: 'opt-lance', selections: [] }],
    };
    const child = {
      kind: 'group', frameSelection, children: [],
      group: { items: [{ option: { id: 'opt-lance' } }] },
    };
    const parent = { kind: 'group', frameSelection, children: [child], group: { items: [] } };

    expect(holdsSelection(parent)).toBe(true);
  });
});

describe('isRoleGroupName', () => {
  it('erkennt die Rollen-Gruppen, deren Mitglieder einzeln stehen', () => {
    expect(isRoleGroupName('Rollen')).toBe(true);
    expect(isRoleGroupName('role')).toBe(true);
    expect(isRoleGroupName('Waffen')).toBe(false);
    expect(isRoleGroupName(null)).toBe(false);
  });
});
