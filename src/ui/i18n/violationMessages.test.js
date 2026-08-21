/**
 * Meldungsprojektion der Evaluator-Verletzungen (`violationMessages.js`,
 * Issue 0121 Task 4): `formatViolation(violation, translate)` und
 * `formatViolationCauses(violation, translate)` uebersetzen die sprachfreie
 * Einordnung des Evaluator-Berichts (ADR-0034) in i18n-Texte (ADR-0026/0027).
 *
 * Die Violation-Fixtures folgen dem VEROEFFENTLICHTEN Berichtsvertrag der
 * Fassade (`src/domain/evaluator/evaluator.js`, Einordnung in
 * `violationClassification`-Form); jede Form wurde per Wegwerf-Skript gegen die
 * echte Fassade an synthetischen Katalogen verifiziert (derivedLimit mit
 * kind/measure/scope/isPercent, mandatoryPhantom, rosterBudget mit
 * `derivation: null`, authorMessage, causes mit `witness: { defId, name }`).
 *
 * ── Vertragsentscheidung: Schluessel-Schema (Task-4-Kontrakt) ────────────────
 *
 *   validation.evaluator.<measure>.<kind>.<scopeGroup>[.percent]
 *
 * - `<measure>`  = `limit.measure` woertlich (selectionCount | forceCount |
 *                  costSum | budgetLimit | rosterBudget, LimitMeasure).
 * - `<kind>`     = `limit.kind` woertlich (min | max, ConstraintKind).
 * - `<scopeGroup>` = 'roster' fuer `limit.scope.kind === 'roster'`,
 *                  'force' fuer `'force'`, sonst 'local' — parent, self, unit,
 *                  ancestor, primary-catalogue, entryId, categoryId UND jede
 *                  kuenftige Scope-Art fallen in 'local': den lokalen Kontext
 *                  traegt der Anker-Name, nicht der Schluessel.
 * - Suffix '.percent' genau dann, wenn `limit.isPercent === true`.
 *
 * Parameter (per translate-Spy geprueft, nie Wortlaute):
 * - immer: `name` (= `anchor.name`), `actual`, `bound`.
 * - bei kostenbezogenen Messgroessen (costSum, budgetLimit, rosterBudget)
 *   zusaetzlich `costTypeId` (= `limit.costTypeId`) — mehr traegt der Bericht
 *   nicht; ein Klartext-Label ist Sache des Aufrufers bzw. der Vorlage.
 * - bei Prozentgrenzen zusaetzlich `percent`: der effektive Prozentsatz aus der
 *   Herleitungskette (`derivation`: letztes `steps[].result`, sonst `base`) —
 *   `bound` bleibt der abgeleitete Absolutwert (so liefert es die Fassade).
 *
 * Weitere Vertragsentscheidungen:
 * - Rueckfall (unbekannte/kuenftige `kind`- oder `measure`-Werte): der
 *   generische Schluessel `validation.evaluator.generic` mit
 *   { name, actual, bound } — nie ein Throw.
 * - Autoren-Meldungen (`origin: 'authorMessage'`): der Katalogtext (`text`)
 *   wird unveraendert zurueckgegeben, translate wird nicht aufgerufen.
 * - Ursachen (ADR-0027): je Eintrag von `violation.causes` ein
 *   translate('validation.evaluator.causeItem', { name: cause.witness.name });
 *   ohne bzw. mit leerem `causes` — und fuer Autoren-Meldungen — ein leeres
 *   Ergebnis.
 * - Fehlender Verstoss (null/undefined): formatViolation → '' ohne
 *   translate-Aufruf (Konvention wie `formatValidationError`).
 *
 * Extra-Parameter ueber die gepinnten hinaus (z. B. `count` fuer Numerus) bleiben
 * dem Implementierer frei — geprueft wird per objectContaining.
 */

import { describe, it, expect, vi } from 'vitest';
import { formatViolation, formatViolationCauses } from './violationMessages';

const KEY_PREFIX = 'validation.evaluator';
const GENERIC_KEY = `${KEY_PREFIX}.generic`;
const CAUSE_ITEM_KEY = `${KEY_PREFIX}.causeItem`;

/** Zaehl-Flags in der Berichtsform (XSD-Vorgaben aufgefuellt). */
const FLAGS = { shared: true, includeChildSelections: false, includeChildForces: false };

/**
 * Eine abgeleitete Verletzung in der veroeffentlichten Berichtsform
 * (per Wegwerf-Skript gegen die echte Fassade verifiziert).
 */
