import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryUnitAdder from './CategoryUnitAdder';

// Isoliert das Verfügbarkeits-Rendering des Aushebe-Dialogs: der Solver-Seam
// getEntryAddAvailability wird gemockt, sodass der Test nur die Darstellung eines
// gesperrten vs. freien Eintrags beobachtet (ausgegraut, nicht klickbar, Grund sichtbar).

const BLOCKED_ENTRY_ID = 'blocked';
const FREE_ENTRY_ID = 'free';
const BLOCK_REASON = 'Please enable "Allow experimental rules?"';

const mockGetEntryAddAvailability = vi.fn();

vi.mock('../../solver/validator', () => ({
  resolveEntry: (_system, entry) => ({ id: entry.id, name: entry.name }),
  getOptionDisplayCost: () => 0,
  getEffectiveName: (res) => res.name,
  collectPrimaryCategoryEntries: () => [
    { entry: { id: BLOCKED_ENTRY_ID, name: 'Emperor Fire Dragon' } },
    { entry: { id: FREE_ENTRY_ID, name: 'Peasant Bowmen' } },
  ],
  validateRoster: () => [],
  getEntryAddAvailability: (args) => mockGetEntryAddAvailability(args),
}));

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
}));

// Die Kinder der BottomSheet inline rendern, sobald sie offen ist (kein Portal/Animation).
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

const CATEGORY_ID = 'cat-special';

function renderAdder(addUnit) {
  const roster = {
    catalogueId: 'cat',
    forces: [{ id: 'f1', catalogueId: 'cat', forceEntryId: 'fe', selections: [] }],
  };
  render(
    <CategoryUnitAdder
      categoryId={CATEGORY_ID}
      categoryName="Special"
      system={{ id: 'sys' }}
      activeCatalogue={{ id: 'cat' }}
      costTypeLabel="Pkt"
      costLimitType="pts"
      addUnit={addUnit}
      roster={roster}
      selectionCounts={{}}
      force={roster.forces[0]}
    />
  );
  fireEvent.click(screen.getByTitle('Special ausheben'));
}

describe('CategoryUnitAdder — Verfügbarkeits-Darstellung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reasons sind strukturierte Verstöße (ADR 0026); ein Autoren-Hinweis trägt seinen
    // fertigen Text im `message`-Feld (Katalog-Pass-through), das die Oberfläche direkt zeigt.
    mockGetEntryAddAvailability.mockImplementation(({ entry }) =>
      entry.id === BLOCKED_ENTRY_ID
        ? { available: false, reasons: [{ message: BLOCK_REASON }] }
        : { available: true, reasons: [] }
    );
  });

  it('markiert den gesperrten Eintrag als „(Nicht verfügbar)" und zeigt den Grund', () => {
    renderAdder(vi.fn());

    expect(screen.getByText('(Nicht verfügbar)')).toBeTruthy();
    expect(screen.getByText(BLOCK_REASON)).toBeTruthy();
  });

  it('rendert den gesperrten Eintrag ausgegraut und nicht klickbar (kein addUnit)', () => {
    const addUnit = vi.fn();
    renderAdder(addUnit);

    // Ausgegraut/nicht-klickbar wird über die CSS-Klasse `.popover-item.disabled`
    // ausgedrückt (ADR-0004: keine statischen Inline-Styles), nicht über style-Attribute.
    const blockedRow = screen.getByText('Emperor Fire Dragon').closest('.popover-item');
    expect(blockedRow.getAttribute('aria-disabled')).toBe('true');
    expect(blockedRow.className).toContain('disabled');
    expect(blockedRow.getAttribute('style')).toBeNull();

    fireEvent.click(blockedRow);
    expect(addUnit).not.toHaveBeenCalled();
  });

  it('zeigt am gesperrten Eintrag den „Ursachen"-Block, wenn der Grund Ursachen trägt', () => {
    mockGetEntryAddAvailability.mockImplementation(({ entry }) =>
      entry.id === BLOCKED_ENTRY_ID
        ? {
            available: false,
            reasons: [{
              message: BLOCK_REASON,
              causes: [{ entryId: 'bsb', name: 'Battle Standard Bearer' }]
            }]
          }
        : { available: true, reasons: [] }
    );
    renderAdder(vi.fn());

    expect(screen.getByText('Ursachen:')).toBeTruthy();
    expect(screen.getByText('„Battle Standard Bearer"')).toBeTruthy();
  });

  it('zeigt keinen „Ursachen"-Block, wenn der Grund keine Ursachen trägt', () => {
    // beforeEach liefert einen Grund ohne causes-Feld — der Block darf fehlen.
    renderAdder(vi.fn());
    expect(document.querySelector('.validation-causes')).toBeNull();
  });

  it('lässt den freien Eintrag klickbar und hebt ihn aus', () => {
    const addUnit = vi.fn();
    renderAdder(addUnit);

    const freeRow = screen.getByText('Peasant Bowmen').closest('.popover-item');
    expect(freeRow.getAttribute('aria-disabled')).toBe('false');
    expect(freeRow.className).not.toContain('disabled');

    fireEvent.click(freeRow);
    expect(addUnit).toHaveBeenCalledTimes(1);
    expect(addUnit.mock.calls[0][1]).toBe(CATEGORY_ID);
  });
});
