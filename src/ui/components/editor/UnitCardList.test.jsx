import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnitCardList from './UnitCardList';

// Die Karte selbst ist hier uninteressant; geprüft wird, dass die Liste jede
// Auswahl genau einmal rendert und den Kartenkontext unverändert durchreicht.
vi.mock('./UnitSelectionCard', () => ({
  default: ({ selection, costTypeLabel, onShowRule }) => (
    <div data-testid={`unit-card-${selection.id}`} data-cost-label={costTypeLabel}>
      {selection.name}
      <button onClick={() => onShowRule('Regel')}>Regel zeigen</button>
    </div>
  )
}));

const cardContext = { costTypeLabel: 'Pkt.', onShowRule: vi.fn() };

describe('UnitCardList', () => {
  it('rendert für jede Auswahl genau eine Karte in Eingabereihenfolge', () => {
    const selections = [
      { id: 'sel-1', name: 'Paladin' },
      { id: 'sel-2', name: 'Ritter' }
    ];

    const { container } = render(<UnitCardList selections={selections} cardContext={cardContext} />);

    const cards = screen.getAllByTestId(/unit-card-/);
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Paladin');
    expect(cards[1].textContent).toContain('Ritter');
    expect(container.querySelector('.unit-card-list')).not.toBeNull();
  });

  it('reicht den Kartenkontext unverändert an jede Karte durch', () => {
    const selections = [{ id: 'sel-1', name: 'Paladin' }];

    render(<UnitCardList selections={selections} cardContext={cardContext} />);

    expect(screen.getByTestId('unit-card-sel-1').getAttribute('data-cost-label')).toBe('Pkt.');
  });

  it('rendert gar nichts, wenn keine Auswahlen vorliegen', () => {
    const { container } = render(<UnitCardList selections={[]} cardContext={cardContext} />);

    expect(container.querySelector('.unit-card-list')).toBeNull();
  });

  it('rendert gar nichts, wenn die Auswahlliste fehlt', () => {
    const { container } = render(<UnitCardList cardContext={cardContext} />);

    expect(container.querySelector('.unit-card-list')).toBeNull();
  });
});
