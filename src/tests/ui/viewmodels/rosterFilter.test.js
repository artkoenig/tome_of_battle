import { describe, it, expect } from 'vitest';
import {
  EMPTY_ROSTER_FILTER,
  FILTER_CATEGORY,
  filterChipsOf,
  filterOptionsOf,
  filterValueCount,
  matchesRosterFilter,
  toggleFilterValue,
  withoutFilterValue,
} from '../../../ui/viewmodels/rosterFilter';

/** Issue 0203 — the filter's pure half. */

const SYSTEMS = [
  { id: 'sys-1', name: 'Warhammer Fantasy', catalogues: [{ id: 'cat-1', name: 'Empire' }] },
  { id: 'sys-2', name: 'Mordheim', catalogues: [{ id: 'cat-2', name: 'Skaven' }] },
];

const roster = (systemId, catalogueId) => ({ id: `${systemId}-${catalogueId}`, systemId, catalogueId });

describe('rosterFilter', () => {
  it('offers a value only where an army list carries it', () => {
    const options = filterOptionsOf([roster('sys-2', 'cat-2'), roster('sys-1', 'unknown')], SYSTEMS);

    expect(options.systems.map(o => o.id)).toEqual(['sys-2', 'sys-1']);
    expect(options.factions.map(o => o.id)).toEqual(['cat-2']);
  });

  it('combines within a category as OR and across the two as AND', () => {
    const filter = { systemIds: ['sys-1', 'sys-2'], factionIds: ['cat-1'] };

    expect(matchesRosterFilter(roster('sys-1', 'cat-1'), filter)).toBe(true);
    expect(matchesRosterFilter(roster('sys-2', 'cat-1'), filter)).toBe(true);
    expect(matchesRosterFilter(roster('sys-2', 'cat-2'), filter)).toBe(false);
  });

  it('lets everything through where nothing is selected', () => {
    expect(matchesRosterFilter(roster('sys-9', 'cat-9'), EMPTY_ROSTER_FILTER)).toBe(true);
    expect(filterValueCount(EMPTY_ROSTER_FILTER)).toBe(0);
  });

  it('toggles and removes one value without touching the other category', () => {
    const added = toggleFilterValue(EMPTY_ROSTER_FILTER, FILTER_CATEGORY.FACTION, 'cat-1');
    expect(added).toEqual({ systemIds: [], factionIds: ['cat-1'] });

    const both = toggleFilterValue(added, FILTER_CATEGORY.SYSTEM, 'sys-1');
    expect(toggleFilterValue(both, FILTER_CATEGORY.FACTION, 'cat-1'))
      .toEqual({ systemIds: ['sys-1'], factionIds: [] });
    expect(withoutFilterValue(both, FILTER_CATEGORY.SYSTEM, 'sys-1'))
      .toEqual({ systemIds: [], factionIds: ['cat-1'] });
  });

  it('names a chip per selected value, systems first', () => {
    const options = filterOptionsOf([roster('sys-1', 'cat-1'), roster('sys-2', 'cat-2')], SYSTEMS);
    const chips = filterChipsOf({ systemIds: ['sys-1'], factionIds: ['cat-2'] }, options);

    expect(chips).toEqual([
      { category: FILTER_CATEGORY.SYSTEM, id: 'sys-1', name: 'Warhammer Fantasy' },
      { category: FILTER_CATEGORY.FACTION, id: 'cat-2', name: 'Skaven' },
    ]);
  });
});
