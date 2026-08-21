/**
 * Einheitstests des `RosterBudget`-Wert-Objekts (`rosterBudget.js`) und seiner
 * Durchreichung in den Query-Kontext (`createQueryContext`). Dieser Slice baut das
 * Budget nur auf und reicht es durch — die Feldauflösung folgt spaeter; hier wird
 * die reine, unveraenderliche Bauform und der Standardwert im Kontext gepinnt.
 */

import { describe, it, expect } from 'vitest';
import { createRosterBudget, EMPTY_ROSTER_BUDGET } from './rosterBudget.js';
import { createQueryContext } from './query.js';

const PTS = 'ecfa-8486-4f6c-c249';
const CASTING_DICE = 'fcec-2340-6368-a2ba';

describe('createRosterBudget', () => {
  it('ist ohne Grenzen leer: kein Grenzwert, keine Eintraege', () => {
    const budget = createRosterBudget();
    expect(budget.get(PTS)).toBeUndefined();
    expect(budget.entries()).toEqual([]);
  });

  it('liest den eingestellten Grenzwert je Kostenart per ID', () => {
    const budget = createRosterBudget([
      { costTypeId: PTS, value: 2000 },
      { costTypeId: CASTING_DICE, value: 8 },
    ]);
    expect(budget.get(PTS)).toBe(2000);
    expect(budget.get(CASTING_DICE)).toBe(8);
  });

  it('liefert fuer eine nicht budgetierte Kostenart undefined (nicht 0)', () => {
    const budget = createRosterBudget([{ costTypeId: PTS, value: 2000 }]);
    expect(budget.get('not-budgeted')).toBeUndefined();
  });

  it('zaehlt alle eingestellten Grenzen als { costTypeId, value } auf', () => {
    const budget = createRosterBudget([
      { costTypeId: PTS, value: 2000 },
      { costTypeId: CASTING_DICE, value: 8 },
    ]);
    expect(budget.entries()).toEqual([
      { costTypeId: PTS, value: 2000 },
      { costTypeId: CASTING_DICE, value: 8 },
    ]);
  });

  it('ist unveraenderlich (eingefroren)', () => {
    expect(Object.isFrozen(createRosterBudget())).toBe(true);
  });
});

describe('createQueryContext traegt das Budget', () => {
  const contextParts = { node: {}, root: {}, index: {}, diagnostics: [] };

  it('reicht ein uebergebenes Budget unveraendert durch', () => {
    const budget = createRosterBudget([{ costTypeId: PTS, value: 2000 }]);
    const ctx = createQueryContext({ ...contextParts, budget });
    expect(ctx.budget).toBe(budget);
  });

  it('faellt ohne Budget auf das leere Budget zurueck', () => {
    const ctx = createQueryContext(contextParts);
    expect(ctx.budget).toBe(EMPTY_ROSTER_BUDGET);
  });
});
