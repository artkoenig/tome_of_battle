import { describe, it, expect } from 'vitest';
import { memberDefsOf, resolveGroupDefaultMember } from './selectionMembers.js';

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

describe('resolveGroupDefaultMember', () => {
  it('wählt die im Katalog vorgegebene Option, auch wenn sie nicht die erste ist', () => {
    const group = {
      defaultSelectionEntryId: heavyArmour.id,
      entryLinks: [lightArmour, heavyArmour]
    };

    expect(resolveGroupDefaultMember(group)).toBe(heavyArmour);
  });

  it('fällt ohne hinterlegte Vorgabe auf das erste Mitglied zurück', () => {
    const group = { defaultSelectionEntryId: null, entryLinks: [lightArmour, heavyArmour] };

    expect(resolveGroupDefaultMember(group)).toBe(lightArmour);
  });

  it('fällt auf das erste Mitglied zurück, wenn die Vorgabe kein Mitglied trifft', () => {
    const group = { defaultSelectionEntryId: 'nicht-vorhanden', entryLinks: [lightArmour, heavyArmour] };

    expect(resolveGroupDefaultMember(group)).toBe(lightArmour);
  });

  it('trifft die Vorgabe über die Link-Id, nicht über die targetId des Ziel-Eintrags', () => {
    const group = {
      defaultSelectionEntryId: heavyArmour.targetId,
      entryLinks: [lightArmour, heavyArmour]
    };

    expect(resolveGroupDefaultMember(group)).toBe(lightArmour);
  });

  it('liefert null für eine leere Gruppe', () => {
    expect(resolveGroupDefaultMember({ defaultSelectionEntryId: 'egal' })).toBeNull();
  });
});
