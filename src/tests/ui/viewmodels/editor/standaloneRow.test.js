import { describe, it, expect, vi } from 'vitest';

import { buildStandaloneSection } from '../../../../ui/viewmodels/editor/standaloneRow';

/**
 * Das Zeilenmodell einer gruppenlosen Options-Zeile. Zustand, Grenzen und
 * Kosten stehen am Slot des Berichts (ADR-0035) — hier wird geprüft, was die
 * Zeile daraus macht, nicht was die Engine rechnet.
 */

const slot = (overrides) => ({
  anchorKind: 'offerAnchor',
  primaryCategoryId: null, defId: 'opt-lance', targetDefId: null, name: 'Lanze',
  costs: { pts: 5 }, effectiveMin: null, effectiveMax: null, current: 0,
  isMandatoryUnmet: false, isBlocked: false, isHidden: false,
  isIndependentSubUnit: false, sortIndex: null, infoElements: [],
  ...overrides,
});

const operations = () => ({
  increaseCount: vi.fn(), decreaseCount: vi.fn(), addInstance: vi.fn(), removeInstance: vi.fn(),
});

const buildRow = ({ capability, selection, subSelectionOperations }) => buildStandaloneSection({
  frameSelection: selection,
  path: '0/0/0',
  capability,
  option: { id: capability.defId, name: capability.name },
  context: {
    system: { catalogues: [{ id: 'cat-main' }] },
    activeCatalogueId: 'cat-main',
    costTypeId: 'pts',
    costTypeLabel: 'pts',
    subSelectionOperations,
  },
});

const emptyUnit = { id: 'sel-1', selections: [] };

describe('buildStandaloneSection', () => {
  it('liest Name, Punkte und Schlüssel am Slot ab', () => {
    const row = buildRow({ capability: slot(), selection: emptyUnit, subSelectionOperations: operations() });

    expect(row.kind).toBe('standalone');
    expect(row.key).toBe('0/0/0');
    expect(row.name).toBe('Lanze');
    expect(row.points).toBe(5);
    expect(row.costTypeLabel).toBe('pts');
    expect(row.count).toBe(0);
  });

  it('zählt die gewählten Instanzen im Teilbaum des Rahmens', () => {
    const selection = {
      id: 'sel-1',
      selections: [{ id: 'row-1', entryLinkId: 'opt-lance', selections: [] }],
    };

    expect(buildRow({ capability: slot(), selection, subSelectionOperations: operations() }).count).toBe(1);
  });

  it('schaltet eine binäre Option beim Klick ein und wieder aus', () => {
    const ops = operations();
    const capability = slot({ effectiveMax: 1 });

    buildRow({ capability, selection: emptyUnit, subSelectionOperations: ops }).onRowClick();
    expect(ops.increaseCount).toHaveBeenCalledTimes(1);

    const chosen = { id: 'sel-1', selections: [{ id: 'row-1', entryLinkId: 'opt-lance', selections: [] }] };
    buildRow({ capability, selection: chosen, subSelectionOperations: ops }).onRowClick();
    expect(ops.decreaseCount).toHaveBeenCalledTimes(1);
  });

  it('sperrt eine Zeile, deren Slot kein Spielraum mehr lässt', () => {
    const ops = operations();
    const row = buildRow({
      capability: slot({ isBlocked: true }), selection: emptyUnit, subSelectionOperations: ops,
    });

    expect(row.isUnavailable).toBe(true);
    expect(row.isClickable).toBe(false);
    expect(row.isAddDisabled).toBe(true);
    row.onRowClick();
    expect(ops.increaseCount).not.toHaveBeenCalled();
  });

  it('hält eine eingelöste Pflicht fest — genommen und nicht zurückzugeben', () => {
    const chosen = { id: 'sel-1', selections: [{ id: 'row-1', entryLinkId: 'opt-lance', selections: [] }] };
    const row = buildRow({
      capability: slot({ effectiveMin: 1, effectiveMax: 1, isMandatoryUnmet: false }),
      selection: chosen,
      subSelectionOperations: operations(),
    });

    expect(row.isObligationHeld).toBe(true);
    expect(row.canRemove).toBe(false);
    expect(row.isClickable).toBe(false);
  });

  it('trägt eine eigenständige Untereinheit als solche und legt je Klick eine neue an', () => {
    const ops = operations();
    const row = buildRow({
      capability: slot({ isIndependentSubUnit: true }), selection: emptyUnit, subSelectionOperations: ops,
    });

    expect(row.isSubUnitWithOwnOptions).toBe(true);
    expect(row.rowSelectionId).toBeNull();
    row.onRowClick();
    expect(ops.addInstance).toHaveBeenCalledTimes(1);
  });
});
