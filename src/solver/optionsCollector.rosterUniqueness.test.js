import { describe, test, expect } from 'vitest';
import { isUniqueOptionTakenElsewhere } from './optionsCollector.js';
import {
  ENTRY_ID,
  CATALOGUE_ID,
  createGrimdarkSystem,
  createRoster,
  createCaptainSelection
} from './__fixtures__/grimdarkSystem.js';

// Einzigartige Gegenstände (max 1 im Roster) dürfen nicht ein zweites Mal angeboten
// werden, wenn sie bereits an einer *anderen* Einheit hängen — an der Einheit, die
// man gerade bearbeitet, zählen sie dagegen nicht als „vergeben".
describe('isUniqueOptionTakenElsewhere — roster-weite Einzigartigkeit', () => {
  const FIRST_CAPTAIN_ID = 'sel-cap-1';
  const SECOND_CAPTAIN_ID = 'sel-cap-2';
  const swordTarget = { id: ENTRY_ID.swordOfBattle };

  function createRosterWithSwordOnFirstCaptain() {
    return createRoster({
      selections: [
        createCaptainSelection({
          id: FIRST_CAPTAIN_ID,
          selections: [{ id: 'sel-sword-unique', selectionEntryId: ENTRY_ID.swordOfBattle }]
        }),
        createCaptainSelection({ id: SECOND_CAPTAIN_ID, selections: [] })
      ]
    });
  }

  const isTakenFor = selectionId => {
    const roster = createRosterWithSwordOnFirstCaptain();
    const selection = roster.forces[0].selections.find(entry => entry.id === selectionId);

    return isUniqueOptionTakenElsewhere(swordTarget, createGrimdarkSystem(), CATALOGUE_ID, selection, roster);
  };

  test('gilt als vergeben, wenn eine andere Einheit den Gegenstand trägt', () => {
    expect(isTakenFor(SECOND_CAPTAIN_ID)).toBe(true);
  });

  test('gilt nicht als vergeben, wenn die bearbeitete Einheit selbst ihn trägt', () => {
    expect(isTakenFor(FIRST_CAPTAIN_ID)).toBe(false);
  });
});
