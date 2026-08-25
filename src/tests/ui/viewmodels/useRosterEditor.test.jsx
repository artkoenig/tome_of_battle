import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

import { useRosterEditor } from '../../../ui/viewmodels/useRosterEditor';

/**
 * Issue 0165, AC1 — the editor shell's ViewModel.
 *
 * The cases here are about state and derivation only, so they run with
 * `system = null`: the report is then the frozen empty evaluation and the hook
 * needs no catalogue parse (see the area note). What the report computes is
 * pinned by `useRosterState.test.js`, not again here.
 */

vi.mock('../../../platform/persistence/database', () => ({ saveRoster: vi.fn().mockResolvedValue(undefined) }));
// Der Regel-Kanal haengt am globalen whfb6-Schalter (ADR-0015). Er hat hier
// keinen Provider ueber sich, also steht er wie in der App ohne Verknuepfung.
vi.mock('../../../ui/viewmodels/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));

const SYSTEM = {
  id: 'sys1',
  name: 'Warhammer',
  catalogues: [{ id: 'cat1', name: 'Bretonnia' }, { id: 'cat2', name: 'Empire' }],
};

const makeRoster = () => ({
  id: 'r1',
  name: 'Erste',
  catalogueId: 'cat2',
  costLimit: 2000,
  costLimitType: 'pts',
  forces: [{ id: 'f1', forceEntryId: 'fe1', selections: [] }],
});

const renderEditor = (overrides = {}) => renderHook(() => useRosterEditor({
  system: null,
  initialRoster: makeRoster(),
  onPlay: vi.fn(),
  ...overrides,
}));

describe('useRosterEditor', () => {
  it('resolves the active catalogue in the very first render, without an effect', () => {
    const { result } = renderHook(() => useRosterEditor({
      system: SYSTEM, initialRoster: makeRoster(), onPlay: vi.fn(),
    }));

    expect(result.current.activeCatalogue).toEqual({ id: 'cat2', name: 'Empire' });
  });

  it('has no active catalogue when the system does not know it', () => {
    const { result } = renderEditor();
    expect(result.current.activeCatalogue).toBeNull();
  });

  it('carries the cost display and the force paths of the report', () => {
    const { result } = renderEditor();

    expect(result.current.limitPoints).toBe(2000);
    expect(result.current.currentPoints).toBe(0);
    // Ein Kontingent ohne Pfad im Bericht wird weiterhin gerendert.
    expect(result.current.forces).toEqual([
      { force: expect.objectContaining({ id: 'f1' }), forcePath: null },
    ]);
  });

  it('starts with every list-rule group collapsed and toggles one at a time', () => {
    const { result } = renderEditor();

    expect(result.current.ruleGroups.isExpanded('f1', 'cat-a')).toBe(false);

    act(() => result.current.ruleGroups.onToggle('f1', 'cat-a'));
    expect(result.current.ruleGroups.isExpanded('f1', 'cat-a')).toBe(true);
    expect(result.current.ruleGroups.isExpanded('f1', 'cat-b')).toBe(false);
    // Derselbe Kategorie-Schlüssel unter einem anderen Kontingent bleibt zu.
    expect(result.current.ruleGroups.isExpanded('f2', 'cat-a')).toBe(false);

    act(() => result.current.ruleGroups.onToggle('f1', 'cat-a'));
    expect(result.current.ruleGroups.isExpanded('f1', 'cat-a')).toBe(false);
  });

  it('opens the rule dialog only for a rule that resolves to a URL', () => {
    const { result } = renderEditor();

    act(() => result.current.showRule('Eine Regel ohne Index'));
    expect(result.current.activeRuleDialog).toBeNull();
  });

  it('hands the current roster to the play and export commands', () => {
    const onPlay = vi.fn();
    const onExportRoster = vi.fn();
    const { result } = renderEditor({ onPlay, onExportRoster });

    act(() => result.current.playRoster());
    act(() => result.current.exportRoster());

    expect(onPlay).toHaveBeenCalledWith(result.current.roster);
    expect(onExportRoster).toHaveBeenCalledWith(result.current.roster);
  });

  it('gives the unit card only the selection state and the rule channel', () => {
    const { result } = renderEditor();

    expect(Object.keys(result.current.unitCardContext).sort()).toEqual([
      'costTypeLabel', 'onShowRule', 'selectedRosterSelection', 'setSelectedRosterSelection',
    ]);
  });

  it('keeps the commands bundle identical across a roster edit', () => {
    const { result } = renderEditor();
    const commandsBefore = result.current.commands;

    act(() => result.current.commands.updateRosterName('Umbenannt'));

    expect(result.current.roster.name).toBe('Umbenannt');
    expect(result.current.commands).toBe(commandsBefore);
  });
});
