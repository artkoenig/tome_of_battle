import { describe, test, expect } from 'vitest';
import {
  childSelectionsOf,
  rootSelectionsOf,
  effectiveCountOf,
  traverseSelectionTree,
  foldSelectionTree,
  findSelectionById,
  findSelectionInRoster,
  someSelection,
  countSelections,
  mapSelectionTree,
  replaceSelectionById
} from './rosterTree.js';

// Generic, schema-shaped fixture: a two-force roster with one nested level, so
// the "direct children only" and "descend" behaviours are distinguishable.
const makeRoster = () => ({
  id: 'r',
  forces: [
    {
      id: 'f1',
      selections: [
        {
          id: 's-lord', name: 'Lord', selectionEntryId: 'lord', number: 1,
          selections: [
            { id: 's-banner', name: 'Banner', selectionEntryId: 'banner', number: 1, selections: [] }
          ]
        },
        { id: 's-troop-a', name: 'Trooper', selectionEntryId: 'trooper', number: 2, selections: [] }
      ]
    },
    {
      id: 'f2',
      selections: [
        { id: 's-troop-b', name: 'Trooper', selectionEntryId: 'trooper', number: 3, selections: [] }
      ]
    }
  ]
});

describe('childSelectionsOf', () => {
  test('returns the node\'s children', () => {
    const node = { selections: [{ id: 'a' }] };
    expect(childSelectionsOf(node)).toHaveLength(1);
  });

  test('returns an empty list for a node without children', () => {
    expect(childSelectionsOf({ id: 'leaf' })).toEqual([]);
    expect(childSelectionsOf({ id: 'leaf', selections: null })).toEqual([]);
    expect(childSelectionsOf(null)).toEqual([]);
    expect(childSelectionsOf(undefined)).toEqual([]);
  });

  test('the missing-children result is one shared, immutable instance', () => {
    const first = childSelectionsOf({ id: 'a' });
    expect(childSelectionsOf({ id: 'b' })).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });
});

describe('rootSelectionsOf', () => {
  test('flattens the top-level selections of every force', () => {
    expect(rootSelectionsOf(makeRoster()).map(s => s.id))
      .toEqual(['s-lord', 's-troop-a', 's-troop-b']);
  });

  test('tolerates a roster without forces', () => {
    expect(rootSelectionsOf(null)).toEqual([]);
    expect(rootSelectionsOf({ id: 'r' })).toEqual([]);
  });

  test('skips a force that carries no selections', () => {
    expect(rootSelectionsOf({ forces: [{ id: 'f' }] })).toEqual([]);
  });
});

describe('effectiveCountOf', () => {
  test('multiplies the selection number by its parent count', () => {
    expect(effectiveCountOf({ number: 3 }, 2)).toBe(6);
  });

  test('treats a missing number as one', () => {
    expect(effectiveCountOf({ id: 'a' }, 5)).toBe(5);
    expect(effectiveCountOf({ number: 0 }, 5)).toBe(5);
  });
});

describe('traverseSelectionTree', () => {
  test('visits every node depth-first in pre-order', () => {
    const visited = [];
    traverseSelectionTree(rootSelectionsOf(makeRoster()), selection => {
      visited.push(selection.id);
    });
    expect(visited).toEqual(['s-lord', 's-banner', 's-troop-a', 's-troop-b']);
  });

  test('passes each node the context its parent returned', () => {
    const effectiveCounts = {};
    traverseSelectionTree(rootSelectionsOf(makeRoster()), (selection, parentCount) => {
      const effectiveCount = (selection.number || 1) * parentCount;
      effectiveCounts[selection.id] = effectiveCount;
      return effectiveCount;
    }, 2);
    expect(effectiveCounts).toEqual({
      's-lord': 2, 's-banner': 2, 's-troop-a': 4, 's-troop-b': 6
    });
  });

  test('siblings share the context of their common parent', () => {
    const tree = [{ id: 'root', selections: [{ id: 'a' }, { id: 'b' }] }];
    const seen = {};
    traverseSelectionTree(tree, (selection, depth) => {
      seen[selection.id] = depth;
      return depth + 1;
    }, 0);
    expect(seen).toEqual({ root: 0, a: 1, b: 1 });
  });

  test('does nothing for an absent forest', () => {
    expect(() => traverseSelectionTree(undefined, () => { throw new Error('visited'); })).not.toThrow();
  });
});

describe('foldSelectionTree', () => {
  const subtree = {
    id: 'unit', number: 2,
    selections: [
      { id: 'option-a', number: 1, selections: [] },
      { id: 'option-b', number: 3, selections: [] }
    ]
  };

  test('combines child results bottom-up with a descended context', () => {
    const total = foldSelectionTree(subtree, {
      descend: (selection, parentCount) => (selection.number || 1) * parentCount,
      combine: (selection, parentCount, childTotals) =>
        (selection.number || 1) * parentCount + childTotals.reduce((sum, value) => sum + value, 0)
    }, 1);
    // unit 2 + option-a 1*2 + option-b 3*2 = 10
    expect(total).toBe(10);
  });

  test('a leaf combines with an empty child-result list', () => {
    const childResults = foldSelectionTree({ id: 'leaf' }, {
      combine: (_selection, _context, results) => results
    });
    expect(childResults).toEqual([]);
  });

  test('keeps the root context for combine while children see the descended one', () => {
    const contexts = {};
    foldSelectionTree(subtree, {
      descend: (_selection, depth) => depth + 1,
      combine: (selection, depth) => { contexts[selection.id] = depth; }
    }, 0);
    expect(contexts).toEqual({ unit: 0, 'option-a': 1, 'option-b': 1 });
  });
});

