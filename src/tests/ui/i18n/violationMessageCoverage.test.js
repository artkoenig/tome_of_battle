/**
 * Locale-Deckung der Evaluator-Meldungsprojektion (Issue 0121 Task 4,
 * Muster `validationMessageCoverage.test.js` / `localeParity.test.js` — hier
 * fuer die NEUEN `validation.evaluator.*`-Schluessel).
 *
 * Driftschutz in zwei Teilen:
 *
 * 1. **Totalitaet:** `formatViolation` waehlt fuer JEDE Kombination des
 *    veroeffentlichten Einordnungs-Vokabulars (ConstraintKind × LimitMeasure ×
 *    ScopeKind × isPercent, aus `src/domain/evaluator/model.js` — Testdateien sind von
 *    der Fassaden-Regel ausgenommen, s. `.oxlintrc.json`) mindestens einen
 *    Meldungsschluessel und wirft nie. Der Wertevorrat kommt aus den echten
 *    Enums, damit ein kuenftig wachsendes Vokabular automatisch mitgeprueft wird.
 *
 * 2. **Deckung:** Jeder dabei tatsaechlich gewaehlte Schluessel — plus der
 *    Rueckfall-Schluessel fuer unbekannte Kombinationen und der
 *    causeItem-Schluessel der Ursachen-Projektion — existiert in `en.json` UND
 *    `de.json`: entweder als einfache Vorlage oder als `_one`/`_other`-Paar
 *    (dieselbe Konvention wie bei den Solver-Schluesseln). Die Locale-Eintraege
 *    selbst sind Sache der Implementierung; dieser Test fordert sie nur ein.
 *
 * Die Violation-Fixtures folgen der per Wegwerf-Skript gegen die echte Fassade
 * verifizierten Berichtsform (siehe `violationMessages.test.js`).
 */

import { describe, it, expect } from 'vitest';
import de from '../../../ui/i18n/locales/de.json';
import en from '../../../ui/i18n/locales/en.json';
import { SUPPORTED_LANGUAGES } from '../../../ui/i18n/constants';
import { ConstraintKind, LimitMeasure, MessageOrigin, ScopeKind } from '../../../domain/evaluator/model.js';
import { formatViolation, formatViolationCauses } from '../../../ui/i18n/violationMessages';

const catalogs = { de, en };

/** Messgroessen, deren Grenze eine Kostenart traegt (Berichtsform: `limit.costTypeId`). */
const COST_MEASURES = new Set([LimitMeasure.COST_SUM, LimitMeasure.BUDGET_LIMIT, LimitMeasure.ROSTER_BUDGET]);

