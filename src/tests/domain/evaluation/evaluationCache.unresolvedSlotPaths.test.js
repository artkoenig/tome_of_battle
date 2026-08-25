/**
 * Issue 0121, Task 12 (Kriterium 3) — Slot-Pfade bleiben gueltig, wenn eine
 * Auswahl nicht mehr auflösbar ist.
 *
 * Hintergrund (Befund B2 der Pruefrunde 2): `pathBySelectionId` zaehlt die
 * Kind-Indizes der Roster-Eingabe durch. Die Engine haengt eine Auswahl, deren
 * `defId` sie nicht aufloesen kann, **nicht** in den Auswertungsbaum (sie meldet
 * dazu die Diagnose `unresolvedDefinition`) — dadurch rutschen alle nachfolgenden
 * Geschwister um eine Position nach vorn. Folge: jede Auswahl **hinter** einer
 * verlorenen wird auf den Faehigkeitsdatensatz ihres Nachbarn abgebildet und
 * zeigt dessen Namen, dessen Kosten und dessen Verfuegbarkeit; der Export
 * schreibt diese fremden Werte in die `.ros`.
 *
 * Sollverhalten, das diese Datei festschreibt:
 *
 * 1. Eine Auswahl, deren `defId` nicht aufloest, hat **keinen** Eintrag in
 *    `pathBySelectionId` — die Engine fuehrt fuer sie keinen Slot.
 * 2. Jede **aufloesbare** Auswahl wird auf den Faehigkeitsdatensatz abgebildet,
 *    der **ihr** gehoert (eigener Name, eigene Kosten).
 * 3. Das gilt auch, wenn die unauflösbare Auswahl Kinder hat, auf **jeder** Ebene
 *    (auch beim Kontingent) und bei **mehreren** unauflösbaren Auswahlen.
 * 4. Ohne `unresolvedDefinition`-Diagnose bleibt die Zuordnung wie heute.
 *
 * Beobachtet wird am Rand, den die Oberflaeche benutzt: `evaluateAppRoster`
 * (`src/domain/evaluation/evaluationCache.js`) — welcher Faehigkeitsdatensatz gehoert zu
 * welcher App-Selection-UUID. Der Adapter allein kann Aufloesbarkeit nicht
 * kennen; wo die Korrektur sitzt, ist deshalb bewusst offen gelassen.
 *
 * Fixture-Muster: `evaluationCache.evaluator.test.js` (synthetischer Datensatz
 * aus `rawXmls`, echte Fassade).
 *
 * Nicht hier, weil schon abgedeckt (`datasetDiagnostics.test.js`): dass
 * `unresolvedSelectionsOf` die verlorene Auswahl beim Namen nennt.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluateAppRoster } from '../../../domain/evaluation/evaluationCache.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Synthetischer Datensatz ─────────────────────────────────────────────────

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const FORCE_DEF_ID = 'force-main';
const SECOND_FORCE_DEF_ID = 'force-second';
const ALPHA_ID = 'entry-alpha';
const BETA_ID = 'entry-beta';
const WARRIOR_ID = 'entry-warrior';
const SWORD_ID = 'entry-sword';
const SHIELD_ID = 'entry-shield';

const ALPHA_POINTS = 11;
const BETA_POINTS = 77;
const SWORD_POINTS = 3;
const SHIELD_POINTS = 5;

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
      <forceEntry id="${SECOND_FORCE_DEF_ID}" name="Second Force"/>
    </forceEntries>
    <selectionEntries>
      <selectionEntry id="${ALPHA_ID}" name="Alpha" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${ALPHA_POINTS}"/></costs>
      </selectionEntry>
      <selectionEntry id="${BETA_ID}" name="Beta" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${BETA_POINTS}"/></costs>
      </selectionEntry>
      <selectionEntry id="${WARRIOR_ID}" name="Warrior" type="unit">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="10"/></costs>
        <selectionEntries>
          <selectionEntry id="${SWORD_ID}" name="Sword" type="upgrade">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${SWORD_POINTS}"/></costs>
          </selectionEntry>
          <selectionEntry id="${SHIELD_ID}" name="Shield" type="upgrade">
            <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="${SHIELD_POINTS}"/></costs>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/** Das App-System-Objekt mit den rohen XMLs (Shape aus `src/data/db/systemImport.js`). */
function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [{ name: 'main.cat', content: CATALOGUE_XML }],
    },
  };
}

/** Eine App-Selection (Shape aus `src/shared/rostermodel/types.js`). */
function selection(id, selectionEntryId, selections = []) {
  return {
    id,
    name: id,
    entryLinkId: null,
    selectionEntryId,
    number: 1,
    category: null,
    selections,
  };
}

/** Ein App-Roster aus beliebig vielen Kontingenten. */
function appRoster(forces) {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 10000,
    costLimitType: COST_TYPE_ID,
    forces: forces.map((force, index) => ({
      id: `force-uuid-${index}`,
      catalogueId: 'cat-main',
      ...force,
    })),
  };
}

