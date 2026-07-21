import { describe, test, expect } from 'vitest';
import { validateRoster } from './validator.js';
import {
  CATEGORY_ID,
  TACTICAL_SQUAD_MAX,
  createGrimdarkSystem,
  createValidRoster,
  createRoster,
  createCaptainSelection,
  createTacticalSquadSelection
} from './__fixtures__/grimdarkSystem.js';

const VIOLATION = {
  entryMax: 'entry-max',
  unresolvedEntry: 'unresolved-entry'
};

describe('validateRoster — Höchstzahl gleicher Einträge im Kontingent', () => {
  test(`meldet entry-max, sobald mehr als ${TACTICAL_SQUAD_MAX} Tactical Squads im Kontingent stehen`, () => {
    const overLimitCount = TACTICAL_SQUAD_MAX + 1;
    const squads = Array.from({ length: overLimitCount }, (_, index) =>
      createTacticalSquadSelection({ id: `sel-tac-${index + 1}`, name: `Tactical Squad ${index + 1}` })
    );
    const roster = createRoster({
      name: 'Tactical Horde Over Limit',
      selections: [createCaptainSelection(), ...squads]
    });

    const errors = validateRoster(roster, createGrimdarkSystem());

    // Die Verletzung wird an der ersten betroffenen Auswahl gemeldet.
    expect(errors.some(
      error => error.type === VIOLATION.entryMax && error.selectionId === 'sel-tac-1'
    )).toBe(true);
  });

  test(`meldet kein entry-max bei genau ${TACTICAL_SQUAD_MAX} Tactical Squads`, () => {
    const squads = Array.from({ length: TACTICAL_SQUAD_MAX }, (_, index) =>
      createTacticalSquadSelection({ id: `sel-tac-${index + 1}`, name: `Tactical Squad ${index + 1}` })
    );
    const roster = createRoster({
      name: 'Tactical Horde At Limit',
      costLimit: 2000,
      selections: [createCaptainSelection(), ...squads]
    });

    const errors = validateRoster(roster, createGrimdarkSystem());

    expect(errors.some(error => error.type === VIOLATION.entryMax)).toBe(false);
  });
});

describe('validateRoster — roster-weites Limit über verschiedene entryLinks', () => {
  // Der „Battle Standard Bearer" ist ein geteilter Eintrag mit max=1 im Roster-Scope,
  // den zwei *verschiedene* entryLinks referenzieren. Werden die Links nicht auf ihr
  // gemeinsames Ziel aufgelöst, zählt der Validator zweimal eins statt einmal zwei
  // und die Verletzung bleibt unentdeckt.
  const BSB_TARGET_ID = 'bsb-target';
  const BSB_ROSTER_MAX = 1;
  const EXPECTED_MESSAGE_FRAGMENT = `maximal ${BSB_ROSTER_MAX} Auswahlen`;

  function createSystemWithSharedBattleStandard() {
    const system = createGrimdarkSystem();
    const catalogue = system.catalogues[0];

    catalogue.sharedSelectionEntries = [
      {
        id: BSB_TARGET_ID,
        name: 'Battle Standard Bearer Target',
        type: 'upgrade',
        constraints: [{ type: 'max', value: BSB_ROSTER_MAX, scope: 'roster' }]
      }
    ];
    catalogue.entryLinks = [
      { id: 'link-1', targetId: BSB_TARGET_ID, type: 'selectionEntry' },
      { id: 'link-2', targetId: BSB_TARGET_ID, type: 'selectionEntry' }
    ];

    return system;
  }

  function createHeroCarryingBattleStandard(heroId, entryLinkId) {
    return {
      id: heroId,
      name: `Hero ${heroId}`,
      selectionEntryId: createCaptainSelection().selectionEntryId,
      selections: [
        {
          id: `bsb-${heroId}`,
          name: 'Battle Standard Bearer Target',
          entryLinkId,
          number: 1
        }
      ]
    };
  }

  test('meldet die Überschreitung an beiden Trägern, obwohl sie verschiedene entryLinks nutzen', () => {
    const roster = createRoster({
      costLimit: 2000,
      selections: [
        createHeroCarryingBattleStandard('sel-1', 'link-1'),
        createHeroCarryingBattleStandard('sel-2', 'link-2')
      ]
    });

    const errors = validateRoster(roster, createSystemWithSharedBattleStandard());
    const battleStandardErrors = errors.filter(
      error => error.type === VIOLATION.entryMax && error.message.includes(EXPECTED_MESSAGE_FRAGMENT)
    );

    expect(battleStandardErrors).toHaveLength(2);
  });
});

describe('validateRoster — nicht mehr auflösbare Auswahlen', () => {
  // Issue 13/03: eine Auswahl, deren Katalogeintrag nicht mehr existiert (etwa nach
  // einem Katalog-Update), muss als Fehler auftauchen statt still mit 0 Punkten zu zählen.
  test('meldet unresolved-entry mit Auswahl-ID, Schweregrad und Namen', () => {
    const roster = createRoster({
      name: 'Ghost Roster',
      costLimit: 2000,
      selections: [
        {
          id: 'sel-ghost',
          selectionEntryId: 'unit-removed-by-catalog-update',
          name: 'Retired Champion',
          number: 1,
          category: CATEGORY_ID.hq
        }
      ]
    });

    const ghostErrors = validateRoster(roster, createGrimdarkSystem())
      .filter(error => error.type === VIOLATION.unresolvedEntry);

    expect(ghostErrors).toHaveLength(1);
    expect(ghostErrors[0].selectionId).toBe('sel-ghost');
    expect(ghostErrors[0].severity).toBe('error');
    expect(ghostErrors[0].message).toContain('Retired Champion');
  });

  test('meldet kein unresolved-entry, solange jede Auswahl noch auflösbar ist', () => {
    const errors = validateRoster(createValidRoster(), createGrimdarkSystem());

    expect(errors.some(error => error.type === VIOLATION.unresolvedEntry)).toBe(false);
  });
});
