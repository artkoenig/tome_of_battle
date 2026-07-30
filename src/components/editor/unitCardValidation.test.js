import { describe, test, expect, vi } from 'vitest';
import {
  isIndependentSubUnitSelection,
  collectCardSelectionIds,
  selectionViolationsForCard
} from './unitCardValidation';

// Das Modul spricht den Solver über die Fassade an. Die reinen Baum- und
// Prädikat-Funktionen werden in ihrer echten Umsetzung durchgereicht; nur die
// Katalog-Auflösung wird auf ein simples Nachschlagewerk gestubbt, damit die
// Testbäume ohne vollständiges System auskommen.
vi.mock('../../roster', async () => ({
  childSelectionsOf: (await vi.importActual('../../roster/rosterTree.js')).childSelectionsOf,
  isIndependentSubUnit: (await vi.importActual('../../roster/subUnit.js')).isIndependentSubUnit,
  findEntryInSystem: (system, entryId) => system?.entriesById?.[entryId] ?? null,
  resolveEntry: (system, entry) => entry
}));

// Kartenbaum: eine Einheit mit einer geschachtelten Option und einer
// eigenständigen Untereinheit (Reittier), die ihre eigene Karte erhält.
const system = {
  entriesById: {
    'entry-option': { id: 'entry-option', type: 'upgrade' },
    'entry-mount': {
      id: 'entry-mount',
      type: 'model',
      collective: false,
      selectionEntries: [{ id: 'entry-mount-option' }]
    }
  }
};

const mountOption = { id: 'mount-opt-1', name: 'Lanze', selectionEntryId: 'entry-mount-option', selections: [] };
const mount = { id: 'mount-1', name: 'Reittier', selectionEntryId: 'entry-mount', selections: [mountOption] };
const nestedOption = { id: 'opt-1-1', name: 'Schild', selectionEntryId: 'entry-option', selections: [] };
const option = { id: 'opt-1', name: 'Ausrüstung', selectionEntryId: 'entry-option', selections: [nestedOption] };
const unit = { id: 'unit-1', name: 'Ritter', selectionEntryId: 'entry-unit', selections: [option, mount] };

describe('isIndependentSubUnitSelection', () => {
  test('erkennt die Selection einer eigenständigen Untereinheit', () => {
    expect(isIndependentSubUnitSelection(mount, system, undefined)).toBe(true);
  });

  test('verneint eine gewöhnliche Options-Selection', () => {
    expect(isIndependentSubUnitSelection(option, system, undefined)).toBe(false);
  });

  test('verneint eine Selection mit unauflösbarem Eintrag', () => {
    const orphan = { id: 'orphan-1', selectionEntryId: 'entry-missing', selections: [] };
    expect(isIndependentSubUnitSelection(orphan, system, undefined)).toBe(false);
  });
});

describe('collectCardSelectionIds', () => {
  test('umfasst die Einheit und ihre geschachtelten Optionen', () => {
    const ids = collectCardSelectionIds(unit, system, undefined);
    expect(ids.has('unit-1')).toBe(true);
    expect(ids.has('opt-1')).toBe(true);
    expect(ids.has('opt-1-1')).toBe(true);
  });

  test('klammert den Teilbaum einer eigenständigen Untereinheit aus', () => {
    const ids = collectCardSelectionIds(unit, system, undefined);
    expect(ids.has('mount-1')).toBe(false);
    expect(ids.has('mount-opt-1')).toBe(false);
  });

  test('deckt für die Karte der Untereinheit deren eigenen Teilbaum ab', () => {
    const ids = collectCardSelectionIds(mount, system, undefined);
    expect(ids.has('mount-1')).toBe(true);
    expect(ids.has('mount-opt-1')).toBe(true);
    expect(ids.has('unit-1')).toBe(false);
  });
});

describe('selectionViolationsForCard', () => {
  // Slot-Pfade des Kartenbaums, wie sie `useEvaluation.pathBySelectionId`
  // liefert (Pfad-Schema des Berichts: `/`-verkettete Kind-Indizes).
  const pathBySelectionId = new Map([
    ['unit-1', '0/0'],
    ['opt-1', '0/0/0'],
    ['opt-1-1', '0/0/0/0'],
    ['mount-1', '0/0/1'],
    ['mount-opt-1', '0/0/1/0'],
  ]);

  const violationAt = (path, name) => ({
    origin: 'derivedLimit',
    severity: 'error',
    anchor: { defId: `def-${name}`, name, path, anchorKind: 'occupied', isValueUnstable: false },
  });

  const violationAtUnit = violationAt('0/0', 'Einheit');
  const violationAtNestedOption = violationAt('0/0/0/0', 'Option');
  const violationAtMountOption = violationAt('0/0/1/0', 'Reittier');
  // Kategorie-Anker liegen außerhalb jedes Kartenteilbaums.
  const categoryViolation = violationAt('0/5', 'Kategorie');

  test('liefert die Verletzungen der Einheit samt geschachtelter Optionen', () => {
    const violations = selectionViolationsForCard(
      [violationAtUnit, violationAtNestedOption, violationAtMountOption, categoryViolation],
      pathBySelectionId, unit, system, undefined
    );
    expect(violations).toEqual([violationAtUnit, violationAtNestedOption]);
  });

  test('liefert für die Untereinheiten-Karte nur deren Teilbaum-Verletzungen', () => {
    const violations = selectionViolationsForCard(
      [violationAtUnit, violationAtNestedOption, violationAtMountOption],
      pathBySelectionId, mount, system, undefined
    );
    expect(violations).toEqual([violationAtMountOption]);
  });

  test('übersteht fehlende und missgebildete Verletzungslisten und fehlende Pfad-Zuordnung', () => {
    expect(selectionViolationsForCard(null, pathBySelectionId, unit, system, undefined)).toEqual([]);
    expect(selectionViolationsForCard([null, undefined, {}], pathBySelectionId, unit, system, undefined)).toEqual([]);
    expect(selectionViolationsForCard([violationAtUnit], null, unit, system, undefined)).toEqual([]);
  });
});