/** Ein Kontingent des Test-Rosters. */
function force(forceEntryId, selections) {
  return { forceEntryId, selections };
}

/**
 * Der Faehigkeitsdatensatz, den die Oberflaeche fuer diese App-Selection liest:
 * `pathBySelectionId` → `capabilities`. `undefined`, wenn kein Pfad gefuehrt wird
 * oder der Pfad ins Leere zeigt.
 */
function capabilityFor(result, selectionId) {
  const path = result.slots.pathBySelectionId.get(selectionId);
  return path === undefined ? undefined : result.slots.capabilities.get(path);
}

const evaluateRoster = (roster) => evaluateAppRoster(appSystem(), roster);

/** Vorbedingung jedes Falls: die Engine meldet die Diagnose wirklich. */
function expectUnresolved(result, defIds) {
  expect(result.diagnostics.filter((entry) => entry.kind === 'unresolvedDefinition').map((entry) => entry.defId))
    .toEqual(defIds);
}

describe('Slot-Pfade bei einer unauflösbaren Auswahl (Issue 0121, Task 12, Kriterium 3)', () => {
  /** Die Reproduktion des Befunds: `sel-gone` vor `sel-alpha` und `sel-beta`. */
  function rosterWithLostFirstSelection() {
    return appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-gone', 'entry-vanished'),
        selection('sel-alpha', ALPHA_ID),
        selection('sel-beta', BETA_ID),
      ]),
    ]);
  }

  it('jede aufloesbare Auswahl hinter der verlorenen zeigt auf IHREN Datensatz — eigener Name, eigene Kosten', () => {
    const result = evaluateRoster(rosterWithLostFirstSelection());
    expectUnresolved(result, ['entry-vanished']);

    expect(capabilityFor(result, 'sel-alpha')).toMatchObject({
      defId: ALPHA_ID,
      name: 'Alpha',
      costs: { [COST_TYPE_ID]: ALPHA_POINTS },
    });
    expect(capabilityFor(result, 'sel-beta')).toMatchObject({
      defId: BETA_ID,
      name: 'Beta',
      costs: { [COST_TYPE_ID]: BETA_POINTS },
    });
  });

  it('die unauflösbare Auswahl selbst hat keinen Slot-Pfad', () => {
    const result = evaluateRoster(rosterWithLostFirstSelection());
    expectUnresolved(result, ['entry-vanished']);

    expect(result.slots.pathBySelectionId.has('sel-gone')).toBe(false);
  });

  it('auch die Kinder der unauflösbaren Auswahl haben keinen Pfad, die folgenden Geschwister bleiben richtig', () => {
    const result = evaluateRoster(appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-gone', 'entry-vanished', [selection('sel-gone-child', SWORD_ID)]),
        selection('sel-alpha', ALPHA_ID),
        selection('sel-beta', BETA_ID),
      ]),
    ]));
    expectUnresolved(result, ['entry-vanished']);

    expect(result.slots.pathBySelectionId.has('sel-gone')).toBe(false);
    expect(result.slots.pathBySelectionId.has('sel-gone-child')).toBe(false);
    expect(capabilityFor(result, 'sel-alpha')).toMatchObject({ defId: ALPHA_ID, name: 'Alpha' });
    expect(capabilityFor(result, 'sel-beta')).toMatchObject({ defId: BETA_ID, name: 'Beta' });
  });

  it('eine unauflösbare Unter-Auswahl mitten unter den Geschwistern einer Einheit verschiebt nichts', () => {
    const result = evaluateRoster(appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-warrior', WARRIOR_ID, [
          selection('sel-opt-gone', 'opt-vanished'),
          selection('sel-sword', SWORD_ID),
          selection('sel-shield', SHIELD_ID),
        ]),
        selection('sel-beta', BETA_ID),
      ]),
    ]));
    expectUnresolved(result, ['opt-vanished']);

    expect(result.slots.pathBySelectionId.has('sel-opt-gone')).toBe(false);
    expect(capabilityFor(result, 'sel-warrior')).toMatchObject({ defId: WARRIOR_ID, name: 'Warrior' });
    expect(capabilityFor(result, 'sel-sword')).toMatchObject({
      defId: SWORD_ID,
      name: 'Sword',
      costs: { [COST_TYPE_ID]: SWORD_POINTS },
    });
    expect(capabilityFor(result, 'sel-shield')).toMatchObject({
      defId: SHIELD_ID,
      name: 'Shield',
      costs: { [COST_TYPE_ID]: SHIELD_POINTS },
    });
    // Das Geschwister der Eltern-Ebene bleibt ebenfalls richtig zugeordnet.
    expect(capabilityFor(result, 'sel-beta')).toMatchObject({ defId: BETA_ID, name: 'Beta' });
  });

  it('mehrere unauflösbare Auswahlen unter denselben Geschwistern verschieben nichts', () => {
    const result = evaluateRoster(appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-gone-1', 'entry-vanished-1'),
        selection('sel-alpha', ALPHA_ID),
        selection('sel-gone-2', 'entry-vanished-2'),
        selection('sel-beta', BETA_ID),
      ]),
    ]));
    expectUnresolved(result, ['entry-vanished-1', 'entry-vanished-2']);

    expect(result.slots.pathBySelectionId.has('sel-gone-1')).toBe(false);
    expect(result.slots.pathBySelectionId.has('sel-gone-2')).toBe(false);
    expect(capabilityFor(result, 'sel-alpha')).toMatchObject({ defId: ALPHA_ID, name: 'Alpha' });
    expect(capabilityFor(result, 'sel-beta')).toMatchObject({ defId: BETA_ID, name: 'Beta' });
  });

  it('als letztes Geschwister hat die unauflösbare Auswahl ebenfalls keinen Pfad (Rand: nichts folgt ihr)', () => {
    const result = evaluateRoster(appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-alpha', ALPHA_ID),
        selection('sel-gone', 'entry-vanished'),
      ]),
    ]));
    expectUnresolved(result, ['entry-vanished']);

    expect(result.slots.pathBySelectionId.has('sel-gone')).toBe(false);
    expect(capabilityFor(result, 'sel-alpha')).toMatchObject({ defId: ALPHA_ID, name: 'Alpha' });
  });

  it('ein unauflösbares Kontingent nimmt seinen Auswahlen den Pfad, das folgende Kontingent bleibt richtig', () => {
    const result = evaluateRoster(appRoster([
      force('force-vanished', [selection('sel-in-gone-force', ALPHA_ID)]),
      force(SECOND_FORCE_DEF_ID, [selection('sel-beta', BETA_ID)]),
    ]));
    expectUnresolved(result, ['force-vanished']);

    expect(result.slots.pathBySelectionId.has('sel-in-gone-force')).toBe(false);
    expect(capabilityFor(result, 'sel-beta')).toMatchObject({
      defId: BETA_ID,
      name: 'Beta',
      costs: { [COST_TYPE_ID]: BETA_POINTS },
    });
  });

  it('kein gefuehrter Pfad zeigt auf einen fremden oder leeren Slot (Invariante ueber den ganzen Bestand)', () => {
    const result = evaluateRoster(appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-gone', 'entry-vanished', [selection('sel-gone-child', SWORD_ID)]),
        selection('sel-warrior', WARRIOR_ID, [
          selection('sel-opt-gone', 'opt-vanished'),
          selection('sel-sword', SWORD_ID),
        ]),
        selection('sel-beta', BETA_ID),
      ]),
    ]));
    expectUnresolved(result, ['entry-vanished', 'opt-vanished']);

    const expectedDefIdBySelectionId = {
      'sel-warrior': WARRIOR_ID,
      'sel-sword': SWORD_ID,
      'sel-beta': BETA_ID,
    };
    // Genau die aufloesbaren Auswahlen haben einen Pfad …
    expect([...result.slots.pathBySelectionId.keys()].sort()).toEqual(Object.keys(expectedDefIdBySelectionId).sort());
    // … und jeder Pfad fuehrt zu dem belegten Slot genau dieser Auswahl.
    for (const [selectionId, defId] of Object.entries(expectedDefIdBySelectionId)) {
      expect(capabilityFor(result, selectionId), selectionId).toMatchObject({ defId, anchorKind: 'occupied' });
    }
  });
});

