/**
 * `SlotIndex` — das Wertobjekt der Slot-Seite des Berichts (Issue 0170).
 *
 * Geprueft wird dreierlei: dass die Lookups, die frueher `slotLookups.js`
 * einzeln fuehrte, als Methoden dieselben Antworten geben; dass
 * {@link SlotIndex.fromMaps} einen Index aus handgebauten Karten baut (die eine
 * Naht, ueber die jedes Fixture geht); und dass genau diese Naht ein Fixture
 * zurueckweist, dem ein von der Anzeige gelesenes Slot-Feld fehlt — statt es
 * drei Schichten spaeter still als `false` zu beantworten.
 */

import { describe, it, expect } from 'vitest';

import { SlotIndex, EMPTY_SLOT_INDEX } from '../../../domain/evaluation/slotIndex.js';

const CATEGORY = 'cat-core';

/** Ein vollstaendiger Slot-Datensatz in der Form, die der Bericht liefert. */
const slot = (over = {}) => ({
  anchorKind: 'occupied',
  defId: 'def-1',
  targetDefId: null,
  name: 'Slot',
  isHidden: false,
  isIndependentSubUnit: false,
  primaryCategoryId: null,
  ...over,
});

const indexOf = (entries, paths = {}) => SlotIndex.fromMaps({
  capabilities: new Map(entries),
  ...paths,
});

describe('SlotIndex: die Lookups als Methoden', () => {
  const slots = indexOf([
    ['0', slot({ anchorKind: 'force', defId: 'force-1', name: 'Kontingent' })],
    ['0/0', slot({ defId: 'unit', name: 'Ritter', primaryCategoryId: CATEGORY })],
    ['0/0/0', slot({ anchorKind: 'groupAnchor', defId: 'grp', name: 'Waffen' })],
    ['0/0/0/0', slot({ defId: 'link-sword', targetDefId: 'sword', name: 'Schwert' })],
    ['0/1', slot({ anchorKind: 'categoryAnchor', defId: 'link-core', targetDefId: CATEGORY, name: 'Kern' })],
    ['0/2', slot({ anchorKind: 'offerAnchor', defId: 'other', primaryCategoryId: 'cat-rare' })],
  ], {
    pathBySelectionId: new Map([['sel-knight', '0/0']]),
    pathByForceId: new Map([['force-uuid', '0']]),
  });

  it('childSlotsOf liefert nur die direkten Kinder, in Berichtsreihenfolge', () => {
    expect(slots.childSlotsOf('0').map(({ path }) => path)).toEqual(['0/0', '0/1', '0/2']);
    expect(slots.childSlotsOf(null)).toEqual([]);
  });

  it('findChildSlot findet ueber eigene und aufgeloeste Id, findDescendantSlot auch in der Tiefe', () => {
    expect(slots.findChildSlot('0', 'unit')?.name).toBe('Ritter');
    expect(slots.findChildSlot('0/0', 'sword')).toBeUndefined();
    expect(slots.findDescendantSlot('0/0', 'sword')?.name).toBe('Schwert');
    expect(slots.findDescendantSlot('0/0', 'link-sword')?.name).toBe('Schwert');
  });

  it('slotOfSelection und isIndependentSubUnitSlot loesen ueber pathBySelectionId auf', () => {
    expect(slots.slotOfSelection({ id: 'sel-knight' })?.name).toBe('Ritter');
    expect(slots.slotOfSelection({ id: 'unbekannt' })).toBeUndefined();
    expect(slots.isIndependentSubUnitSlot({ id: 'sel-knight' })).toBe(false);
    expect(slots.isIndependentSubUnitSlot(null)).toBe(false);
  });

  it('pathOfForce liefert den Pfad des Kontingents, sonst null', () => {
    expect(slots.pathOfForce('force-uuid')).toBe('0');
    expect(slots.pathOfForce('force-weg')).toBeNull();
  });

  it('categoryAnchorSlotsOf, findCategoryAnchorSlot und hasUnitSlotsInCategory lesen den Bericht', () => {
    expect(slots.categoryAnchorSlotsOf('0').map(({ path }) => path)).toEqual(['0/1']);
    expect(slots.findCategoryAnchorSlot('0', CATEGORY)?.name).toBe('Kern');
    expect(slots.findCategoryAnchorSlot('0', 'link-core')?.name).toBe('Kern');
    expect(slots.hasUnitSlotsInCategory('0', CATEGORY)).toBe(true);
    expect(slots.hasUnitSlotsInCategory('0', 'cat-ohne-slot')).toBe(false);
  });

  it('der leere Index beantwortet alles ohne Throw', () => {
    expect(EMPTY_SLOT_INDEX.childSlotsOf('0')).toEqual([]);
    expect(EMPTY_SLOT_INDEX.slotOfSelection({ id: 'x' })).toBeUndefined();
    expect(EMPTY_SLOT_INDEX.pathOfForce('x')).toBeNull();
  });
});

describe('SlotIndex.fromMaps: die eine Naht der Fixtures', () => {
  it('baut einen Index aus handgebauten Karten', () => {
    const slots = SlotIndex.fromMaps({
      capabilities: new Map([['0', slot({ name: 'Ritter' })]]),
      pathBySelectionId: new Map([['sel-1', '0']]),
    });

    expect(slots).toBeInstanceOf(SlotIndex);
    expect(slots.slotOfSelection({ id: 'sel-1' })?.name).toBe('Ritter');
    expect(slots.pathByForceId.size).toBe(0);
  });

  it('ohne Argument ist der Index leer, statt zu werfen', () => {
    expect(SlotIndex.fromMaps().capabilities.size).toBe(0);
    expect(SlotIndex.fromMaps({}).pathBySelectionId.size).toBe(0);
  });

  it.each([
    ['isHidden', 'primaryCategoryId'],
    ['isIndependentSubUnit', 'isHidden'],
    ['primaryCategoryId', 'isIndependentSubUnit'],
  ])('ein Fixture ohne das Anzeige-Feld %s faellt beim Bau auf', (missing) => {
    const capability = slot();
    delete capability[missing];

    expect(() => SlotIndex.fromMaps({ capabilities: new Map([['0/0', capability]]) }))
      .toThrow(new RegExp(`"0/0".*"${missing}"`));
  });

  it('ein Anzeige-Feld vom falschen Typ faellt genauso auf', () => {
    expect(() => SlotIndex.fromMaps({ capabilities: new Map([['0', slot({ isHidden: 'nein' })]]) }))
      .toThrow(/isHidden/);
    expect(() => SlotIndex.fromMaps({ capabilities: new Map([['0', slot({ primaryCategoryId: 7 })]]) }))
      .toThrow(/primaryCategoryId/);
  });

  it('ein Slot ohne Datensatz faellt auf', () => {
    expect(() => SlotIndex.fromMaps({ capabilities: new Map([['0', null]]) }))
      .toThrow(/carries no capability record/);
  });
});
