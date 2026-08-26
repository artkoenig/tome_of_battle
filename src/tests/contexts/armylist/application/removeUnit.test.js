import { describe, it, expect } from 'vitest';

import { removeUnit } from '../../../../contexts/armylist/application/removeUnit.js';

/** Issue 0188 — the use case is a plain function over the roster; no React. */

const ROSTER = {
  name: 'list',
  forces: [{ id: 'f1', selections: [{ id: 'u1', selections: [] }, { id: 'u2', selections: [] }] }],
};

describe('removeUnit', () => {
  it('drops the unit from its force', () => {
    expect(removeUnit(ROSTER, 'u1').forces[0].selections.map(unit => unit.id)).toEqual(['u2']);
  });

  it('leaves the roster it was given untouched', () => {
    removeUnit(ROSTER, 'u1');

    expect(ROSTER.forces[0].selections).toHaveLength(2);
  });

  it('keeps every unit for an id the roster does not hold', () => {
    expect(removeUnit(ROSTER, 'nope').forces[0].selections).toHaveLength(2);
  });

  it('survives a force without a selections list', () => {
    expect(removeUnit({ forces: [{ id: 'f1' }] }, 'u1').forces[0].selections).toEqual([]);
  });
});