describe('Ohne unauflösbare Auswahl bleibt die Zuordnung wie heute (Regressionsschutz)', () => {
  it('jede Auswahl aller Ebenen zeigt auf ihren eigenen belegten Slot', () => {
    const result = evaluateRoster(appRoster([
      force(FORCE_DEF_ID, [
        selection('sel-alpha', ALPHA_ID),
        selection('sel-warrior', WARRIOR_ID, [
          selection('sel-sword', SWORD_ID),
          selection('sel-shield', SHIELD_ID),
        ]),
        selection('sel-beta', BETA_ID),
      ]),
    ]));

    expect(result.diagnostics).toEqual([]);
    expect(capabilityFor(result, 'sel-alpha')).toMatchObject({ defId: ALPHA_ID, name: 'Alpha' });
    expect(capabilityFor(result, 'sel-warrior')).toMatchObject({ defId: WARRIOR_ID, name: 'Warrior' });
    expect(capabilityFor(result, 'sel-sword')).toMatchObject({ defId: SWORD_ID, name: 'Sword' });
    expect(capabilityFor(result, 'sel-shield')).toMatchObject({ defId: SHIELD_ID, name: 'Shield' });
    expect(capabilityFor(result, 'sel-beta')).toMatchObject({ defId: BETA_ID, name: 'Beta' });
  });
});
