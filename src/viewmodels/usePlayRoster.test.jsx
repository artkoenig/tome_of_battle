import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

import { usePlayRoster, groupedPlaySelections } from './usePlayRoster';

/**
 * Issue 0165, AC1 — the play shell's ViewModel.
 *
 * The grouping is the interesting derivation, and it reads the report, never a
 * catalogue walk (ADR-0034): a hand-built `capabilities` map plus
 * `pathBySelectionId` is therefore the whole fixture, and the hook cases run
 * with `system = null` so the evaluation is the frozen empty result.
 */

vi.mock('../db/database', () => ({ saveRoster: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const makeRoster = () => ({
  id: 'r1',
  name: 'Erste',
  catalogueId: 'cat1',
  costLimitType: 'pts',
  forces: [{
    id: 'f1',
    forceEntryId: 'fe1',
    selections: [
      { id: 's-cheap', name: 'Bogenschützen', category: 'core' },
      { id: 's-dear', name: 'Ritter', category: 'core' },
      { id: 's-rule', name: 'Eine Listenregel', category: 'core' },
      { id: 's-loose', name: 'Ohne Kategorie', category: 'nirgends' },
    ],
  }],
});

const SYSTEM = {
  name: 'Warhammer',
  catalogues: [{ id: 'cat1', name: 'Bretonnia' }],
  categoryEntries: [{ id: 'core', name: 'Kerneinheiten' }],
  forceEntries: [{ id: 'fe1', name: 'Heer', categoryLinks: [{ targetId: 'core', name: 'Kern' }] }],
};

const REPORT = {
  description: { costTypes: [{ id: 'pts', name: 'Punkte' }] },
  pathBySelectionId: new Map([
    ['s-cheap', 'f/0/u/0'],
    ['s-dear', 'f/0/u/1'],
    ['s-rule', 'f/0/u/2'],
    ['s-loose', 'f/0/u/3'],
  ]),
  capabilities: new Map([
    ['f/0/u/0', { totalCosts: { pts: 60 } }],
    ['f/0/u/1', { totalCosts: { pts: 240 } }],
    ['f/0/u/2', { totalCosts: { pts: 0 }, isListRule: true }],
    ['f/0/u/3', { totalCosts: { pts: 30 } }],
  ]),
  costTotals: { pts: 330 },
};

describe('groupedPlaySelections', () => {
  it('groups by the categories of the force and sorts each group by cost, descending', () => {
    const groups = groupedPlaySelections(SYSTEM, makeRoster(), REPORT);

    expect(groups.map(g => g.name)).toEqual(['Kerneinheiten', expect.any(String)]);
    expect(groups[0].selections.map(s => s.id)).toEqual(['s-dear', 's-cheap']);
    expect(groups[1].selections.map(s => s.id)).toEqual(['s-loose']);
  });

  it('leaves the list rules off the battlefield', () => {
    const groups = groupedPlaySelections(SYSTEM, makeRoster(), REPORT);
    const shownIds = groups.flatMap(g => g.selections.map(s => s.id));
    expect(shownIds).not.toContain('s-rule');
  });

  it('drops a category that holds nothing', () => {
    const emptyForce = { ...makeRoster(), forces: [{ id: 'f1', forceEntryId: 'fe1', selections: [] }] };
    expect(groupedPlaySelections(SYSTEM, emptyForce, REPORT)).toEqual([]);
  });
});

describe('usePlayRoster', () => {
  const renderPlay = () => renderHook(() => usePlayRoster({
    system: null, initialRoster: makeRoster(), onReportError: vi.fn(),
  }));

  it('carries the roster, its report and the header labels', () => {
    const { result } = renderPlay();

    expect(result.current.roster.id).toBe('r1');
    expect(result.current.activeCatalogue).toBeNull();
    expect(result.current.catalogueLabel).toBe('');
    expect(result.current.extraResources).toEqual([]);
  });

  it('shows a tooltip only on the desktop and only with content', () => {
    const { result } = renderPlay();
    const event = { currentTarget: { getBoundingClientRect: () => ({ left: 10, bottom: 20 }) } };

    window.innerWidth = 1200;
    act(() => result.current.showTooltip(event, 'Titel', []));
    expect(result.current.tooltipState.visible).toBe(false);

    act(() => result.current.showTooltip(event, 'Titel', ['+1 Stärke']));
    expect(result.current.tooltipState).toMatchObject({ visible: true, x: 10, y: 28, title: 'Titel' });

    act(() => result.current.hideTooltip());
    expect(result.current.tooltipState.visible).toBe(false);

    window.innerWidth = 500;
    act(() => result.current.showTooltip(event, 'Titel', ['+1 Stärke']));
    expect(result.current.tooltipState.visible).toBe(false);
  });

  it('opens and closes the detail sheet', () => {
    const { result } = renderPlay();

    act(() => result.current.setSaveSummaryData({ title: 'Rüstung', breakdown: ['+1'] }));
    act(() => result.current.setSaveSummaryOpen(true));
    expect(result.current.saveSummaryOpen).toBe(true);
    expect(result.current.saveSummaryData.title).toBe('Rüstung');

    act(() => result.current.closeSaveSummary());
    expect(result.current.saveSummaryOpen).toBe(false);
  });

  it('opens the rule dialog only for a rule that resolves to a URL', () => {
    const { result } = renderPlay();
    act(() => result.current.showRule('Eine Regel ohne Index'));
    expect(result.current.activeRuleDialog).toBeNull();
  });
});