/** Eine abgeleitete Verletzung in der veroeffentlichten Berichtsform. */
function derivedViolation({ kind, measure, scopeKind, isPercent }) {
  return {
    origin: 'derivedLimit',
    severity: 'error',
    anchor: { defId: 'def-1', name: 'Anchor', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
    limitId: 'lim-1',
    limit: {
      kind,
      measure,
      costTypeId: COST_MEASURES.has(measure) ? 'cost-pts' : null,
      isPercent,
      scope: {
        kind: scopeKind,
        targetId: scopeKind === ScopeKind.ENTRY_ID || scopeKind === ScopeKind.CATEGORY_ID ? 'target-1' : null,
        flags: { shared: true, includeChildSelections: false, includeChildForces: false },
      },
    },
    actual: 3,
    bound: 2,
    delta: -1,
    derivation: { base: isPercent ? 25 : 2, steps: [] },
  };
}

/** Alle Kombinationen des veroeffentlichten Einordnungs-Vokabulars. */
function allCombinations() {
  const combinations = [];
  for (const kind of Object.values(ConstraintKind)) {
    for (const measure of Object.values(LimitMeasure)) {
      for (const scopeKind of Object.values(ScopeKind)) {
        for (const isPercent of [false, true]) {
          combinations.push({ kind, measure, scopeKind, isPercent });
        }
      }
    }
  }
  return combinations;
}

/** Ruft die Projektion mit einem sammelnden Spy auf; liefert die gewaehlten Schluessel. */
function keysChosenFor(violation, invoke = formatViolation) {
  const keys = [];
  invoke(violation, (key) => {
    keys.push(key);
    return '';
  });
  return keys;
}

// ── Sammellauf: einmal ueber das ganze Vokabular ─────────────────────────────
const combinations = allCombinations();
const chosenKeys = new Set();
const combosWithoutKey = [];
const combosThatThrew = [];

for (const combination of combinations) {
  try {
    const keys = keysChosenFor(derivedViolation(combination));
    if (keys.length === 0) combosWithoutKey.push(combination);
    for (const key of keys) chosenKeys.add(key);
  } catch (error) {
    combosThatThrew.push({ combination, error: String(error) });
  }
}

// Der Rueckfall fuer unbekannte kuenftige Kombinationen gehoert mit zur Deckung.
// (try/catch nur fuer die Sammlung — ob der Aufruf wirft, prueft der
// Totalitaets-Block unten als eigener Testfall.)
const causeViolation = {
  ...derivedViolation({ kind: ConstraintKind.MAX, measure: LimitMeasure.SELECTION_COUNT, scopeKind: ScopeKind.PARENT, isPercent: false }),
  causes: [{ witness: { defId: 'entry-musician', name: 'Musician' }, modifierKind: 'set', value: 0 }],
};
/** Eine versteckte, aber gewaehlte Auswahl in der veroeffentlichten Berichtsform. */
const hiddenSelectionViolation = {
  origin: MessageOrigin.HIDDEN_SELECTION,
  severity: 'error',
  anchor: { defId: 'entry-scouts', name: 'Scouts', path: '0/0/0', anchorKind: 'occupied', isValueUnstable: false },
};
try {
  for (const key of keysChosenFor(derivedViolation({ kind: 'kuenftige-art', measure: 'kuenftige-messgroesse', scopeKind: 'roster', isPercent: false }))) {
    chosenKeys.add(key);
  }
  // Ebenso der Schluessel der Ursachen-Projektion (ADR-0027).
  for (const key of keysChosenFor(causeViolation, formatViolationCauses)) {
    chosenKeys.add(key);
  }
  // Und der Schluessel der versteckten Auswahl (Issue 0119) — eine Herkunft
  // ohne Grenze, die deshalb im Kreuzprodukt oben nicht vorkommt.
  for (const key of keysChosenFor(hiddenSelectionViolation)) {
    chosenKeys.add(key);
  }
} catch {
  // Absichtlich still: die dedizierten Testfaelle unten rufen dieselben Pfade
  // erneut auf und melden den Fehler dann als regulaeren Testfehlschlag.
}

/** True, wenn der Schluessel im Katalog gedeckt ist: einfache Vorlage oder Plural-Paar. */
function isCovered(catalog, key) {
  return typeof catalog[key] === 'string'
    || (typeof catalog[`${key}_one`] === 'string' && typeof catalog[`${key}_other`] === 'string');
}

describe('Evaluator-Meldungsprojektion: Totalitaet ueber das Einordnungs-Vokabular', () => {
  it('wirft fuer keine Kombination aus ConstraintKind × LimitMeasure × ScopeKind × isPercent', () => {
    expect(combosThatThrew, JSON.stringify(combosThatThrew, null, 2)).toEqual([]);
  });

  it('waehlt fuer jede Kombination mindestens einen Meldungsschluessel', () => {
    expect(combosWithoutKey, JSON.stringify(combosWithoutKey, null, 2)).toEqual([]);
  });

  it('waehlt fuer eine unbekannte kuenftige Kombination einen Rueckfall-Schluessel statt zu schweigen', () => {
    expect(keysChosenFor(derivedViolation({ kind: 'kuenftige-art', measure: 'kuenftige-messgroesse', scopeKind: 'roster', isPercent: false })).length)
      .toBeGreaterThan(0);
  });

  it('waehlt fuer die Ursachen-Projektion einen Schluessel je Ursache', () => {
    expect(keysChosenFor(causeViolation, formatViolationCauses).length).toBeGreaterThan(0);
  });
});

describe('Evaluator-Meldungsschluessel: Locale-Deckung (en UND de)', () => {
  // Ohne gewaehlte Schluessel liefe die Deckung leer und "gruen" — das faengt
  // der Totalitaets-Block oben; hier zusaetzlich als harte Vorbedingung.
  it('hat ueberhaupt Schluessel eingesammelt', () => {
    expect(chosenKeys.size).toBeGreaterThan(0);
  });

  for (const language of SUPPORTED_LANGUAGES) {
    const catalog = catalogs[language];

    for (const key of [...chosenKeys].sort()) {
      it(`"${language}" liefert eine Vorlage (oder ein Plural-Paar) fuer ${key}`, () => {
        expect(isCovered(catalog, key), `${key} fehlt in ${language}`).toBe(true);
      });
    }
  }
});
