import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterValidationPanel from './RosterValidationPanel';

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="icon-play" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Check: () => <span data-testid="icon-check" />
}));

vi.mock('../../solver/validator', () => ({
  hasBlockingViolations: (errors) => (errors || []).some(e => e.severity === 'error'),
  ValidationSeverity: { ERROR: 'error', WARNING: 'warning', INFO: 'info' }
}));

const renderPanel = (props = {}) => render(
  <RosterValidationPanel
    validationErrors={[]}
    extraResources={[]}
    onPlay={vi.fn()}
    {...props}
  />
);

describe('RosterValidationPanel', () => {
  it('meldet eine regelkonforme Liste samt mobilem Spielen-Knopf', () => {
    const onPlay = vi.fn();
    const { container } = renderPanel({ onPlay });

    expect(screen.getByText(/regelkonform und bereit/i)).toBeDefined();
    expect(screen.getByText(/Die Schlachtreihen stehen fest/i)).toBeDefined();
    expect(container.querySelector('.general-errors-panel--valid')).not.toBeNull();

    fireEvent.click(container.querySelector('.mobile-only button'));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('zeigt bei blockierenden Verstößen die Fehlerliste statt des Spielen-Knopfs', () => {
    const { container } = renderPanel({
      validationErrors: [{ message: 'Zu teuer', severity: 'error' }]
    });

    expect(screen.getByText('Zu teuer')).toBeDefined();
    expect(container.querySelector('.general-errors-panel--invalid')).not.toBeNull();
    expect(container.querySelector('.mobile-only button')).toBeNull();
  });

  it('trennt allgemeine von kategorie- und auswahlgebundenen Fehlern', () => {
    const { container } = renderPanel({
      validationErrors: [
        { message: 'Allgemein', severity: 'error' },
        { message: 'Kategorie', severity: 'error', categoryId: 'cat-core' },
        { message: 'Auswahl', severity: 'error', selectionId: 'sel-1' }
      ]
    });

    const secondaryTexts = Array.from(container.querySelectorAll('.validation-error-item--secondary'))
      .map(node => node.textContent);
    expect(secondaryTexts).toEqual(['Kategorie', 'Auswahl']);
    expect(screen.getByText('Allgemein').closest('.validation-error-item').className)
      .not.toContain('validation-error-item--secondary');
  });

  it('zeigt rein informative Hinweise auch bei regelkonformer Liste', () => {
    const { container } = renderPanel({
      validationErrors: [{ message: 'Nur ein Hinweis', severity: 'warning' }]
    });

    expect(container.querySelector('.general-errors-panel--valid')).not.toBeNull();
    expect(container.querySelector('.validation-error-list--advisory').textContent).toContain('Nur ein Hinweis');
  });

  it('listet zusätzliche Ressourcen mit ihrer Summe auf', () => {
    const { container } = renderPanel({
      extraResources: [{ id: 'res-1', name: 'Bannerpunkte', total: 7 }]
    });

    const resourceRow = container.querySelector('.roster-extra-resources').textContent;
    expect(resourceRow).toContain('Bannerpunkte');
    expect(resourceRow).toContain('7');
  });

  it('lässt den Ressourcen-Block weg, wenn es keine zusätzlichen Ressourcen gibt', () => {
    const { container } = renderPanel();

    expect(container.querySelector('.roster-extra-resources')).toBeNull();
  });
});
