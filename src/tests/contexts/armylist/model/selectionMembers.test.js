import { describe, it, expect } from 'vitest';
import { findMemberDefById, memberDefsOf } from '../../../../contexts/armylist/model/selectionMembers.js';

// Generische, schema-förmige Fixtures (nicht katalog-/einheitsspezifisch, ADR-0003).
const lightArmour = { id: 'link-light', targetId: 'entry-light', name: 'Light Armour' };
const heavyArmour = { id: 'link-heavy', targetId: 'entry-heavy', name: 'Heavy Armour' };
const shield = { id: 'entry-shield', name: 'Shield' };

describe('memberDefsOf', () => {
  it('führt Einträge und Links zu einer Liste zusammen, Einträge zuerst', () => {
    const group = { selectionEntries: [shield], entryLinks: [lightArmour, heavyArmour] };

    expect(memberDefsOf(group)).toEqual([shield, lightArmour, heavyArmour]);
  });

  it('liefert eine leere Liste für eine Gruppe ohne Mitglieder', () => {
    expect(memberDefsOf({})).toEqual([]);
    expect(memberDefsOf(undefined)).toEqual([]);
  });
});

describe('findMemberDefById — die Id des Berichts zurück auf ihr Katalog-Objekt', () => {
  // Der Bericht nennt die **eigene** Id des Mitglieds; bei einem Verweis ist das
  // dessen Link-Id, nie die targetId seines Ziels (Issue 0157).
  const noGroupLinks = () => null;

  it('findet ein direktes Mitglied über seine eigene Id', () => {
    const def = { selectionEntries: [shield], entryLinks: [lightArmour] };

    expect(findMemberDefById(def, 'link-light', noGroupLinks)).toBe(lightArmour);
    expect(findMemberDefById(def, 'entry-shield', noGroupLinks)).toBe(shield);
  });

  it('steigt in geschachtelte Gruppen jeder Tiefe ab', () => {
    const def = {
      selectionEntryGroups: [{
        id: 'group-outer',
        selectionEntryGroups: [{ id: 'group-inner', entryLinks: [heavyArmour] }]
      }]
    };

    expect(findMemberDefById(def, 'link-heavy', noGroupLinks)).toBe(heavyArmour);
  });

  it('folgt einem Gruppen-Verweis über den mitgegebenen Auflöser', () => {
    const groupLink = { id: 'link-group', targetId: 'group-shared', type: 'selectionEntryGroup' };
    const sharedGroup = { id: 'group-shared', entryLinks: [heavyArmour] };
    const resolveGroupDef = (member) => (member === groupLink ? sharedGroup : null);

    expect(findMemberDefById({ entryLinks: [groupLink] }, 'link-heavy', resolveGroupDef))
      .toBe(heavyArmour);
  });

  it('greift ersatzweise auf die aufgelöste Ziel-Id zurück', () => {
    const def = { entryLinks: [lightArmour] };

    expect(findMemberDefById(def, 'unbekannt', noGroupLinks, 'entry-light')).toBe(lightArmour);
  });

  it('liefert null, wenn die Id unter der Definition nicht vorkommt', () => {
    expect(findMemberDefById({ entryLinks: [lightArmour] }, 'link-heavy', noGroupLinks)).toBeNull();
    expect(findMemberDefById(null, 'link-heavy', noGroupLinks)).toBeNull();
  });
});
