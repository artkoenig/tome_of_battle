import { describe, it, expect } from 'vitest';
import { createSelectionFromDef } from './selectionFactory.js';

// ── Generische, schema-förmige Fixtures (nicht katalog-/einheitsspezifisch, ADR-0003) ──
// Ein Stub-resolveEntry löst Links über targetId, Einträge über id auf.
function makeResolver(entriesById) {
  return (_system, entry) => {
    if (!entry) return null;
    if (entry.targetId) return entriesById[entry.targetId] || null;
    return entriesById[entry.id] || entry;
  };
}

const min = value => ({ type: 'min', value, scope: 'parent', field: 'selections' });
const max = value => ({ type: 'max', value, scope: 'parent', field: 'selections' });

function childNumbers(selection) {
  return selection.selections.map(child => ({ name: child.name, number: child.number }));
}

describe('createSelectionFromDef — Pflichtgruppen-Bevölkerung', () => {
  it('itemisierte Pflichtgruppe: bevölkert jedes Mitglied mit eigenem min je einmal (nicht Erst-Option × Gruppen-min)', () => {
    // Reale Struktur „Tichi Huichi's Raiders" / Gruppe „Weapons and Armour":
    // Gruppe min=3/max=3, drei Mitglieder je min=1/max=1 → je 1× erwartet.
    const entriesById = {
      hand: { id: 'hand', name: 'Hand Weapon' },
      spear: { id: 'spear', name: 'Spear (Mounted)' },
      shield: { id: 'shield', name: 'Shield' },
      unit: {
        id: 'unit', name: "Tichi Huichi's Raiders",
        selectionEntries: [], entryLinks: [],
        selectionEntryGroups: [{
          id: 'weapons', name: 'Weapons and Armour',
          constraints: [min(3), max(3)],
          defaultSelectionEntryId: null,
          selectionEntries: [],
          entryLinks: [
            { id: 'l-hand', targetId: 'hand', name: 'Hand Weapon', constraints: [min(1), max(1)] },
            { id: 'l-spear', targetId: 'spear', name: 'Spear (Mounted)', constraints: [min(1), max(1)] },
            { id: 'l-shield', targetId: 'shield', name: 'Shield', constraints: [min(1), max(1)] }
          ]
        }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([
      { name: 'Hand Weapon', number: 1 },
      { name: 'Spear (Mounted)', number: 1 },
      { name: 'Shield', number: 1 }
    ]);
    // Kein Mitglied überschreitet sein eigenes max=1.
    expect(selection.selections.find(c => c.name === 'Hand Weapon').number).toBe(1);
  });

  it('wähle-eine-Pflichtgruppe: keine Mitglieder-min → Default-Option wird genau einmal gewählt', () => {
    const entriesById = {
      sword: { id: 'sword', name: 'Sword' },
      axe: { id: 'axe', name: 'Axe' },
      unit: {
        id: 'unit', name: 'Hero',
        selectionEntries: [], entryLinks: [],
        selectionEntryGroups: [{
          id: 'weapon-choice', name: 'Weapon',
          constraints: [min(1), max(1)],
          defaultSelectionEntryId: 'e-axe',
          selectionEntries: [
            { id: 'e-sword', name: 'Sword', constraints: [] },
            { id: 'e-axe', name: 'Axe', constraints: [] }
          ],
          entryLinks: []
        }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Axe', number: 1 }]);
  });

  it('wähle-eine ohne gesetzten Default: fällt auf die Erst-Option zurück, mit Gruppen-min als Anzahl', () => {
    const entriesById = {
      bolt: { id: 'bolt', name: 'Bolt' },
      unit: {
        id: 'unit', name: 'Battery',
        selectionEntries: [], entryLinks: [],
        selectionEntryGroups: [{
          id: 'ammo', name: 'Ammunition',
          constraints: [min(2)],
          defaultSelectionEntryId: null,
          selectionEntries: [{ id: 'e-bolt', name: 'Bolt', constraints: [] }],
          entryLinks: []
        }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Bolt', number: 2 }]);
  });

  it('direkte Pflicht-Einträge bleiben unberührt: jeder min>0 wird mit eigenem min angelegt', () => {
    const entriesById = {
      crew: { id: 'crew', name: 'Crew' },
      unit: {
        id: 'unit', name: 'War Machine',
        selectionEntries: [{ id: 'crew', name: 'Crew', constraints: [min(3)] }],
        entryLinks: [], selectionEntryGroups: []
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Crew', number: 3 }]);
  });
});
