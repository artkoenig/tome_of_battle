import { describe, test, expect } from 'vitest';
import { resolveCostTypeLabel, resolveCostLimitLabel } from '../../../domain/roster/costTypeLabels.js';
import {
  POINTS,
  CASTING_DICE,
  COST_TYPE_NAME,
  createGrimdarkSystem
} from '../../../shared/__fixtures__/grimdarkSystem.js';

/**
 * Die Bezeichnung einer Kostenart kommt unverändert aus `costType/@name`. Sie
 * wird ausschließlich getrimmt — Katalogautoren stellen den Namen ein führendes
 * Leerzeichen voran (` Casting Dice`, ` Dispel Dice`, ` PL` bei wh40k-9e).
 * Übersetzt oder abgekürzt wird nichts; die deutsche Oberfläche zeigt daher
 * `pts` und nicht `Pkt.` (ADR-0003, Entscheidung des Maintainers zu Issue 47).
 */


describe('resolveCostTypeLabel', () => {
  test('übernimmt den Katalognamen unverändert', () => {
    expect(resolveCostTypeLabel(createGrimdarkSystem(), POINTS)).toBe(COST_TYPE_NAME.points);
  });

  test('übersetzt „pts" nicht in eine deutsche Kurzform', () => {
    expect(resolveCostTypeLabel(createGrimdarkSystem(), POINTS)).not.toBe('Pkt.');
  });

  test('entfernt das führende Leerzeichen eines Katalognamens', () => {
    expect(COST_TYPE_NAME.castingDice).toBe(' Casting Dice');
    expect(resolveCostTypeLabel(createGrimdarkSystem(), CASTING_DICE)).toBe('Casting Dice');
  });

  test('liefert eine leere Bezeichnung für eine nicht deklarierte Kostenart', () => {
    expect(resolveCostTypeLabel(createGrimdarkSystem(), 'nicht-deklariert')).toBe('');
    expect(resolveCostTypeLabel(null, POINTS)).toBe('');
  });
});

describe('resolveCostLimitLabel', () => {
  test('benennt die im Roster eingestellte Kostenart', () => {
    const roster = { costLimitType: CASTING_DICE };

    expect(resolveCostLimitLabel(roster, createGrimdarkSystem())).toBe('Casting Dice');
  });

  test('weicht ohne Einstellung auf die erste deklarierte Kostenart aus', () => {
    expect(resolveCostLimitLabel(null, createGrimdarkSystem())).toBe(COST_TYPE_NAME.points);
  });
});

// Dass eine Grenzmeldung die Kostenart des Spielsystems benennt, ist seit
// Issue 0121 Sache der Meldungsprojektion des Berichts: sie fuehrt
// `limit.costTypeId` als Parameter (`src/ui/i18n/violationMessages.js`,
// abgedeckt durch `violationMessages.test.js`). Die frueheren Faelle hier
// pruefen die geloeschte Solver-Validierung und sterben mit ihr.
