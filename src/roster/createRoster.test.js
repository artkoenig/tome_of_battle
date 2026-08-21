import { describe, test, expect } from 'vitest';
import { buildRoster } from './createRoster';
import { DEFAULT_ROSTER_COST_LIMIT } from './rosterDefaults';

const systemDef = {
  id: 'sys-1',
  costTypes: [{ id: 'pts' }, { id: 'pl' }],
  forceEntries: [{ id: 'force-a' }, { id: 'force-b' }],
};

const form = { name: 'Neue Liste', systemId: 'sys-1', catId: 'cat-1', forceEntryId: 'force-x', limit: '1500' };

describe('buildRoster', () => {
  test('übernimmt Name, System und Katalog aus dem Formular', () => {
    const roster = buildRoster(form, systemDef);

    expect(roster.name).toBe('Neue Liste');
    expect(roster.systemId).toBe('sys-1');
    expect(roster.catalogueId).toBe('cat-1');
  });

  test('führt die erste vom System deklarierte Kostenart als Limit-Typ', () => {
    expect(buildRoster(form, systemDef).costLimitType).toBe('pts');
  });

  test('setzt costLimitType auf null, wenn das System keine Kostenart deklariert', () => {
    expect(buildRoster(form, { id: 'sys-1' }).costLimitType).toBeNull();
  });

  test('parst das übergebene Limit als Zahl', () => {
    expect(buildRoster(form, systemDef).costLimit).toBe(1500);
  });

  test('fällt ohne Limit auf den Vorgabewert zurück', () => {
    const roster = buildRoster({ ...form, limit: '' }, systemDef);
    expect(roster.costLimit).toBe(DEFAULT_ROSTER_COST_LIMIT);
  });

  test('legt genau eine Streitmacht mit dem gewählten forceEntry an', () => {
    const roster = buildRoster(form, systemDef);

    expect(roster.forces).toHaveLength(1);
    expect(roster.forces[0].forceEntryId).toBe('force-x');
    expect(roster.forces[0].catalogueId).toBe('cat-1');
    expect(roster.forces[0].selections).toEqual([]);
  });

  test('nutzt die erste Streitmacht des Systems, wenn das Formular keine vorgibt', () => {
    const roster = buildRoster({ ...form, forceEntryId: '' }, systemDef);
    expect(roster.forces[0].forceEntryId).toBe('force-a');
  });

  test('setzt forceEntryId auf null, wenn weder Formular noch System eine liefern', () => {
    const roster = buildRoster({ ...form, forceEntryId: '' }, { id: 'sys-1' });
    expect(roster.forces[0].forceEntryId).toBeNull();
  });

  test('startet mit einem frischen Spielzustand', () => {
    expect(buildRoster(form, systemDef).gameState).toEqual({ round: 1, vp: 0, cp: 0, wounds: {} });
  });

  test('vergibt eigene Ids für Roster und Streitmacht', () => {
    const roster = buildRoster(form, systemDef);

    expect(typeof roster.id).toBe('string');
    expect(roster.id.length).toBeGreaterThan(0);
    expect(roster.forces[0].id).not.toBe(roster.id);
  });
});
