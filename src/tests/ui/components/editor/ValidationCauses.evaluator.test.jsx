/**
 * Issue 0121, Task 5 — `ValidationCauses` rendert die Ursachenliste einer
 * Evaluator-Violation über `formatViolationCauses`
 * (`src/ui/i18n/violationMessages.js`); ohne causes rendert die Komponente
 * nichts (test-first; die neue Implementierung existiert noch nicht).
 *
 * Vertragsentscheidungen dieses Tests:
 * - Prop heißt `violation` (statt bisher `error`): der Inhalt ist eine
 *   Verletzung aus dem Bericht der Evaluator-Fassade; ihre Ursachen tragen
 *   die Form `causes: [{ witness: { defId, name } }]` (ADR 0027, Form wie in
 *   `src/ui/i18n/violationMessages.test.js` gegen die echte Fassade verifiziert).
 * - Die Render-Struktur der bestehenden Komponente bleibt (Klassen
 *   `validation-causes`, `validation-causes-item`, Titel „Ursachen:") —
 *   dieselben Observablen wie im bestehenden `ValidationCauses.test.jsx`.
 *
 * i18n läuft ECHT (i18nTestSetup pinnt Deutsch je Test).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ValidationCauses from '../../../../ui/components/editor/ValidationCauses';
import { setActiveLanguage } from '../../../../ui/i18n/i18nStore';

const FLAGS = { shared: true, includeChildSelections: false, includeChildForces: false };

/** Eine abgeleitete Verletzung in der veröffentlichten Berichtsform. */
function violationWithCauses(...names) {
  return {
    origin: 'derivedLimit',
    severity: 'error',
    anchor: { defId: 'def-1', name: 'Long Bow', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
    limitId: 'lim-1',
    limit: {
      kind: 'max',
      measure: 'selectionCount',
      costTypeId: null,
      isPercent: false,
      scope: { kind: 'parent', targetId: null, flags: FLAGS },
    },
    actual: 1,
    bound: 0,
    delta: -1,
    derivation: { base: 1, steps: [] },
    ...(names.length === 0
      ? {}
      : { causes: names.map((name, index) => ({ witness: { defId: `e-${index}`, name } })) }),
  };
}

describe('ValidationCauses mit Evaluator-Violations', () => {
  it('rendert nichts, wenn die Violation kein causes-Feld trägt (Rand: Feld entfällt, ADR 0027)', () => {
    const { container } = render(<ValidationCauses violation={violationWithCauses()} />);

    expect(container.querySelector('.validation-causes')).toBeNull();
  });

  it('rendert nichts für ein leeres causes-Feld (Rand)', () => {
    const violation = { ...violationWithCauses(), causes: [] };
    const { container } = render(<ValidationCauses violation={violation} />);

    expect(container.querySelector('.validation-causes')).toBeNull();
  });

  it('zeigt Überschrift und einen Listenpunkt je Ursache, in Reihenfolge (Zeugen-Namen aus witness.name)', () => {
    const { container } = render(
      <ValidationCauses violation={violationWithCauses('Battle Standard Bearer', 'General')} />,
    );

    expect(screen.getByText('Ursachen:')).toBeTruthy();
    const items = Array.from(container.querySelectorAll('.validation-causes-item'))
      .map(node => node.textContent);
    expect(items).toEqual(['„Battle Standard Bearer"', '„General"']);
  });

  it('rendert die Katalognamen unübersetzt in der aktiven Sprache (Englisch)', () => {
    setActiveLanguage('en');
    render(<ValidationCauses violation={violationWithCauses('Battle Standard Bearer')} />);

    expect(screen.getByText('Causes:')).toBeTruthy();
    expect(screen.getByText('"Battle Standard Bearer"')).toBeTruthy();
  });
});
