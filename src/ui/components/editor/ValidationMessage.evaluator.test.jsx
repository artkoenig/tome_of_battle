/**
 * Issue 0121, Task 5 — `ValidationMessage` nimmt künftig eine
 * Evaluator-Violation und rendert den Text aus `formatViolation`
 * (`src/ui/i18n/violationMessages.js`); die severity bestimmt die Optik
 * (test-first; die neue Implementierung existiert noch nicht).
 *
 * Vertragsentscheidungen dieses Tests:
 * - Prop heißt `violation` (statt bisher `error`): der Inhalt ist keine
 *   Solver-ValidationError-Form mehr, sondern eine Verletzung aus dem
 *   Bericht der Evaluator-Fassade (`src/domain/evaluator/evaluator.js`).
 * - Severity-Optik: das Wurzelelement der Meldung trägt die Klasse
 *   `validation-message--<severity>` (error | warning | info) — geprüft per
 *   `container.querySelector`, wie die bestehenden Editor-Komponententests
 *   ihre Klassen prüfen.
 *
 * i18n läuft ECHT (jsdom + i18nTestSetup pinnt Deutsch je Test); die
 * erwarteten Sätze stammen aus `src/ui/i18n/locales/de.json`
 * (`validation.evaluator.…`) und wurden per Wegwerf-Skript gegen
 * `formatViolation` mit der echten Übersetzung verifiziert. Die
 * Violation-Fixtures folgen dem veröffentlichten Berichtsvertrag (Formen wie
 * in `src/ui/i18n/violationMessages.test.js`).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ValidationMessage from './ValidationMessage';

const FLAGS = { shared: true, includeChildSelections: false, includeChildForces: false };

/** Eine abgeleitete Verletzung in der veröffentlichten Berichtsform. */
function derivedViolation({
  kind = 'max',
  measure = 'selectionCount',
  scopeKind = 'parent',
  actual = 2,
  bound = 1,
  name = 'Musician',
  causes,
} = {}) {
  return {
    origin: 'derivedLimit',
    severity: 'error',
    anchor: { defId: 'def-1', name, path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
    limitId: 'lim-1',
    limit: {
      kind,
      measure,
      costTypeId: null,
      isPercent: false,
      scope: { kind: scopeKind, targetId: null, flags: FLAGS },
    },
    actual,
    bound,
    delta: bound - actual,
    derivation: { base: bound, steps: [] },
    ...(causes === undefined ? {} : { causes }),
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

describe('ValidationMessage: rendert den Text einer Evaluator-Violation aus formatViolation', () => {
  it('eine abgeleitete max-Grenzverletzung erscheint als übersetzter Satz (de.json-Vorlage)', () => {
    render(<ValidationMessage violation={derivedViolation()} />);

    // validation.evaluator.selectionCount.max.local_one mit name=Musician
    expect(screen.getByText('„Musician" darf höchstens einmal gewählt werden.')).toBeDefined();
  });

  it('eine min-Grenzverletzung wählt die pluralisierte Vorlage (bound 3)', () => {
    render(<ValidationMessage violation={derivedViolation({ kind: 'min', actual: 1, bound: 3 })} />);

    // validation.evaluator.selectionCount.min.local_other mit bound=3
    expect(screen.getByText('„Musician" muss mindestens 3 Mal gewählt werden.')).toBeDefined();
  });

  it('eine Autoren-Meldung gibt den Katalogtext unverändert und unübersetzt wieder', () => {
    render(<ValidationMessage violation={authorMessage({ text: 'Special characters need opponent consent' })} />);

    expect(screen.getByText('Special characters need opponent consent')).toBeDefined();
  });
});

describe('ValidationMessage: die severity bestimmt die Optik (Vertragsentscheidung: Klasse validation-message--<severity>)', () => {
  it('severity error → Klasse validation-message--error', () => {
    const { container } = render(<ValidationMessage violation={derivedViolation()} />);

    expect(container.querySelector('.validation-message--error')).not.toBeNull();
    expect(container.querySelector('.validation-message--warning')).toBeNull();
    expect(container.querySelector('.validation-message--info')).toBeNull();
  });

  it('severity warning → Klasse validation-message--warning', () => {
    const { container } = render(<ValidationMessage violation={authorMessage({ severity: 'warning' })} />);

    expect(container.querySelector('.validation-message--warning')).not.toBeNull();
    expect(container.querySelector('.validation-message--error')).toBeNull();
  });

  it('severity info → Klasse validation-message--info', () => {
    const { container } = render(<ValidationMessage violation={authorMessage({ severity: 'info' })} />);

    expect(container.querySelector('.validation-message--info')).not.toBeNull();
    expect(container.querySelector('.validation-message--error')).toBeNull();
  });
});

describe('ValidationMessage: Ursachen-Block (ADR 0027) über formatViolationCauses', () => {
  it('eine Violation mit causes rendert den Ursachen-Block mit dem Zeugen-Namen', () => {
    const violation = derivedViolation({
      causes: [{ witness: { defId: 'e-0', name: 'Battle Standard Bearer' } }],
    });
    const { container } = render(<ValidationMessage violation={violation} />);

    expect(screen.getByText('Ursachen:')).toBeDefined();
    const items = Array.from(container.querySelectorAll('.validation-causes-item'))
      .map(node => node.textContent);
    expect(items).toEqual(['„Battle Standard Bearer"']);
  });

  it('ohne causes-Feld erscheint kein Ursachen-Block — die Meldung selbst aber schon', () => {
    const { container } = render(<ValidationMessage violation={derivedViolation()} />);

    // Positivsignal zuerst: die Meldung ist gerendert (sonst wäre der
    // Negativ-Teil trivial wahr) …
    expect(screen.getByText('„Musician" darf höchstens einmal gewählt werden.')).toBeDefined();
    // … und der Ursachen-Block fehlt.
    expect(container.querySelector('.validation-causes')).toBeNull();
  });
});
