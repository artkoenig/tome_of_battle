/**
 * Der eine **Rueckfall** der Info-Projektion (`infoProjection.js`, Issue 0173):
 * traegt ein Slot ueberhaupt keinen Regeltext, gilt die *gleichnamige* Regel
 * seines eigenen Katalogs.
 *
 * Der Korpus fuehrt Regeln, die kein `infoLink` je erreicht — ein Armeebuch legt
 * den Text eines magischen Gegenstands als gleichnamige geteilte Regel ab und
 * verlinkt sie nicht. Der Anker ist die **Gleichheit** von Namen innerhalb eines
 * bekannten Katalogs, nie eine Aehnlichkeit: erst der Katalog, der die Definition
 * des Slots deklariert, dann das Spielsystem, dann der Rest.
 *
 * Seit Issue 0173 traegt der Bericht diesen Rueckfall, nicht die Oberflaeche:
 * Detailblock und Chips lesen ihn aus derselben Quelle
 * (`ui/viewmodels/editor/upgradeDetailElements.js`).
 */

import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate as evaluateDataset } from '../../../../contexts/ruleengine/evaluator.js';
import { PreparedDataset, prepareDataset } from '../../../../contexts/ruleengine/engine/datasetPreparation.js';
import { AnchorKind, InfoElementKind } from '../../../../contexts/ruleengine/engine/model.js';
import { createNamedRuleRegistry } from '../../../../contexts/ruleengine/engine/infoProjection.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-1" name="Buch" gameSystemId="gst-1" library="false"
  xmlns="http://www.battlescribe.net/schema/catalogueSchema">
  <sharedRules>
    <rule id="sr-1" name="Frostklinge"><description>Kalt.</description></rule>
    <rule id="sr-2" name="Ohne Text"/>
  </sharedRules>
  <selectionEntries>
    <selectionEntry id="e-1" name="Frostklinge" type="upgrade"/>
    <selectionEntry id="e-2" name="Frostklinge" type="upgrade">
      <rules>
        <rule id="r-eigen" name="Frostklinge"><description>Eigener Text.</description></rule>
      </rules>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="gst-1" name="System" xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
  <sharedRules>
    <rule id="gst-r-1" name="Frostklinge"><description>Aus dem Spielsystem.</description></rule>
    <rule id="gst-r-2" name="Nur im System"><description>Systemtext.</description></rule>
  </sharedRules>
</gameSystem>`;

const registryOf = (dataset) => {
  const { gameSystemDocument, catalogueDocuments, sourceIdByDefId } = PreparedDataset.contentsOf(dataset);
  const documents = gameSystemDocument === null
    ? catalogueDocuments
    : [gameSystemDocument, ...catalogueDocuments];
  return createNamedRuleRegistry(documents, {
    gameSystemId: gameSystemDocument?.id ?? null,
    sourceIdByDefId,
  });
};

describe('createNamedRuleRegistry', () => {
  it('findet die gleichnamige Regel des Katalogs, der die Definition des Slots deklariert', () => {
    const registry = registryOf(prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] }));

    expect(registry.namedRuleFor({ id: 'e-1' }, 'Frostklinge')).toMatchObject({ id: 'sr-1', text: 'Kalt.' });
  });

  it('vergleicht auf Gleichheit — Schreibung und Rand duerfen abweichen, der Name nicht', () => {
    const registry = registryOf(prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] }));

    expect(registry.namedRuleFor({ id: 'e-1' }, '  frostklinge ')).toMatchObject({ id: 'sr-1' });
    expect(registry.namedRuleFor({ id: 'e-1' }, 'Die grosse Frostklinge')).toBeNull();
    expect(registry.namedRuleFor({ id: 'e-1' }, '')).toBeNull();
  });

  it('nimmt das Spielsystem erst, wo der eigene Katalog die Regel nicht kennt', () => {
    const registry = registryOf(prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] }));

    expect(registry.namedRuleFor({ id: 'e-1' }, 'Nur im System')).toMatchObject({ id: 'gst-r-2' });
  });

  it('ohne Dokumente gibt es keinen Rueckfall', () => {
    expect(createNamedRuleRegistry([]).namedRuleFor({ id: 'e-1' }, 'Frostklinge')).toBeNull();
  });
});

describe('der Regel-Rueckfall am eingefrorenen Korpus', () => {
  // __fixtures__ bleibt neben der Quelle in src/contexts/ruleengine/engine/, nicht mit den Tests verschoben.
  const FIXTURE_DIR = path.resolve(__dirname, '../../../../contexts/ruleengine/engine/__fixtures__/whfb6-definitive');
  const GST = 'Warhammer Fantasy Battles (6th definitive edition).gst';
  const CAT = 'Vampire Counts (6th definitive edition).cat';

  /** Der Korpus wird einmal je Datei gelesen — der Parse dominiert die Laufzeit. */
  let prepared = null;
  const vampireCounts = () => {
    prepared ??= prepareDataset({
      gameSystem: fs.readFileSync(path.join(FIXTURE_DIR, GST), 'utf8'),
      catalogues: [fs.readFileSync(path.join(FIXTURE_DIR, CAT), 'utf8')],
    });
    return prepared;
  };

  it('erreicht die vier unverlinkten Regeln des Vampirfuersten-Buchs', () => {
    const dataset = vampireCounts();
    const named = registryOf(dataset);
    // Irgendeine Definition dieses Buchs genuegt: der Herkunftsindex fuehrt von
    // ihr auf den Katalog, in dem der Rueckfall zuerst sucht.
    const def = { id: PreparedDataset.contentsOf(dataset).catalogueDocuments[0].entries[0].id };

    expect(named.namedRuleFor(def, 'Frostblade')?.text).toEqual(expect.stringContaining('FROSTBLADE'));
    for (const name of ['Bloodlines', 'Special Characters', 'Experimental rules']) {
      expect(named.namedRuleFor(def, name)?.text, name).toEqual(expect.any(String));
    }
  });
});

describe('der Rueckfall im Bericht', () => {
  /** Die Info-Projektion des belegten Slots dieser Definition. */
  const infoElementsOfSlot = (defId) => {
    const report = evaluateDataset(
      prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] }),
      { forces: [{ defId, count: 1, children: [] }] },
    );
    for (const capability of report.capabilities.values()) {
      if (capability.defId === defId && capability.anchorKind === AnchorKind.OCCUPIED) {
        return capability.infoElements;
      }
    }
    return [];
  };

  it('traegt die gleichnamige Regel als Regel-Element des Slots ein — ohne Buchquelle', () => {
    expect(infoElementsOfSlot('e-1')).toEqual([{
      kind: InfoElementKind.RULE,
      id: 'sr-1',
      name: 'Frostklinge',
      // Die Regel haengt an keinem Traeger dieses Slots und nennt fuer ihn
      // deshalb auch keine Buchquelle.
      source: null,
      text: 'Kalt.',
    }]);
  });

  it('greift nicht, wo der Slot einen eigenen Regeltext traegt', () => {
    expect(infoElementsOfSlot('e-2').map(element => element.text)).toEqual(['Eigener Text.']);
  });
});
