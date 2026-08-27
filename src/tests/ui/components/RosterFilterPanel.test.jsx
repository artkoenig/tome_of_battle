import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterFilterPanel from '../../../ui/components/RosterFilterPanel';
import { FILTER_CATEGORY } from '../../../ui/viewmodels/rosterFilter';

/**
 * Issue 0203 — the filter's selection surface, shared by the desktop popover
 * and the mobile bottom sheet.
 */
const OPTIONS = {
  systems: [{ id: 'sys-1', name: 'Warhammer Fantasy' }],
  factions: [{ id: 'cat-1', name: 'Empire' }, { id: 'cat-2', name: 'Bretonnia' }],
};

describe('RosterFilterPanel', () => {
  it('shows both multi-selects and marks the selected values', () => {
    render(
      <RosterFilterPanel
        options={OPTIONS}
        selection={{ systemIds: ['sys-1'], factionIds: [] }}
        selectedCount={1}
      />
    );

    expect(screen.getByLabelText('Warhammer Fantasy').checked).toBe(true);
    expect(screen.getByLabelText('Empire').checked).toBe(false);
    expect(screen.getByText('Filter zurücksetzen')).toBeDefined();
  });

  it('reports a toggle with its category and clears on demand', () => {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    render(
      <RosterFilterPanel
        options={OPTIONS}
        selection={{ systemIds: [], factionIds: ['cat-2'] }}
        selectedCount={1}
        onToggle={onToggle}
        onClear={onClear}
      />
    );

    fireEvent.click(screen.getByLabelText('Warhammer Fantasy'));
    expect(onToggle).toHaveBeenCalledWith(FILTER_CATEGORY.SYSTEM, 'sys-1');

    fireEvent.click(screen.getByText('Filter zurücksetzen'));
    expect(onClear).toHaveBeenCalled();
  });

  it('says so where a category has no value to offer, and hides clear-all without a selection', () => {
    render(<RosterFilterPanel options={{ systems: [], factions: [] }} />);

    expect(screen.getAllByText('Nichts zur Auswahl')).toHaveLength(2);
    expect(screen.queryByText('Filter zurücksetzen')).toBeNull();
  });
});
