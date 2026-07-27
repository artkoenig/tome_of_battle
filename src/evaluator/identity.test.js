import { describe, it, expect } from 'vitest';
import { identityIdsOf, isOccurrenceOf, resolvedTargetIdOf, hasCountableIdentity, entryTypeOf } from './identity.js';
import { DefinitionKind } from './model.js';
import { SelectionEntryKind, EntryLinkKind } from '../parser/schema/battlescribeSchema.generated.js';

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

describe('resolvedTargetIdOf (worauf zeigt ein Verweis?)', () => {
  it('nennt fuer einen Verweis die Id seines aufgeloesten Ziels', () => {
    expect(resolvedTargetIdOf(entryLink())).toBe(ENTRY_ID);
  });

  it('nennt bei einer Verweiskette deren Ende, nicht das Zwischenglied', () => {
    const chained = entryLink({ targetId: INTERMEDIATE_LINK_ID, resolved: entry(ENTRY_ID) });
    expect(resolvedTargetIdOf(chained)).toBe(ENTRY_ID);
  });

  it('nennt bei einem baumelnden Verweis ehrlich das Ziel, das er nicht gefunden hat', () => {
    const dangling = { id: LINK_ID, kind: DefinitionKind.ENTRY_LINK, targetId: ENTRY_ID, resolved: null };
    expect(resolvedTargetIdOf(dangling)).toBe(ENTRY_ID);
  });

  it('liefert nichts fuer eine Definition ohne Ziel und fuer eine fehlende Definition', () => {
    expect(resolvedTargetIdOf(entry())).toBeNull();
    expect(resolvedTargetIdOf(null)).toBeNull();
    expect(resolvedTargetIdOf(undefined)).toBeNull();
  });
});

describe('hasCountableIdentity (ist die Identitaet ueberhaupt ein Zaehlziel?)', () => {
  it('bejaht einen Eintrag und einen Verweis auf einen Eintrag', () => {
    expect(hasCountableIdentity(entry())).toBe(true);
    expect(hasCountableIdentity(entryLink())).toBe(true);
  });

  it('verneint eine Eintragsgruppe — sie buendelt nur, gezaehlt werden ihre Member', () => {
    expect(hasCountableIdentity({ id: ENTRY_ID, kind: DefinitionKind.GROUP })).toBe(false);
  });

  it('verneint auch einen Verweis auf eine Gruppe — er IST die Gruppe an dieser Stelle', () => {
    const groupLink = entryLink({ resolved: { id: ENTRY_ID, kind: DefinitionKind.GROUP } });
    expect(hasCountableIdentity(groupLink)).toBe(false);
  });

  it('bejaht einen baumelnden Verweis — ueber ein ungefundenes Ziel ist nichts zu behaupten', () => {
    const dangling = { id: LINK_ID, kind: DefinitionKind.ENTRY_LINK, targetId: ENTRY_ID, resolved: null };
    expect(hasCountableIdentity(dangling)).toBe(true);
  });

  it('verneint eine fehlende Definition', () => {
    expect(hasCountableIdentity(null)).toBe(false);
    expect(hasCountableIdentity(undefined)).toBe(false);
  });
});

/** Ein Eintrag mit erklaerter Eintragsart. */
function typedEntry(type, id = ENTRY_ID) {
  return { ...entry(id), type };
}

describe('entryTypeOf (Eintragsart eines Vorkommens)', () => {
  it('liest die Eintragsart eines direkt gesetzten Eintrags an ihm selbst', () => {
    expect(entryTypeOf(typedEntry(SelectionEntryKind.UNIT))).toBe(SelectionEntryKind.UNIT);
    expect(entryTypeOf(typedEntry(SelectionEntryKind.MODEL))).toBe(SelectionEntryKind.MODEL);
  });

  it('liest die Eintragsart eines Verweises an seinem aufgeloesten Ziel', () => {
    const link = entryLink({ resolved: typedEntry(SelectionEntryKind.UNIT) });
    expect(entryTypeOf(link)).toBe(SelectionEntryKind.UNIT);
  });

  it('liefert fuer Verweis und Ziel dieselbe Eintragsart — die Herkunft aendert sie nicht', () => {
    const target = typedEntry(SelectionEntryKind.MODEL);
    expect(entryTypeOf(entryLink({ resolved: target }))).toBe(entryTypeOf(target));
  });

  it('liest NIE das gleichnamige Attribut des Verweises — es traegt eine Verweisart, keine Eintragsart', () => {
    const linkWithOwnKind = {
      ...entryLink({ resolved: typedEntry(SelectionEntryKind.UNIT) }),
      type: EntryLinkKind.SELECTION_ENTRY,
    };
    expect(entryTypeOf(linkWithOwnKind)).toBe(SelectionEntryKind.UNIT);
    expect(Object.values(EntryLinkKind)).not.toContain(entryTypeOf(linkWithOwnKind));
  });

  it('liefert nichts, wenn das Ziel eines Verweises baumelt', () => {
    const dangling = { id: LINK_ID, kind: DefinitionKind.ENTRY_LINK, targetId: ENTRY_ID, resolved: null };
    expect(entryTypeOf(dangling)).toBeNull();
  });

  it('liefert nichts fuer einen Verweis auf eine Gruppe — ein Buendel hat keine Eintragsart', () => {
    const groupLink = entryLink({ resolved: { id: ENTRY_ID, kind: DefinitionKind.GROUP } });
    expect(entryTypeOf(groupLink)).toBeNull();
  });

  it('liefert nichts fuer Definitionsarten ohne Eintragsart', () => {
    expect(entryTypeOf({ id: ENTRY_ID, kind: DefinitionKind.GROUP })).toBeNull();
    expect(entryTypeOf({ id: ENTRY_ID, kind: DefinitionKind.FORCE })).toBeNull();
    expect(entryTypeOf({ id: CATEGORY_ID, kind: DefinitionKind.CATEGORY })).toBeNull();
    expect(entryTypeOf({ id: CATEGORY_ID, kind: DefinitionKind.CATEGORY_LINK, targetId: CATEGORY_ID })).toBeNull();
  });

  it('liefert nichts fuer einen Eintrag ohne erklaerte Art und fuer eine fehlende Definition', () => {
    expect(entryTypeOf(entry())).toBeNull();
    expect(entryTypeOf(null)).toBeNull();
    expect(entryTypeOf(undefined)).toBeNull();
  });
});
