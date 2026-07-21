import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CategoryCountBadge from './CategoryCountBadge';

// Nur die Formatierung der Grenzwerte kommt aus dem Solver; sie wird hier auf
// eine vorhersagbare Darstellung festgenagelt (Prozentgrenzen bekommen ein %).
vi.mock('../../solver/validator', () => ({
  formatConstraintLimit: (value, constraint) =>
    constraint?.percentValue === true ? `${value} %` : `${value}`
}));

const badgeTextOf = (container) => container.querySelector('span.badge').textContent.replace(/\s+/g, ' ').trim();

describe('CategoryCountBadge', () => {
  it('zeigt nur die Anzahl, wenn weder Minimum noch Maximum einschränken', () => {
    const { container } = render(
      <CategoryCountBadge count={3} minValue={0} maxValue={Infinity} hasErrors={false} />
    );

    expect(badgeTextOf(container)).toBe('3');
  });

  it('nennt das Minimum, sobald eines gefordert ist', () => {
    const { container } = render(
      <CategoryCountBadge count={1} minValue={2} maxValue={Infinity} minConstraint={{ type: 'min' }} hasErrors={false} />
    );

    expect(badgeTextOf(container)).toBe('1 / Min: 2');
  });

  it('nennt Minimum und Maximum gemeinsam, wenn beide gelten', () => {
    const { container } = render(
      <CategoryCountBadge
        count={4}
        minValue={2}
        maxValue={5}
        minConstraint={{ type: 'min' }}
        maxConstraint={{ type: 'max' }}
        hasErrors={false}
      />
    );

    expect(badgeTextOf(container)).toBe('4 / Min: 2, Max: 5');
  });

  it('übernimmt die Prozent-Darstellung des Solvers für Prozentgrenzen', () => {
    const { container } = render(
      <CategoryCountBadge
        count={0}
        minValue={25}
        maxValue={Infinity}
        minConstraint={{ type: 'min', percentValue: true }}
        hasErrors={false}
      />
    );

    expect(badgeTextOf(container)).toBe('0 / Min: 25 %');
  });

  it('färbt den Chip nur bei blockierenden Meldungen der Kategorie', () => {
    const { container: valid } = render(
      <CategoryCountBadge count={2} minValue={0} maxValue={Infinity} hasErrors={false} />
    );
    const { container: invalid } = render(
      <CategoryCountBadge count={0} minValue={2} maxValue={Infinity} minConstraint={{ type: 'min' }} hasErrors={true} />
    );

    expect(valid.querySelector('span.badge').className).toContain('badge-muted');
    expect(invalid.querySelector('span.badge').className).toContain('badge-danger');
  });
});
