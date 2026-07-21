import { describe, test, expect } from 'vitest';
import {
  calculateRosterCosts,
  getOptionDisplayCost,
  getSelectionTotalCost,
  resolveCostLimitTypeId
} from './validator.js';
import {
  POINTS,
  CASTING_DICE,
  COST_TYPE_NAME,
  createGrimdarkSystem
} from './__fixtures__/grimdarkSystem.js';

/**
 * Der Wert einer Auswahl wird ausschließlich über die eingestellte Kostenart-id
 * ermittelt. `cost/@typeId` verweist auf `costType/@id`, nie auf `costType/@name`
 * (ADR-0003) — und die Reihenfolge im `costs`-Array trägt keine Bedeutung.
 */

const WIZARD_ENTRY_ID = 'unit-wizard';
const CHAMPION_ENTRY_ID = 'unit-champion';
const CATALOGUE_ID = 'cat-dual-cost';

const WIZARD_POINTS = 90;
const WIZARD_CASTING_DICE = 2;
const CHAMPION_POINTS = 40;

/**
 * Der Zauberer trägt beide Kostenarten, und zwar mit den Punkten **vor** den
 * Zauberwürfeln: eine Ermittlung, die schlicht den ersten Eintrag nimmt, liefert
 * hier die falsche Zahl. Der Champion trägt nur Punkte — er belegt den Fall einer
 * fehlenden Kostenart.
 */
function createDualCostSystem() {
  return {
    id: 'sys-dual-cost',
    name: 'Dual Cost System',
    costTypes: [
      { id: POINTS, name: COST_TYPE_NAME.points },
      { id: CASTING_DICE, name: COST_TYPE_NAME.castingDice }
    ],
    catalogues: [{
      id: CATALOGUE_ID,
      name: 'Dual Cost Catalogue',
      selectionEntries: [
        {
          id: WIZARD_ENTRY_ID,
          name: 'Wizard',
          costs: [
            { typeId: POINTS, value: WIZARD_POINTS },
            { typeId: CASTING_DICE, value: WIZARD_CASTING_DICE }
          ]
        },
        {
          id: CHAMPION_ENTRY_ID,
          name: 'Champion',
          costs: [{ typeId: POINTS, value: CHAMPION_POINTS }]
        }
      ]
    }]
  };
}

function createSelection(entryId, id = 'sel-1') {
  return { id, selectionEntryId: entryId, name: entryId, number: 1 };
}

function createDualCostRoster(costLimitType, selections) {
  return {
    id: 'r-dual',
    name: 'Dual Cost Roster',
    costLimit: 2000,
    costLimitType,
    catalogueId: CATALOGUE_ID,
    forces: [{ id: 'f1', catalogueId: CATALOGUE_ID, selections }]
  };
}

describe('resolveCostLimitTypeId', () => {
  test('nimmt die im Roster eingestellte Kostenart', () => {
    const system = createDualCostSystem();
    const roster = createDualCostRoster(CASTING_DICE, []);

    expect(resolveCostLimitTypeId(roster, system)).toBe(CASTING_DICE);
  });

  test('weicht ohne Einstellung auf die erste im System deklarierte Kostenart aus', () => {
    expect(resolveCostLimitTypeId({}, createDualCostSystem())).toBe(POINTS);
  });

  test('liefert null, wenn weder Roster noch System eine Kostenart führen', () => {
    expect(resolveCostLimitTypeId(null, { costTypes: [] })).toBeNull();
  });
});

