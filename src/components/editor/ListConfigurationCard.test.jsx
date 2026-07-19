import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListConfigurationCard from './ListConfigurationCard';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
}));

const mockBuildConfigurationRadioGroups = vi.fn();
vi.mock('../../solver/listConfigurationView', () => ({
  buildConfigurationRadioGroups: (...args) => mockBuildConfigurationRadioGroups(...args),
}));

const forgeworldDef = { id: 'opt-fw' };
const gwWebsiteDef = { id: 'opt-gw' };
const armyBooksDef = { id: 'opt-ab' };
const campaignRulesEntryDef = { id: 'entry-campaign' };
const campaignOptionDef = { id: 'opt-campaign' };

// Two main entries: the first has "…from GW-website" active, the second none.
const buildGroups = () => ([
  {
    mainEntrySelectionId: 'main-experimental',
    options: [
      { optionId: 'opt-fw', name: 'From ForgeWorld', def: forgeworldDef, selected: false },
      { optionId: 'opt-gw', name: 'From GW-website', def: gwWebsiteDef, selected: true },
    ],
    selectedOption: { optionId: 'opt-gw', name: 'From GW-website', def: gwWebsiteDef, selected: true },
  },
  {
    mainEntrySelectionId: 'main-specials',
    options: [
      { optionId: 'opt-ab', name: 'From ArmyBooks', def: armyBooksDef, selected: false },
    ],
    selectedOption: null,
  },
]);

// A main entry the roster has no selection for yet — its group is "virtual",
// built straight from the catalogue definition (main-issue 35).
const buildGroupsWithVirtualEntry = () => ([
  ...buildGroups(),
  {
    mainEntrySelectionId: 'virtual-entry-campaign',
    entryDef: campaignRulesEntryDef,
    isVirtual: true,
    options: [
      { optionId: 'opt-campaign', name: 'Matched Play', def: campaignOptionDef, selected: false },
    ],
    selectedOption: null,
  },
]);

const mockUpdateSubSelection = vi.fn();
const mockAddUnitWithSubSelection = vi.fn();

const renderCard = () => render(
  <ListConfigurationCard
    categoryName="Special list rules"
    categoryId="cat-special-rules"
    selections={[{ id: 'main-experimental' }, { id: 'main-specials' }]}
    system={{ id: 'sys' }}
    roster={{ catalogueId: 'cat-1' }}
    force={{ catalogueId: 'cat-1' }}
    activeCatalogue={{ id: 'cat-1' }}
    updateSubSelection={mockUpdateSubSelection}
    addUnitWithSubSelection={mockAddUnitWithSubSelection}
  />
);

describe('ListConfigurationCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildConfigurationRadioGroups.mockReturnValue(buildGroups());
  });

  it('uses the dynamic category name as the card title', () => {
    renderCard();
    expect(screen.getByText('Special list rules')).toBeDefined();
  });

  it('shows a badge for each main entry with a non-None selection and none otherwise', () => {
    const { container } = renderCard();
    const badges = container.querySelectorAll('.list-config-badge');
    // Only the first main entry has an active option; the "Keine" one has no badge.
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('From GW-website');
  });

  it('does not render option rows while collapsed', () => {
    renderCard();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('shows no "x von y" counter', () => {
    const { container } = renderCard();
    expect(container.textContent).not.toMatch(/\d+\s*(von|\/)\s*\d+/);
  });

  it('lists every option plus a "Keine" row per main entry when expanded, without main-entry sub-headings', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button'));

    const radios = screen.getAllByRole('radio');
    // 2 options + 1 "Keine" for the first group, 1 option + 1 "Keine" for the second.
    expect(radios).toHaveLength(5);
    expect(screen.getAllByText('Keine')).toHaveLength(2);
    // The main entries' own names must not appear as headings.
    expect(screen.queryByText('main-experimental')).toBeNull();
    expect(screen.queryByText('main-specials')).toBeNull();
  });

  it('selects an option by clearing the previous one and setting the new one', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button'));

    fireEvent.click(screen.getByText('From ForgeWorld'));

    expect(mockUpdateSubSelection).toHaveBeenCalledTimes(2);
    expect(mockUpdateSubSelection).toHaveBeenNthCalledWith(1, 'main-experimental', gwWebsiteDef, 'decrement');
    expect(mockUpdateSubSelection).toHaveBeenNthCalledWith(2, 'main-experimental', forgeworldDef, 'increment');
  });

  it('only increments when the main entry had no previous selection', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button'));

    fireEvent.click(screen.getByText('From ArmyBooks'));

    expect(mockUpdateSubSelection).toHaveBeenCalledTimes(1);
    expect(mockUpdateSubSelection).toHaveBeenCalledWith('main-specials', armyBooksDef, 'increment');
  });

  it('clears the active option when its "Keine" row is clicked', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button'));

    // The first group's "Keine" row is the first radio row.
    const noneRows = screen.getAllByText('Keine');
    fireEvent.click(noneRows[0]);

    expect(mockUpdateSubSelection).toHaveBeenCalledTimes(1);
    expect(mockUpdateSubSelection).toHaveBeenCalledWith('main-experimental', gwWebsiteDef, 'decrement');
  });

  it('does nothing when the already-selected option is clicked again', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button'));

    fireEvent.click(screen.getByText('From GW-website'));

    expect(mockUpdateSubSelection).not.toHaveBeenCalled();
  });

  it('creates the roster selection when picking an option of a main entry with no selection yet (virtual group)', () => {
    mockBuildConfigurationRadioGroups.mockReturnValue(buildGroupsWithVirtualEntry());
    renderCard();
    fireEvent.click(screen.getByRole('button'));

    fireEvent.click(screen.getByText('Matched Play'));

    expect(mockAddUnitWithSubSelection).toHaveBeenCalledTimes(1);
    expect(mockAddUnitWithSubSelection).toHaveBeenCalledWith(campaignRulesEntryDef, 'cat-special-rules', campaignOptionDef);
    expect(mockUpdateSubSelection).not.toHaveBeenCalled();
  });

  it('renders no cost slot and no copy/delete actions', () => {
    const { container } = renderCard();
    fireEvent.click(screen.getByRole('button'));

    expect(container.querySelector('.selection-node-cost')).toBeNull();
    expect(container.textContent).not.toMatch(/Pkt\./);
    expect(screen.queryByTitle('Aktionen')).toBeNull();
    expect(screen.queryByText('Kopieren')).toBeNull();
    expect(screen.queryByText(/Löschen/)).toBeNull();
  });
});
