import { describe, test, expect } from 'vitest';
import { findEntryInSystem } from './validator.js';

// Zwei Kataloge desselben Systems dürfen dieselbe Eintrags-ID vergeben. Ohne den
// Katalog als Namensraum liefert die Suche dann den falschen Eintrag — etwa den
// Chaoszwergen-Helden, wo der Schwarzork-Kriegsboss gemeint war.
describe('findEntryInSystem — kollidierende IDs über Katalogsgrenzen', () => {
  const COLLIDING_ENTRY_ID = 'colliding-id';
  const ORCS_CATALOGUE_ID = 'cat-og';
  const CHAOS_DWARFS_CATALOGUE_ID = 'cat-cd';
  const WARBOSS_NAME = 'Black Orc Warboss';
  const CHAOS_DWARF_HERO_NAME = 'Chaos Dwarf Hero';

  function createCollisionSystem() {
    return {
      id: 'sys-collision',
      catalogues: [
        {
          id: ORCS_CATALOGUE_ID,
          name: 'Orcs and Goblins',
          selectionEntries: [{
            id: COLLIDING_ENTRY_ID,
            name: WARBOSS_NAME,
            selectionEntryGroups: [{ id: 'group-mounts', name: 'Mounts' }]
          }]
        },
        {
          id: CHAOS_DWARFS_CATALOGUE_ID,
          name: 'Chaos Dwarfs',
          selectionEntries: [{
            id: COLLIDING_ENTRY_ID,
            name: CHAOS_DWARF_HERO_NAME,
            selectionEntryGroups: []
          }]
        }
      ]
    };
  }

  test('löst die ID im bevorzugten Katalog auf', () => {
    const system = createCollisionSystem();

    const warboss = findEntryInSystem(system, COLLIDING_ENTRY_ID, ORCS_CATALOGUE_ID);

    expect(warboss.name).toBe(WARBOSS_NAME);
    expect(warboss.selectionEntryGroups).toHaveLength(1);
  });

  test('löst dieselbe ID im anderen Katalog auf den dortigen Eintrag auf', () => {
    const system = createCollisionSystem();

    const hero = findEntryInSystem(system, COLLIDING_ENTRY_ID, CHAOS_DWARFS_CATALOGUE_ID);

    expect(hero.name).toBe(CHAOS_DWARF_HERO_NAME);
    expect(hero.selectionEntryGroups).toHaveLength(0);
  });

  test('liefert ohne Katalogangabe einen der kollidierenden Einträge', () => {
    const system = createCollisionSystem();

    const fallback = findEntryInSystem(system, COLLIDING_ENTRY_ID);

    expect([WARBOSS_NAME, CHAOS_DWARF_HERO_NAME]).toContain(fallback.name);
  });
});
