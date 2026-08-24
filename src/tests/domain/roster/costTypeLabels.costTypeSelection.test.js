import { describe, test, expect } from 'vitest';
import { resolveCostLimitTypeId } from '../../../domain/roster/costTypeLabels.js';
import {
  POINTS,
  CASTING_DICE,
  COST_TYPE_NAME,
  createGrimdarkSystem
} from '../../../shared/__fixtures__/grimdarkSystem.js';

/**
 * Die Kostenart, in der ein Roster gemessen wird, wird ausschliesslich ueber die
 * Kostenart-**id** bestimmt: `cost/@typeId` verweist auf `costType/@id`, nie auf
 * `costType/@name` (ADR-0003). Was eine Auswahl in dieser Kostenart kostet, sagt
 * seit Issue 0157 der Bericht — hier steht nur noch die Wahl der Kostenart
 * selbst und die Form der Testdaten.
 */

const CATALOGUE_ID = 'cat-dual-cost';

function createDualCostSystem() {
  return {
    id: 'sys-dual-cost',
    name: 'Dual Cost System',
    costTypes: [
      { id: POINTS, name: COST_TYPE_NAME.points },
      { id: CASTING_DICE, name: COST_TYPE_NAME.castingDice }
    ],
    catalogues: [{ id: CATALOGUE_ID, name: 'Dual Cost Catalogue', selectionEntries: [] }]
  };
}

function createDualCostRoster(costLimitType) {
  return { id: 'r1', costLimitType, catalogueId: CATALOGUE_ID, forces: [] };
}

describe('resolveCostLimitTypeId', () => {
  test('nimmt die im Roster eingestellte Kostenart', () => {
    const system = createDualCostSystem();
    const roster = createDualCostRoster(CASTING_DICE);

    expect(resolveCostLimitTypeId(roster, system)).toBe(CASTING_DICE);
  });

  test('weicht ohne Einstellung auf die erste im System deklarierte Kostenart aus', () => {
    expect(resolveCostLimitTypeId({}, createDualCostSystem())).toBe(POINTS);
  });

  test('liefert null, wenn weder Roster noch System eine Kostenart führen', () => {
    expect(resolveCostLimitTypeId(null, { costTypes: [] })).toBeNull();
  });
});

describe('Testdaten bilden echte Katalogdaten ab', () => {
  test('die Kostenart-ids sind GUID-förmig und nicht der Anzeigename', () => {
    const guidShape = /^[0-9a-f]{4}(-[0-9a-f]{4}){3}$/;
    const { costTypes } = createGrimdarkSystem();

    costTypes.forEach(costType => {
      expect(costType.id).toMatch(guidShape);
      expect(costType.id).not.toBe(costType.name);
    });
  });

  test('ein Kostenart-Name kann führende Leerzeichen tragen', () => {
    const castingDice = createGrimdarkSystem().costTypes.find(ct => ct.id === CASTING_DICE);

    expect(castingDice.name).toBe(' Casting Dice');
    expect(castingDice.name.trim()).toBe('Casting Dice');
  });
});