describe('getSelectionTotalCost — Wert allein über die eingestellte Kostenart', () => {
  test('nimmt die eingestellte Kostenart, auch wenn eine andere im Array vorne steht', () => {
    const system = createDualCostSystem();
    const selection = createSelection(WIZARD_ENTRY_ID);
    const roster = createDualCostRoster(CASTING_DICE, [selection]);

    const total = getSelectionTotalCost(selection, CASTING_DICE, 1, {
      system, roster, currentCatalogueId: CATALOGUE_ID
    });

    expect(total).toBe(WIZARD_CASTING_DICE);
  });

  test('ist 0, wenn dem Eintrag die eingestellte Kostenart fehlt', () => {
    const system = createDualCostSystem();
    const selection = createSelection(CHAMPION_ENTRY_ID);
    const roster = createDualCostRoster(CASTING_DICE, [selection]);

    const total = getSelectionTotalCost(selection, CASTING_DICE, 1, {
      system, roster, currentCatalogueId: CATALOGUE_ID
    });

    expect(total).toBe(0);
  });

  test('setzt für eine fehlende Kostenart keinen Punktwert ein', () => {
    const system = createDualCostSystem();
    const selection = createSelection(CHAMPION_ENTRY_ID);
    const roster = createDualCostRoster(CASTING_DICE, [selection]);

    const total = getSelectionTotalCost(selection, CASTING_DICE, 1, {
      system, roster, currentCatalogueId: CATALOGUE_ID
    });

    expect(total).not.toBe(CHAMPION_POINTS);
  });
});

describe('getOptionDisplayCost — Wert allein über die eingestellte Kostenart', () => {
  test('nimmt die eingestellte Kostenart, auch wenn eine andere im Array vorne steht', () => {
    const system = createDualCostSystem();

    expect(getOptionDisplayCost(system, { id: WIZARD_ENTRY_ID }, CASTING_DICE))
      .toBe(WIZARD_CASTING_DICE);
  });

  test('ist 0, wenn dem Eintrag die eingestellte Kostenart fehlt', () => {
    const system = createDualCostSystem();

    expect(getOptionDisplayCost(system, { id: CHAMPION_ENTRY_ID }, CASTING_DICE)).toBe(0);
  });
});

describe('calculateRosterCosts hält die Kostenarten auseinander', () => {
  test('summiert jede Kostenart getrennt', () => {
    const selections = [createSelection(WIZARD_ENTRY_ID, 'sel-wizard'), createSelection(CHAMPION_ENTRY_ID, 'sel-champion')];
    const costs = calculateRosterCosts(createDualCostRoster(POINTS, selections), createDualCostSystem());

    expect(costs[POINTS]).toBe(WIZARD_POINTS + CHAMPION_POINTS);
    expect(costs[CASTING_DICE]).toBe(WIZARD_CASTING_DICE);
  });
});

/**
 * Regressionsschutz für den entfernten Ersatzwert: die Wertermittlung hatte den
 * Anzeigenamen `'pts'` als vermeintliche id festgeschrieben. Ein Katalog, der
 * `'pts'` tatsächlich als id führt (so wh40k-9e mit `id="points"`), löste damit
 * den Punktwert aus, obwohl eine andere Kostenart eingestellt war. Nur ein
 * Katalog mit genau dieser id kann den Rückfall überhaupt sichtbar machen.
 */
describe('kein Rückfall auf eine als "pts" benannte Kostenart', () => {
  const LITERAL_POINTS_ID = 'pts';
  const SCROLL_ENTRY_ID = 'item-scroll';
  const SCROLL_POINTS = 25;

  function createLiteralPointsSystem() {
    return {
      id: 'sys-literal-points',
      costTypes: [
        { id: LITERAL_POINTS_ID, name: 'pts' },
        { id: CASTING_DICE, name: COST_TYPE_NAME.castingDice }
      ],
      catalogues: [{
        id: CATALOGUE_ID,
        selectionEntries: [{
          id: SCROLL_ENTRY_ID,
          name: 'Dispel Scroll',
          costs: [{ typeId: LITERAL_POINTS_ID, value: SCROLL_POINTS }]
        }]
      }]
    };
  }

  test('getSelectionTotalCost liefert 0 statt des Punktwerts', () => {
    const system = createLiteralPointsSystem();
    const selection = createSelection(SCROLL_ENTRY_ID);
    const roster = createDualCostRoster(CASTING_DICE, [selection]);

    const total = getSelectionTotalCost(selection, CASTING_DICE, 1, {
      system, roster, currentCatalogueId: CATALOGUE_ID
    });

    expect(total).toBe(0);
  });

  test('getOptionDisplayCost liefert 0 statt des Punktwerts', () => {
    const system = createLiteralPointsSystem();

    expect(getOptionDisplayCost(system, { id: SCROLL_ENTRY_ID }, CASTING_DICE)).toBe(0);
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
