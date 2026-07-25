import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluator.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen
// Evaluator-Tests). Der eigene XML-Leser der Engine nutzt genau dieses Primitiv.
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// ── Eigene, minimale Fixtures (ADR-0030: eigenes Datenmodell, eigene Fixtures) ──
// Slice 06: Phantomknoten als Anker fuer Pflicht-Absenz (Ogerbullen-Fall). Ein
// armee- bzw. kontingentweiter Pflichteintrag, der fehlt, muss eine MIN-Verletzung
// an einem Phantomknoten erzeugen — der Phantom zaehlt dabei 0.

const OGRE_DEF_ID = 'entry-ogre-bulls';
const OGRE_NAME = 'Ogerbullen';
const WARRIOR_DEF_ID = 'entry-warrior';
const DETACHMENT_FORCE_ID = 'force-detachment';
const MIN_OGRE_LIMIT_ID = 'min-ogre-bulls';

describe('Phantomknoten: armeeweite Pflicht-Absenz (scope=roster)', () => {
  const MIN_OGRE = 2;
  // Ein armeeweiter Pflichteintrag (mind. 2 Ogerbullen im Roster) plus ein
  // gewoehnlicher Eintrag ohne Grenze, der die Absenz nicht heilt.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-phantom-roster" name="Phantom Roster Catalogue">
      <selectionEntries>
        <selectionEntry id="${OGRE_DEF_ID}" name="${OGRE_NAME}" type="unit">
          <constraints>
            <constraint id="${MIN_OGRE_LIMIT_ID}" type="min" value="${MIN_OGRE}" field="selections" scope="roster"/>
          </constraints>
        </selectionEntry>
        <selectionEntry id="${WARRIOR_DEF_ID}" name="Warrior" type="unit"/>
      </selectionEntries>
    </catalogue>`;

  it('erzeugt eine MIN-Verletzung an einem Phantomknoten, wenn der Pflichteintrag ganz fehlt', () => {
    // Roster ohne Ogerbullen, nur Warriors.
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: WARRIOR_DEF_ID, count: 3, children: [] }] });

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toEqual({
      limitId: MIN_OGRE_LIMIT_ID,
      anchor: { defId: OGRE_DEF_ID, name: OGRE_NAME },
      // actual === 0 beweist zugleich: der Phantom zaehlt 0. Zaehlte er als eine
      // Ogerbullen-Instanz mit, waere actual === 1 und die Grenze naeher erfuellt.
      actual: 0,
      bound: MIN_OGRE,
      delta: MIN_OGRE,
    });
  });

  it('meldet keine Verletzung, wenn der Pflichteintrag in ausreichender Zahl vorhanden ist', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [
        { defId: OGRE_DEF_ID, count: MIN_OGRE, children: [] },
        { defId: WARRIOR_DEF_ID, count: 3, children: [] },
      ],
    });

    expect(report.violations).toHaveLength(0);
  });

  it('schlaegt bei vorhandenem, aber zu kleinem Eintrag am realen Knoten an — kein zusaetzlicher Phantom', () => {
    // count=1 < MIN=2: der Eintrag ist vorhanden, also entsteht kein Phantom;
    // die Verletzung kommt vom realen Knoten und traegt dessen Ist-Wert (1, nicht 0).
    const report = evaluate(CATALOGUE_XML, { forces: [{ defId: OGRE_DEF_ID, count: 1, children: [] }] });

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].actual).toBe(1);
    expect(report.violations[0].bound).toBe(MIN_OGRE);
  });
});

describe('Phantomknoten: je-Kontingent Pflicht-Absenz (scope=force)', () => {
  // Pflichteintrag pro Kontingent: jedes Kontingent muss mindestens einen
  // Ogerbullen fuehren. Fehlt er in einem Kontingent, schlaegt die Grenze an
  // einem Phantom in genau diesem Kontingent an.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-phantom-force" name="Phantom Force Catalogue">
      <forceEntries>
        <forceEntry id="${DETACHMENT_FORCE_ID}" name="Detachment"/>
      </forceEntries>
      <selectionEntries>
        <selectionEntry id="${OGRE_DEF_ID}" name="${OGRE_NAME}" type="unit">
          <constraints>
            <constraint id="${MIN_OGRE_LIMIT_ID}" type="min" value="1" field="selections" scope="force"/>
          </constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;

  /** Ein Kontingent-Instanz mit gegebenen Kind-Auswahlen. */
  function detachment(children) {
    return { defId: DETACHMENT_FORCE_ID, count: 1, children };
  }

  /** Eine Ogerbullen-Auswahl gegebener Anzahl. */
  function ogres(count) {
    return { defId: OGRE_DEF_ID, count, children: [] };
  }

  it('erkennt die Absenz je Kontingent: nur das Kontingent ohne Pflichteintrag wird verletzt', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [
        detachment([ogres(1)]), // Kontingent A: fuehrt einen Ogerbullen
        detachment([]),          // Kontingent B: keiner → Phantom-Verletzung
      ],
    });

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toEqual({
      limitId: MIN_OGRE_LIMIT_ID,
      anchor: { defId: OGRE_DEF_ID, name: OGRE_NAME },
      actual: 0,
      bound: 1,
      delta: 1,
    });
  });

  it('meldet je Kontingent eine eigene Verletzung, wenn der Pflichteintrag ueberall fehlt', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [detachment([]), detachment([])],
    });

    expect(report.violations).toHaveLength(2);
    for (const violation of report.violations) {
      expect(violation).toMatchObject({ limitId: MIN_OGRE_LIMIT_ID, actual: 0, bound: 1 });
    }
  });

  it('meldet keine Verletzung, wenn jedes Kontingent den Pflichteintrag fuehrt', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [detachment([ogres(1)]), detachment([ogres(2)])],
    });

    expect(report.violations).toHaveLength(0);
  });
});

describe('Phantomknoten: Pflicht-Kontingent (Grenze an der Kontingent-Definition, §3.2)', () => {
  const MANDATORY_FORCE_ID = 'force-mandatory-detachment';
  const OTHER_FORCE_ID = 'force-other';
  const FORCE_MIN_LIMIT_ID = 'min-mandatory-detachment';
  // Eine min-Grenze AN der Kontingent-Definition (Grenze am Force-Typ, §3.2): das
  // Roster muss mindestens ein Kontingent dieses Typs fuehren.
  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-phantom-forcetype" name="Phantom Force-Type Catalogue">
      <forceEntries>
        <forceEntry id="${MANDATORY_FORCE_ID}" name="Mandatory Detachment">
          <constraints>
            <constraint id="${FORCE_MIN_LIMIT_ID}" type="min" value="1" field="selections" scope="roster"/>
          </constraints>
        </forceEntry>
        <forceEntry id="${OTHER_FORCE_ID}" name="Other Detachment"/>
      </forceEntries>
    </catalogue>`;

  it('meldet keine Verletzung, wenn das Pflicht-Kontingent vorhanden ist (kein Fehlalarm)', () => {
    // Regression: ein vorhandenes Kontingent muss unter seiner eigenen
    // Definitions-ID zaehlen (actual=1), nicht faelschlich actual=0 lesen.
    const report = evaluate(CATALOGUE_XML, {
      forces: [{ defId: MANDATORY_FORCE_ID, count: 1, children: [] }],
    });

    expect(report.violations).toHaveLength(0);
  });

  it('erzeugt eine MIN-Verletzung an einem Phantom, wenn das Pflicht-Kontingent fehlt', () => {
    const report = evaluate(CATALOGUE_XML, {
      forces: [{ defId: OTHER_FORCE_ID, count: 1, children: [] }],
    });

    expect(report.violations).toHaveLength(1);
    expect(report.violations[0]).toMatchObject({
      limitId: FORCE_MIN_LIMIT_ID,
      actual: 0,
      bound: 1,
      delta: 1,
    });
  });
});
