/**
 * Die eindeutigen Pflicht-Listenregeln aus dem Bericht (Issue 0157, AC2).
 *
 * Was dieser Leser meldet, setzt `useRoster.js` **ohne jede Nutzerwahl** in ein
 * frisches Kontingent — jede Zeile hier ist deshalb eine Aussage darueber, was
 * dem Nutzer aus dem Nichts erscheinen darf und was nicht.
 */
import { describe, it, expect } from 'vitest';
import { SlotIndex } from '../../../domain/evaluation/slotIndex.js';
import { findMissingMandatoryListRules } from '../../../domain/evaluation/mandatoryListRules.js';

/** Ein Faehigkeits-Datensatz des Berichts in der Lesart dieses Moduls. */
const capabilityOf = (overrides = {}) => ({
  name: 'Regel',
  defId: 'def',
  targetDefId: null,
  anchorKind: 'offerAnchor',
  isIndependentSubUnit: false,
  isHidden: false,
  isListRule: true,
  isMandatoryListRule: true,
  primaryCategoryId: 'cat-rules',
  ...overrides,
});

const namesOf = (missing) => missing.map((hit) => hit.name);

describe('findMissingMandatoryListRules: was ein frisches Kontingent ungefragt erhaelt', () => {
  it('meldet das Pflicht-Angebot des Kontingents', () => {
    const capabilities = new Map([
      ['0', capabilityOf({ name: 'Kontingent', anchorKind: 'occupied', isListRule: false, isMandatoryListRule: false })],
      ['0/0', capabilityOf({ name: 'Pflichtregel', defId: 'rule-a' })],
    ]);

    const missing = findMissingMandatoryListRules(SlotIndex.fromMaps({ capabilities }), '0');

    expect(namesOf(missing)).toEqual(['Pflichtregel']);
    expect(missing[0]).toMatchObject({ defId: 'rule-a', resolvedId: 'rule-a', categoryId: 'cat-rules' });
  });

  it('meldet auch ein Pflicht-Phantom der Wurzel — es haengt nicht am Kontingent', () => {
    const capabilities = new Map([
      ['0', capabilityOf({ name: 'Kontingent', anchorKind: 'occupied', isListRule: false, isMandatoryListRule: false })],
      ['1', capabilityOf({ name: 'Wurzelpflicht', defId: 'rule-root', anchorKind: 'mandatoryPhantom', })],
    ]);

    expect(namesOf(findMissingMandatoryListRules(SlotIndex.fromMaps({ capabilities }), '0'))).toEqual(['Wurzelpflicht']);
  });

  it('meldet keine Regel, die der Roster schon fuehrt — auch nicht ueber ihr Verweisziel', () => {
    const capabilities = new Map([
      ['0/0', capabilityOf({ name: 'Belegte Regel', defId: 'link-a', targetDefId: 'rule-a', anchorKind: 'occupied', })],
      ['0/1', capabilityOf({ name: 'Dasselbe Angebot', defId: 'rule-a' })],
    ]);

    expect(findMissingMandatoryListRules(SlotIndex.fromMaps({ capabilities }), '0')).toEqual([]);
  });

  it('meldet weder eine freie Listenregel noch eine ausgeblendete Pflicht', () => {
    const capabilities = new Map([
      ['0/0', capabilityOf({ name: 'Freie Regel', defId: 'rule-free', isMandatoryListRule: false })],
      ['0/1', capabilityOf({ name: 'Versteckte Pflicht', defId: 'rule-hidden', isHidden: true })],
    ]);

    expect(findMissingMandatoryListRules(SlotIndex.fromMaps({ capabilities }), '0')).toEqual([]);
  });

  it('meldet nichts aus einem fremden Kontingent', () => {
    const capabilities = new Map([
      ['0/0', capabilityOf({ name: 'Eigene Pflicht', defId: 'rule-a' })],
      ['1/0', capabilityOf({ name: 'Fremde Pflicht', defId: 'rule-b' })],
    ]);

    expect(namesOf(findMissingMandatoryListRules(SlotIndex.fromMaps({ capabilities }), '0'))).toEqual(['Eigene Pflicht']);
  });

  it('laesst eine armeeweite Pflicht aus, die ein frueheres Kontingent des Durchlaufs schon uebernommen hat', () => {
    const capabilities = new Map([
      ['1', capabilityOf({ name: 'Wurzelpflicht', defId: 'rule-root', anchorKind: 'mandatoryPhantom', })],
    ]);

    const missing = findMissingMandatoryListRules(SlotIndex.fromMaps({ capabilities }), '0', {
      skipResolvedIds: new Set(['rule-root']),
    });

    expect(missing).toEqual([]);
  });

  it('reicht den Katalog-Eintrag des Schreibmodells durch, ohne ihn selbst zu suchen', () => {
    const capabilities = new Map([
      ['0/0', capabilityOf({ name: 'Pflichtregel', defId: 'rule-a' })],
    ]);

    const missing = findMissingMandatoryListRules(SlotIndex.fromMaps({ capabilities }), '0', {
      entryOf: (capability) => ({ id: capability.defId }),
    });

    expect(missing[0].entry).toEqual({ id: 'rule-a' });
  });

  it('meldet ohne Bericht nichts, statt zu werfen', () => {
    expect(findMissingMandatoryListRules(SlotIndex.fromMaps(), '0')).toEqual([]);
    expect(findMissingMandatoryListRules(SlotIndex.fromMaps({}), '0')).toEqual([]);
  });
});
