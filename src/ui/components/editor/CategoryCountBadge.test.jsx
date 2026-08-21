import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CategoryCountBadge from './CategoryCountBadge';

// Der Chip liest seit Issue 0121, Task 7 die Werte des categoryAnchor-Slots
// aus dem Evaluator-Bericht: `count` (current) und `min`/`max`
// (effectiveMin/effectiveMax; `null` = keine wirksame Grenze). Der frühere
// Solver-Formatierer (`formatConstraintLimit`, Prozent-Suffix) ist aus diesem
// Pfad entfallen — Prozentgrenzen erscheinen als die aufgelösten Zahlen des
// Berichts (bewusst akzeptiertes, sichtbares Delta der Hauptsession).
const badgeTextOf = (container) => container.querySelector('span.badge').textContent.replace(/\s+/g, ' ').trim();

describe('CategoryCountBadge', () => {
  it('zeigt nur die Anzahl, wenn weder Minimum noch Maximum einschränken', () => {
    const { container } = render(
      <CategoryCountBadge count={3} min={null} max={null} hasErrors={false} />
    );

    expect(badgeTextOf(container)).toBe('3');
  });

  it('nennt das Minimum, sobald eines gefordert ist', () => {
    const { container } = render(
      <CategoryCountBadge count={1} min={2} max={null} hasErrors={false} />
    );

    expect(badgeTextOf(container)).toBe('1 / Min: 2');
  });

  it('nennt Minimum und Maximum gemeinsam, wenn beide gelten', () => {
    const { container } = render(
      <CategoryCountBadge count={4} min={2} max={5} hasErrors={false} />
    );

    expect(badgeTextOf(container)).toBe('4 / Min: 2, Max: 5');
  });

  it('ein Minimum von 0 schränkt nichts ein und bleibt weg', () => {
    const { container } = render(
      <CategoryCountBadge count={2} min={0} max={null} hasErrors={false} />
    );

    expect(badgeTextOf(container)).toBe('2');
  });

  it('färbt den Chip nur bei blockierenden Meldungen der Kategorie', () => {
    const { container: valid } = render(
      <CategoryCountBadge count={2} min={null} max={null} hasErrors={false} />
    );
    const { container: invalid } = render(
      <CategoryCountBadge count={0} min={2} max={null} hasErrors={true} />
    );

    expect(valid.querySelector('span.badge').className).toContain('badge-muted');
    expect(invalid.querySelector('span.badge').className).toContain('badge-danger');
  });
});
