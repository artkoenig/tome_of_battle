/**
 * Datensatz-Metadaten des XML-Lesers (`catalogReader.js`, Main-Issue 75, Slice 01):
 * die Angaben der Katalogwurzel, die **ohne Roster** gebraucht werden (ADR-0034) —
 * die Kostenart-Deklarationen (`costTypes`), das `library`-Kennzeichen und die
 * Sichtbarkeit einer Kontingent-Definition. Alle drei stammen unmittelbar aus den
 * Katalogdaten; keine Namensliste, keine Heuristik.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const POINTS_COST_TYPE_ID = 'ecfa-8486-4f6c-c249';
const DICE_COST_TYPE_ID = 'fcec-2340-6368-a2ba';
const GAME_SYSTEM_ID = '0d13-7737-ea86-4662';

/** Ein Katalog mit den gegebenen Wurzel-Attributen und Wurzel-Kindern. */
function catalogueXml(rootAttributes, rootChildren = '') {
  return `<?xml version="1.0"?>
    <catalogue id="cat" name="Cat" gameSystemId="${GAME_SYSTEM_ID}" ${rootAttributes}>
      ${rootChildren}
    </catalogue>`;
}

describe('parseCatalogue: Kostenart-Deklarationen der Wurzel', () => {
  it('liest ID, Klartext-Name, Vorgabe-Grenze und Sichtbarkeit je Kostenart', () => {
    const xml = catalogueXml('', `
      <costTypes>
        <costType id="${POINTS_COST_TYPE_ID}" name="pts" defaultCostLimit="2000" hidden="false"/>
        <costType id="${DICE_COST_TYPE_ID}" name=" Casting Dice" defaultCostLimit="-1" hidden="true"/>
      </costTypes>`);

    expect(parseCatalogue(xml).costTypes).toEqual([
      { id: POINTS_COST_TYPE_ID, name: 'pts', defaultLimit: 2000, isHidden: false },
      { id: DICE_COST_TYPE_ID, name: ' Casting Dice', defaultLimit: null, isHidden: true },
    ]);
  });

  it('bildet die Katalog-Vorgabe -1 auf "keine Vorgabe-Grenze" ab statt auf die Zahl -1', () => {
    const xml = catalogueXml('', `
      <costTypes><costType id="${POINTS_COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>`);

    expect(parseCatalogue(xml).costTypes[0].defaultLimit).toBeNull();
  });

  it('faellt ohne deklarierte Attribute auf die XSD-Vorgaben zurueck (keine Grenze, sichtbar)', () => {
    const xml = catalogueXml('', `
      <costTypes><costType id="${POINTS_COST_TYPE_ID}" name="pts"/></costTypes>`);

    expect(parseCatalogue(xml).costTypes[0]).toEqual({
      id: POINTS_COST_TYPE_ID,
      name: 'pts',
      defaultLimit: null,
      isHidden: false,
    });
  });

  it('liefert fuer einen Katalog ohne <costTypes> eine leere Liste', () => {
    expect(parseCatalogue(catalogueXml('')).costTypes).toEqual([]);
  });
});

describe('parseCatalogue: library-Kennzeichen der Wurzel', () => {
  it('liest library="true" als reine Bibliothek', () => {
    expect(parseCatalogue(catalogueXml('library="true"')).isLibrary).toBe(true);
  });

  it('liest library="false" als spielbaren Katalog', () => {
    expect(parseCatalogue(catalogueXml('library="false"')).isLibrary).toBe(false);
  });

  it('faellt ohne Attribut auf die XSD-Vorgabe "kein Bibliotheks-Katalog" zurueck', () => {
    expect(parseCatalogue(catalogueXml('')).isLibrary).toBe(false);
  });

  it('liest eine Spielsystemdatei, die das Attribut gar nicht kennt, als keine Bibliothek', () => {
    const gst = `<?xml version="1.0"?><gameSystem id="${GAME_SYSTEM_ID}" name="System"/>`;

    expect(parseCatalogue(gst).isLibrary).toBe(false);
  });
});

describe('parseCatalogue: Sichtbarkeit einer Kontingent-Definition', () => {
  it('liest das hidden-Attribut eines forceEntry', () => {
    const xml = catalogueXml('', `
      <forceEntries>
        <forceEntry id="force-visible" name="Standard" hidden="false"/>
        <forceEntry id="force-hidden" name="[WIP] Horde" hidden="true"/>
      </forceEntries>`);

    expect(parseCatalogue(xml).forces.map(force => [force.id, force.isHidden])).toEqual([
      ['force-visible', false],
      ['force-hidden', true],
    ]);
  });

  it('faellt ohne Attribut auf die XSD-Vorgabe "sichtbar" zurueck', () => {
    const xml = catalogueXml('', '<forceEntries><forceEntry id="force" name="Standard"/></forceEntries>');

    expect(parseCatalogue(xml).forces[0].isHidden).toBe(false);
  });
});
