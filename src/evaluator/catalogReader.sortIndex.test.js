/**
 * Issue 0130, Kriterien 1-2 — der XML-Leser (`catalogReader.js`) liest das
 * katalogweite Community-Attribut `sortIndex` an `selectionEntry`,
 * `selectionEntryGroup` und `entryLink` (nicht Teil der vendored
 * `Catalogue.xsd`, siehe `docs/battlescribe-data-format.md`). Es ist rein
 * deskriptiv (keine Grenze, kein Gültigkeits-Urteil) und wird als **Zahl**
 * geführt, nie als Roh-String:
 *
 * - Kriterium 1: gelesen an allen drei Elementarten.
 * - Kriterium 2: fehlt das Attribut oder ist es nicht numerisch, gilt das als
 *   "kein sortIndex" — kein Fehler, keine Diagnose, kein Ablehnen des
 *   Katalogs. Vorhandene Werte werden von String zu Zahl konvertiert
 *   (Grenzfall: negative Werte sind numerisch und damit ein gültiger
 *   sortIndex, "0" ist numerisch und gültig trotz seines falsy-Zahlenwerts).
 *
 * Test-first gegen `parseCatalogue` direkt (Muster: `catalogReader.limitField.test.js`,
 * `catalogReader.datasetMetadata.test.js`) — die Zuordnung Attribut → Feld,
 * unabhängig vom Rest der Auswertungs-Pipeline.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

/** Ein Katalog mit einem einzelnen Wurzel-`selectionEntry`, das die gegebenen Kinder trägt. */
function catalogueWithEntryChildren(entryAttributes, entryChildrenXml = '') {
  return `<?xml version="1.0"?>
    <catalogue id="cat" name="Cat">
      <selectionEntries>
        <selectionEntry id="entry" name="Entry" ${entryAttributes}>
          ${entryChildrenXml}
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

describe('parseCatalogue: sortIndex an selectionEntry (Issue 0130, Kriterium 1)', () => {
  it('liest ein vorhandenes sortIndex als Zahl, nicht als String', () => {
    const xml = catalogueWithEntryChildren('sortIndex="4"');

    const entry = parseCatalogue(xml).entries[0];

    expect(entry.sortIndex).toBe(4);
    expect(typeof entry.sortIndex).toBe('number');
  });

  it('fehlt das Attribut, gilt das als "kein sortIndex" (Kriterium 2) — kein Fehler, keine Diagnose', () => {
    const xml = catalogueWithEntryChildren('');

    const result = parseCatalogue(xml);

    expect(result.entries[0].sortIndex).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });

  it('ein nicht-numerischer Wert gilt als "kein sortIndex", der Katalog bleibt lesbar', () => {
    const xml = catalogueWithEntryChildren('sortIndex="abc"');

    const result = parseCatalogue(xml);

    expect(result.entries[0].sortIndex).toBeNull();
    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toHaveLength(1);
  });

  it('ein leerer sortIndex-Wert gilt ebenso als "kein sortIndex"', () => {
    const xml = catalogueWithEntryChildren('sortIndex=""');

    expect(parseCatalogue(xml).entries[0].sortIndex).toBeNull();
  });

  it('ein negativer sortIndex ist numerisch und damit ein gültiger Wert (kein "nicht-numerisch")', () => {
    const xml = catalogueWithEntryChildren('sortIndex="-3"');

    expect(parseCatalogue(xml).entries[0].sortIndex).toBe(-3);
  });

  it('sortIndex="0" ist gültig (nicht "kein sortIndex" trotz falsy-Zahlenwert)', () => {
    const xml = catalogueWithEntryChildren('sortIndex="0"');

    const entry = parseCatalogue(xml).entries[0];

    expect(entry.sortIndex).toBe(0);
    expect(entry.sortIndex).not.toBeNull();
  });
});

describe('parseCatalogue: sortIndex an selectionEntryGroup (Issue 0130, Kriterium 1)', () => {
  it('liest ein vorhandenes sortIndex einer Gruppe als Zahl', () => {
    const xml = `<?xml version="1.0"?>
      <catalogue id="cat" name="Cat">
        <selectionEntryGroups>
          <selectionEntryGroup id="grp" name="Group" sortIndex="2"/>
        </selectionEntryGroups>
      </catalogue>`;

    const group = parseCatalogue(xml).entries[0];

    expect(group.sortIndex).toBe(2);
  });

  it('eine Gruppe ohne sortIndex führt null, kein Fehler', () => {
    const xml = `<?xml version="1.0"?>
      <catalogue id="cat" name="Cat">
        <selectionEntryGroups>
          <selectionEntryGroup id="grp" name="Group"/>
        </selectionEntryGroups>
      </catalogue>`;

    const result = parseCatalogue(xml);

    expect(result.entries[0].sortIndex).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });
});

describe('parseCatalogue: sortIndex an entryLink (Issue 0130, Kriterium 1)', () => {
  it('liest ein vorhandenes sortIndex eines Verweises als Zahl', () => {
    const xml = `<?xml version="1.0"?>
      <catalogue id="cat" name="Cat">
        <entryLinks>
          <entryLink id="link" name="Link" targetId="target" sortIndex="1"/>
        </entryLinks>
      </catalogue>`;

    const link = parseCatalogue(xml).entries[0];

    expect(link.sortIndex).toBe(1);
  });

  it('ein Verweis ohne sortIndex führt null, kein Fehler', () => {
    const xml = `<?xml version="1.0"?>
      <catalogue id="cat" name="Cat">
        <entryLinks>
          <entryLink id="link" name="Link" targetId="target"/>
        </entryLinks>
      </catalogue>`;

    const result = parseCatalogue(xml);

    expect(result.entries[0].sortIndex).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });

  it('ein nicht-numerischer sortIndex an einem Verweis gilt als "kein sortIndex"', () => {
    const xml = `<?xml version="1.0"?>
      <catalogue id="cat" name="Cat">
        <entryLinks>
          <entryLink id="link" name="Link" targetId="target" sortIndex="abc"/>
        </entryLinks>
      </catalogue>`;

    const result = parseCatalogue(xml);

    expect(result.entries[0].sortIndex).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });
});
