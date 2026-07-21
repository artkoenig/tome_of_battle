import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ForceEditorSection from './ForceEditorSection';

const mockCollectUnreachableArmyWideSelectors = vi.fn();

vi.mock('../../solver/validator', () => ({
  computeRosterCounts: () => ({ selectionCounts: {}, categoryCounts: { 'force-1': { 'cat-core': 2 } } }),
  findForceEntryById: (system, id) => system?.forceEntries?.find(fe => fe.id === id) || null,
  collectUnreachableArmyWideSelectors: (...args) => mockCollectUnreachableArmyWideSelectors(...args),
  childSelectionsOf: (force) => force.selections || []
}));

vi.mock('./CategoryUnitAdder', () => ({
  default: ({ categoryName }) => <button data-testid={`adder-${categoryName}`}>Hinzufügen</button>
}));
vi.mock('./AutoFillSuggestions', () => ({
  default: ({ remainingPoints }) => <div data-testid="auto-fill">{remainingPoints}</div>
}));
vi.mock('./RosterCategorySection', () => ({
  default: ({ categoryLink, isRuleGroupExpanded, addUnit }) => (
    <div data-testid={`category-${categoryLink.targetId}`} data-expanded={String(isRuleGroupExpanded)}>
      <button
        data-testid={`add-${categoryLink.targetId}`}
        onClick={() => addUnit({ id: 'entry-1' }, categoryLink.targetId)}
      >
        Ausheben
      </button>
    </div>
  )
}));
vi.mock('./RosterValidationPanel', () => ({
  default: () => <div data-testid="validation-panel" />
}));
vi.mock('./UnitCardList', () => ({
  default: ({ selections }) => (
    <div data-testid="unit-card-list">{selections.map(s => s.id).join(',')}</div>
  )
}));

const system = {
  forceEntries: [{
    id: 'fe-1',
    categoryLinks: [{ targetId: 'cat-core', name: 'Core' }, { targetId: 'cat-heroes', name: 'Heroes' }]
  }]
};

const force = {
  id: 'force-1',
  forceEntryId: 'fe-1',
  catalogueId: 'bret-cat',
  selections: [{ id: 'sel-1', category: 'cat-core' }]
};

const renderForce = (props = {}) => render(
  <ForceEditorSection
    force={force}
    system={system}
    roster={{ catalogueId: 'bret-cat', costLimitType: 'pts' }}
    activeCatalogue={{ id: 'bret-cat' }}
    validationErrors={[]}
    costTypeLabel="Pkt."
    addUnit={vi.fn()}
    removeUnit={vi.fn()}
    subSelectionOperations={{}}
    unitCardContext={{}}
    isRuleGroupExpanded={() => false}
    onToggleRuleGroup={vi.fn()}
    onShowRule={vi.fn()}
    remainingPoints={580}
    extraResources={[]}
    onPlay={vi.fn()}
    {...props}
  />
);

describe('ForceEditorSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollectUnreachableArmyWideSelectors.mockReturnValue([]);
  });

  it('rendert je Kategorie-Verknüpfung des Kontingents eine Sektion und den Lagerbericht', () => {
    renderForce();

    expect(screen.getByTestId('category-cat-core')).toBeDefined();
    expect(screen.getByTestId('category-cat-heroes')).toBeDefined();
    expect(screen.getByTestId('validation-panel')).toBeDefined();
  });

  it('fragt den Ausklapp-Zustand je Kontingent und Kategorie ab', () => {
    const isRuleGroupExpanded = vi.fn((forceId, categoryId) => categoryId === 'cat-heroes');
    renderForce({ isRuleGroupExpanded });

    expect(isRuleGroupExpanded).toHaveBeenCalledWith('force-1', 'cat-core');
    expect(screen.getByTestId('category-cat-core').getAttribute('data-expanded')).toBe('false');
    expect(screen.getByTestId('category-cat-heroes').getAttribute('data-expanded')).toBe('true');
  });

  it('rendert keine armeeweite Sektion, solange der Solver keine unerreichbaren Selektoren meldet', () => {
    renderForce();

    expect(screen.queryByTestId('adder-Armeeweite Auswahl')).toBeNull();
  });

  it('gibt unerreichbaren armeeweiten Selektoren eine eigene Sektion mit ihren Karten', () => {
    mockCollectUnreachableArmyWideSelectors.mockReturnValue([{ id: 'entry-army' }]);
    renderForce({
      force: {
        ...force,
        selections: [
          { id: 'sel-1', category: 'cat-core' },
          { id: 'sel-army', selectionEntryId: 'entry-army', category: 'cat-core' }
        ]
      }
    });

    expect(screen.getByTestId('adder-Armeeweite Auswahl')).toBeDefined();
    expect(screen.getByText('Armeeweite Auswahl')).toBeDefined();
    expect(screen.getAllByTestId('unit-card-list')[0].textContent).toBe('sel-army');
  });

  it('sammelt Auswahlen ohne passende Kategorie unter „Sonstiges“', () => {
    renderForce({
      force: { ...force, selections: [{ id: 'sel-fremd', category: 'cat-unbekannt' }] }
    });

    expect(screen.getByText('Sonstiges')).toBeDefined();
    expect(screen.getByTestId('unit-card-list').textContent).toBe('sel-fremd');
  });

  it('lässt „Sonstiges“ weg, wenn jede Auswahl eine Kategorie hat', () => {
    renderForce();

    expect(screen.queryByText('Sonstiges')).toBeNull();
  });

  it('schlägt Auffüllungen erst nahe am Punktelimit vor', () => {
    const { rerender } = renderForce({ remainingPoints: 51 });
    expect(screen.queryByTestId('auto-fill')).toBeNull();

    rerender(
      <ForceEditorSection
        force={force}
        system={system}
        roster={{ catalogueId: 'bret-cat', costLimitType: 'pts' }}
        activeCatalogue={{ id: 'bret-cat' }}
        validationErrors={[]}
        costTypeLabel="Pkt."
        addUnit={vi.fn()}
        removeUnit={vi.fn()}
        subSelectionOperations={{}}
        unitCardContext={{}}
        isRuleGroupExpanded={() => false}
        onToggleRuleGroup={vi.fn()}
        onShowRule={vi.fn()}
        remainingPoints={50}
        extraResources={[]}
        onPlay={vi.fn()}
      />
    );
    expect(screen.getByTestId('auto-fill').textContent).toBe('50');
  });

  // Ohne das Kontingent der Sektion landete die Einheit in jedem Kontingent des Rosters.
  it('hebt in das Kontingent aus, das die Sektion darstellt', () => {
    const addUnit = vi.fn();
    renderForce({ addUnit });

    fireEvent.click(screen.getByTestId('add-cat-heroes'));

    expect(addUnit).toHaveBeenCalledWith({ id: 'entry-1' }, 'cat-heroes', 'force-1');
  });

  it('schlägt keine Auffüllung vor, wenn das Punktelimit bereits erreicht ist', () => {
    renderForce({ remainingPoints: 0 });

    expect(screen.queryByTestId('auto-fill')).toBeNull();
  });
});
