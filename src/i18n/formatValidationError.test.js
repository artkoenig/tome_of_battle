import { describe, it, expect } from 'vitest';
import { formatValidationError } from './formatValidationError';
import { t, setActiveLanguage } from './i18nStore';
import { ValidationMessageKey } from '../solver/validationMessages';

// Die Tests fahren gegen die realen Sprachdateien (kein Fixture): sie belegen, dass die
// vom Solver erzeugten Schlüssel + Parameter an der Oberfläche zu korrekten Sätzen werden.
// i18nTestSetup pinnt Deutsch vor jedem Test; Englisch-Fälle schalten selbst um.

describe('formatValidationError', () => {
  it('reicht einen Autoren-Hinweis ohne Schlüssel unverändert durch (Katalog-Pass-through)', () => {
    const authorHint = { message: 'Please enable "Allow special characters?"', severity: 'error' };
    expect(formatValidationError(authorHint, t)).toBe(authorHint.message);
  });

  it('gibt einen leeren String für einen fehlenden Verstoß zurück', () => {
    expect(formatValidationError(undefined, t)).toBe('');
  });

  const categoryMax = (count, current) => ({
    type: 'category-max',
    messageKey: ValidationMessageKey.CATEGORY_MAX,
    messageParams: { count, categoryName: 'Lords', forceName: 'Army', current }
  });

  it('bildet dieselbe Meldung numerus-korrekt in Singular und Plural (Deutsch)', () => {
    expect(formatValidationError(categoryMax(1, 2), t))
      .toBe('Maximal 1 Auswahl für "Lords" in Army erlaubt (aktuell: 2).');
    expect(formatValidationError(categoryMax(3, 5), t))
      .toBe('Maximal 3 Auswahlen für "Lords" in Army erlaubt (aktuell: 5).');
  });

  it('bildet dieselbe Meldung numerus-korrekt in Singular und Plural (Englisch)', () => {
    setActiveLanguage('en');
    expect(formatValidationError(categoryMax(1, 2), t))
      .toBe('At most 1 selection allowed for "Lords" in Army (currently: 2).');
    expect(formatValidationError(categoryMax(3, 5), t))
      .toBe('At most 3 selections allowed for "Lords" in Army (currently: 5).');
  });

  const percentMax = unitLabel => ({
    type: 'entry-percent-max',
    messageKey: ValidationMessageKey.ENTRY_PERCENT_MAX,
    messageParams: { selectionName: 'Sword', percent: 25, threshold: 10, actual: 12, unitLabel }
  });

  it('setzt das Katalog-Kostenlabel als Bezugsgröße ein, wenn eines geliefert ist (Pass-through)', () => {
    expect(formatValidationError(percentMax('Casting Dice'), t))
      .toContain('der Casting Dice ausmachen');
  });

  it('fällt ohne Kostenlabel auf das übersetzte Auswahl-Substantiv zurück', () => {
    expect(formatValidationError(percentMax(undefined), t))
      .toContain('der Auswahlen ausmachen');
  });

  it('kappt den technischen Zählstand-Zusatz für den Aushebe-Dialog', () => {
    const rendered = formatValidationError(categoryMax(1, 2), t, { omitCurrentCount: true });
    expect(rendered).toBe('Maximal 1 Auswahl für "Lords" in Army erlaubt.');
    expect(rendered).not.toContain('aktuell');
  });
});
