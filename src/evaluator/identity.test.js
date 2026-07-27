import { describe, it, expect } from 'vitest';
import { identityIdsOf, isOccurrenceOf } from './identity.js';
import { DefinitionKind } from './model.js';

const ENTRY_ID = 'abdb-bbd0-41b2-5dff';
const LINK_ID = 'b581-8a9e-9d0c-b7c8';
const INTERMEDIATE_LINK_ID = '1b7c-2c90-6d96-28c9';
const CATEGORY_ID = 'd824-eb03-77ac-8be2';
const UNRELATED_ID = 'ffff-ffff-ffff-ffff';

/** Ein direkt gesetzter Eintrag: nur die eigene Id. */
function entry(id = ENTRY_ID) {
  return { id, kind: DefinitionKind.ENTRY };
}

/** Ein `entryLink` auf ein aufgeloestes Ziel. */
function entryLink({ id = LINK_ID, targetId = ENTRY_ID, resolved = entry(targetId) } = {}) {
  return { id, kind: DefinitionKind.ENTRY_LINK, targetId, resolved };
}

describe('identityIdsOf (Zaehl-Identitaet einer Definition)', () => {
  it('liefert fuer einen direkt gesetzten Eintrag genau seine eigene Id', () => {
    expect(identityIdsOf(entry())).toEqual([ENTRY_ID]);
  });

  it('liefert fuer einen Verweis seine eigene Id und die seines Ziels', () => {
    expect(identityIdsOf(entryLink())).toEqual([LINK_ID, ENTRY_ID]);
  });

  it('nennt das aufgeloeste Ziel einer Verweiskette zusaetzlich zur genannten Ziel-Id', () => {
    const chained = entryLink({ targetId: INTERMEDIATE_LINK_ID, resolved: entry(ENTRY_ID) });
    expect(identityIdsOf(chained)).toEqual([LINK_ID, INTERMEDIATE_LINK_ID, ENTRY_ID]);
  });

  it('entdoppelt: eine Id, die mehrfach auftritt, steht genau einmal in der Menge', () => {
    const selfTargeting = { id: LINK_ID, kind: DefinitionKind.ENTRY_LINK, targetId: LINK_ID, resolved: entry(LINK_ID) };
    expect(identityIdsOf(selfTargeting)).toEqual([LINK_ID]);
  });

  it('laesst fehlende Angaben weg statt sie als Id zu fuehren', () => {
    const dangling = { id: LINK_ID, kind: DefinitionKind.ENTRY_LINK, targetId: ENTRY_ID, resolved: null };
    expect(identityIdsOf(dangling)).toEqual([LINK_ID, ENTRY_ID]);
    expect(identityIdsOf({ id: ENTRY_ID, targetId: null, resolved: null })).toEqual([ENTRY_ID]);
  });

  it('liefert fuer eine fehlende Definition (die Baumwurzel) eine leere Menge', () => {
    expect(identityIdsOf(null)).toEqual([]);
    expect(identityIdsOf(undefined)).toEqual([]);
  });
});

describe('isOccurrenceOf (einseitige Frage: zaehlt dieses Vorkommen unter der Id?)', () => {
  it('trifft ein direkt gesetztes Vorkommen unter der Eintrags-Id', () => {
    expect(isOccurrenceOf(entry(), ENTRY_ID)).toBe(true);
  });

  it('trifft ein per Verweis gesetztes Vorkommen ebenfalls unter der Ziel-Id', () => {
    expect(isOccurrenceOf(entryLink(), ENTRY_ID)).toBe(true);
  });

  it('trifft ein per Verweis gesetztes Vorkommen unter der Verweis-Id', () => {
    expect(isOccurrenceOf(entryLink(), LINK_ID)).toBe(true);
  });

  it('trifft unter einer Verweis-Id NICHT das direkt gesetzte Vorkommen — die Richtung ist einseitig', () => {
    expect(isOccurrenceOf(entry(), LINK_ID)).toBe(false);
  });

  it('trifft unter einer Verweis-Id NICHT das Vorkommen ueber einen anderen Verweis', () => {
    const otherLink = entryLink({ id: CATEGORY_ID });
    expect(isOccurrenceOf(otherLink, LINK_ID)).toBe(false);
    expect(isOccurrenceOf(otherLink, ENTRY_ID)).toBe(true);
  });

  it('trifft nicht unter einer fremden Id', () => {
    expect(isOccurrenceOf(entryLink(), UNRELATED_ID)).toBe(false);
  });

  it('ist deckungsgleich mit "die Identitaets-Menge enthaelt die Id"', () => {
    const chained = entryLink({ targetId: INTERMEDIATE_LINK_ID, resolved: entry(ENTRY_ID) });
    for (const candidateId of [LINK_ID, INTERMEDIATE_LINK_ID, ENTRY_ID, CATEGORY_ID, UNRELATED_ID]) {
      expect(isOccurrenceOf(chained, candidateId)).toBe(identityIdsOf(chained).includes(candidateId));
    }
  });

  it('trifft nie ohne Definition oder ohne gesuchte Id', () => {
    expect(isOccurrenceOf(null, ENTRY_ID)).toBe(false);
    expect(isOccurrenceOf(entry(), null)).toBe(false);
    expect(isOccurrenceOf(entry(), undefined)).toBe(false);
  });
});
