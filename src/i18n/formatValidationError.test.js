import { describe, it, expect } from 'vitest';
import { formatValidationError, formatValidationCauses } from './formatValidationError';
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

  const categoryMax = count => ({
    type: 'category-max',
    messageKey: ValidationMessageKey.CATEGORY_MAX,
    messageParams: { count, categoryName: 'Lords', forceName: 'Army' }
  });

  it('bildet dieselbe Meldung numerus-korrekt in Singular und Plural (Deutsch)', () => {
    expect(formatValidationError(categoryMax(1), t))
      .toBe('Die Armee darf höchstens eine Auswahl aus „Lords" treffen.');
    expect(formatValidationError(categoryMax(3), t))
      .toBe('Die Armee darf höchstens 3 Auswahlen aus „Lords" treffen.');
  });

  it('bildet dieselbe Meldung numerus-korrekt in Singular und Plural (Englisch)', () => {
    setActiveLanguage('en');
    expect(formatValidationError(categoryMax(1), t))
      .toBe('The army may take at most one selection from "Lords".');
    expect(formatValidationError(categoryMax(3), t))
      .toBe('The army may take at most 3 selections from "Lords".');
  });

  const groupCountMax = count => ({
    type: 'group-count-max',
    messageKey: ValidationMessageKey.GROUP_COUNT_MAX,
    messageParams: { count, groupName: 'Weapons', selectionName: 'Commander' }
  });

  it('wählt bei einer Obergrenze von null die eigene "keine"-Vorlage statt der Plural-Vorlage (Deutsch)', () => {
    expect(formatValidationError(groupCountMax(0), t))
      .toBe('Commander darf keine Auswahl aus „Weapons" treffen.');
  });

  it('wählt bei einer Obergrenze von null die eigene "none"-Vorlage statt der Plural-Vorlage (Englisch)', () => {
    setActiveLanguage('en');
    expect(formatValidationError(groupCountMax(0), t))
      .toBe('Commander can\'t take anything from "Weapons".');
  });

  const percentMax = unitLabel => ({
    type: 'entry-percent-max',
    messageKey: ValidationMessageKey.ENTRY_PERCENT_MAX,
    messageParams: { selectionName: 'Sword', percent: 25, unitLabel }
  });

  it('setzt das Katalog-Kostenlabel als Bezugsgröße ein, wenn eines geliefert ist (Pass-through)', () => {
    expect(formatValidationError(percentMax('Casting Dice'), t))
      .toContain('der Casting Dice ausmachen');
  });

  it('fällt ohne Kostenlabel auf das übersetzte Auswahl-Substantiv zurück', () => {
    expect(formatValidationError(percentMax(undefined), t))
      .toContain('der Auswahlen ausmachen');
  });
});

describe('formatValidationCauses', () => {
  const withCauses = (...names) => ({
    type: 'entry-max',
    messageKey: ValidationMessageKey.ENTRY_MAX,
    messageParams: { count: 0, selectionName: 'Long Bow' },
    causes: names.map((name, index) => ({ entryId: `entry-${index}`, name }))
  });

  it('gibt für einen Verstoß ohne Ursachen-Feld eine leere Liste zurück', () => {
    const withoutCauses = { messageKey: ValidationMessageKey.ENTRY_MAX, messageParams: {} };
    expect(formatValidationCauses(withoutCauses, t)).toEqual([]);
  });

  it('gibt für ein leeres Ursachen-Feld eine leere Liste zurück', () => {
    expect(formatValidationCauses({ causes: [] }, t)).toEqual([]);
  });

  it('gibt für einen fehlenden Verstoß eine leere Liste zurück', () => {
    expect(formatValidationCauses(undefined, t)).toEqual([]);
  });

  it('setzt jeden Katalognamen als Listenpunkt in deutsche Anführungszeichen (Pass-through)', () => {
    expect(formatValidationCauses(withCauses('Battle Standard Bearer'), t))
      .toEqual(['„Battle Standard Bearer"']);
  });

  it('führt die ganze Kette mehrerer Ursachen als eigene Listenpunkte', () => {
    expect(formatValidationCauses(withCauses('Battle Standard Bearer', 'General'), t))
      .toEqual(['„Battle Standard Bearer"', '„General"']);
  });

  it('setzt die Katalognamen in englische Anführungszeichen, ohne sie zu übersetzen (Englisch)', () => {
    setActiveLanguage('en');
    expect(formatValidationCauses(withCauses('Battle Standard Bearer'), t))
      .toEqual(['"Battle Standard Bearer"']);
  });
});
