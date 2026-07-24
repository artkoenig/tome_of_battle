import { describe, test, expect } from 'vitest';
import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { computeRosterCounts } from './rosterCounter.js';
import { findForceContainingSelection, findSelectionInRoster } from './rosterTree.js';
import {
  createQueryContext, resolveScopeAnchor, measureOver, measureQuery,
  createEntryInstanceMatcher, MeasureTarget
} from './queryEngine.js';

// Unit tests for the scope-agnostic counting kernel (ADR 0029). They exercise the
// kernel in isolation of the validator: a query object + an instance subject go in,
// a measured number comes out — the same seam every constraint/condition adapter uses.

const POINTS = 'pts';
const CATALOGUE_ID = 'cat';
const FORCE_ENTRY_ID = 'fe-army';
const HERO_ENTRY_ID = 'hero';
const GRUNT_ENTRY_ID = 'grunt';
const WEAPON_ENTRY_ID = 'weapon';
const SERGEANT_ENTRY_ID = 'sergeant';

function makeSystem(selectionEntries, { entryLinks = [] } = {}) {
  return {
    id: 'sys',
    costTypes: [{ id: POINTS, name: 'Points' }],
    categoryEntries: [],
    forceEntries: [{ id: FORCE_ENTRY_ID, name: 'Army', categoryLinks: [] }],
    catalogues: [{ id: CATALOGUE_ID, selectionEntries, entryLinks }]
  };
}

function makeForce(id, selections) {
  return { id, forceEntryId: FORCE_ENTRY_ID, catalogueId: CATALOGUE_ID, selections };
}

function makeRoster(forces, { costLimit, costLimitType = POINTS } = {}) {
  return { id: 'r', catalogueId: CATALOGUE_ID, costLimit, costLimitType, forces };
}

function sel({ id, entry, number = 1, link = null, selections = [], name = 'Sel' }) {
  return { id, name, selectionEntryId: entry ?? null, entryLinkId: link, number, selections };
}

/** Assembles the (subject, ctx) pair the kernel expects for a selection in a roster. */
function subjectFor(roster, system, selectionId) {
  const selection = findSelectionInRoster(roster, selectionId);
  const force = findForceContainingSelection(roster, selectionId);
  const forceCatalogueId = force?.catalogueId ?? roster.catalogueId;
  const parentSelection = findParentSelection(roster, selectionId);
  const entryId = selection.entryLinkId || selection.selectionEntryId;
  const entry = resolveEntry(system, findEntryInSystem(system, entryId, forceCatalogueId), forceCatalogueId);
  const counts = computeRosterCounts(roster, system);
  const ctx = createQueryContext({ roster, system, counts, forceCatalogueId });
  return { subject: { selection, parentSelection, force, entry, entryId }, ctx };
}

