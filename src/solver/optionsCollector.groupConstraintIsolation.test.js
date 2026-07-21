import { describe, test, expect } from 'vitest';
import { getUnitOptions } from './optionsCollector.js';
import {
  ENTRY_ID,
  GROUP_ID,
  CONSTRAINT_ID,
  CATALOGUE_ID,
  createGrimdarkSystem
} from './__fixtures__/grimdarkSystem.js';

// Regression „Waaagh-Sprüche": der Eintrag „Show Spells" trägt ein max=1, seine
// Sprüche-Gruppe dagegen keins. Reichte das Limit des Elternteils an die Sprüche
// durch, ließe sich nur ein einziger Spruch wählen.
describe('getUnitOptions — Gruppenlimits bleiben von Elternlimits getrennt', () => {
  function createShamanSelection() {
    return {
      selectionEntryId: ENTRY_ID.shaman,
      name: 'Orc Shaman',
      selections: [{ selectionEntryId: ENTRY_ID.showSpells }]
    };
  }

  const collectSpellOption = () => {
    const system = createGrimdarkSystem();
    const options = getUnitOptions(system, CATALOGUE_ID, createShamanSelection());

    return options.find(item => item.option.id === ENTRY_ID.gazeOfMork);
  };

  test('bietet die Sprüche der geöffneten Gruppe überhaupt an', () => {
    expect(collectSpellOption()).toBeDefined();
  });

  test('erbt das max-Limit des übergeordneten Eintrags nicht in die Sprüche-Gruppe', () => {
    const spellOption = collectSpellOption();

    expect(spellOption.groupConstraints?.some(
      constraint => constraint.id === CONSTRAINT_ID.showSpellsMax
    )).toBeFalsy();
  });

  test('ordnet den Spruch seiner eigenen Gruppe zu', () => {
    const spellOption = collectSpellOption();

    expect(spellOption.groupId ?? spellOption.group?.id).toBe(GROUP_ID.littleWaaagh);
  });
});
