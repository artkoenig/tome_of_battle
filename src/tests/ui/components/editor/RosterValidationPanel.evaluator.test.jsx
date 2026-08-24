/**
 * Issue 0121, Task 5 — `RosterValidationPanel` zeigt für eine Liste von
 * Evaluator-Violations die formatierten Texte (über
 * `formatViolation`/`ValidationMessage`) und einen Zähler der blockierenden
 * Verletzungen (severity 'error'); eine Autoren-warning erscheint, zählt
 * aber nicht als blockierend (test-first; die neue Implementierung existiert
 * noch nicht).
 *
 * Vertragsentscheidungen dieses Tests:
 * - Prop heißt `violations` (statt bisher `validationErrors`): der Inhalt
 *   sind Verletzungen aus dem Bericht der Evaluator-Fassade — dieselbe Liste,
 *   die `useRoster` künftig als `violations` liefert. `extraResources` und
 *   `onPlay` bleiben unverändert.
 * - Der Zähler der blockierenden Verletzungen ist über
 *   `data-testid="blocking-violation-count"` erreichbar; sein Textinhalt ist
 *   die Anzahl (severity error), mindestens sichtbar sobald sie > 0 ist.
 * - Der Gesamtstatus bleibt an den bestehenden Klassen ablesbar
 *   (`general-errors-panel--valid` / `--invalid`, wie im bestehenden
 *   `RosterValidationPanel.test.jsx`): blockierend ⇔ mindestens eine
 *   error-Verletzung.
 *
 * i18n läuft ECHT (i18nTestSetup pinnt Deutsch); die erwarteten Sätze stammen
 * aus `src/ui/i18n/locales/de.json` (`validation.evaluator.…`, per Wegwerf-Skript
 * gegen `formatViolation` verifiziert). Die Violation-Fixtures folgen dem
 * veröffentlichten Berichtsvertrag der Fassade.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RosterValidationPanelHarness as RosterValidationPanel } from '../../../../tests/test-utils/harnesses/RosterValidationPanelHarness';

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="icon-play" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Check: () => <span data-testid="icon-check" />,
}));

const FLAGS = { shared: true, includeChildSelections: false, includeChildForces: false };

/** Eine abgeleitete error-Verletzung in der veröffentlichten Berichtsform. */
function derivedViolation({ name = 'Musician', limitId = 'lim-1', actual = 2, bound = 1 } = {}) {
  return {
    origin: 'derivedLimit',
    severity: 'error',
    anchor: { defId: `def-${limitId}`, name, path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
    limitId,
    limit: {
      kind: 'max',
      measure: 'selectionCount',
      costTypeId: null,
      isPercent: false,
      scope: { kind: 'parent', targetId: null, flags: FLAGS },
    },
    actual,
    bound,
    delta: bound - actual,
    derivation: { base: bound, steps: [] },
  };
}

/** Eine Autoren-Meldung in der veröffentlichten Berichtsform. */
function authorMessage({ severity = 'warning', text = 'Special characters need opponent consent' } = {}) {
  return {
    origin: 'authorMessage',
    severity,
    anchor: { defId: 'entry-special', name: 'Special Character', path: '0/3', anchorKind: 'occupied', isValueUnstable: false },
    text,
  };
}

const renderPanel = (props = {}) => render(
  <RosterValidationPanel
    violations={[]}
    extraResources={[]}
    onPlay={vi.fn()}
    {...props}
  />,
);

describe('RosterValidationPanel mit Evaluator-Violations', () => {
  it('leere Liste → regelkonformer Zustand (Rand)', () => {
    const { container } = renderPanel();

    expect(container.querySelector('.general-errors-panel--valid')).not.toBeNull();
  });

  it('zeigt für eine error-Verletzung den formatierten Text und den invaliden Zustand', () => {
    const { container } = renderPanel({ violations: [derivedViolation()] });

    // validation.evaluator.selectionCount.max.local_one mit name=Musician
    expect(screen.getByText('„Musician" darf höchstens einmal gewählt werden.')).toBeDefined();
    expect(container.querySelector('.general-errors-panel--invalid')).not.toBeNull();
  });

  it('zählt die blockierenden Verletzungen (eine error-Verletzung → 1)', () => {
    renderPanel({ violations: [derivedViolation()] });

    expect(screen.getByTestId('blocking-violation-count').textContent).toContain('1');
  });

  it('zählt nur severity error: zwei errors neben einer Autoren-warning → 2', () => {
    renderPanel({
      violations: [
        derivedViolation({ name: 'Musician', limitId: 'lim-1' }),
        authorMessage({ severity: 'warning' }),
        derivedViolation({ name: 'Standard Bearer', limitId: 'lim-2' }),
      ],
    });

    expect(screen.getByTestId('blocking-violation-count').textContent).toContain('2');
  });

  it('eine Autoren-warning erscheint mit ihrem Katalogtext, blockiert die Liste aber nicht', () => {
    const { container } = renderPanel({
      violations: [authorMessage({ severity: 'warning', text: 'Special characters need opponent consent' })],
    });

    expect(screen.getByText('Special characters need opponent consent')).toBeDefined();
    // Nicht blockierend: der Gesamtstatus bleibt regelkonform.
    expect(container.querySelector('.general-errors-panel--valid')).not.toBeNull();
    expect(container.querySelector('.general-errors-panel--invalid')).toBeNull();
  });

  it('warning und error zusammen: beide Texte sichtbar, Status invalide', () => {
    const { container } = renderPanel({
      violations: [
        authorMessage({ severity: 'warning', text: 'Special characters need opponent consent' }),
        derivedViolation(),
      ],
    });

    expect(screen.getByText('Special characters need opponent consent')).toBeDefined();
    expect(screen.getByText('„Musician" darf höchstens einmal gewählt werden.')).toBeDefined();
    expect(container.querySelector('.general-errors-panel--invalid')).not.toBeNull();
  });
});
