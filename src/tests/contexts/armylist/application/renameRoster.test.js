import { describe, it, expect } from 'vitest';

import { renameRoster } from '../../../../contexts/armylist/application/renameRoster.js';

/** Issue 0188 — the use case is a plain function over the roster; no React. */

const ROSTER = { name: 'old name', forces: [{ id: 'f1', selections: [] }] };

describe('renameRoster', () => {
  it('renames the roster', () => {
    expect(renameRoster(ROSTER, 'new name').name).toBe('new name');
  });

  it('keeps the selection tree identical', () => {
    expect(renameRoster(ROSTER, 'new name').forces).toBe(ROSTER.forces);
  });

  it('leaves the roster it was given untouched', () => {
    renameRoster(ROSTER, 'new name');

    expect(ROSTER.name).toBe('old name');
  });
});
