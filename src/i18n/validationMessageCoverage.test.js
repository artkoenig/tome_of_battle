import { describe, it, expect } from 'vitest';
import de from './locales/de.json';
import en from './locales/en.json';
import { SUPPORTED_LANGUAGES } from './constants';
import { ValidationMessageKey, PLURALIZED_VALIDATION_MESSAGE_KEYS } from '../solver/validationMessages';

// Driftschutz: Jeder Meldungsschlüssel, den der Solver erzeugen kann, muss in jeder
// Sprachdatei eine Vorlage haben — sonst zeigte die Oberfläche den nackten Schlüssel.
// Für numerus-abhängige Schlüssel wird das `_one`/`_other`-Paar verlangt (Basis-Schlüssel
// existiert dann bewusst nicht; `translate` wählt die Variante über den `count`-Parameter).

const catalogs = { de, en };
const pluralized = new Set(PLURALIZED_VALIDATION_MESSAGE_KEYS);

describe('Validierungsmeldungen: Locale-Deckung', () => {
  for (const language of SUPPORTED_LANGUAGES) {
    const catalog = catalogs[language];

    for (const key of Object.values(ValidationMessageKey)) {
      if (pluralized.has(key)) {
        it(`"${language}" liefert Singular- und Pluralvariante für ${key}`, () => {
          expect(catalog[`${key}_one`], `${key}_one fehlt in ${language}`).toBeTypeOf('string');
          expect(catalog[`${key}_other`], `${key}_other fehlt in ${language}`).toBeTypeOf('string');
        });
      } else {
        it(`"${language}" liefert eine Vorlage für ${key}`, () => {
          expect(catalog[key], `${key} fehlt in ${language}`).toBeTypeOf('string');
        });
      }
    }
  }
});
