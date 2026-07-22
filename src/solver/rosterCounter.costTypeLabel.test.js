import { describe, test, expect } from 'vitest';
import { resolveCostTypeLabel, resolveCostLimitLabel, validateRoster } from './validator.js';
import { formatValidationError } from '../i18n/formatValidationError.js';
import { t } from '../i18n/i18nStore.js';
import {
  POINTS,
  CASTING_DICE,
  COST_TYPE_NAME,
  createGrimdarkSystem
} from './__fixtures__/grimdarkSystem.js';

/**
 * Die Bezeichnung einer Kostenart kommt unverändert aus `costType/@name`. Sie
 * wird ausschließlich getrimmt — Katalogautoren stellen den Namen ein führendes
 * Leerzeichen voran (` Casting Dice`, ` Dispel Dice`, ` PL` bei wh40k-9e).
 * Übersetzt oder abgekürzt wird nichts; die deutsche Oberfläche zeigt daher
 * `pts` und nicht `Pkt.` (ADR-0003, Entscheidung des Maintainers zu Issue 47).
 */

const CATALOGUE_ID = 'cat-label';
const WIZARD_ENTRY_ID = 'unit-wizard';
const CASTING_DICE_LIMIT = 4;
const CASTING_DICE_PER_WIZARD = 3;

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

/**
 * Die Meldungen des Validators entstehen eine Schicht unter der Oberfläche und
 * hätten bei einer reinen UI-Prüfung durchs Raster fallen können. Geprüft wird
 * daher an einem Roster, dessen Kostenart **nicht** Punkte ist.
 */
describe('Validierungsmeldungen benennen die Kostenart des Spielsystems', () => {
  function createCastingDiceSystem() {
    return {
      id: 'sys-casting-dice',
      costTypes: [
        { id: POINTS, name: COST_TYPE_NAME.points },
        { id: CASTING_DICE, name: COST_TYPE_NAME.castingDice }
      ],
      catalogues: [{
        id: CATALOGUE_ID,
        selectionEntries: [{
          id: WIZARD_ENTRY_ID,
          name: 'Wizard',
          costs: [{ typeId: CASTING_DICE, value: CASTING_DICE_PER_WIZARD }]
        }]
      }]
    };
  }

  function createOverLimitRoster() {
    return {
      id: 'r-casting-dice',
      name: 'Casting Dice Roster',
      costLimit: CASTING_DICE_LIMIT,
      costLimitType: CASTING_DICE,
      catalogueId: CATALOGUE_ID,
      forces: [{
        id: 'f1',
        catalogueId: CATALOGUE_ID,
        selections: [
          { id: 'sel-1', selectionEntryId: WIZARD_ENTRY_ID, name: 'Wizard', number: 1 },
          { id: 'sel-2', selectionEntryId: WIZARD_ENTRY_ID, name: 'Wizard', number: 1 }
        ]
      }]
    };
  }

  // Die Limitmeldung ist strukturiert (ADR 0026); der Anzeigetext entsteht erst durch
  // die Oberflächen-Übersetzung. Der Testlauf pinnt Deutsch (i18nTestSetup), sodass die
  // Bezeichnungs-Prüfung unverändert greift und den unitLabel-Pass-through belegt.
  const rosterLimitMessage = () => {
    const violation = validateRoster(createOverLimitRoster(), createCastingDiceSystem())
      .find(error => error.type === 'roster-limit');
    return violation ? formatValidationError(violation, t) : undefined;
  };

  test('die Limitmeldung nennt die getrimmte Katalog-Bezeichnung', () => {
    expect(rosterLimitMessage()).toContain('Casting Dice');
  });

  test('die Limitmeldung schreibt keine Punkte-Bezeichnung fest', () => {
    const message = rosterLimitMessage();

    expect(message).not.toContain('Punkte');
    expect(message).not.toContain('Pkt.');
  });
});
