import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = resolve(__dirname, '..', 'src', 'data', 'rules-index.json');

describe('generate-rules-index output', () => {
  let index;

  beforeAll(() => {
    const raw = readFileSync(INDEX_PATH, 'utf-8');
    index = JSON.parse(raw);
  });

  it('is valid JSON', () => {
    expect(typeof index).toBe('object');
    expect(index).not.toBeNull();
  });

  it('contains entries', () => {
    const count = Object.keys(index).length;
    expect(count).toBeGreaterThan(10);
  });

  it('contains core special rules', () => {
    expect(index).toHaveProperty('Killing Blow');
    expect(index).toHaveProperty('Regeneration');
    expect(index).toHaveProperty('Flammable');
  });

  it('contains core weapons', () => {
    expect(index).toHaveProperty('Hand Weapon');
    expect(index).toHaveProperty('Halberd');
    expect(index).toHaveProperty('Great Weapon');
  });

  it('contains core magic items section', () => {
    expect(index).toHaveProperty('Common Magic Items');
  });

  it('contains spell lores', () => {
    expect(index).toHaveProperty('The Lore of Fire');
    expect(index).toHaveProperty('The Lore of Death');
  });

  it('contains characteristics', () => {
    expect(index).toHaveProperty('Movement Allowance (M)');
    expect(index).toHaveProperty('Leadership (Ld)');
  });

  it('contains psychology rules, which are not linked from special-rules', () => {
    for (const rule of ['Fear', 'Terror', 'Hatred', 'Frenzy', 'Stupidity', 'Stubborn']) {
      expect(index[rule]).toMatch(/^\/psychology\//);
    }
  });

  it('contains the remaining single-level sections', () => {
    expect(index['Unit Strength']).toMatch(/^\/units\//);
    expect(index['Impact Hits']).toMatch(/^\/chariots\//);
    expect(index['Charge Reactions']).toMatch(/^\/movement\//);
    expect(index['Break Tests']).toMatch(/^\/close-combat\//);
  });

  it('has minimal=true in all URLs', () => {
    for (const path of Object.values(index)) {
      expect(path).toContain('minimal=true');
    }
  });

  it('has UTM parameters in all URLs', () => {
    for (const path of Object.values(index)) {
      expect(path).toContain('utm_source=6th-builder');
      expect(path).toContain('utm_medium=referral');
    }
  });

  it('paths start with a slash', () => {
    for (const path of Object.values(index)) {
      expect(path.startsWith('/')).toBe(true);
    }
  });

  it('has no undecoded HTML entities in the rule-name keys', () => {
    // Keys are matched against literal BSData names, so an escaped key
    // (e.g. "Cloak &amp; Dagger") could never resolve — guard against regressions.
    const offenders = Object.keys(index).filter(name => /&(amp|quot|lt|gt|#\d+|#x[0-9a-fA-F]+);/.test(name));
    expect(offenders).toEqual([]);
  });

  it('resolves entity-bearing names against the lookup', async () => {
    const { getRuleUrl } = await import('../src/data/rulesLookup.js');
    expect(getRuleUrl('Cloak & Dagger')).toContain('/weapons/cloak-and-dagger');
  });
});
