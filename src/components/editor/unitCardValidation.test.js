import { describe, test, expect, vi } from 'vitest';
import {
  collectCardSelectionIds,
  selectionViolationsForCard
} from './unitCardValidation';

// Nichts wird gestubbt: das Modul liest nur noch den **Bericht** (Issue 0156).
// Welche Selection eine eigenständige Untereinheit ist, sagt ihr Slot
// (`capability.isIndependentSubUnit`) — die Karte löst dafür keinen
// Katalog-Eintrag mehr auf.

const mountOption = { id: 'mount-opt-1', name: 'Lanze', selectionEntryId: 'entry-mount-option', selections: [] };
const mount = { id: 'mount-1', name: 'Reittier', selectionEntryId: 'entry-mount', selections: [mountOption] };
const nestedOption = { id: 'opt-1-1', name: 'Schild', selectionEntryId: 'entry-option', selections: [] };
const option = { id: 'opt-1', name: 'Ausrüstung', selectionEntryId: 'entry-option', selections: [nestedOption] };
const unit = { id: 'unit-1', name: 'Ritter', selectionEntryId: 'entry-unit', selections: [option, mount] };

// Slot-Pfade des Kartenbaums, wie sie `useEvaluation.pathBySelectionId`
// liefert (Pfad-Schema des Berichts: `/`-verkettete Kind-Indizes).
const pathBySelectionId = new Map([
  ['unit-1', '0/0'],
  ['opt-1', '0/0/0'],
  ['opt-1-1', '0/0/0/0'],
  ['mount-1', '0/0/1'],
  ['mount-opt-1', '0/0/1/0'],
]);

// Der Bericht: das Reittier ist eine eigenständige Untereinheit, alles andere
// nicht.
const capabilities = new Map([
  ['0/0', { anchorKind: 'occupied', isIndependentSubUnit: false }],
  ['0/0/0', { anchorKind: 'occupied', isIndependentSubUnit: false }],
  ['0/0/0/0', { anchorKind: 'occupied', isIndependentSubUnit: false }],
  ['0/0/1', { anchorKind: 'occupied', isIndependentSubUnit: true }],
  ['0/0/1/0', { anchorKind: 'occupied', isIndependentSubUnit: false }],
]);

describe('collectCardSelectionIds', () => {
  test('umfasst die Einheit und ihre geschachtelten Optionen', () => {
    const ids = collectCardSelectionIds(unit, capabilities, pathBySelectionId);
    expect(ids.has('unit-1')).toBe(true);
    expect(ids.has('opt-1')).toBe(true);
    expect(ids.has('opt-1-1')).toBe(true);
  });

  test('klammert den Teilbaum einer eigenständigen Untereinheit aus', () => {
    const ids = collectCardSelectionIds(unit, capabilities, pathBySelectionId);
    expect(ids.has('mount-1')).toBe(false);
    expect(ids.has('mount-opt-1')).toBe(false);
  });

  test('deckt für die Karte der Untereinheit deren eigenen Teilbaum ab', () => {
    const ids = collectCardSelectionIds(mount, capabilities, pathBySelectionId);
    expect(ids.has('mount-1')).toBe(true);
    expect(ids.has('mount-opt-1')).toBe(true);
    expect(ids.has('unit-1')).toBe(false);
  });

  test('ohne Slot im Bericht bleibt ein Kind Teil der Karte', () => {
    const ids = collectCardSelectionIds(unit, new Map(), new Map());
    expect(ids.has('mount-1')).toBe(true);
  });
});

describe('selectionViolationsForCard', () => {
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
      pathBySelectionId, unit, capabilities
    );
    expect(violations).toEqual([violationAtUnit, violationAtNestedOption]);
  });

  test('liefert für die Untereinheiten-Karte nur deren Teilbaum-Verletzungen', () => {
    const violations = selectionViolationsForCard(
      [violationAtUnit, violationAtNestedOption, violationAtMountOption],
      pathBySelectionId, mount, capabilities
    );
    expect(violations).toEqual([violationAtMountOption]);
  });

  test('übersteht fehlende und missgebildete Verletzungslisten und fehlende Pfad-Zuordnung', () => {
    expect(selectionViolationsForCard(null, pathBySelectionId, unit, capabilities)).toEqual([]);
    expect(selectionViolationsForCard([null, undefined, {}], pathBySelectionId, unit, capabilities)).toEqual([]);
    expect(selectionViolationsForCard([violationAtUnit], null, unit, capabilities)).toEqual([]);
  });
});
