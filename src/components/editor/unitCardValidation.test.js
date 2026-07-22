import { describe, test, expect, vi } from 'vitest';
import {
  isIndependentSubUnitSelection,
  collectCardSelectionIds,
  selectionErrorsForCard
} from './unitCardValidation';

// Das Modul spricht den Solver über die Fassade an. Die reinen Baum- und
// Prädikat-Funktionen werden in ihrer echten Umsetzung durchgereicht; nur die
// Katalog-Auflösung wird auf ein simples Nachschlagewerk gestubbt, damit die
// Testbäume ohne vollständiges System auskommen.
vi.mock('../../solver/validator', async () => ({
  childSelectionsOf: (await vi.importActual('../../solver/rosterTree')).childSelectionsOf,
  isIndependentSubUnit: (await vi.importActual('../../solver/subUnit')).isIndependentSubUnit,
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

describe('selectionErrorsForCard', () => {
  const errorAtUnit = { selectionId: 'unit-1', message: 'Fehler an der Einheit' };
  const errorAtNestedOption = { selectionId: 'opt-1-1', message: 'Fehler an der Option' };
  const errorAtMountOption = { selectionId: 'mount-opt-1', message: 'Fehler am Reittier' };
  const categoryError = { categoryId: 'cat-core', message: 'Kategorie-Fehler' };

  test('liefert die Fehler der Einheit samt geschachtelter Optionen', () => {
    const errors = selectionErrorsForCard(
      [errorAtUnit, errorAtNestedOption, errorAtMountOption, categoryError],
      unit, system, undefined
    );
    expect(errors).toEqual([errorAtUnit, errorAtNestedOption]);
  });

  test('liefert für die Untereinheiten-Karte nur deren Teilbaum-Fehler', () => {
    const errors = selectionErrorsForCard(
      [errorAtUnit, errorAtNestedOption, errorAtMountOption],
      mount, system, undefined
    );
    expect(errors).toEqual([errorAtMountOption]);
  });

  test('übersteht fehlende und missgebildete Fehlerlisten', () => {
    expect(selectionErrorsForCard(null, unit, system, undefined)).toEqual([]);
    expect(selectionErrorsForCard([null, undefined, {}], unit, system, undefined)).toEqual([]);
  });
});
