import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterDashboard from '../../../ui/components/RosterDashboard';
import { FILTER_CATEGORY } from '../../../ui/viewmodels/rosterFilter';

/**
 * Issue 0203 — the overview's filter as the shell renders it: the control in
 * the toolbar, the panel it opens, the chip row and the "nothing matches"
 * message.
 *
 * The filter bundle is handed in as a prop (`App` builds it with
 * `useRosterFilter`), so this file drives the shell without a settings
 * provider — what is pinned here is the markup and the callbacks, not the
 * persistence.
 */

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Play: () => <span data-testid="icon-play" />,
  Edit3: () => <span data-testid="icon-edit" />,
  Download: () => <span data-testid="icon-download" />,
  Upload: () => <span data-testid="icon-upload" />,
  WifiOff: () => <span data-testid="icon-wifioff" />,
  MoreVertical: () => <span data-testid="icon-more-vertical" />,
  Filter: () => <span data-testid="icon-filter" />,
  X: () => <span data-testid="icon-x" />,
}));

vi.mock('../../../ui/components/editor/BottomSheet', () => ({
  default: ({ children, isOpen }) => (isOpen ? <div data-testid="bottom-sheet">{children}</div> : null),
}));

const SYSTEMS = [
  {
    id: 'sys-1',
    name: 'Warhammer Fantasy',
    catalogues: [{ id: 'cat-1', name: 'Empire' }, { id: 'cat-2', name: 'Bretonnia' }],
  },
  {
    id: 'sys-2',
    name: 'Warhammer 40.000',
    catalogues: [{ id: 'cat-3', name: 'Orks' }],
  },
];

const roster = (id, name, systemId, catalogueId) => ({
  id, name, systemId, catalogueId, costLimit: 2000, costLimitType: 'pts', forces: [],
});

const ROSTERS = [
  roster('r1', 'Reikland', 'sys-1', 'cat-1'),
  roster('r2', 'Ritter', 'sys-1', 'cat-2'),
  roster('r3', 'Waaagh', 'sys-2', 'cat-3'),
];

const toggleValue = vi.fn();
const removeValue = vi.fn();
const clearAll = vi.fn();

const filterBundle = (selection = { systemIds: [], factionIds: [] }, chips = []) => ({
  selection,
  options: {
    systems: [{ id: 'sys-2', name: 'Warhammer 40.000' }, { id: 'sys-1', name: 'Warhammer Fantasy' }],
    factions: [
      { id: 'cat-2', name: 'Bretonnia' },
      { id: 'cat-1', name: 'Empire' },
      { id: 'cat-3', name: 'Orks' },
    ],
  },
  chips,
  selectedCount: selection.systemIds.length + selection.factionIds.length,
  toggleValue,
  removeValue,
  clearAll,
});

const renderDashboard = (filter) => render(
  <RosterDashboard rosters={ROSTERS} systems={SYSTEMS} filter={filter} />
);

beforeEach(() => {
  toggleValue.mockClear();
  removeValue.mockClear();
  clearAll.mockClear();
});

describe('RosterDashboard filter', () => {
  it('opens a panel with both multi-selects and reports a toggled value', () => {
    renderDashboard(filterBundle());

    expect(screen.queryByTestId('roster-filter-panel')).toBeNull();
    fireEvent.click(screen.getByTestId('dashboard-filter'));

    expect(screen.getByTestId('roster-filter-panel')).toBeDefined();
    expect(screen.getByText('Spielsysteme')).toBeDefined();
    expect(screen.getByText('Fraktionen')).toBeDefined();
    expect(screen.getByText('Warhammer Fantasy')).toBeDefined();
    expect(screen.getAllByText('Empire').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Empire'));
    expect(toggleValue).toHaveBeenCalledWith(FILTER_CATEGORY.FACTION, 'cat-1');
  });

  it('shows how many values are selected while a filter is active', () => {
    const { rerender } = renderDashboard(filterBundle());
    expect(screen.getByTestId('dashboard-filter').textContent).not.toMatch(/2/);

    rerender(
      <RosterDashboard
        rosters={ROSTERS}
        systems={SYSTEMS}
        filter={filterBundle({ systemIds: ['sys-1'], factionIds: ['cat-1'] })}
      />
    );
    expect(screen.getByTestId('dashboard-filter').textContent).toMatch(/2/);
  });

  it('renders one dismissible chip per selected value plus a clear-all control', () => {
    renderDashboard(filterBundle(
      { systemIds: ['sys-1'], factionIds: ['cat-1'] },
      [
        { category: FILTER_CATEGORY.SYSTEM, id: 'sys-1', name: 'Warhammer Fantasy' },
        { category: FILTER_CATEGORY.FACTION, id: 'cat-1', name: 'Empire' },
      ]
    ));

    const chipRow = screen.getByTestId('dashboard-filter-chips');
    expect(chipRow).toBeDefined();

    fireEvent.click(screen.getByLabelText('Empire aus dem Filter nehmen'));
    expect(removeValue).toHaveBeenCalledWith(FILTER_CATEGORY.FACTION, 'cat-1');

    fireEvent.click(screen.getAllByText('Filter zurücksetzen')[0]);
    expect(clearAll).toHaveBeenCalled();
  });

  it('drops the chip row when nothing is selected', () => {
    renderDashboard(filterBundle());
    expect(screen.queryByTestId('dashboard-filter-chips')).toBeNull();
  });

  it('shows its own message when the selection matches no army list', () => {
    renderDashboard(filterBundle(
      { systemIds: ['sys-1'], factionIds: ['cat-3'] },
      [{ category: FILTER_CATEGORY.FACTION, id: 'cat-3', name: 'Orks' }]
    ));

    expect(screen.getByTestId('dashboard-filter-no-match')).toBeDefined();
    expect(screen.getByText('Keine Liste passt zum Filter')).toBeDefined();
    // Not the first-start empty state a user without any list sees.
    expect(screen.queryByText('Die Waffenkammern sind leer')).toBeNull();

    fireEvent.click(screen.getAllByText('Filter zurücksetzen')[0]);
    expect(clearAll).toHaveBeenCalled();
  });

  it('shows only the matching lists and drops a faction group left without a card', () => {
    renderDashboard(filterBundle({ systemIds: [], factionIds: ['cat-1'] }));

    expect(screen.getByText('Reikland')).toBeDefined();
    expect(screen.queryByText('Ritter')).toBeNull();
    expect(screen.queryByText('Waaagh')).toBeNull();
    expect(screen.queryByText('Bretonnia')).toBeNull();
  });
});
