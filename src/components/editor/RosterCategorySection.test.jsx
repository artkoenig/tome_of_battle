import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RosterCategorySectionHarness as RosterCategorySection } from '../../test-utils/harnesses/RosterCategorySectionHarness';

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />
}));

// Sichtbarkeit und Primär-Kategorie kommen seit Issue 0156 aus dem Bericht
// (`categoryAnchor.isHidden`, `capability.primaryCategoryId`) — die Komponente
// wertet den Katalog dafür nicht mehr aus, also gibt es dafür nichts zu stubben.
vi.mock('../../roster', () => ({
  findEntryInSystem: (_system, entryId) => ({ id: entryId }),
  childSelectionsOf: (force) => force.selections || [],
}));

// Der Zähl-Chip liest seit Issue 0121, Task 7 den categoryAnchor-Slot des
// Evaluator-Berichts (current/effectiveMin/effectiveMax) statt der
// Solver-Grenzenableitung (getCategoryDisplayLimits/formatConstraintLimit).
//
// Ob die Kategorie eine **Listenregel-Gruppe** ist, sagt seit Issue 0156
// ebenfalls der Bericht: der Slot der Auswahl in dieser Kategorie trägt
// `isListRule`. Ein zweiter Katalog-Durchlauf in der Komponente gibt es nicht
// mehr, also gibt es hier auch nichts mehr zu stubben.
const capabilitiesFor = ({ isListRule }) => new Map([
  ['0/0', {
    anchorKind: 'occupied',
    defId: 'entry-1',
    targetDefId: null,
    name: 'Ritter',
    primaryCategoryId: 'cat-core',
    isHidden: false,
    isListRule,
    isMandatoryListRule: false,
    effectiveMin: null,
    effectiveMax: 1,
  }],
  ['0/1', {
    anchorKind: 'categoryAnchor',
    defId: 'link-core',
    targetDefId: 'cat-core',
    current: 1,
    effectiveMin: 2,
    effectiveMax: null,
  }],
]);

const categoryAnchorCapabilities = capabilitiesFor({ isListRule: false });

/** Derselbe Bericht, nur dass sein Kategorie-Anker die Kategorie ausblendet. */
const hiddenCategoryCapabilities = new Map(
  [...capabilitiesFor({ isListRule: false })].map(([path, capability]) =>
    [path, capability.anchorKind === 'categoryAnchor' ? { ...capability, isHidden: true } : capability])
);

/** Ein Bericht, dessen einziger Einheiten-Slot eine ANDERE Primär-Kategorie trägt. */
const foreignPrimaryCapabilities = new Map(
  [...capabilitiesFor({ isListRule: false })].map(([path, capability]) =>
    [path, capability.anchorKind === 'occupied' ? { ...capability, primaryCategoryId: 'cat-other' } : capability])
);

