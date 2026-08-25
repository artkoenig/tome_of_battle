/**
 * Der Identitaets-Cache von `evaluate` (Issue 0170, AC4).
 *
 * Die App-Auswertung memoisiert bereits je `(System, Roster)`
 * (`evaluationCache.js`). Darunter fehlte dieselbe Zusage auf der Ebene der
 * Fassade: wer `evaluate(prepared, roster)` zweimal mit **demselben**
 * Roster-Objekt ruft — die Evaluator-Tests, der `.ros`-Export, jeder Aufrufer,
 * der die App-Naht nicht benutzt — bezahlte den ganzen Lauf ein zweites Mal.
 * Der Cache haengt an den Objektidentitaeten beider Eingaben und macht den
 * zweiten Aufruf zu einer Rueckgabe.
 *
 * Aufbau: synthetischer Datensatz aus `evaluationCache.evaluator.test.js`.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';

import { prepareDataset, evaluate } from '../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../contexts/ruleengine/acl/rosterAdapter.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const WARRIOR_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-pts';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes>
      <costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/>
    </costTypes>
  </gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <costs>
          <cost name="pts" typeId="${COST_TYPE_ID}" value="10"/>
        </costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const appRoster = () => ({
  id: 'roster-uuid',
  name: 'Test Roster',
  systemId: 'system-uuid',
  catalogueId: 'cat-main',
  costLimit: 1000,
  costLimitType: COST_TYPE_ID,
  forces: [{
    id: 'force-uuid-1',
    forceEntryId: FORCE_DEF_ID,
    catalogueId: 'cat-main',
    selections: [{
      id: 'sel-warrior',
      name: 'Warrior',
      entryLinkId: null,
      selectionEntryId: WARRIOR_ID,
      number: 2,
      category: null,
      selections: [],
    }],
  }],
});

const preparedDataset = () => prepareDataset({
  gameSystem: GAME_SYSTEM_XML,
  catalogues: [CATALOGUE_XML],
});

describe('evaluate: Identitaets-Cache (Issue 0170, AC4)', () => {
  it('gibt beim zweiten Aufruf mit demselben Roster-Objekt denselben Bericht zurueck', () => {
    const prepared = preparedDataset();
    const { evalRoster } = toEvaluatorRoster(appRoster());

    const first = evaluate(prepared, evalRoster);
    const second = evaluate(prepared, evalRoster);

    expect(second).toBe(first);
  });

  it('rechnet fuer ein neues Roster-Objekt neu — gleiches Ergebnis, andere Identitaet', () => {
    const prepared = preparedDataset();
    const first = evaluate(prepared, toEvaluatorRoster(appRoster()).evalRoster);
    const second = evaluate(prepared, toEvaluatorRoster(appRoster()).evalRoster);

    expect(second).not.toBe(first);
    expect([...second.capabilities.keys()]).toEqual([...first.capabilities.keys()]);
    expect(second.costTotals).toEqual(first.costTotals);
  });

  it('rechnet fuer einen anderen Datensatz neu, auch bei gleichem Roster-Objekt', () => {
    const { evalRoster } = toEvaluatorRoster(appRoster());
    const first = evaluate(preparedDataset(), evalRoster);
    const second = evaluate(preparedDataset(), evalRoster);

    expect(second).not.toBe(first);
  });

  it('der Mess-Modus geht am Cache vorbei — seine Messung gilt diesem Lauf', () => {
    const prepared = preparedDataset();
    const { evalRoster } = toEvaluatorRoster(appRoster());

    const cached = evaluate(prepared, evalRoster);
    const measured = evaluate(prepared, evalRoster, { measure: true });

    expect(measured).not.toBe(cached);
    expect(measured.measurement).toBeDefined();
  });
});
