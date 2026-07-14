import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./rules-index.json', () => ({
  default: {
    'Killing Blow': '/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Regeneration': '/special-rules/regeneration?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Immune to Psychology': '/special-rules/immune-to-psychology?minimal=true&utm_source=6th-builder&utm_medium=referral',
    'Hand Weapon': '/weapons/hand-weapon?minimal=true&utm_source=6th-builder&utm_medium=referral',
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
});