describe('findSelectionById', () => {
  test('finds a nested selection', () => {
    const found = findSelectionById(rootSelectionsOf(makeRoster()), 's-banner');
    expect(found?.name).toBe('Banner');
  });

  test('returns null for an unknown or missing id', () => {
    const selections = rootSelectionsOf(makeRoster());
    expect(findSelectionById(selections, 'nope')).toBeNull();
    expect(findSelectionById(selections, null)).toBeNull();
    expect(findSelectionById(undefined, 's-lord')).toBeNull();
  });
});

describe('findSelectionInRoster', () => {
  test('spans every force of the roster', () => {
    expect(findSelectionInRoster(makeRoster(), 's-troop-b')?.name).toBe('Trooper');
  });

  test('returns null without a roster', () => {
    expect(findSelectionInRoster(null, 's-lord')).toBeNull();
  });
});

describe('someSelection', () => {
  test('matches a deeply nested selection', () => {
    expect(someSelection(rootSelectionsOf(makeRoster()), s => s.id === 's-banner')).toBe(true);
  });

  test('is false when nothing matches', () => {
    expect(someSelection(rootSelectionsOf(makeRoster()), s => s.id === 'nope')).toBe(false);
    expect(someSelection(undefined, () => true)).toBe(false);
  });

  test('stops at the first match', () => {
    const inspected = [];
    someSelection(rootSelectionsOf(makeRoster()), selection => {
      inspected.push(selection.id);
      return selection.id === 's-lord';
    });
    expect(inspected).toEqual(['s-lord']);
  });
});

describe('countSelections', () => {
  const force1 = makeRoster().forces[0];

  test('counts only direct children by default', () => {
    expect(countSelections(force1.selections)).toBe(3); // lord(1) + trooper(2)
  });

  test('includeChildSelections descends into nested selections', () => {
    expect(countSelections(force1.selections, { includeChildSelections: true })).toBe(4); // + banner(1)
  });

  test('applies the predicate to filter matches', () => {
    const onlyTroopers = s => s.selectionEntryId === 'trooper';
    expect(countSelections(force1.selections, { predicate: onlyTroopers })).toBe(2);
  });

  test('treats a missing number as one', () => {
    expect(countSelections([{ id: 'a' }, { id: 'b' }])).toBe(2);
  });

  test('is zero for an absent forest', () => {
    expect(countSelections(undefined)).toBe(0);
  });
});

describe('mapSelectionTree', () => {
  test('rebuilds the subtree bottom-up without mutating the input', () => {
    const roster = makeRoster();
    const original = roster.forces[0].selections[0];
    const renamed = mapSelectionTree(original, (selection, mappedChildren) => ({
      ...selection, name: selection.name.toUpperCase(), selections: mappedChildren
    }));

    expect(renamed.name).toBe('LORD');
    expect(renamed.selections[0].name).toBe('BANNER');
    expect(original.name).toBe('Lord');
    expect(original.selections[0].name).toBe('Banner');
    expect(renamed).not.toBe(original);
  });

  test('hands a leaf an empty child list', () => {
    const mapped = mapSelectionTree({ id: 'leaf' }, (selection, mappedChildren) => ({
      ...selection, selections: mappedChildren
    }));
    expect(mapped.selections).toEqual([]);
  });
});

describe('replaceSelectionById', () => {
  test('replaces a nested selection immutably', () => {
    const roster = makeRoster();
    const before = roster.forces[0].selections;
    const after = replaceSelectionById(before, 's-banner', selection => ({ ...selection, number: 9 }));

    expect(after[0].selections[0].number).toBe(9);
    expect(before[0].selections[0].number).toBe(1);
    expect(after).not.toBe(before);
  });

  test('shares untouched siblings by reference', () => {
    const before = makeRoster().forces[0].selections;
    const after = replaceSelectionById(before, 's-banner', selection => ({ ...selection, number: 9 }));
    expect(after[1]).toBe(before[1]);
  });

  test('returns the input list unchanged when nothing matches', () => {
    const before = makeRoster().forces[0].selections;
    expect(replaceSelectionById(before, 'nope', () => ({}))).toBe(before);
  });

  test('replaces a top-level selection', () => {
    const before = makeRoster().forces[0].selections;
    const after = replaceSelectionById(before, 's-troop-a', selection => ({ ...selection, number: 7 }));
    expect(after[1].number).toBe(7);
    expect(after[0]).toBe(before[0]);
  });

  test('replaces only the first matching selection', () => {
    const before = [
      { id: 'parent', selections: [{ id: 'target', number: 1 }] },
      { id: 'target', number: 1 }
    ];
    const replacements = [];
    replaceSelectionById(before, 'target', selection => {
      replacements.push(selection);
      return { ...selection, number: 5 };
    });
    expect(replacements).toHaveLength(1);
  });
});
