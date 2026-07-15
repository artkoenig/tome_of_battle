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
    '6. The Hand of Gork': '/spell-lists/gork/6-the-hand-of-gork?minimal=true&utm_source=6th-builder&utm_medium=referral',
    '2. Fists of Gork': '/spell-lists/gork/2-fists-of-gork?minimal=true&utm_source=6th-builder&utm_medium=referral',
    '1. Mork Save Uz!': '/spell-lists/mork/1-mork-save-uz?minimal=true&utm_source=6th-builder&utm_medium=referral',
    '4. Brain Bursta': '/spell-lists/gork/4-brain-bursta?minimal=true&utm_source=6th-builder&utm_medium=referral',
    "'Edbuttin' 'At": '/magic-item/edbuttin-at?minimal=true&utm_source=6th-builder&utm_medium=referral',
    "Pork's Pigstikka": '/magic-item/porks-pigstikka?minimal=true&utm_source=6th-builder&utm_medium=referral',
    "Wollopa's One Hit Wunda": '/magic-item/wollopas-one-hit-wunda?minimal=true&utm_source=6th-builder&utm_medium=referral',
    "Owzat's Club of Smackin'": '/magic-item/owzats-club-of-smackin?minimal=true&utm_source=6th-builder&utm_medium=referral',
  },
}));

vi.mock('./synonyms.js', () => ({
  SYNONYMS: {
    'Immune to Psycology': 'Immune to Psychology',
    'Short Bow': 'Shortbow',
    '6.Hand of Gork': '6. The Hand of Gork',
    '2.Fist of Gork': '2. Fists of Gork',
    '1.Mork Save Us': '1. Mork Save Uz!',
    '4.Brain Busta': '4. Brain Bursta',
    "'Eadbuttin' 'At": "'Edbuttin' 'At",
    "Porka's Pigstikka": "Pork's Pigstikka",
    "Wallopa's One Hit Wunda": "Wollopa's One Hit Wunda",
    "Ozat's Club of Smakin'": "Owzat's Club of Smackin'",
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

  it('resolves synonyms case-insensitively', () => {
    const url = getRuleUrl('immune to psycology');
    expect(url).toBe('https://6th.whfb.app/special-rules/immune-to-psychology?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('is case-insensitive', () => {
    expect(getRuleUrl('killing blow')).toBe('https://6th.whfb.app/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral');
    expect(getRuleUrl('KILLING BLOW')).toBe('https://6th.whfb.app/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  // Regression (Issue 11 / Issue 13-02): normalizeName() strips all non-alphanumeric
  // characters, so it already resolves catalog names carrying stray whitespace
  // (e.g. upstream's "Cavalry hammer ", "Crazed! ") without needing a trim(). The
  // parser trims name attributes too (Issue 13-02), but this lookup must keep
  // working even for names it never touches.
  it('resolves names with leading/trailing whitespace, same as trimmed', () => {
    expect(getRuleUrl(' Killing Blow ')).toBe(getRuleUrl('Killing Blow'));
    expect(getRuleUrl('Killing Blow ')).toBe('https://6th.whfb.app/special-rules/killing-blow?minimal=true&utm_source=6th-builder&utm_medium=referral');
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

  it('resolves a synonym for a catalog name missing the "The" article', () => {
    expect(getRuleUrl('6.Hand of Gork')).toBe('https://6th.whfb.app/spell-lists/gork/6-the-hand-of-gork?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('resolves a synonym for a catalog name with a singular/plural mismatch', () => {
    expect(getRuleUrl('2.Fist of Gork')).toBe('https://6th.whfb.app/spell-lists/gork/2-fists-of-gork?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('resolves a synonym for a catalog name with an Orky spelling mismatch ("Us" vs. "Uz")', () => {
    expect(getRuleUrl('1.Mork Save Us')).toBe('https://6th.whfb.app/spell-lists/mork/1-mork-save-uz?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('resolves a synonym for a catalog name with a typo ("Busta" vs. "Bursta")', () => {
    expect(getRuleUrl('4.Brain Busta')).toBe('https://6th.whfb.app/spell-lists/gork/4-brain-bursta?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('resolves a synonym for a catalog name with an Orky spelling mismatch ("Eadbuttin\'" vs. "Edbuttin\'")', () => {
    expect(getRuleUrl("'Eadbuttin' 'At")).toBe('https://6th.whfb.app/magic-item/edbuttin-at?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('resolves a synonym for a catalog name with a missing name-syllable ("Porka\'s" vs. "Pork\'s")', () => {
    expect(getRuleUrl("Porka's Pigstikka")).toBe('https://6th.whfb.app/magic-item/porks-pigstikka?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('resolves a synonym for a catalog name with an Orky spelling mismatch ("Wallopa" vs. "Wollopa")', () => {
    expect(getRuleUrl("Wallopa's One Hit Wunda")).toBe('https://6th.whfb.app/magic-item/wollopas-one-hit-wunda?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });

  it('resolves a synonym for a catalog name with a missing letter in each word ("Ozat...Smakin\'" vs. "Owzat...Smackin\'")', () => {
    expect(getRuleUrl("Ozat's Club of Smakin'")).toBe('https://6th.whfb.app/magic-item/owzats-club-of-smackin?minimal=true&utm_source=6th-builder&utm_medium=referral');
  });
});
