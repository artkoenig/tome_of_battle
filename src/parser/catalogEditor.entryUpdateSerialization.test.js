import { describe, test, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { updateRawXml } from './catalogEditor.js';

// JSDOM stellt DOMParser und XMLSerializer für den Node-Testlauf bereit.
beforeAll(() => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
});

describe('updateRawXml — Rückschreiben geänderter Einträge ins rohe XML', () => {
  const ENTRY_ID = 'unit-thrall';
  const NEW_NAME = 'Vampire Thrall Elite';
  const NEW_POINTS = 95;
  const CONSTRAINT_ID = 'max-thralls';
  const NEW_CONSTRAINT_VALUE = 4;

  function createSystemWithRawCatalogue() {
    return {
      rawXmls: {
        cat: [{
          name: 'vampires.cat',
          content: `
<selectionEntry id="${ENTRY_ID}" name="Vampire Thrall">
  <costs>
    <cost typeId="pts" value="80" />
  </costs>
  <constraints>
    <constraint id="${CONSTRAINT_ID}" type="max" value="3" />
  </constraints>
</selectionEntry>
`
        }]
      }
    };
  }

  function updatedCatalogueXml() {
    const system = createSystemWithRawCatalogue();

    updateRawXml(system, {
      entryId: ENTRY_ID,
      type: 'entry',
      patch: {
        name: NEW_NAME,
        costs: { pts: NEW_POINTS },
        constraints: { [CONSTRAINT_ID]: NEW_CONSTRAINT_VALUE },
      },
    });

    return system.rawXmls.cat[0].content;
  }

  test('schreibt den geänderten Namen in das Attribut zurück', () => {
    expect(updatedCatalogueXml()).toContain(`name="${NEW_NAME}"`);
  });

  test('schreibt die geänderten Punktkosten zurück', () => {
    expect(updatedCatalogueXml()).toContain(`typeId="pts" value="${NEW_POINTS}"`);
  });

  test('schreibt den geänderten Constraint-Wert zurück', () => {
    expect(updatedCatalogueXml()).toContain(`id="${CONSTRAINT_ID}" type="max" value="${NEW_CONSTRAINT_VALUE}"`);
  });
});