function derivedViolation({
  kind = 'max',
  measure = 'selectionCount',
  scopeKind = 'parent',
  isPercent = false,
  actual = 2,
  bound = 1,
  costTypeId = null,
  name = 'Musician',
  anchorKind = 'occupied',
  derivation = { base: 1, steps: [] },
  causes,
} = {}) {
  return {
    origin: 'derivedLimit',
    severity: 'error',
    anchor: { defId: 'def-1', name, path: '0/0', anchorKind, isValueUnstable: false },
    limitId: 'lim-1',
    limit: {
      kind,
      measure,
      costTypeId,
      isPercent,
      scope: { kind: scopeKind, targetId: null, flags: FLAGS },
    },
    actual,
    bound,
    delta: bound - actual,
    derivation,
    ...(causes === undefined ? {} : { causes }),
  };
}

/** Eine Autoren-Meldung in der veroeffentlichten Berichtsform. */
function authorMessage({ text = 'Please enable special characters', severity = 'error' } = {}) {
  return {
    origin: 'authorMessage',
    severity,
    anchor: { defId: 'entry-special', name: 'Special Character', path: '0/3', anchorKind: 'occupied', isValueUnstable: false },
    text,
  };
}

/** Eine Meldung ueber eine versteckte, aber gewaehlte Auswahl (Issue 0119). */
function hiddenSelection({ name = 'Scouts' } = {}) {
  return {
    origin: 'hiddenSelection',
    severity: 'error',
    anchor: { defId: 'entry-scouts', name, path: '0/0/0', anchorKind: 'occupied', isValueUnstable: false },
  };
}

/** Ein aufzeichnender translate-Spy mit festem Rueckgabetext. */
function spy(result = 'ÜBERSETZT') {
  return vi.fn(() => result);
}

describe('formatViolation: Schluesselwahl fuer abgeleitete Grenzen (kind × measure × scopeGroup)', () => {
  it('waehlt fuer selectionCount × max im parent-Rahmen den local-Schluessel mit Name/Ist/Grenze', () => {
    const translate = spy();
    formatViolation(derivedViolation({ kind: 'max', measure: 'selectionCount', scopeKind: 'parent', actual: 2, bound: 1, name: 'Musician' }), translate);

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.selectionCount.max.local`,
      expect.objectContaining({ name: 'Musician', actual: 2, bound: 1 }),
    );
  });

  it('waehlt fuer selectionCount × min im force-Rahmen (Pflicht-Phantom) den force-Schluessel', () => {
    const translate = spy();
    formatViolation(
      derivedViolation({ kind: 'min', measure: 'selectionCount', scopeKind: 'force', actual: 0, bound: 1, name: 'General', anchorKind: 'mandatoryPhantom' }),
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.selectionCount.min.force`,
      expect.objectContaining({ name: 'General', actual: 0, bound: 1 }),
    );
  });

  it('waehlt fuer selectionCount × max im roster-Rahmen den roster-Schluessel', () => {
    const translate = spy();
    formatViolation(derivedViolation({ kind: 'max', measure: 'selectionCount', scopeKind: 'roster', actual: 4, bound: 3, name: 'Chariot' }), translate);

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.selectionCount.max.roster`,
      expect.objectContaining({ name: 'Chariot', actual: 4, bound: 3 }),
    );
  });

  it('gruppiert jeden nicht-roster/force-Rahmen nach local — der Anker-Name traegt den Kontext', () => {
    // Alle uebrigen ScopeKind-Werte des Berichtsvertrags (violationClassification):
    const localScopeKinds = ['parent', 'self', 'unit', 'ancestor', 'primary-catalogue', 'entryId', 'categoryId'];

    for (const scopeKind of localScopeKinds) {
      const translate = spy();
      formatViolation(derivedViolation({ scopeKind }), translate);
      expect(translate, `scope.kind "${scopeKind}" muss nach .local gruppieren`).toHaveBeenCalledWith(
        `${KEY_PREFIX}.selectionCount.max.local`,
        expect.objectContaining({ name: 'Musician' }),
      );
    }
  });

  it('waehlt fuer forceCount × max den forceCount-Schluessel (Kontingent-Grenze)', () => {
    const translate = spy();
    formatViolation(
      derivedViolation({ kind: 'max', measure: 'forceCount', scopeKind: 'roster', actual: 2, bound: 1, name: 'Special Army' }),
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.forceCount.max.roster`,
      expect.objectContaining({ name: 'Special Army', actual: 2, bound: 1 }),
    );
  });

  it('waehlt fuer costSum × max den costSum-Schluessel und reicht die Kostenart als Parameter durch', () => {
    const translate = spy();
    formatViolation(
      derivedViolation({ kind: 'max', measure: 'costSum', scopeKind: 'parent', actual: 80, bound: 50, costTypeId: 'cost-pts', name: 'Magic Items' }),
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.costSum.max.local`,
      expect.objectContaining({ name: 'Magic Items', actual: 80, bound: 50, costTypeId: 'cost-pts' }),
    );
  });

  it('waehlt fuer costSum × min den min-Schluessel — min und max sind getrennte Schluessel', () => {
    const translate = spy();
    formatViolation(
      derivedViolation({ kind: 'min', measure: 'costSum', scopeKind: 'roster', actual: 100, bound: 500, costTypeId: 'cost-pts', name: 'Core' }),
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.costSum.min.roster`,
      expect.objectContaining({ name: 'Core', actual: 100, bound: 500, costTypeId: 'cost-pts' }),
    );
  });

  it('waehlt fuer budgetLimit × min (Mindest-Punktelimit eines Sonderheers) den budgetLimit-Schluessel', () => {
    const translate = spy();
    formatViolation(
      derivedViolation({ kind: 'min', measure: 'budgetLimit', scopeKind: 'roster', actual: 1000, bound: 1500, costTypeId: 'cost-pts', name: 'Special Army' }),
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.budgetLimit.min.roster`,
      expect.objectContaining({ name: 'Special Army', actual: 1000, bound: 1500, costTypeId: 'cost-pts' }),
    );
  });

  it('waehlt fuer die engine-eigene Budget-Regel (rosterBudget, derivation null) den rosterBudget-Schluessel', () => {
    const translate = spy();
    formatViolation(
      derivedViolation({
        kind: 'max',
        measure: 'rosterBudget',
        scopeKind: 'roster',
        actual: 1100,
        bound: 1000,
        costTypeId: 'cost-pts',
        name: 'Roster',
        anchorKind: 'roster',
        derivation: null,
      }),
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.rosterBudget.max.roster`,
      expect.objectContaining({ name: 'Roster', actual: 1100, bound: 1000, costTypeId: 'cost-pts' }),
    );
  });

  it('gibt das Ergebnis von translate unveraendert zurueck', () => {
    expect(formatViolation(derivedViolation(), spy('Der fertige Satz.'))).toBe('Der fertige Satz.');
  });

  it('liefert fuer einen fehlenden Verstoss einen leeren String, ohne translate aufzurufen', () => {
    const translate = spy();
    expect(formatViolation(undefined, translate)).toBe('');
    expect(formatViolation(null, translate)).toBe('');
    expect(translate).not.toHaveBeenCalled();
  });
});

