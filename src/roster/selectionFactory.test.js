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

// ── Issue 0145, Kriterium 2 — die Option, die eine verschachtelte Pflichtgruppe beisteuert ──

/**
 * `Duelist` / `Loadout`: eine wähle-eine-Pflichtgruppe `Sidearm` (min=2/max=2),
 * eine Ebene tief verschachtelt in einer Gruppe `Loadout`, die selbst kein
 * eigenes `min` trägt — wie `Wizard Level` innerhalb `Magic` bei
 * `Zacharias the Everliving`.
 */
function nestedChoiceUnit({ defaultSelectionEntryId }) {
  return {
    id: 'unit', name: 'Duelist',
    selectionEntries: [], entryLinks: [],
    selectionEntryGroups: [{
      id: 'outer-loadout', name: 'Loadout',
      constraints: [],
      selectionEntries: [], entryLinks: [],
      selectionEntryGroups: [{
        id: 'inner-sidearm', name: 'Sidearm',
        constraints: [min(2), max(2)],
        defaultSelectionEntryId,
        selectionEntries: [
          { id: 'e-dagger', name: 'Dagger', constraints: [] },
          { id: 'e-rapier', name: 'Rapier', constraints: [] }
        ],
        entryLinks: []
      }]
    }]
  };
}

describe('createSelectionFromDef — die Option, die eine verschachtelte Pflichtgruppe beisteuert (Issue 0145 AC2)', () => {
  it('eine wähle-eine-Gruppe, verschachtelt in einer Gruppe ohne eigenes min, mit passender defaultSelectionEntryId: die benannte Option wird angelegt, mit dem min der verschachtelten Gruppe als Anzahl', () => {
    const entriesById = { unit: nestedChoiceUnit({ defaultSelectionEntryId: 'e-rapier' }) };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Rapier', number: 2 }]);
  });

  it('dieselbe verschachtelte Gruppe mit einer defaultSelectionEntryId, die zu nichts passt: die erste Option wird angelegt — unverändert gegenüber der Tiefe-0-Rückfallregel', () => {
    const entriesById = { unit: nestedChoiceUnit({ defaultSelectionEntryId: 'nirgendwo-passend' }) };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Dagger', number: 2 }]);
  });

  it('dieselbe verschachtelte Gruppe ohne gesetztes Attribut: die erste Option wird angelegt', () => {
    const entriesById = { unit: nestedChoiceUnit({ defaultSelectionEntryId: undefined }) };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Dagger', number: 2 }]);
  });

  it("Wizard Levels reale Form als generische Fixture: eine verschachtelte Gruppe mit einer ins Leere zeigenden Vorgabe UND einem Mitglied mit eigenem min — das Mitglied wird angelegt, die verwaiste Vorgabe bleibt unbeachtet", () => {
    // Nachgebildet nach `Wizard Level` (`af1f-355f-236b-a64f`) innerhalb `Magic`
    // (`fe61-20a7-8126-d5b9`) bei Zacharias the Everliving: `Magic` trägt kein
    // eigenes min, `Wizard Level` hat min=1/max=1 und `defaultSelectionEntryId`
    // `42d9-cebe-18d5-cdbd` — eine Id, die im Katalog nirgends existiert — und
    // sein einziges Mitglied `Magic Level 4` trägt selbst min=1.
    const entriesById = {
      'magic-level-4': { id: 'magic-level-4', name: 'Magic Level 4' },
      unit: {
        id: 'unit', name: 'Zacharias the Everliving',
        selectionEntries: [], entryLinks: [],
        selectionEntryGroups: [{
          id: 'outer-magic', name: 'Magic',
          constraints: [],
          selectionEntries: [], entryLinks: [],
          selectionEntryGroups: [{
            id: 'inner-wizard-level', name: 'Wizard Level',
            constraints: [min(1), max(1)],
            defaultSelectionEntryId: 'verwaiste-vorgabe-existiert-nicht',
            selectionEntries: [],
            entryLinks: [
              { id: 'l-magic-level-4', targetId: 'magic-level-4', name: 'Magic Level 4', constraints: [min(1)] }
            ]
          }]
        }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Magic Level 4', number: 1 }]);
  });
});

// ── Issue 0145, Kriterium 1 — "an jeder Tiefe" und was liegen bleiben muss ──

describe('createSelectionFromDef — Pflichtgruppen an jeder Tiefe (Issue 0145 AC1)', () => {
  it('eine Pflichtgruppe drei Ebenen tief (Gruppe ohne min → Gruppe ohne min → Gruppe mit min 1) wird bevölkert', () => {
    const entriesById = {
      torch: { id: 'torch', name: 'Torch' },
      unit: {
        id: 'unit', name: 'Deep Nesting Unit',
        selectionEntries: [], entryLinks: [],
        selectionEntryGroups: [{
          id: 'level-1', name: 'Level 1',
          constraints: [],
          selectionEntries: [], entryLinks: [],
          selectionEntryGroups: [{
            id: 'level-2', name: 'Level 2',
            constraints: [],
            selectionEntries: [], entryLinks: [],
            selectionEntryGroups: [{
              id: 'level-3', name: 'Level 3',
              constraints: [min(1), max(1)],
              defaultSelectionEntryId: null,
              selectionEntries: [{ id: 'e-torch', name: 'Torch', constraints: [] }],
              entryLinks: []
            }]
          }]
        }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Torch', number: 1 }]);
  });

  it('eine verschachtelte Gruppe, deren eigenes min 0 ist, deren Mitglieder aber min 1 tragen, bleibt unbevölkert — die Regel, die die 83 unerfüllten Pflichten unerfüllt lässt', () => {
    // Nachgebildet nach `Lores of Magic` (`3240-32da-ecd5-ee0f`) bei Zacharias:
    // die Gruppe trägt nur ein max, kein min; ihr Mitglied `Lore of Necromancy`
    // trägt selbst min=1 und bleibt dennoch unbevölkert.
    const entriesById = {
      necromancy: { id: 'necromancy', name: 'Lore of Necromancy' },
      unit: {
        id: 'unit', name: 'Unmet Obligation Unit',
        selectionEntries: [], entryLinks: [],
        selectionEntryGroups: [{
          id: 'outer', name: 'Outer',
          constraints: [],
          selectionEntries: [], entryLinks: [],
          selectionEntryGroups: [{
            id: 'inner-no-min', name: 'Lores of Magic',
            constraints: [max(1)],
            selectionEntries: [],
            entryLinks: [
              { id: 'l-necromancy', targetId: 'necromancy', name: 'Lore of Necromancy', constraints: [min(1)] }
            ]
          }]
        }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([]);
  });

  it('eine Pflichtgruppe ohne eigene direkte Mitglieder, aber mit einer Pflichtgruppe darin, steuert nur das Mitglied der inneren Gruppe bei', () => {
    const entriesById = {
      fire: { id: 'fire', name: 'Fire' },
      unit: {
        id: 'unit', name: 'Adept',
        selectionEntries: [], entryLinks: [],
        selectionEntryGroups: [{
          id: 'outer-mandatory', name: 'Discipline',
          constraints: [min(1), max(1)],
          selectionEntries: [], entryLinks: [],
          selectionEntryGroups: [{
            id: 'inner-mandatory', name: 'Element',
            constraints: [min(1), max(1)],
            defaultSelectionEntryId: null,
            selectionEntries: [{ id: 'e-fire', name: 'Fire', constraints: [] }],
            entryLinks: []
          }]
        }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), entry: { id: 'unit' }
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Fire', number: 1 }]);
  });
});
