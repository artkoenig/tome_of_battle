import { describe, it, expect } from 'vitest';

import { copyUnit } from '../../../../contexts/armylist/application/copyUnit.js';

/** Issue 0188 — the use case is a plain function over the roster; no React. */

const ROSTER = {
  name: 'list',
  forces: [{
    id: 'f1',
    selections: [
      { id: 'u1', name: 'Ghoul', selections: [{ id: 'o1', name: 'Banner', selections: [] }] },
      { id: 'u2', name: 'Zombie', selections: [] },
    ],
  }],
};

describe('copyUnit', () => {
  it('inserts a clone with fresh ids right after the original', () => {
    const selections = copyUnit(ROSTER, 'u1').forces[0].selections;

    expect(selections.map(unit => unit.name)).toEqual(['Ghoul', 'Ghoul', 'Zombie']);
    expect(selections[1].id).not.toBe('u1');
    expect(selections[1].selections[0].id).not.toBe('o1');
    expect(selections[1].selections[0].name).toBe('Banner');
  });

  it('leaves the roster untouched for an unknown id', () => {
    expect(copyUnit(ROSTER, 'nope')).toBe(ROSTER);
  });

  it('does not mutate the roster it was given', () => {
    copyUnit(ROSTER, 'u1');

    expect(ROSTER.forces[0].selections).toHaveLength(2);
  });
});
