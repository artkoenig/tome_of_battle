import { describe, test, expect } from 'vitest';
import { findForceEntryById } from './validator.js';

// Kontingente können sowohl im Spielsystem (.gst) als auch in einem Katalog (.cat)
// definiert sein; die Suche muss beide Quellen abdecken.
describe('findForceEntryById — Kontingente aus System und Katalog', () => {
  const SYSTEM_FORCE_ENTRY_ID = 'fe-sys-standard';
  const SYSTEM_FORCE_ENTRY_NAME = 'Standard GST Detachment';
  const CATALOGUE_FORCE_ENTRY_ID = 'fe-cat-themed';
  const CATALOGUE_FORCE_ENTRY_NAME = 'Themed Cat Detachment';

  function createSystem() {
    return {
      id: 'sys-test',
      name: 'Test System',
      categoryEntries: [{ id: 'cat-hq', name: 'HQ' }],
      forceEntries: [{
        id: SYSTEM_FORCE_ENTRY_ID,
        name: SYSTEM_FORCE_ENTRY_NAME,
        categoryLinks: [{ id: 'cl-hq', targetId: 'cat-hq', hidden: false }]
      }],
      catalogues: [{
        id: 'cat-orcs',
        name: 'Orcs & Goblins',
        forceEntries: [{
          id: CATALOGUE_FORCE_ENTRY_ID,
          name: CATALOGUE_FORCE_ENTRY_NAME,
          categoryLinks: [{ id: 'cl-themed-hq', targetId: 'cat-hq', hidden: false }]
        }]
      }]
    };
  }

  test('findet ein im Spielsystem definiertes Kontingent', () => {
    expect(findForceEntryById(createSystem(), SYSTEM_FORCE_ENTRY_ID).name).toBe(SYSTEM_FORCE_ENTRY_NAME);
  });

  test('findet ein in einem Katalog definiertes Kontingent', () => {
    expect(findForceEntryById(createSystem(), CATALOGUE_FORCE_ENTRY_ID).name).toBe(CATALOGUE_FORCE_ENTRY_NAME);
  });

  test('liefert null für eine unbekannte ID', () => {
    expect(findForceEntryById(createSystem(), 'non-existent')).toBeNull();
  });
});