/** Die Slot-Pfade der Auswahlen des Kontingents (`useEvaluation`). */
const pathBySelectionId = new Map([['sel-1', '0/0']]);

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
    forcePath="0"
    capabilities={categoryAnchorCapabilities}
    pathBySelectionId={pathBySelectionId}
    system={system}
    roster={{ costLimitType: 'pts' }}
    activeCatalogue={system.catalogues[0]}
    violations={[]}
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
  });

  it('rendert Kopfzeile, Zähl-Chip, Hinzufüger und die Einheitenkarten der Kategorie', () => {
    const { container } = renderSection();

    expect(screen.getByText('Kerneinheiten')).toBeDefined();
    expect(container.querySelector('span.badge').textContent.replace(/\s+/g, ' ').trim()).toBe('1 / Min: 2');
    expect(screen.getByTestId('adder-cat-core')).toBeDefined();
    expect(screen.getByTestId('unit-card-sel-1')).toBeDefined();
  });

  it('liest den Zähl-Chip aus dem categoryAnchor-Slot des Berichts (current, effectiveMin, effectiveMax)', () => {
    const capabilities = new Map([
      ['0/1', {
        anchorKind: 'categoryAnchor',
        defId: 'link-core',
        targetDefId: 'cat-core',
        current: 1,
        effectiveMin: 1,
        effectiveMax: 5,
      }],
    ]);

    const { container } = renderSection({ capabilities });

    expect(container.querySelector('span.badge').textContent.replace(/\s+/g, ' ').trim()).toBe('1 / Min: 1, Max: 5');
  });

  it('weicht auf den Namen der Verknüpfung aus, wenn das System die Kategorie nicht kennt', () => {
    renderSection({ system: { ...system, categoryEntries: [] } });

    expect(screen.getByText('Core')).toBeDefined();
  });

  it('bleibt verborgen, wenn der Bericht die Kategorie ausblendet und nichts ausgewählt ist', () => {
    const { container } = renderSection({
      capabilities: hiddenCategoryCapabilities,
      force: { ...force, selections: [] }
    });

    expect(container.querySelector('.roster-category-group')).toBeNull();
  });

  it('rendert eine ausgeblendete Kategorie dennoch, solange sie Auswahlen enthält', () => {
    const { container } = renderSection({ capabilities: hiddenCategoryCapabilities });

    expect(container.querySelector('.roster-category-group')).not.toBeNull();
  });

  it('bleibt verborgen, wenn die leere Kategorie für keinen Slot des Berichts Primär-Kategorie ist', () => {
    const { container } = renderSection({
      capabilities: foreignPrimaryCapabilities,
      force: { ...force, selections: [] }
    });

    expect(container.querySelector('.roster-category-group')).toBeNull();
  });

  it('rendert eine leere Kategorie, für die es Primäreinträge gibt — mobil führt nur ihr Hinzufüger zur Einheit', () => {
    const { container } = renderSection({ force: { ...force, selections: [] } });

    expect(container.querySelector('.roster-category-group')).not.toBeNull();
    expect(screen.getByTestId('adder-cat-core')).toBeDefined();
  });

  it('liest die Primär-Kategorie aus dem Bericht — der aktive Katalog des Editors ändert nichts', () => {
    const foreignCatalogue = { id: 'fremd-cat', selectionEntries: [{ id: 'fremd-entry' }] };
    const { container } = renderSection({
      force: { ...force, selections: [] },
      system: { ...system, catalogues: [...system.catalogues, foreignCatalogue] },
      activeCatalogue: foreignCatalogue
    });

    // Der Slot des Berichts nennt `cat-core` als Primär-Kategorie; die leere
    // Sektion erscheint deshalb, gleich welchen Katalog der Editor gerade zeigt.
    expect(container.querySelector('.roster-category-group')).not.toBeNull();
  });

  it('färbt den Zähl-Chip, wenn die Kategorie blockierende Verletzungen trägt', () => {
    const { container } = renderSection({
      violations: [{
        origin: 'derivedLimit',
        severity: 'error',
        anchor: { defId: 'cat-core', name: 'Kerneinheiten', path: '0/1', anchorKind: 'categoryAnchor', isValueUnstable: false },
      }]
    });

    expect(container.querySelector('span.badge').className).toContain('badge-danger');
  });

  describe('Listenregel-Gruppe', () => {
    // Dieselbe Sektion, nur dass der Bericht ihren einen Slot als Listenregel
    // ausweist.
    const listRuleCapabilities = capabilitiesFor({ isListRule: true });

    it('ersetzt Zähl-Chip und Hinzufüger durch die eingeklappte Ankreuzliste', () => {
      const { container } = renderSection({ capabilities: listRuleCapabilities });

      expect(container.querySelector('span.badge')).toBeNull();
      expect(screen.queryByTestId('adder-cat-core')).toBeNull();
      expect(screen.queryByTestId('list-rule-checklist')).toBeNull();
      expect(screen.getByTestId('icon-chevron-right')).toBeDefined();
    });

    it('zeigt die Ankreuzliste, sobald die Gruppe ausgeklappt ist', () => {
      renderSection({ capabilities: listRuleCapabilities, isRuleGroupExpanded: true });

      expect(screen.getByTestId('list-rule-checklist')).toBeDefined();
      expect(screen.getByTestId('icon-chevron-down')).toBeDefined();
    });

    it('meldet den Klick auf die Kopfzeile als Umschalten', () => {
      const onToggleRuleGroup = vi.fn();
      const { container } = renderSection({ capabilities: listRuleCapabilities, onToggleRuleGroup });

      fireEvent.click(container.querySelector('.roster-category-title'));

      expect(onToggleRuleGroup).toHaveBeenCalledTimes(1);
    });

    it('macht eine gewöhnliche Kategorie-Kopfzeile nicht klickbar', () => {
      const onToggleRuleGroup = vi.fn();
      const { container } = renderSection({ onToggleRuleGroup });

      const title = container.querySelector('.roster-category-title');
      fireEvent.click(title);

      expect(title.getAttribute('role')).toBeNull();
      expect(onToggleRuleGroup).not.toHaveBeenCalled();
    });
  });
});