function findParentSelection(roster, selectionId) {
  const walk = (nodes, parent) => {
    for (const node of nodes ?? []) {
      if (node.id === selectionId) return parent;
      const found = walk(node.selections, node);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  for (const force of roster.forces) {
    const found = walk(force.selections, null);
    if (found !== undefined) return found;
  }
  return null;
}

const heroSystem = () => makeSystem([
  { id: HERO_ENTRY_ID, name: 'Hero', type: 'unit', costs: [{ typeId: POINTS, value: 100 }] },
  { id: GRUNT_ENTRY_ID, name: 'Grunt', type: 'unit', costs: [{ typeId: POINTS, value: 10 }] }
]);

describe('resolveScopeAnchor — the single scope-aware seam', () => {
  const roster = makeRoster([makeForce('f1', [sel({ id: 's1', entry: HERO_ENTRY_ID })])]);

  test('a non-shared query binds to the instance subtree regardless of scope', () => {
    const { subject, ctx } = subjectFor(roster, heroSystem(), 's1');
    const anchor = resolveScopeAnchor({ scope: 'roster', shared: false }, subject, ctx);
    expect(anchor.kind).toBe('subtree');
  });

  test('roster / force / parent / entry-id each map to their own anchor kind', () => {
    const { subject, ctx } = subjectFor(roster, heroSystem(), 's1');
    expect(resolveScopeAnchor({ scope: 'roster' }, subject, ctx).kind).toBe('aggregate');
    expect(resolveScopeAnchor({ scope: 'force' }, subject, ctx).kind).toBe('aggregate');
    expect(resolveScopeAnchor({ scope: 'parent' }, subject, ctx).kind).toBe('container');
    expect(resolveScopeAnchor({ scope: 'some-category-id' }, subject, ctx).kind).toBe('entryBucket');
  });
});

describe('measureOver INSTANCES — one entry counted per reference frame', () => {
  // f1: two heroes, f2: one hero → 3 army-wide, 2 in f1.
  const roster = makeRoster([
    makeForce('f1', [sel({ id: 's1', entry: HERO_ENTRY_ID }), sel({ id: 's2', entry: HERO_ENTRY_ID })]),
    makeForce('f2', [sel({ id: 's3', entry: HERO_ENTRY_ID })])
  ]);

  const countInstances = (query, selectionId) => {
    const { subject, ctx } = subjectFor(roster, heroSystem(), selectionId);
    const anchor = resolveScopeAnchor(query, subject, ctx);
    return measureOver(anchor, {
      target: MeasureTarget.INSTANCES,
      includeChildSelections: query.includeChildSelections,
      subject, ctx
    });
  };

  test('roster scope (shared) aggregates every instance army-wide', () => {
    expect(countInstances({ scope: 'roster' }, 's1')).toBe(3);
  });

  test('force scope (shared) aggregates only within the subject\'s force', () => {
    expect(countInstances({ scope: 'force' }, 's1')).toBe(2);
  });

  test('force scope with includeChildForces widens to the whole roster', () => {
    expect(countInstances({ scope: 'force', includeChildForces: true }, 's1')).toBe(3);
  });

  test('shared="false" counts only the one instance it hangs on', () => {
    expect(countInstances({ scope: 'roster', shared: false }, 's1')).toBe(1);
  });

  test('shared="false" still counts the instance\'s own number', () => {
    const rosterWithPair = makeRoster([makeForce('f1', [sel({ id: 's1', entry: HERO_ENTRY_ID, number: 2 })])]);
    const { subject, ctx } = subjectFor(rosterWithPair, heroSystem(), 's1');
    const anchor = resolveScopeAnchor({ scope: 'roster', shared: false }, subject, ctx);
    expect(measureOver(anchor, { target: MeasureTarget.INSTANCES, subject, ctx })).toBe(2);
  });
});

describe('measureOver INSTANCES — parent scope and nesting', () => {
  const system = makeSystem([
    { id: 'squad', name: 'Squad', type: 'unit' },
    { id: SERGEANT_ENTRY_ID, name: 'Sergeant', type: 'upgrade' },
    { id: WEAPON_ENTRY_ID, name: 'Weapon', type: 'upgrade' }
  ]);
  // squad → [weapon-1, sergeant → [weapon-2]]
  const roster = makeRoster([makeForce('f1', [
    sel({
      id: 's-squad', entry: 'squad',
      selections: [
        sel({ id: 's-weapon-1', entry: WEAPON_ENTRY_ID }),
        sel({ id: 's-sergeant', entry: SERGEANT_ENTRY_ID, selections: [sel({ id: 's-weapon-2', entry: WEAPON_ENTRY_ID })] })
      ]
    })
  ])]);

  const countWeaponsInParent = (includeChildSelections) => {
    const { subject, ctx } = subjectFor(roster, system, 's-weapon-1');
    const query = { scope: 'parent', includeChildSelections };
    const anchor = resolveScopeAnchor(query, subject, ctx);
    return measureOver(anchor, { target: MeasureTarget.INSTANCES, includeChildSelections, subject, ctx });
  };

  test('without includeChildSelections only the parent\'s direct children count', () => {
    expect(countWeaponsInParent(false)).toBe(1);
  });

  test('includeChildSelections reaches the weapon nested under the sergeant', () => {
    expect(countWeaponsInParent(true)).toBe(2);
  });
});

describe('the single target matcher resolves link ids to their target id', () => {
  const TARGET_ID = 'shared-target';
  const system = makeSystem(
    [{ id: 'carrier', name: 'Carrier', type: 'unit' }],
    { entryLinks: [] }
  );
  system.catalogues[0].sharedSelectionEntries = [{ id: TARGET_ID, name: 'Banner', type: 'upgrade' }];
  system.catalogues[0].entryLinks = [
    { id: 'link-1', targetId: TARGET_ID, type: 'selectionEntry' },
    { id: 'link-2', targetId: TARGET_ID, type: 'selectionEntry' }
  ];
  // Two carriers each hold the same target via a *different* link.
  const roster = makeRoster([makeForce('f1', [
    sel({ id: 'c1', entry: 'carrier', selections: [sel({ id: 'b1', link: 'link-1' })] }),
    sel({ id: 'c2', entry: 'carrier', selections: [sel({ id: 'b2', link: 'link-2' })] })
  ])]);

  test('a candidate reached via another link still matches the subject target', () => {
    const { subject, ctx } = subjectFor(roster, system, 'b1');
    const matcher = createEntryInstanceMatcher(subject, ctx);
    const other = findSelectionInRoster(roster, 'b2');
    expect(matcher(other)).toBe(true);
  });

  test('roster-scope aggregation counts both banners as one shared target', () => {
    const { value } = measureQuery({ scope: 'roster' }, subjectFor(roster, system, 'b1').subject, subjectFor(roster, system, 'b1').ctx);
    expect(value).toBe(2);
  });
});

describe('measureOver REFERENCE — percent denominator over the same anchor', () => {
  // f1: hero (100 pts) + two grunts (10 pts each).
  const roster = makeRoster([makeForce('f1', [
    sel({ id: 's-hero', entry: HERO_ENTRY_ID }),
    sel({ id: 'g1', entry: GRUNT_ENTRY_ID }),
    sel({ id: 'g2', entry: GRUNT_ENTRY_ID })
  ])], { costLimit: 1000 });

  const reference = (query, field) => {
    const { subject, ctx } = subjectFor(roster, heroSystem(), 's-hero');
    const anchor = resolveScopeAnchor(query, subject, ctx);
    return measureOver(anchor, { target: MeasureTarget.REFERENCE, field, subject, ctx });
  };

  test('a selection-field reference is the total selection count in scope', () => {
    expect(reference({ scope: 'roster' }, 'selections')).toBe(3);
  });

  test('a roster-wide reference of the limited cost type is the points budget', () => {
    expect(reference({ scope: 'roster' }, POINTS)).toBe(1000);
  });

  test('without a points budget the cost reference is the summed cost in scope', () => {
    const noBudget = makeRoster([makeForce('f1', [
      sel({ id: 's-hero', entry: HERO_ENTRY_ID }),
      sel({ id: 'g1', entry: GRUNT_ENTRY_ID })
    ])]);
    const { subject, ctx } = subjectFor(noBudget, heroSystem(), 's-hero');
    const anchor = resolveScopeAnchor({ scope: 'roster' }, subject, ctx);
    expect(measureOver(anchor, { target: MeasureTarget.REFERENCE, field: POINTS, subject, ctx })).toBe(110);
  });

  test('a non-shared percent measures numerator and denominator in the same subtree', () => {
    // The instance's own subtree holds just itself → reference 1, matching a shared=false numerator.
    const anchor = resolveScopeAnchor({ scope: 'roster', shared: false }, subjectFor(roster, heroSystem(), 's-hero').subject, subjectFor(roster, heroSystem(), 's-hero').ctx);
    const { subject, ctx } = subjectFor(roster, heroSystem(), 's-hero');
    expect(measureOver(anchor, { target: MeasureTarget.REFERENCE, field: 'selections', subject, ctx })).toBe(1);
  });
});

describe('measureQuery — L2 composition', () => {
  const roster = makeRoster([makeForce('f1', [
    sel({ id: 's1', entry: HERO_ENTRY_ID }), sel({ id: 's2', entry: HERO_ENTRY_ID })
  ])]);

  test('returns the instance count together with the anchor it measured over', () => {
    const { subject, ctx } = subjectFor(roster, heroSystem(), 's1');
    const result = measureQuery({ scope: 'roster' }, subject, ctx);
    expect(result.value).toBe(2);
    expect(result.anchor.kind).toBe('aggregate');
  });
});
