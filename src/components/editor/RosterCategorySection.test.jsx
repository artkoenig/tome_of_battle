import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterCategorySection from './RosterCategorySection';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />
}));

const mockIsCategoryLinkHidden = vi.fn();
const mockIsEntryPrimaryInCategory = vi.fn();
const mockResolveListRuleGroup = vi.fn();

vi.mock('../../solver/validator', () => ({
  getModifiedConstraintValue: (constraint) => constraint.value,
  getEffectiveModifiers: (source) => source?.modifiers || [],
  isCategoryLinkHidden: (...args) => mockIsCategoryLinkHidden(...args),
  isEntryPrimaryInCategory: (...args) => mockIsEntryPrimaryInCategory(...args),
  resolveListRuleGroup: (...args) => mockResolveListRuleGroup(...args),
  childSelectionsOf: (force) => force.selections || [],
  formatConstraintLimit: (value) => `${value}`
}));

vi.mock('./CategoryUnitAdder', () => ({
  default: ({ categoryId }) => <button data-testid={`adder-${categoryId}`}>Hinzufügen</button>
}));
vi.mock('./ListRuleChecklist', () => ({
  default: () => <div data-testid="list-rule-checklist" />
}));
vi.mock('./UnitSelectionCard', () => ({
  default: ({ selection }) => <div data-testid={`unit-card-${selection.id}`}>{selection.name}</div>
}));

const system = {
  categoryEntries: [{ id: 'cat-core', name: 'Kerneinheiten' }],
  catalogues: [{ id: 'bret-cat', selectionEntries: [{ id: 'entry-1' }] }]
};

const force = {
  id: 'force-1',
  catalogueId: 'bret-cat',
  selections: [{ id: 'sel-1', name: 'Ritter', category: 'cat-core' }]
};

const categoryLink = { targetId: 'cat-core', name: 'Core', constraints: [{ type: 'min', value: 2 }] };

const renderSection = (props = {}) => render(
  <RosterCategorySection
    categoryLink={categoryLink}
    force={force}
    system={system}
    roster={{ costLimitType: 'pts' }}
    activeCatalogue={system.catalogues[0]}
    validationErrors={[]}
    selectionCounts={{}}
    forceCategoryCounts={{ 'cat-core': 1 }}
    costTypeLabel="Pkt."
    addUnit={vi.fn()}
    removeUnit={vi.fn()}
    subSelectionOperations={{}}
    unitCardContext={{}}
    isRuleGroupExpanded={false}
    onToggleRuleGroup={vi.fn()}
    onShowRule={vi.fn()}
    {...props}
  />
);

describe('RosterCategorySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCategoryLinkHidden.mockReturnValue(false);
    mockIsEntryPrimaryInCategory.mockReturnValue(true);
    mockResolveListRuleGroup.mockReturnValue({ isListRuleGroup: false, states: [] });
  });

  it('rendert Kopfzeile, Zähl-Chip, Hinzufüger und die Einheitenkarten der Kategorie', () => {
    const { container } = renderSection();

    expect(screen.getByText('Kerneinheiten')).toBeDefined();
    expect(container.querySelector('span.badge').textContent.replace(/\s+/g, ' ').trim()).toBe('1 / Min: 2');
    expect(screen.getByTestId('adder-cat-core')).toBeDefined();
    expect(screen.getByTestId('unit-card-sel-1')).toBeDefined();
  });

  it('weicht auf den Namen der Verknüpfung aus, wenn das System die Kategorie nicht kennt', () => {
    renderSection({ system: { ...system, categoryEntries: [] } });

    expect(screen.getByText('Core')).toBeDefined();
  });

  it('bleibt verborgen, wenn der Solver die Kategorie ausblendet und nichts ausgewählt ist', () => {
    mockIsCategoryLinkHidden.mockReturnValue(true);
    const { container } = renderSection({ force: { ...force, selections: [] } });

    expect(container.querySelector('.roster-category-group')).toBeNull();
  });

  it('rendert eine ausgeblendete Kategorie dennoch, solange sie Auswahlen enthält', () => {
    mockIsCategoryLinkHidden.mockReturnValue(true);
    const { container } = renderSection();

    expect(container.querySelector('.roster-category-group')).not.toBeNull();
  });

  it('bleibt verborgen, wenn die leere Kategorie für keinen Eintrag Primär-Kategorie ist', () => {
    mockIsEntryPrimaryInCategory.mockReturnValue(false);
    const { container } = renderSection({ force: { ...force, selections: [] } });

    expect(container.querySelector('.roster-category-group')).toBeNull();
  });

  it('rendert eine leere Kategorie, für die es Primäreinträge gibt — mobil führt nur ihr Hinzufüger zur Einheit', () => {
    const { container } = renderSection({ force: { ...force, selections: [] } });

    expect(container.querySelector('.roster-category-group')).not.toBeNull();
    expect(screen.getByTestId('adder-cat-core')).toBeDefined();
  });

  it('prüft die Primär-Kategorie im Katalog des Kontingents, nicht im aktiven Katalog des Editors', () => {
    const foreignCatalogue = { id: 'fremd-cat', selectionEntries: [{ id: 'fremd-entry' }] };
    renderSection({
      system: { ...system, catalogues: [...system.catalogues, foreignCatalogue] },
      activeCatalogue: foreignCatalogue
    });

    expect(mockIsEntryPrimaryInCategory).toHaveBeenCalledWith(
      { id: 'entry-1' },
      'cat-core',
      expect.objectContaining({ force })
    );
  });

  it('färbt den Zähl-Chip, wenn die Kategorie blockierende Meldungen trägt', () => {
    const { container } = renderSection({
      validationErrors: [{ message: 'Zu wenige', categoryId: 'cat-core', severity: 'error' }]
    });

    expect(container.querySelector('span.badge').className).toContain('badge-danger');
  });

  describe('Listenregel-Gruppe', () => {
    beforeEach(() => {
      mockResolveListRuleGroup.mockReturnValue({ isListRuleGroup: true, states: [] });
    });

    it('ersetzt Zähl-Chip und Hinzufüger durch die eingeklappte Ankreuzliste', () => {
      const { container } = renderSection();

      expect(container.querySelector('span.badge')).toBeNull();
      expect(screen.queryByTestId('adder-cat-core')).toBeNull();
      expect(screen.queryByTestId('list-rule-checklist')).toBeNull();
      expect(screen.getByTestId('icon-chevron-right')).toBeDefined();
    });

    it('zeigt die Ankreuzliste, sobald die Gruppe ausgeklappt ist', () => {
      renderSection({ isRuleGroupExpanded: true });

      expect(screen.getByTestId('list-rule-checklist')).toBeDefined();
      expect(screen.getByTestId('icon-chevron-down')).toBeDefined();
    });

    it('meldet den Klick auf die Kopfzeile als Umschalten', () => {
      const onToggleRuleGroup = vi.fn();
      const { container } = renderSection({ onToggleRuleGroup });

      fireEvent.click(container.querySelector('.roster-category-title'));

      expect(onToggleRuleGroup).toHaveBeenCalledTimes(1);
    });

    it('macht eine gewöhnliche Kategorie-Kopfzeile nicht klickbar', () => {
      mockResolveListRuleGroup.mockReturnValue({ isListRuleGroup: false, states: [] });
      const onToggleRuleGroup = vi.fn();
      const { container } = renderSection({ onToggleRuleGroup });

      const title = container.querySelector('.roster-category-title');
      fireEvent.click(title);

      expect(title.getAttribute('role')).toBeNull();
      expect(onToggleRuleGroup).not.toHaveBeenCalled();
    });
  });
});
