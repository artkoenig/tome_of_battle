import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RosterValidationPanelHarness as RosterValidationPanel } from '../../../../tests/test-utils/harnesses/RosterValidationPanelHarness';

// Ergänzt RosterValidationPanel.evaluator.test.jsx (Vertragstests von Issue
// 0121, Task 5) um die Observablen, die dort nicht abgedeckt sind: mobiler
// Spielen-Knopf, Ursachen-Block und Ressourcen-Summen. Die Fixtures folgen dem
// Berichtsvertrag der Evaluator-Fassade (`src/domain/evaluator/evaluator.js`).

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="icon-play" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Check: () => <span data-testid="icon-check" />
}));

const FLAGS = { shared: true, includeChildSelections: false, includeChildForces: false };

/** Eine abgeleitete error-Verletzung in der veröffentlichten Berichtsform. */
function derivedViolation({ name = 'Long Bow', kind = 'max', actual = 1, bound = 0, causes } = {}) {
  return {
    origin: 'derivedLimit',
    severity: 'error',
    anchor: { defId: 'def-1', name, path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
    limitId: 'lim-1',
    limit: {
      kind,
      measure: 'selectionCount',
      costTypeId: null,
      isPercent: false,
      scope: { kind: 'parent', targetId: null, flags: FLAGS },
    },
    actual,
    bound,
    delta: bound - actual,
    derivation: { base: bound, steps: [] },
    ...(causes === undefined ? {} : { causes }),
  };
}

/** Eine Autoren-Meldung in der veröffentlichten Berichtsform (Text-Pass-through). */
function authorMessage({ severity = 'warning', text = 'Nur ein Hinweis' } = {}) {
  return {
    origin: 'authorMessage',
    severity,
    anchor: { defId: 'entry-1', name: 'Special Character', path: '0/1', anchorKind: 'occupied', isValueUnstable: false },
    text,
  };
}

const renderPanel = (props = {}) => render(
  <RosterValidationPanel
    violations={[]}
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

  it('zeigt bei blockierenden Verletzungen die Fehlerliste statt des Spielen-Knopfs', () => {
    const { container } = renderPanel({
      violations: [authorMessage({ severity: 'error', text: 'Zu teuer' })]
    });

    expect(screen.getByText('Zu teuer')).toBeDefined();
    expect(container.querySelector('.general-errors-panel--invalid')).not.toBeNull();
    expect(container.querySelector('.mobile-only button')).toBeNull();
  });

  it('zeigt rein informative Hinweise auch bei regelkonformer Liste', () => {
    const { container } = renderPanel({
      violations: [authorMessage({ severity: 'warning', text: 'Nur ein Hinweis' })]
    });

    expect(container.querySelector('.general-errors-panel--valid')).not.toBeNull();
    expect(container.querySelector('.validation-error-list--advisory').textContent).toContain('Nur ein Hinweis');
  });

  it('zeigt unter einer Meldung mit Ursachen den „Ursachen"-Block als Liste', () => {
    const { container } = renderPanel({
      violations: [derivedViolation({
        causes: [{ witness: { defId: 'bsb', name: 'Battle Standard Bearer' } }]
      })]
    });

    // validation.evaluator.selectionCount.max.local_zero mit name=Long Bow
    expect(screen.getByText('„Long Bow" kann nicht gewählt werden.')).toBeDefined();
    expect(screen.getByText('Ursachen:')).toBeDefined();
    const causeItems = Array.from(container.querySelectorAll('.validation-causes-item'))
      .map(node => node.textContent);
    expect(causeItems).toEqual(['„Battle Standard Bearer"']);
  });

  it('zeigt keinen „Ursachen"-Block, wenn die Verletzung keine Ursachen trägt', () => {
    const { container } = renderPanel({
      violations: [derivedViolation()]
    });

    expect(container.querySelector('.validation-causes')).toBeNull();
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