describe('formatViolation: Prozentgrenzen erscheinen als Prozent', () => {
  it('waehlt die percent-Variante und reicht den Prozentsatz aus der Herleitungskette (base) durch', () => {
    // Fassaden-verifizierte Form: bound ist der abgeleitete Absolutwert (275),
    // die Herleitungskette beschreibt den Prozentsatz (base 25, keine Schritte).
    const translate = spy();
    formatViolation(
      derivedViolation({
        kind: 'max',
        measure: 'costSum',
        scopeKind: 'roster',
        isPercent: true,
        actual: 900,
        bound: 275,
        costTypeId: 'cost-pts',
        name: 'Elite',
        derivation: { base: 25, steps: [] },
      }),
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.costSum.max.roster.percent`,
      expect.objectContaining({ name: 'Elite', actual: 900, bound: 275, percent: 25, costTypeId: 'cost-pts' }),
    );
  });

  it('liest den Prozentsatz einer modifizierten Prozentgrenze aus dem letzten Kettenschritt', () => {
    const translate = spy();
    formatViolation(
      derivedViolation({
        kind: 'min',
        measure: 'selectionCount',
        scopeKind: 'roster',
        isPercent: true,
        actual: 1,
        bound: 4,
        name: 'Core',
        derivation: {
          base: 10,
          steps: [{ kind: 'set', rawValue: '20', times: 1, isConditional: false, witness: null, result: 20 }],
        },
      }),
      translate,
    );

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.selectionCount.min.roster.percent`,
      expect.objectContaining({ name: 'Core', actual: 1, bound: 4, percent: 20 }),
    );
  });
});

describe('formatViolation: Autoren-Meldungen (Katalogtext, Pass-through)', () => {
  it('gibt den Katalogtext unveraendert zurueck und ruft translate nicht auf', () => {
    const translate = spy();
    const message = authorMessage({ text: 'Please enable "Allow special characters?"' });

    expect(formatViolation(message, translate)).toBe('Please enable "Allow special characters?"');
    expect(translate).not.toHaveBeenCalled();
  });

  it('behandelt warning- und info-Schweregrade genauso — der Schweregrad aendert den Text nicht', () => {
    for (const severity of ['warning', 'info']) {
      const translate = spy();
      expect(formatViolation(authorMessage({ text: `Hinweis (${severity})`, severity }), translate)).toBe(`Hinweis (${severity})`);
      expect(translate).not.toHaveBeenCalled();
    }
  });

  it('gibt einen leeren Katalogtext als leeren String zurueck', () => {
    expect(formatViolation(authorMessage({ text: '' }), spy())).toBe('');
  });
});

