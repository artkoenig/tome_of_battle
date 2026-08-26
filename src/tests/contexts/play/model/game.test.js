import { describe, test, expect } from 'vitest';
import {
  createGame,
  isUnplayedGame,
  currentWoundsOf,
  withAdjustedWound,
  withAdjustedTracker,
  selectionIdsOf,
  withoutOrphanedWounds,
} from '../../../../contexts/play/model/game';

const gameWith = (wounds) => ({ ...createGame('roster-1'), wounds });

const ROSTER = {
  id: 'roster-1',
  forces: [
    {
      id: 'force-1',
      selections: [
        { id: 'unit-1', selections: [{ id: 'sub-1', selections: [] }] },
        { id: 'unit-2', selections: [] },
      ],
    },
  ],
};

describe('createGame', () => {
  test('beginnt in Runde 1 ohne Punkte und ohne Wunden, mit Bezug auf die Liste', () => {
    const game = createGame('roster-1');

    expect(game.rosterId).toBe('roster-1');
    expect(game.round).toBe(1);
    expect(game.vp).toBe(0);
    expect(game.cp).toBe(0);
    expect(game.wounds).toEqual({});
    expect(typeof game.id).toBe('string');
  });

  test('liefert je Aufruf eine eigene Instanz, damit Wunden nicht geteilt werden', () => {
    const first = createGame('roster-1');
    const second = createGame('roster-1');

    first.wounds['unit-1'] = 3;

    expect(second.wounds).toEqual({});
  });
});

describe('isUnplayedGame', () => {
  test('eine frische Partie hat keinen Verlauf', () => {
    expect(isUnplayedGame(createGame('roster-1'))).toBe(true);
  });

  test('eine Wunde, ein Punkt oder eine weitere Runde macht sie zur Partie', () => {
    expect(isUnplayedGame(gameWith({ 'unit-1': 2 }))).toBe(false);
    expect(isUnplayedGame(withAdjustedTracker(createGame('r'), 'vp', 1))).toBe(false);
    expect(isUnplayedGame(withAdjustedTracker(createGame('r'), 'round', 1))).toBe(false);
  });
});

describe('currentWoundsOf', () => {
  test('ohne Eintrag gilt eine Auswahl als unverwundet', () => {
    expect(currentWoundsOf(createGame('r'), 'unit-1', 15)).toBe(15);
  });

  test('ein Wert je Modell wird summiert', () => {
    expect(currentWoundsOf(gameWith({ 'unit-1': [2, 1, 0] }), 'unit-1', 9)).toBe(3);
  });
});

describe('withAdjustedWound', () => {
  test('bleibt zwischen 0 und dem Maximum der Auswahl', () => {
    const damaged = withAdjustedWound(createGame('r'), 'unit-1', -2, 10);
    expect(damaged.wounds['unit-1']).toBe(8);
    expect(withAdjustedWound(damaged, 'unit-1', 5, 10).wounds['unit-1']).toBe(10);
    expect(withAdjustedWound(damaged, 'unit-1', -20, 10).wounds['unit-1']).toBe(0);
  });

  test('laesst die Partie unveraendert und liefert eine neue', () => {
    const game = createGame('r');
    withAdjustedWound(game, 'unit-1', -2, 10);
    expect(game.wounds).toEqual({});
  });
});

describe('withAdjustedTracker', () => {
  test('faellt nie unter null', () => {
    expect(withAdjustedTracker(createGame('r'), 'vp', -5).vp).toBe(0);
  });
});

describe('selectionIdsOf', () => {
  test('erfasst Unter-Auswahlen mit', () => {
    expect(selectionIdsOf(ROSTER)).toEqual(new Set(['unit-1', 'sub-1', 'unit-2']));
  });
});

describe('withoutOrphanedWounds', () => {
  // Produktentscheidung 1 des PRD: Liste und Partie koexistieren. Verschwindet
  // eine Auswahl, faellt ihr Eintrag beim naechsten Schreiben weg — und nur er.
  test('entfernt den Eintrag einer verschwundenen Auswahl, behaelt die uebrigen', () => {
    const game = { ...gameWith({ 'unit-1': 2, 'weg': 1, 'sub-1': 0 }), round: 3, vp: 4, cp: 1 };

    const pruned = withoutOrphanedWounds(game, ROSTER);

    expect(pruned.wounds).toEqual({ 'unit-1': 2, 'sub-1': 0 });
    expect(pruned.round).toBe(3);
    expect(pruned.vp).toBe(4);
    expect(pruned.cp).toBe(1);
  });

  test('ohne verwaisten Eintrag bleibt die Partie identisch', () => {
    const game = gameWith({ 'unit-1': 2 });
    expect(withoutOrphanedWounds(game, ROSTER)).toBe(game);
  });

  test('ohne Liste wird nichts entfernt', () => {
    const game = gameWith({ 'weg': 1 });
    expect(withoutOrphanedWounds(game, null)).toBe(game);
  });
});
