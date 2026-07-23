import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ValidationCauses from './ValidationCauses';
import { setActiveLanguage } from '../../i18n/i18nStore';

// Der „Ursachen"-Block ist die einzige Renderquelle für die auslösenden Auswahlen
// hinter einer Meldung (SSOT, ADR 0027). i18nTestSetup pinnt Deutsch je Test.

const errorWith = (...names) => ({
  type: 'entry-max',
  causes: names.map((name, index) => ({ entryId: `e-${index}`, name }))
});

describe('ValidationCauses', () => {
  it('rendert nichts, wenn der Verstoß kein Ursachen-Feld trägt', () => {
    const { container } = render(<ValidationCauses error={{ type: 'entry-max' }} />);
    expect(container.querySelector('.validation-causes')).toBeNull();
  });

  it('rendert nichts für ein leeres Ursachen-Feld', () => {
    const { container } = render(<ValidationCauses error={{ causes: [] }} />);
    expect(container.querySelector('.validation-causes')).toBeNull();
  });

  it('zeigt Überschrift und einen Listenpunkt je Ursache (ganze Kette)', () => {
    const { container } = render(
      <ValidationCauses error={errorWith('Battle Standard Bearer', 'General')} />
    );

    expect(screen.getByText('Ursachen:')).toBeTruthy();
    const items = Array.from(container.querySelectorAll('.validation-causes-item'))
      .map((node) => node.textContent);
    expect(items).toEqual(['„Battle Standard Bearer"', '„General"']);
  });

  it('rendert die Katalognamen unübersetzt in der aktiven Sprache (Englisch)', () => {
    setActiveLanguage('en');
    render(<ValidationCauses error={errorWith('Battle Standard Bearer')} />);

    expect(screen.getByText('Causes:')).toBeTruthy();
    expect(screen.getByText('"Battle Standard Bearer"')).toBeTruthy();
  });
});
