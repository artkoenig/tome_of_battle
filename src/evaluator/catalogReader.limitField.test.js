/**
 * Feld-Abbildung des XML-Lesers (`catalogReader.js:readField`, Main-Issue 70,
 * Slice 02): das `field`-Attribut einer Grenze/Bedingung wird auf das
 * engine-eigene Feld abgebildet. `"selections"` → Selektionsanzahl, ein
 * `limit::<id>`-Praefix → die **eingestellte Kostengrenze** (`LIMIT_VALUE`), jede
 * andere ID → die verplante Kostensumme (`COST_SUM`). Der Praefix-Test darf keine
 * echte Kostenart-ID faelschlich als Budget-Feld lesen (Risiko „Praefix-Kollision").
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { CountedFieldKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const POINTS_COST_TYPE_ID = 'ecfa-8486-4f6c-c249';
const OTHER_COST_TYPE_ID = 'fcec-2340-6368-a2ba';
// Eine Kostenart-ID, die zwar mit „limit" beginnt, aber **nicht** das `limit::`-
// Praefix traegt — sie darf nicht faelschlich als Budget-Feld gelesen werden.
const LOOKALIKE_COST_TYPE_ID = 'limitless-abcd-0001';

/** Baut einen Katalog mit je einer Grenze pro `field`-Wert und liefert deren Felder je Grenz-Id. */
function fieldsByConstraintId(...fieldAttrs) {
  const constraints = fieldAttrs
    .map((field, i) => `<constraint id="c${i}" type="min" value="1" field="${field}" scope="roster"/>`)
    .join('');
  const xml = `<?xml version="1.0"?>
    <catalogue id="cat" name="Cat">
      <selectionEntries>
        <selectionEntry id="entry" name="Entry">
          <constraints>${constraints}</constraints>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
  const entry = parseCatalogue(xml).entries[0];
  return new Map(entry.limits.map(limit => [limit.id, limit.field]));
}

describe('readField: field-Attribut → engine-eigenes Feld', () => {
  it('bildet "selections" auf die Selektionsanzahl ab', () => {
    const fields = fieldsByConstraintId('selections');

    expect(fields.get('c0')).toMatchObject({ kind: CountedFieldKind.SELECTION_COUNT });
    expect(fields.get('c0').costTypeId).toBeUndefined();
  });

  it('bildet ein limit::<id>-Praefix auf LIMIT_VALUE der Kostenart ab', () => {
    const fields = fieldsByConstraintId(`limit::${POINTS_COST_TYPE_ID}`);

    expect(fields.get('c0')).toEqual({
      kind: CountedFieldKind.LIMIT_VALUE,
      costTypeId: POINTS_COST_TYPE_ID,
    });
  });

  it('bildet eine blosse Kostenart-ID auf COST_SUM ab (verplante Summe)', () => {
    const fields = fieldsByConstraintId(OTHER_COST_TYPE_ID);

    expect(fields.get('c0')).toEqual({
      kind: CountedFieldKind.COST_SUM,
      costTypeId: OTHER_COST_TYPE_ID,
    });
  });

  it('faengt keine ID faelschlich ab, die nur mit "limit" beginnt (Praefix-Kollision)', () => {
    const fields = fieldsByConstraintId(LOOKALIKE_COST_TYPE_ID);

    expect(fields.get('c0')).toEqual({
      kind: CountedFieldKind.COST_SUM,
      costTypeId: LOOKALIKE_COST_TYPE_ID,
    });
  });
});