describe('formatViolation: versteckte Auswahlen (Issue 0119)', () => {
  it('waehlt den eigenen Schluessel mit dem Anker-Namen als einzigem Parameter', () => {
    const translate = spy();

    formatViolation(hiddenSelection({ name: 'Scouts' }), translate);

    expect(translate).toHaveBeenCalledWith(`${KEY_PREFIX}.hiddenSelection`, { name: 'Scouts' });
  });

  it('faellt nicht auf den generischen Grenzen-Schluessel zurueck, obwohl die Meldung keine Grenze traegt', () => {
    const translate = spy();

    formatViolation(hiddenSelection(), translate);

    expect(translate).not.toHaveBeenCalledWith(`${KEY_PREFIX}.generic`, expect.anything());
  });
});

describe('formatViolation: Rueckfall fuer unbekannte Einordnungs-Kombinationen (kein Throw)', () => {
  it('faellt bei einer unbekannten Messgroesse auf den generischen Schluessel mit Name/Ist/Grenze zurueck', () => {
    const translate = spy();
    expect(() =>
      formatViolation(derivedViolation({ measure: 'psychicLoad', actual: 7, bound: 2, name: 'Seer' }), translate),
    ).not.toThrow();

    expect(translate).toHaveBeenCalledWith(
      GENERIC_KEY,
      expect.objectContaining({ name: 'Seer', actual: 7, bound: 2 }),
    );
  });

  it('faellt bei einer unbekannten Grenzen-Art auf den generischen Schluessel zurueck', () => {
    const translate = spy();
    expect(() =>
      formatViolation(derivedViolation({ kind: 'exactly', actual: 3, bound: 2, name: 'Banner' }), translate),
    ).not.toThrow();

    expect(translate).toHaveBeenCalledWith(
      GENERIC_KEY,
      expect.objectContaining({ name: 'Banner', actual: 3, bound: 2 }),
    );
  });

  it('gruppiert eine unbekannte kuenftige Scope-Art nach local statt zu werfen', () => {
    const translate = spy();
    expect(() => formatViolation(derivedViolation({ scopeKind: 'detachment-2049' }), translate)).not.toThrow();

    expect(translate).toHaveBeenCalledWith(
      `${KEY_PREFIX}.selectionCount.max.local`,
      expect.objectContaining({ name: 'Musician' }),
    );
  });
});

describe('formatViolationCauses: Ursachen-Projektion (ADR-0027)', () => {
  const MUSICIAN = { defId: 'entry-musician', name: 'Musician' };
  const HORN = { defId: 'entry-war-horn', name: 'War Horn' };

  it('rendert je Ursache einen Listenpunkt ueber den causeItem-Schluessel mit dem Zeugen-Namen, in Reihenfolge', () => {
    const translate = vi.fn((key, params) => `<${params.name}>`);
    const violation = derivedViolation({
      bound: 0,
      causes: [
        { witness: MUSICIAN, modifierKind: 'set', value: 0 },
        { witness: HORN, modifierKind: 'increment', value: 3 },
      ],
    });

    expect(formatViolationCauses(violation, translate)).toEqual(['<Musician>', '<War Horn>']);
    expect(translate).toHaveBeenNthCalledWith(1, CAUSE_ITEM_KEY, expect.objectContaining({ name: 'Musician' }));
    expect(translate).toHaveBeenNthCalledWith(2, CAUSE_ITEM_KEY, expect.objectContaining({ name: 'War Horn' }));
  });

  it('liefert ohne causes-Feld ein leeres Ergebnis — der Bericht laesst das Feld weg, wenn nichts benennbar ist', () => {
    const translate = spy();
    expect(formatViolationCauses(derivedViolation(), translate)).toEqual([]);
    expect(translate).not.toHaveBeenCalled();
  });

  it('liefert fuer ein leeres causes-Feld ein leeres Ergebnis (Randfall, robust)', () => {
    expect(formatViolationCauses(derivedViolation({ causes: [] }), spy())).toEqual([]);
  });

  it('liefert fuer eine Autoren-Meldung ein leeres Ergebnis — Autoren-Meldungen tragen keine Ursachen', () => {
    expect(formatViolationCauses(authorMessage(), spy())).toEqual([]);
  });

  it('liefert fuer einen fehlenden Verstoss ein leeres Ergebnis', () => {
    expect(formatViolationCauses(undefined, spy())).toEqual([]);
    expect(formatViolationCauses(null, spy())).toEqual([]);
  });
});
