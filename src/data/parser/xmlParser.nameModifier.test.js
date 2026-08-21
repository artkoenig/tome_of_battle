import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogueXML } from './xmlParser.js';

// JSDOM stellt DOMParser fuer den Node-Testlauf bereit (wie in den uebrigen Parser-Tests).
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

// NBSP-umschlossenes „+" — der reale Dogs-of-War-join-Wert. Muss verbatim erhalten
// bleiben und darf nicht zu einem Leerzeichen normalisiert werden.
const NBSP = ' ';
const JOIN_VALUE = `${NBSP} + ${NBSP}`;

const catalogueXml = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-join-test" name="Join Test" gameSystemId="sys">
  <sharedSelectionEntries>
    <selectionEntry id="entry-relic" name="Relic" type="upgrade">
      <modifiers>
        <modifier type="append" field="name" value="Relics of Lustria" join="${JOIN_VALUE}">
          <conditions>
            <condition type="atLeast" value="1" field="selections" scope="parent" childId="entry-x"/>
          </conditions>
        </modifier>
        <modifier type="set" field="name" value="Halberdier"/>
      </modifiers>
    </selectionEntry>
  </sharedSelectionEntries>
</catalogue>`;

describe('xmlParser: field="name"-Modifier mit join-Attribut', () => {
  const parsed = parseCatalogueXML(catalogueXml);
  const entry = parsed.sharedSelectionEntries.find(e => e.id === 'entry-relic');
  const appendMod = entry.modifiers.find(m => m.type === 'append');
  const setMod = entry.modifiers.find(m => m.type === 'set');

  it('liest den join-Wert verbatim (NBSP-umschlossenes "+")', () => {
    expect(appendMod.join).toBe(JOIN_VALUE);
  });

  it('erfasst field und value des Namens-Modifiers', () => {
    expect(appendMod.field).toBe('name');
    expect(appendMod.value).toBe('Relics of Lustria');
  });

  it('setzt join auf null, wenn das Attribut fehlt', () => {
    expect(setMod.join).toBeNull();
  });
});
