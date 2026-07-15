import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./rules-index.json', () => ({
  default: {
    'Killing Blow': '/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Regeneration': '/special-rules/regeneration?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Immune to Psychology': '/special-rules/immune-to-psychology?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Hand Weapon': '/weapons/hand-weapon?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Banner of Châlons': '/magic-item/banner-of-chalons?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Conqueror’s Tapestry': '/magic-item/conquerors-tapestry?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Hand of Khaine (Artefact and Skill)': '/magic-item/hand-of-khaine?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Power Familiar (Hordes of Chaos)': '/magic-item/power-familiar-hordes-of-chaos?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Power Familiar (Vampire Counts)': '/magic-item/power-familiar-vampire-counts?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Bullgut': '/magic-item/bullgut?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Battleaxe of the Last Waaagh!': '/magic-item/battleaxe-of-the-last-waaagh?minimal=true&utm_source=6th-builder&utm_medium=referral',
  },
}));

vi.mock('./synonyms.js', () => ({
  SYNONYMS: {
    'Immune to Psycology': 'Immune to Psychology',
    'Short Bow': 'Shortbow',
  },
}));

const { getRuleUrl } = await import('./rulesLookup.js');

describe('rulesLookup', () => {
  it('returns URL for a known rule name', () => {
    const url = getRuleUrl('Killing Blow');
    expect(url).toBe('https://6th.whfb.app/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('returns null for an unknown rule name', () => {
    expect(getRuleUrl('Unknown Rule')).toBeNull();
  });

  it('resolves synonyms to the canonical name', () => {
    const url = getRuleUrl('Immune to Psycology');
    expect(url).toBe('https://6th.whfb.app/special-rules/immune-to-psychology?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('is case-insensitive', () => {
    expect(getRuleUrl('killing blow')).toBe('https://6th.whfb.app/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral');
    expect(getRuleUrl('KILLING BLOW')).toBe('https://6th.whfb.app/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('returns null for null or undefined input', () => {
    expect(getRuleUrl(null)).toBeNull();
    expect(getRuleUrl(undefined)).toBeNull();
    expect(getRuleUrl('')).toBeNull();
  });

  it('returns null for a synonym that maps to an unknown name', () => {
    expect(getRuleUrl('Short Bow')).toBeNull();
  });

  it('matches despite a missing accent (catalog "Chalons" vs. indexed "Châlons")', () => {
    expect(getRuleUrl('Banner of Chalons')).toBe('https://6th.whfb.app/magic-item/banner-of-chalons?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('matches despite a straight vs. curly apostrophe', () => {
    expect(getRuleUrl("Conqueror's Tapestry")).toBe('https://6th.whfb.app/magic-item/conquerors-tapestry?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('matches despite a doubled space in the catalog name', () => {
    expect(getRuleUrl('Killing  Blow')).toBe('https://6th.whfb.app/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('resolves a bare catalog name to its single faction-suffixed index entry', () => {
    expect(getRuleUrl('Hand of Khaine')).toBe('https://6th.whfb.app/magic-item/hand-of-khaine?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('leaves a bare catalog name unresolved when multiple faction-suffixed variants collide', () => {
    expect(getRuleUrl('Power Familiar')).toBeNull();
  });

  it('matches despite a spacing difference (catalog "Bull gut" vs. indexed "Bullgut")', () => {
    expect(getRuleUrl('Bull gut')).toBe('https://6th.whfb.app/magic-item/bullgut?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('matches despite a missing exclamation mark', () => {
    expect(getRuleUrl('Battleaxe of the last Waaagh')).toBe('https://6th.whfb.app/magic-item/battleaxe-of-the-last-waaagh?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });
});
