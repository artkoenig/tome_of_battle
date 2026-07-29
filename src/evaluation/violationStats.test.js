/**
 * Issue 0121, Task 5 — Blockierungs-Helfer `src/evaluation/violationStats.js`
 * (existiert noch nicht; test-first).
 *
 * Intention: Die UI braucht eine eine Stelle, die entscheidet, welche
 * Evaluator-Verletzungen eine Liste "blockieren" (Spielen sperren):
 *
 * - `isBlockingViolation(v)`  ⇔ `v.severity === 'error'` — unabhängig vom
 *   `origin`: auch eine Autoren-Meldung mit severity 'error' blockiert;
 *   Autoren-Meldungen mit 'warning'/'info' blockieren nicht.
 * - `countBlockingViolations(violations)` zählt die blockierenden.
 * - `hasBlockingViolations(violations)` ⇔ mindestens eine blockierende.
 *
 * Die Violation-Fixtures folgen dem veröffentlichten Berichtsvertrag der
 * Fassade (`src/evaluator/evaluator.js`; Formen wie in
 * `src/i18n/violationMessages.test.js`, dort per Wegwerf-Skript gegen die
 * echte Fassade verifiziert).
 */

import { describe, it, expect } from 'vitest';
import {
  isBlockingViolation,
  countBlockingViolations,
  hasBlockingViolations,
} from './violationStats.js';

/** Eine abgeleitete Verletzung in der veröffentlichten Berichtsform. */
function derivedViolation({ severity = 'error' } = {}) {
  return {
    origin: 'derivedLimit',
    severity,
    anchor: { defId: 'def-1', name: 'Musician', path: '0/0', anchorKind: 'occupied', isValueUnstable: false },
    limitId: 'lim-1',
    limit: {
      kind: 'max',
      measure: 'selectionCount',
      costTypeId: null,
      isPercent: false,
      scope: { kind: 'parent', targetId: null, flags: { shared: true, includeChildSelections: false, includeChildForces: false } },
    },
    actual: 2,
    bound: 1,
    delta: -1,
    derivation: { base: 1, steps: [] },
  };
}

/** Eine Autoren-Meldung in der veröffentlichten Berichtsform. */
function authorMessage({ severity = 'warning', text = 'Beware of the author' } = {}) {
  return {
    origin: 'authorMessage',
    severity,
    anchor: { defId: 'entry-1', name: 'Special Character', path: '0/1', anchorKind: 'occupied', isValueUnstable: false },
    text,
  };
}

describe('isBlockingViolation: severity error blockiert, warning/info nicht', () => {
  it('eine abgeleitete Grenzverletzung (severity error) blockiert', () => {
    expect(isBlockingViolation(derivedViolation())).toBe(true);
  });

  it('eine Autoren-Meldung mit severity error blockiert ebenfalls (origin ist egal)', () => {
    expect(isBlockingViolation(authorMessage({ severity: 'error' }))).toBe(true);
  });

  it('eine Autoren-Meldung mit severity warning blockiert nicht', () => {
    expect(isBlockingViolation(authorMessage({ severity: 'warning' }))).toBe(false);
  });

  it('eine Autoren-Meldung mit severity info blockiert nicht', () => {
    expect(isBlockingViolation(authorMessage({ severity: 'info' }))).toBe(false);
  });
});

describe('countBlockingViolations: zählt genau die blockierenden', () => {
  it('leere Liste → 0 (Rand)', () => {
    expect(countBlockingViolations([])).toBe(0);
  });

  it('nur nicht-blockierende (warning + info) → 0', () => {
    expect(countBlockingViolations([
      authorMessage({ severity: 'warning' }),
      authorMessage({ severity: 'info' }),
    ])).toBe(0);
  });

  it('gemischte Liste: zwei errors neben warning und info → 2', () => {
    expect(countBlockingViolations([
      derivedViolation(),
      authorMessage({ severity: 'warning' }),
      authorMessage({ severity: 'error' }),
      authorMessage({ severity: 'info' }),
    ])).toBe(2);
  });

  it('Wiederholung: dieselbe Verletzung mehrfach in der Liste zählt mehrfach', () => {
    const violation = derivedViolation();
    expect(countBlockingViolations([violation, violation])).toBe(2);
  });
});

describe('hasBlockingViolations: entsprechend zu count', () => {
  it('leere Liste → false (Rand)', () => {
    expect(hasBlockingViolations([])).toBe(false);
  });

  it('nur Autoren-warning/-info → false', () => {
    expect(hasBlockingViolations([
      authorMessage({ severity: 'warning' }),
      authorMessage({ severity: 'info' }),
    ])).toBe(false);
  });

  it('eine einzige error-Verletzung → true', () => {
    expect(hasBlockingViolations([
      authorMessage({ severity: 'info' }),
      derivedViolation(),
    ])).toBe(true);
  });
});
