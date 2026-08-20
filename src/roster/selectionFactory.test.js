import { describe, it, expect } from 'vitest';
import { createSelectionFromDef } from './selectionFactory.js';

/**
 * Die Fabrik legt an, was der **Bericht** als Pflicht-Mitgliedschaft eines noch
 * nicht ausgehobenen Eintrags meldet (`capability.raiseMembers`, Issue 0157) —
 * sie liest keine Katalog-Constraints mehr. Welche Verpflichtung dort entsteht
 * (Mitglieder-`min`, Gruppen-`min`, `defaultSelectionEntryId`, Modifikatoren),
 * ist Sache des Evaluators und dort gepinnt
 * (`src/evaluator/costProjection.raiseMembers.test.js`). Hier steht allein: aus
 * einer gemeldeten Id wird das richtige Katalog-Objekt, in jeder Tiefe.
 */

// ── Generische, schema-förmige Fixtures (nicht katalog-/einheitsspezifisch, ADR-0003) ──
// Ein Stub-resolveEntry löst Links über targetId, Einträge über id auf.
function makeResolver(entriesById) {
  return (_system, entry) => {
    if (!entry) return null;
    if (entry.targetId) return entriesById[entry.targetId] || null;
    return entriesById[entry.id] || entry;
  };
}

function childNumbers(selection) {
  return selection.selections.map(child => ({ name: child.name, number: child.number }));
}

describe('createSelectionFromDef — der Knoten selbst', () => {
  it('trägt Name, Kategorie und Herkunfts-Id des aufgelösten Eintrags', () => {
    const entriesById = { hero: { id: 'hero', name: 'Held', collective: false } };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), catalogueId: 'cat-1',
      entry: { id: 'hero' }, categoryId: 'cat-heroes'
    });

    expect(selection).toMatchObject({
      name: 'Held', number: 1, category: 'cat-heroes',
      selectionEntryId: 'hero', entryLinkId: null, collective: false, selections: []
    });
  });

  it('führt einen Verweis unter seiner Link-Id, nicht unter der Ziel-Id', () => {
    const entriesById = { hero: { id: 'hero', name: 'Held' } };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), catalogueId: 'cat-1',
      entry: { id: 'link-hero', targetId: 'hero' }
    });

    expect(selection).toMatchObject({ entryLinkId: 'link-hero', selectionEntryId: null });
  });

  it('liefert null für einen unauflösbaren Eintrag', () => {
    expect(createSelectionFromDef({
      system: {}, resolveEntry: () => null, catalogueId: 'cat-1', entry: { id: 'weg' }
    })).toBeNull();
  });

  it('legt ohne gemeldete Pflicht-Mitglieder nichts darunter an — auch wenn der Katalog min-Constraints trägt', () => {
    const entriesById = {
      unit: {
        id: 'unit', name: 'Einheit',
        selectionEntries: [{
          id: 'crew', name: 'Crew',
          constraints: [{ id: 'c-min', type: 'min', value: 3, scope: 'parent' }]
        }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(entriesById), catalogueId: 'cat-1', entry: { id: 'unit' }
    });

    expect(selection.selections).toEqual([]);
  });
});

describe('createSelectionFromDef — die vom Bericht gemeldeten Pflicht-Mitglieder', () => {
  const entriesById = {
    axe: { id: 'axe', name: 'Axe' },
    bolt: { id: 'bolt', name: 'Bolt' },
    torch: { id: 'torch', name: 'Torch' },
    unit: {
      id: 'unit', name: 'Einheit',
      selectionEntries: [{ id: 'crew', name: 'Crew' }],
      entryLinks: [{ id: 'l-axe', targetId: 'axe', name: 'Axe' }],
      selectionEntryGroups: [{
        id: 'outer', name: 'Outer',
        selectionEntryGroups: [{
          id: 'inner', name: 'Inner',
          entryLinks: [{ id: 'l-torch', targetId: 'torch', name: 'Torch' }]
        }]
      }]
    }
  };
  const factory = (mandatoryMembers) => createSelectionFromDef({
    system: {}, resolveEntry: makeResolver(entriesById), catalogueId: 'cat-1',
    entry: { id: 'unit' }, mandatoryMembers
  });

  it('legt jedes gemeldete Mitglied mit der gemeldeten Anzahl an, in gemeldeter Reihenfolge', () => {
    const selection = factory([
      { defId: 'l-axe', targetDefId: 'axe', count: 1, members: [] },
      { defId: 'crew', targetDefId: null, count: 3, members: [] }
    ]);

    expect(childNumbers(selection)).toEqual([
      { name: 'Axe', number: 1 },
      { name: 'Crew', number: 3 }
    ]);
  });

  it('findet ein Mitglied in einer Gruppe beliebiger Tiefe — Gruppen sind durchlässig', () => {
    const selection = factory([{ defId: 'l-torch', targetDefId: 'torch', count: 2, members: [] }]);

    expect(childNumbers(selection)).toEqual([{ name: 'Torch', number: 2 }]);
  });

  it('legt die Pflicht-Mitglieder eines Pflicht-Mitglieds rekursiv an', () => {
    const nested = {
      mount: {
        id: 'mount', name: 'Mount',
        selectionEntries: [{ id: 'barding', name: 'Barding' }]
      },
      unit: { id: 'unit', name: 'Einheit', entryLinks: [{ id: 'l-mount', targetId: 'mount' }] }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(nested), catalogueId: 'cat-1', entry: { id: 'unit' },
      mandatoryMembers: [{
        defId: 'l-mount', targetDefId: 'mount', count: 1,
        members: [{ defId: 'barding', targetDefId: null, count: 1, members: [] }]
      }]
    });

    expect(selection.selections[0].name).toBe('Mount');
    expect(childNumbers(selection.selections[0])).toEqual([{ name: 'Barding', number: 1 }]);
  });

  it('übergeht eine Id, die der Katalog unter diesem Eintrag nicht führt', () => {
    const selection = factory([
      { defId: 'gibt-es-nicht', targetDefId: null, count: 1, members: [] },
      { defId: 'crew', targetDefId: null, count: 1, members: [] }
    ]);

    expect(childNumbers(selection)).toEqual([{ name: 'Crew', number: 1 }]);
  });

  it('folgt einem Gruppen-Verweis: die Mitglieder der verlinkten Gruppe sind erreichbar', () => {
    const linked = {
      'shared-group': { id: 'shared-group', entryLinks: [{ id: 'l-bolt', targetId: 'bolt' }] },
      bolt: { id: 'bolt', name: 'Bolt' },
      unit: {
        id: 'unit', name: 'Einheit',
        entryLinks: [{ id: 'l-group', targetId: 'shared-group', type: 'selectionEntryGroup' }]
      }
    };

    const selection = createSelectionFromDef({
      system: {}, resolveEntry: makeResolver(linked), catalogueId: 'cat-1', entry: { id: 'unit' },
      mandatoryMembers: [{ defId: 'l-bolt', targetDefId: 'bolt', count: 1, members: [] }]
    });

    expect(childNumbers(selection)).toEqual([{ name: 'Bolt', number: 1 }]);
  });
});
