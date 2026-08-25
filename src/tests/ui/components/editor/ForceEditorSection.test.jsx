import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForceEditorSectionHarness as ForceEditorSection } from '../../../../tests/test-utils/harnesses/ForceEditorSectionHarness';


vi.mock('../../../../contexts/armylist/model', () => ({
  computeRosterCounts: () => ({ selectionCounts: {}, categoryCounts: { 'force-1': { 'cat-core': 2 } } }),
  findForceEntryById: (system, id) => system?.forceEntries?.find(fe => fe.id === id) || null,
  findEntryInSystem: (_system, entryId) => ({ id: entryId }),
  childSelectionsOf: (force) => force.selections || []
}));

// Welche Pflicht keine Kategorie des Kontingents anbietet, sagt seit Issue 0156
// der **Bericht**: ein sichtbarer Slot des Kontingents mit wirksamem Minimum,
// dessen effektive Kategorien keine der Kontingent-Kategorien treffen.
const ARMY_WIDE_CAPABILITIES = new Map([
  ['0/0', {
    anchorKind: 'occupied',
    isIndependentSubUnit: false,
    primaryCategoryId: null,
    defId: 'entry-army',
    targetDefId: null,
    name: 'Blutlinie',
    isHidden: false,
    effectiveMin: 1,
    effectiveMax: 1,
    categoryIds: ['cat-bloodline'],
  }],
]);

vi.mock('../../../../ui/components/editor/CategoryUnitAdder', () => ({
  default: ({ categoryName }) => <button data-testid={`adder-${categoryName}`}>Hinzufügen</button>
}));
// Das Panel selbst entscheidet über seine Sichtbarkeit (Pflicht-Signale des
// Berichts, ADR-0035); die Sektion reicht nur die Kontingent-Slots durch. Der
// Stub macht die durchgereichte Slot-Menge beobachtbar.
vi.mock('../../../../ui/components/editor/AutoFillSuggestions', () => ({
  default: ({ forceId, forcePath }) => (
    <div data-testid="auto-fill" data-force-id={String(forceId)}>{String(forcePath)}</div>
  )
}));
vi.mock('../../../../ui/components/editor/RosterCategorySection', () => ({
  default: ({ categoryLink, force, ruleGroup }) => (
    <div
      data-testid={`category-${categoryLink.targetId}`}
      data-expanded={String(ruleGroup?.isExpanded)}
      data-force-id={force.id}
    >
      <button data-testid={`toggle-${categoryLink.targetId}`} onClick={ruleGroup?.onToggle}>
        Umschalten
      </button>
    </div>
  )
}));
vi.mock('../../../../ui/components/editor/RosterValidationPanel', () => ({
  default: () => <div data-testid="validation-panel" />
}));
vi.mock('../../../../ui/components/editor/UnitCardList', () => ({
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
    forcePath="0"
    system={system}
    roster={{ catalogueId: 'bret-cat', costLimitType: 'pts' }}
    activeCatalogue={{ id: 'bret-cat' }}
    violations={[]}
    capabilities={new Map()}
    pathBySelectionId={new Map()}
    costTypeLabel="Pkt."
    addUnit={vi.fn()}
    removeUnit={vi.fn()}
    subSelectionOperations={{}}
    unitCardContext={{}}
    isRuleGroupExpanded={() => false}
    onToggleRuleGroup={vi.fn()}
    onShowRule={vi.fn()}
    extraResources={[]}
    onPlay={vi.fn()}
    {...props}
  />
);

describe('ForceEditorSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    renderForce({
      capabilities: ARMY_WIDE_CAPABILITIES,
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

  // Seit Issue 0164 grenzt das Auffüll-Panel die Slot-Map selbst auf sein
  // Kontingent ein (`useAutoFillSuggestions`, dort geprüft); die Sektion nennt
  // ihm dafür nur noch, welches Kontingent sie darstellt.
  it('nennt dem Auffüll-Panel das Kontingent, das die Sektion darstellt', () => {
    renderForce();

    const panel = screen.getByTestId('auto-fill');
    expect(panel.getAttribute('data-force-id')).toBe('force-1');
    expect(panel.textContent).toBe('0');
  });

  // Ohne das Kontingent der Sektion landete die Einheit in jedem Kontingent des
  // Rosters: jede Untersektion hebt über `force.id` aus.
  it('gibt jeder Kategorie-Sektion das Kontingent mit, in das sie aushebt', () => {
    renderForce();

    expect(screen.getByTestId('category-cat-heroes').getAttribute('data-force-id')).toBe('force-1');
  });

  it('reicht den Umschalter der Listenregel-Gruppe mit Kontingent und Kategorie durch', () => {
    const onToggleRuleGroup = vi.fn();
    renderForce({ onToggleRuleGroup });

    fireEvent.click(screen.getByTestId('toggle-cat-heroes'));

    expect(onToggleRuleGroup).toHaveBeenCalledWith('force-1', 'cat-heroes');
  });

});
