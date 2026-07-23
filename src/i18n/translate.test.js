import { describe, it, expect } from 'vitest';
import { translateMessage } from './translate';

// Fixture catalogs kept independent of the real locale files, so these tests
// exercise the translation behaviour (placeholders, plurals, number formatting,
// fallback) without depending on which keys the app currently ships.
const catalogs = {
  en: {
    greeting: 'Hello {name}',
    'points.total': '{points} points',
    selection_one: '{count} selection',
    selection_other: '{count} selections',
    limit_zero: 'nothing allowed',
    limit_one: 'at most {count}',
    limit_other: 'at most {count}',
    onlyEnglish: 'English only',
  },
  de: {
    greeting: 'Hallo {name}',
    'points.total': '{points} Punkte',
    selection_one: '{count} Auswahl',
    selection_other: '{count} Auswahlen',
  },
};

describe('translateMessage', () => {
  it('substitutes a named placeholder', () => {
    expect(translateMessage(catalogs, 'de', 'greeting', { name: 'Aldric' })).toBe('Hallo Aldric');
  });

  it('leaves an unmatched placeholder untouched', () => {
    expect(translateMessage(catalogs, 'en', 'greeting', {})).toBe('Hello {name}');
  });

  it('selects the singular plural variant for a count of one', () => {
    expect(translateMessage(catalogs, 'de', 'selection', { count: 1 })).toBe('1 Auswahl');
  });

  it('selects the plural variant for a count greater than one', () => {
    expect(translateMessage(catalogs, 'de', 'selection', { count: 2 })).toBe('2 Auswahlen');
  });

  it('applies English plural rules for the English catalog', () => {
    expect(translateMessage(catalogs, 'en', 'selection', { count: 1 })).toBe('1 selection');
    expect(translateMessage(catalogs, 'en', 'selection', { count: 5 })).toBe('5 selections');
  });

  it('falls back to the "other" variant when no count is supplied', () => {
    expect(translateMessage(catalogs, 'de', 'selection', {})).toBe('{count} Auswahlen');
  });

  it('prefers an explicit "zero" variant for a count of exactly zero', () => {
    expect(translateMessage(catalogs, 'en', 'limit', { count: 0 })).toBe('nothing allowed');
  });

  it('does not use the "zero" variant for non-zero counts', () => {
    expect(translateMessage(catalogs, 'en', 'limit', { count: 1 })).toBe('at most 1');
    expect(translateMessage(catalogs, 'en', 'limit', { count: 2 })).toBe('at most 2');
  });

  it('falls back to the ordinary plural rule when no "zero" variant exists', () => {
    // The German fixture omits `selection_zero`, so a count of zero must not
    // break — it stays on the regular "other" variant (Intl has no "zero").
    expect(translateMessage(catalogs, 'de', 'selection', { count: 0 })).toBe('0 Auswahlen');
  });

  it('formats a numeric parameter for the active language', () => {
    // German groups thousands with a dot, English with a comma.
    expect(translateMessage(catalogs, 'de', 'points.total', { points: 1234 })).toBe('1.234 Punkte');
    expect(translateMessage(catalogs, 'en', 'points.total', { points: 1234 })).toBe('1,234 points');
  });

  it('falls back to English when the key is missing in the active language', () => {
    expect(translateMessage(catalogs, 'de', 'onlyEnglish')).toBe('English only');
  });

  it('returns the key itself when it is missing in every language', () => {
    expect(translateMessage(catalogs, 'de', 'does.not.exist')).toBe('does.not.exist');
  });
});
